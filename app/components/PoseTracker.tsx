'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
  PoseLandmarker,
  ImageSegmenter,
  FilesetResolver,
  ImageSegmenterResult,
} from '@mediapipe/tasks-vision';

// Hook console.error to filter out false-positive Next.js dev overlay triggers from WebAssembly/TFLite stderr logs
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const msg = args[0];
    if (
      typeof msg === 'string' &&
      (msg.includes('XNNPACK') ||
        msg.includes('TensorFlow') ||
        msg.includes('Created TensorFlow Lite') ||
        msg.includes('INFO:'))
    ) {
      console.info('[TFLite Info]', ...args);
      return;
    }
    originalConsoleError(...args);
  };
}

interface PoseTrackerProps {
  onPoseDetected: (landmarks: any) => void;
  gameStatus: string;
  onRecordingComplete?: (blob: Blob) => void;
  gamePoints?: number;
  globalTime?: number;
  currentExercise?: string;
  countdownValue?: number;
  removeBackground?: boolean;
  bgType?: 'neon-grid' | 'synthwave' | 'video' | 'image';
  bgVideoUrl?: string | null;
  onSystemReady?: () => void;
}

export default function PoseTracker({
  onPoseDetected, gameStatus, onRecordingComplete,
  gamePoints = 0, globalTime = 0, currentExercise = '',  countdownValue = 0,
  removeBackground = false,
  bgType = 'synthwave',
  bgVideoUrl = null,
  onSystemReady,
}: PoseTrackerProps) {
  const videoRef         = useRef<HTMLVideoElement>(null);
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const bgVideoRef       = useRef<HTMLVideoElement>(null);
  const offscreenRef     = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef    = useRef<HTMLCanvasElement | null>(null);
  const segMaskDataRef   = useRef<HTMLCanvasElement | null>(null); // holds the converted mask canvas
  const imgDataRef       = useRef<ImageData | null>(null);         // reused ImageData (avoid GC churn)
  const hasValidSegMaskRef = useRef<boolean>(false);

  const onPoseDetectedRef      = useRef(onPoseDetected);
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  const staticBgImgRef   = useRef<HTMLImageElement | null>(null);

  // Keep state refs in sync for render loop
  const uiStateRef = useRef({ gamePoints, globalTime, currentExercise, gameStatus, countdownValue, removeBackground, bgType, bgVideoUrl });

  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [cameraError, setCameraError]   = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStatus,   setLoadStatus]   = useState('กำลังเชื่อมต่อระบบ AI...');
  const canvasHeightRef                 = useRef(1280);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const parent = canvasRef.current.parentElement;
        const pw = parent?.clientWidth || window.innerWidth || 360;
        const ph = parent?.clientHeight || window.innerHeight || 640;
        canvasHeightRef.current = Math.round(720 * (ph / pw));
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    onPoseDetectedRef.current      = onPoseDetected;
    onRecordingCompleteRef.current = onRecordingComplete;
    uiStateRef.current = { gamePoints, globalTime, currentExercise, gameStatus, countdownValue, removeBackground, bgType, bgVideoUrl };
  }, [onPoseDetected, onRecordingComplete, gamePoints, globalTime, currentExercise, gameStatus, countdownValue, removeBackground, bgType, bgVideoUrl]);

  const bgImageLoadedRef = useRef<boolean>(false);
  const logoImgRef       = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (bgType === 'image') {
      const img = new Image();
      img.src = '/game_bg.webp';
      img.onload = () => {
        staticBgImgRef.current = img;
        bgImageLoadedRef.current = true;
      };
      img.onerror = () => {
        console.warn('/game_bg.webp failed to load');
        bgImageLoadedRef.current = true; // prevent hanging
      };
      if (img.complete && img.naturalWidth > 0) {
        staticBgImgRef.current = img;
        bgImageLoadedRef.current = true;
      }
    } else {
      bgImageLoadedRef.current = true;
    }
    
    const logo = new Image();
    logo.src = '/logo.webp';
    logo.onload = () => { logoImgRef.current = logo; };
    logo.onerror = () => { console.warn('/logo.webp failed to load'); };
    if (logo.complete && logo.naturalWidth > 0) {
      logoImgRef.current = logo;
    }
  }, [bgType]);

  // MediaRecorder logic based on gameStatus
  useEffect(() => {
    if (gameStatus === 'countdown' || gameStatus === 'playing') {
      if (canvasRef.current && !mediaRecorderRef.current) {
        // Record from the Canvas
        const videoStream = canvasRef.current.captureStream(30); // 30 FPS is usually more stable
        const combinedStream = videoStream;

        // iOS-compatible MIME priority: mp4 first (iOS Safari), then webm (Chrome/Android)
        const mimePriority = [
          'video/mp4;codecs=avc1',
          'video/mp4',
          'video/webm;codecs=vp8',
          'video/webm',
        ];
        let recorderOptions: MediaRecorderOptions | undefined;
        if (typeof MediaRecorder !== 'undefined') {
          const supportedMime = mimePriority.find(m => MediaRecorder.isTypeSupported(m));
          if (supportedMime) {
            recorderOptions = { mimeType: supportedMime, videoBitsPerSecond: 2500000 };
          }
        }

        try {
          const recorder = recorderOptions ? new MediaRecorder(combinedStream, recorderOptions) : new MediaRecorder(combinedStream);
          mediaRecorderRef.current = recorder;
        } catch (e) {
          try {
            const recorder = new MediaRecorder(combinedStream);
            mediaRecorderRef.current = recorder;
          } catch (e2) {
            console.error('[MediaRecorder] Fallback creation failed:', e2);
          }
        }

        if (mediaRecorderRef.current) {
          const recorder = mediaRecorderRef.current;
          // Clean up mimeType (e.g. "video/webm;codecs=vp8,opus" -> "video/webm")
          // This prevents the <video> element from throwing NotSupportedError
          const activeMimeType = (recorder.mimeType || 'video/webm').split(';')[0];

          recordedChunksRef.current = [];

          recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              recordedChunksRef.current.push(event.data);
            }
          };

          recorder.onstop = () => {
            if (recordedChunksRef.current.length > 0) {
              const blob = new Blob(recordedChunksRef.current, { type: activeMimeType });
              console.log('[MediaRecorder] Created blob size:', blob.size, 'type:', activeMimeType);
              if (onRecordingCompleteRef.current) {
                onRecordingCompleteRef.current(blob);
              }
            } else {
              console.warn('[MediaRecorder] No chunks recorded!');
            }
            recordedChunksRef.current = [];
          };

          // Removing timeslice (1000) makes it fire one large chunk at the end, 
          // which is much more reliable across different browsers.
          recorder.start();
        }
      }
    } else if (gameStatus === 'preview' || gameStatus === 'win' || gameStatus === 'lose' || gameStatus === 'idle') {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
    }
  }, [gameStatus]);

  // ── Background video sync ─────────────────────────────────────────────────
  useEffect(() => {
    if (removeBackground && bgType === 'video' && bgVideoRef.current) {
      if (gameStatus === 'playing' || gameStatus === 'countdown') {
        bgVideoRef.current.play().catch(() => {});
      } else {
        bgVideoRef.current.pause();
      }
    }
  }, [gameStatus, removeBackground, bgType, bgVideoUrl]);

  // ── Init camera & models in parallel ─────────────────────────────────────
  useEffect(() => {
    let poseLandmarker: PoseLandmarker | null = null;
    let imageSegmenter: ImageSegmenter | null = null;
    let poseDelegate: 'GPU' | 'CPU' = 'GPU';
    let segDelegate:  'GPU' | 'CPU' = 'GPU';

    let animFrameId: number;
    let alive = true;
    let frameCount = 0;
    
    // Debug variables
    let lastFpsTime = 0;
    let fpsCount = 0;
    let currentFps = 0;

    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const FRAME_MS = isMobile ? 33 : 0; // ~30fps throttle on mobile for performance
    let lastRenderTime = 0;
    
    // Performance Throttling Settings
    let lastPoseRunTime = 0;
    let lastSegRunTime = 0;
    const POSE_THROTTLE_MS = isMobile ? 33 : 0;  // 30 FPS on mobile, run every frame on desktop
    const SEG_THROTTLE_MS = isMobile ? 33 : 0;   // 30 FPS on mobile, run every frame on desktop for perfect mask alignment

    const MODEL_BASE = 'https://storage.googleapis.com/mediapipe-models';

    // ── Helper to automatically try GPU first, then fallback to CPU ──────
    const createAutoModel = async <T,>(
      baseOptions: any,
      createFn: (opts: any) => Promise<T>,
      modelName: string
    ): Promise<{ instance: T; delegate: 'GPU' | 'CPU' }> => {
      // 1. Try GPU
      try {
        const gpuOpts = { ...baseOptions, baseOptions: { ...baseOptions.baseOptions, delegate: 'GPU' as const } };
        const instance = await createFn(gpuOpts);
        console.info(`[PoseTracker] ${modelName} auto-selected: GPU`);
        return { instance, delegate: 'GPU' };
      } catch (gpuErr: any) {
        console.warn(`[PoseTracker] ${modelName} GPU failed (${gpuErr?.message || gpuErr}), auto-switching to CPU...`);
      }
      // 2. Fallback CPU
      const cpuOpts = { ...baseOptions, baseOptions: { ...baseOptions.baseOptions, delegate: 'CPU' as const } };
      const instance = await createFn(cpuOpts);
      console.info(`[PoseTracker] ${modelName} auto-selected: CPU`);
      return { instance, delegate: 'CPU' };
    };

    // ── Camera start ──────────────────────────────────────────────────────────
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width:  { ideal: 1080 },
            height: { ideal: 1920 },
            aspectRatio: { ideal: 9/16 },
            frameRate: { ideal: 30 }
          }
        });
        if (!videoRef.current || !alive) {
          stream.getTracks().forEach(t => t.stop());
          return false;
        }
        
        videoRef.current.srcObject = stream;
        // Call play immediately for Safari / Mobile WebKit compatibility
        videoRef.current.play().catch(err => console.warn('Video play catch:', err));

        return new Promise<boolean>((resolve) => {
          const signalReady = () => {
            resolve(true);
          };

          if (videoRef.current && videoRef.current.readyState >= 1) {
            signalReady();
          } else if (videoRef.current) {
            videoRef.current.onloadedmetadata = signalReady;
            videoRef.current.onloadeddata = signalReady;
          }
          setTimeout(() => resolve(true), 800); // Fallback guarantee
        });
      } catch (err: any) {
        console.error('Camera error:', err);
        throw err;
      }
    };

    const initModels = async () => {
      const poseOptions = {
        baseOptions: {
          modelAssetPath: `${MODEL_BASE}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
        },
        runningMode: 'VIDEO' as const,
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      };

      const segOptions = {
        baseOptions: {
          modelAssetPath: `${MODEL_BASE}/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite`,
        },
        runningMode: 'VIDEO' as const,
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      };

      // ── 1. Load FilesetResolver first (sequential start) ───────────────────
      setLoadStatus('กำลังโหลด AI Runtime...');
      setLoadProgress(10);
      const visionObj = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
      if (!alive) return;

      setLoadStatus('กำลังโหลดระบบตรวจจับท่าทาง...');
      setLoadProgress(30);

      // ── 2. Load PoseLandmarker model ─────────────────────────
      try {
        const res = await createAutoModel(
          poseOptions,
          (opts) => PoseLandmarker.createFromOptions(visionObj, opts),
          'PoseLandmarker'
        );
        poseLandmarker = res.instance;
        poseDelegate   = res.delegate;
      } catch (e) {
        console.error('PoseLandmarker init failed:', e);
        throw e;
      }
      if (!alive) return;
      
      setLoadProgress(70);

      // ── 3. Load optional ImageSegmenter in background (non-blocking) ──
      const segLoader = createAutoModel(segOptions, (opts) => ImageSegmenter.createFromOptions(visionObj, opts), 'ImageSegmenter');

      segLoader.then(res => {
        if (!alive) return;
        imageSegmenter = res.instance;
        segDelegate    = res.delegate;
        console.info(`[PoseTracker] ImageSegmenter ready in background (${res.delegate})`);
      }).catch(e => {
        console.warn('[PoseTracker] ImageSegmenter background load failed:', e);
      });
    };

    // ── Helper to calculate scale and offset with a zoom limit ───────────
    const getScaleParams = (vW: number, vH: number, targetW: number, targetH: number) => {
      let scale = Math.max(targetW / vW, targetH / vH);
      
      // Cap scale for landscape streams drawn on portrait canvas to avoid excessive digital zoom
      if (vW > vH && targetH > targetW) {
        const maxAllowedScale = (targetW / vW) * 1.5;
        if (scale > maxAllowedScale) {
          scale = maxAllowedScale;
        }
      }
      
      const drawW   = vW * scale;
      const drawH   = vH * scale;
      const offsetX = (targetW - drawW) / 2;
      const offsetY = (targetH - drawH) / 2;
      return { scale, drawW, drawH, offsetX, offsetY };
    };

    // ── Helper functions for AI execution ──────────────────────────────
    const runPose = (nowMs: number) => {
      if (!alive || !videoRef.current || !poseLandmarker) return;
      try {
        const result = poseLandmarker.detectForVideo(videoRef.current, nowMs);
        if (result.landmarks?.[0]) {
          const lms = result.landmarks[0];
          const vW  = videoRef.current.videoWidth;
          const vH  = videoRef.current.videoHeight;
          const cW  = canvasRef.current?.clientWidth  || window.innerWidth;
          const cH  = canvasRef.current?.clientHeight || window.innerHeight;
          
          const { drawW: dW, drawH: dH, offsetX: oX, offsetY: oY } = getScaleParams(vW, vH, cW, cH);

          // Use cH as the common divisor for both x and y to maintain 1:1 aspect ratio (undistorted)
          const mapped = lms.map((lm: any) => ({
            ...lm,
            x: (oX + lm.x * dW) / cH,
            y: (oY + lm.y * dH) / cH,
          }));
          onPoseDetectedRef.current(mapped);
        }
      } catch (e) {
        // Guard against transient frame errors
      }
    };

    const runSeg = (nowMs: number) => {
      if (!alive || !videoRef.current || !imageSegmenter) return;
      const { removeBackground } = uiStateRef.current;
      if (!removeBackground) return;
      try {
        imageSegmenter.segmentForVideo(videoRef.current, nowMs, (result) => {
          const categoryMask = result.categoryMask || result.confidenceMasks?.[0];
          if (categoryMask) {
            const w = categoryMask.width;
            const h = categoryMask.height;
            if (!segMaskDataRef.current) segMaskDataRef.current = document.createElement('canvas');
            const tc = segMaskDataRef.current;
            if (tc.width !== w || tc.height !== h) { tc.width = w; tc.height = h; }
            const tCtx = tc.getContext('2d')!;
            if (!imgDataRef.current || imgDataRef.current.width !== w || imgDataRef.current.height !== h) {
              imgDataRef.current = tCtx.createImageData(w, h);
            }
            const imgData = imgDataRef.current;
            try {
              let maskBytes: Uint8Array | Float32Array;
              if ('getAsUint8Array' in categoryMask) {
                maskBytes = categoryMask.getAsUint8Array();
              } else {
                maskBytes = (categoryMask as any).getAsFloat32Array();
              }
              const buf32 = new Uint32Array(imgData.data.buffer);
              let personPixels = 0;
              for (let i = 0; i < maskBytes.length; i++) {
                const isPerson = maskBytes[i] < 0.5;
                if (isPerson) personPixels++;
                // 0xffffffff is white (RGBA 255, 255, 255, 255) in little-endian systems
                // 0x00000000 is transparent
                buf32[i] = isPerson ? 0xffffffff : 0x00000000;
              }
              tCtx.putImageData(imgData, 0, 0);
              hasValidSegMaskRef.current = personPixels > 10;
            } catch (e) {
              console.warn('MPMask error:', e);
            }
            categoryMask.close?.();
          }
        });
      } catch (e) {
        console.error('[runSeg] Error during segmentation execution:', e);
      }
    };

    // ── Master rAF loop ──────────────────────────────────────────────────
    const renderFrame = (timestamp: number) => {
      if (!alive) return;

      // 30fps cap on mobile to prevent GPU thermal throttling
      if (FRAME_MS > 0 && timestamp - lastRenderTime < FRAME_MS) {
        animFrameId = requestAnimationFrame(renderFrame);
        return;
      }
      lastRenderTime = timestamp;

      if (!videoRef.current || !canvasRef.current) {
        animFrameId = requestAnimationFrame(renderFrame);
        return;
      }

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) { animFrameId = requestAnimationFrame(renderFrame); return; }

      const TARGET_W = 720;
      const TARGET_H = canvasHeightRef.current;
      if (canvasRef.current.width !== TARGET_W || canvasRef.current.height !== TARGET_H) {
        canvasRef.current.width  = TARGET_W;
        canvasRef.current.height = TARGET_H;
      }

      const vW = videoRef.current.videoWidth;
      const vH = videoRef.current.videoHeight;
      if (vW > 0 && vH > 0 && videoRef.current.readyState >= 2) {
        const now = performance.now();
        const { removeBackground } = uiStateRef.current;

        // Stagger Pose detection and Segmentation to run on alternate frames.
        // This prevents CPU/GPU bottlenecks by never running both deep learning models in the same animation frame.
        if (removeBackground) {
          frameCount++;
          if (frameCount % 2 === 0) {
            if (now - lastPoseRunTime >= POSE_THROTTLE_MS) {
              runPose(timestamp);
              lastPoseRunTime = now;
            }
          } else {
            if (now - lastSegRunTime >= SEG_THROTTLE_MS) {
              runSeg(timestamp);
              lastSegRunTime = now;
            }
          }
        } else {
          // If background removal is disabled, only pose tracking is needed, run it directly
          if (now - lastPoseRunTime >= POSE_THROTTLE_MS) {
            runPose(timestamp);
            lastPoseRunTime = now;
          }
        }

        const { drawW, drawH, offsetX, offsetY } = getScaleParams(vW, vH, TARGET_W, TARGET_H);

        const { gamePoints, globalTime, currentExercise, countdownValue, gameStatus: status, bgType } = uiStateRef.current;

        // 1. Draw composite layers
        ctx.clearRect(0, 0, TARGET_W, TARGET_H);

        if (removeBackground && hasValidSegMaskRef.current && segMaskDataRef.current) {
          // Draw mask on main canvas first (mirrored)
          ctx.save();
          ctx.translate(TARGET_W, 0); ctx.scale(-1, 1);
          ctx.drawImage(segMaskDataRef.current, offsetX, offsetY, drawW, drawH);
          
          // Crop source to keep only the mask shape
          ctx.globalCompositeOperation = 'source-in';
          // Draw camera feed
          ctx.drawImage(videoRef.current, offsetX, offsetY, drawW, drawH);
          ctx.restore();

          // Draw background behind the person shape
          ctx.globalCompositeOperation = 'destination-over';
          
          const bgVideoEl = bgVideoRef.current;
          if (bgType === 'video' && bgVideoEl && bgVideoEl.readyState >= 2) {
            const bs = Math.max(TARGET_W / bgVideoEl.videoWidth, TARGET_H / bgVideoEl.videoHeight);
            ctx.drawImage(bgVideoEl,
              (TARGET_W - bgVideoEl.videoWidth * bs) / 2, (TARGET_H - bgVideoEl.videoHeight * bs) / 2,
              bgVideoEl.videoWidth * bs, bgVideoEl.videoHeight * bs);
          } else if (bgType === 'image' && staticBgImgRef.current) {
            const img = staticBgImgRef.current;
            const bs = Math.max(TARGET_W / img.width, TARGET_H / img.height);
            ctx.drawImage(img,
              (TARGET_W - img.width * bs) / 2, (TARGET_H - img.height * bs) / 2,
              img.width * bs, img.height * bs);
          } else if (bgType === 'synthwave') {
            drawSynthwaveBg(ctx, TARGET_W, TARGET_H);
          } else {
            drawNeonGridBg(ctx, TARGET_W, TARGET_H);
          }
          
          // Reset composite operation to default
          ctx.globalCompositeOperation = 'source-over';
        } else {
          // Draw normal camera feed if background removal is disabled or mask is not valid
          ctx.save();
          ctx.translate(TARGET_W, 0); ctx.scale(-1, 1);
          ctx.drawImage(videoRef.current, offsetX, offsetY, drawW, drawH);
          ctx.restore();
        }

        // 3. HUD Layer
        if (status === 'countdown') {
          const cdValue = uiStateRef.current.countdownValue;
          if (cdValue !== undefined && cdValue !== null) {
            ctx.save();
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = 'italic 900 250px sans-serif';
            const text = cdValue > 0 ? cdValue.toString() : 'GO!';
            const x = TARGET_W / 2; const y = TARGET_H / 2;
            ctx.lineWidth = 15; ctx.strokeStyle = '#06b6d4';
            ctx.strokeText(text, x, y);
            ctx.fillStyle = '#ffffff'; ctx.fillText(text, x, y);
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 20; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 10;
            ctx.fillText(text, x, y);
            ctx.restore();
          }
        }
        if (status === 'playing') {
          ctx.save();
          ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 22px sans-serif';
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 4; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 2;
          ctx.fillText('SCORE', 110, 55);
          ctx.font = 'italic 900 80px sans-serif';
          ctx.shadowColor = 'rgba(0,51,102,0.8)';
          ctx.shadowBlur = 12; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
          ctx.fillText(`${gamePoints}`, 110, 130);

          if (logoImgRef.current) {
            const logoW = 180;
            const logoH = (logoImgRef.current.height / logoImgRef.current.width) * logoW;
            ctx.shadowColor = 'rgba(255,255,255,0.4)';
            ctx.shadowBlur = 10; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 4;
            ctx.drawImage(logoImgRef.current, (TARGET_W - logoW) / 2, 25, logoW, logoH);
          }

          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 4; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 2;
          ctx.font = 'bold 22px sans-serif';
          ctx.fillText('TIME', TARGET_W - 110, 55);

          const secVal = Math.floor(Math.max(0, globalTime));
          const msVal  = Math.floor(Math.max(0, (globalTime - secVal) * 100));
          const sStr   = secVal.toString().padStart(2, '0');
          const msStr  = msVal.toString().padStart(2, '0');
          const digits = [sStr[0], sStr[1], ':', msStr[0], msStr[1]];
          const startX = TARGET_W - 200; const startY = 70;
          let curX = startX;
          digits.forEach((d) => {
            if (d === ':') {
              ctx.font = 'bold 32px sans-serif';
              ctx.fillStyle = '#ffffff';
              ctx.fillText(':', curX + 6, startY + 32);
              curX += 14;
            } else {
              ctx.fillStyle = 'rgba(255,255,255,0.25)';
              ctx.strokeStyle = 'rgba(255,255,255,0.5)';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.roundRect(curX, startY, 34, 46, 8);
              ctx.fill(); ctx.stroke();
              ctx.font = 'bold 30px sans-serif';
              ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
              ctx.fillText(d, curX + 17, startY + 34);
              curX += 40;
            }
          });

          const getExName = (ex?: string) => {
            if (ex === 'squats') return 'สควอช';
            if (ex === 'high_knees') return 'วิ่งเข่าสูง';
            return 'กระโดดตบ';
          };
          const exBannerText = `${getExName(currentExercise)} ให้มากที่สุด`;
          ctx.font = 'italic 900 24px sans-serif';
          const textW = ctx.measureText(exBannerText).width;
          const bannerW = textW + 50; const bannerH = 46;
          const bannerX = (TARGET_W - bannerW) / 2; const bannerY = 120;
          const pGrad = ctx.createLinearGradient(bannerX, 0, bannerX + bannerW, 0);
          pGrad.addColorStop(0, 'rgba(29, 78, 216, 0.6)');
          pGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.6)');
          pGrad.addColorStop(1, 'rgba(29, 78, 216, 0.6)');
          ctx.fillStyle = pGrad;
          ctx.strokeStyle = 'rgba(165, 243, 252, 0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 23);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4;
          ctx.fillText(exBannerText, TARGET_W / 2, bannerY + bannerH / 2);
          ctx.restore();
        }

        if (status === 'ending') {
          ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, TARGET_W, TARGET_H);
          ctx.textAlign = 'center'; ctx.font = 'bold 120px sans-serif';
          ctx.fillText('🏆', TARGET_W / 2, TARGET_H / 2 - 80);
          ctx.fillStyle = '#facc15'; ctx.font = 'bold 80px sans-serif';
          ctx.fillText(`SCORE: ${gamePoints}`, TARGET_W / 2, TARGET_H / 2 + 60);
        }

        // ── 4. Debug / FPS Overlay ───────────────────────────────────────
        // Calculate rendering frame rate
        fpsCount++;
        const nowMs = performance.now();
        if (nowMs - lastFpsTime >= 1000) {
          currentFps = fpsCount;
          fpsCount = 0;
          lastFpsTime = nowMs;
        }

        // Draw debug overlay when not actively playing/countdown (to keep HUD clean)
        if (status !== 'playing' && status !== 'countdown') {
          ctx.save();
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(20, TARGET_H - 130, 280, 100);
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(20, TARGET_H - 130, 280, 100);
          
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 13px monospace';
          ctx.fillText(`FPS: ${currentFps}`, 30, TARGET_H - 110);
          ctx.fillText(`Cam Stream: ${vW}x${vH}`, 30, TARGET_H - 92);
          ctx.fillText(`Drawing Canvas: ${TARGET_W}x${TARGET_H}`, 30, TARGET_H - 74);
          ctx.fillText(`AI: Pose(${poseDelegate}) | Seg(${segDelegate})`, 30, TARGET_H - 56);
          ctx.restore();
        }
      }

      animFrameId = requestAnimationFrame(renderFrame);
    };

    // ── Parallel system load initialization ───────────────────────────────
    setLoadStatus('กำลังเริ่มต้นระบบ...');
    setLoadProgress(5);

    Promise.all([startCamera(), initModels()])
      .then(() => {
        if (!alive) return;
        setLoadProgress(100);
        setLoadStatus('พร้อมแล้ว!');
        if (onSystemReady) onSystemReady();
        
        // Kickoff render loop
        animFrameId = requestAnimationFrame(renderFrame);
      })
      .catch((err) => {
        if (!alive) return;
        console.error('[System Init Failed]', err);
        let msg = 'ระบบไม่สามารถเปิดใช้งานได้\nกรุณาลองใหม่';
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          msg = 'กรุณาอนุญาตการใช้กล้อง\nในการตั้งค่าเบราว์เซอร์';
        } else if (err?.name === 'NotFoundError') {
          msg = 'ไม่พบกล้องในอุปกรณ์นี้';
        } else if (err?.name === 'NotReadableError') {
          msg = 'กล้องกำลังถูกใช้งานโดยแอปอื่น\nกรุณาปิดแอปอื่นก่อน';
        }
        setCameraError(msg);
      });

    return () => {
      alive = false;
      cancelAnimationFrame(animFrameId);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      poseLandmarker?.close();
      imageSegmenter?.close();
    };
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full bg-black overflow-hidden">
      {/* Preloading overlay — shown on top until 100% ready */}
      {loadProgress < 100 && !cameraError && (
        <div
          className="absolute inset-0 z-[100] flex flex-col items-center justify-center px-10"
          style={{ background: 'linear-gradient(160deg, #0a0a1a 0%, #0d1b2a 50%, #0a0a1a 100%)' }}
        >
          {/* Animated glow orb */}
          <div className="relative mb-8">
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-40 animate-pulse"
              style={{ background: 'radial-gradient(circle, #06b6d4, #3b82f6)', transform: 'scale(1.6)' }}
            />
            <img
              src="/logo.webp"
              alt="Logo"
              className="relative w-36 object-contain drop-shadow-lg"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-[260px]">
            <div className="flex justify-between items-center mb-2">
              <p className="text-white/60 text-xs font-medium tracking-wide">{loadStatus}</p>
              <p className="text-cyan-400 text-xs font-bold tabular-nums">{loadProgress}%</p>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${loadProgress}%`,
                  background: 'linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6)',
                }}
              />
            </div>
          </div>

          {/* Tip text */}
          <p className="mt-8 text-white/25 text-[11px] text-center leading-relaxed">
            ยืนห่างจากกล้อง 1.5–2 เมตร<br />ให้เห็นร่างกายเต็มตัว
          </p>
        </div>
      )}
      {/* Camera error state */}
      {cameraError && (
        <div className="absolute inset-0 bg-gray-950 flex flex-col items-center justify-center text-white z-[110] p-8">
          <div className="text-6xl mb-5">📷</div>
          <p className="text-center text-base font-semibold whitespace-pre-line leading-relaxed mb-6">{cameraError}</p>
          <button
            onClick={() => { setCameraError(null); window.location.reload(); }}
            className="px-8 py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-bold rounded-2xl active:scale-95 transition-transform text-base"
          >
            ลองใหม่อีกครั้ง
          </button>
        </div>
      )}
      <video ref={videoRef} width={640} height={480} className="absolute top-0 left-0 w-1 h-1 opacity-0 pointer-events-none" playsInline autoPlay muted />
      {removeBackground && bgType === 'video' && bgVideoUrl && (
        <video ref={bgVideoRef} src={bgVideoUrl} width={640} height={480}
          className="absolute top-0 left-0 w-1 h-1 opacity-0 pointer-events-none"
          playsInline autoPlay loop muted crossOrigin="anonymous" />
      )}
      <canvas ref={canvasRef} width={720} height={canvasHeightRef.current} className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none" />
    </div>
  );
}

// ── Background Drawing Helpers ──────────────────────────────────────────────────
let gridOffset = 0;
const drawNeonGridBg = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0f051d'); g.addColorStop(1, '#05010a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

  const hz = h * 0.45;
  ctx.save(); ctx.shadowColor = '#06b6d4'; ctx.shadowBlur = 12; ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 3;
  for (let i = 0; i <= 14; i++) {
    const xT = (w / 14) * i;
    ctx.beginPath(); ctx.moveTo(xT, hz); ctx.lineTo(w / 2 + (xT - w / 2) * 4, h); ctx.stroke();
  }
  gridOffset = (gridOffset + 3) % 40;
  for (let y = hz; y < h; y += 40) {
    const ay = y + gridOffset;
    const alpha = Math.min(1, (ay - hz) / (h - hz));
    ctx.strokeStyle = `rgba(6,182,212,${alpha * 0.7})`;
    ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(w, ay); ctx.stroke();
  }
  ctx.restore();
  const t = Date.now() * 0.001;
  ctx.fillStyle = 'rgba(236,72,153,0.6)';
  for (let i = 0; i < 12; i++) {
    const px = (Math.sin(i * 123 + t) * 0.5 + 0.5) * w;
    const py = hz + ((i * 59 + t * 60) % (h - hz));
    const sz = (1 - (py - hz) / (h - hz)) * 8 + 3;
    ctx.beginPath(); ctx.arc(px, py, sz, 0, Math.PI * 2); ctx.fill();
  }
};

let synthwaveOffset = 0;
const drawSynthwaveBg = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0d0221'); g.addColorStop(0.5, '#3b0d60'); g.addColorStop(1, '#02000a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

  const sx = w / 2, sy = h * 0.4, sr = 130;
  const sg = ctx.createLinearGradient(0, sy - sr, 0, sy + sr);
  sg.addColorStop(0, '#facc15'); sg.addColorStop(0.5, '#f43f5e'); sg.addColorStop(1, '#ec4899');
  ctx.save(); ctx.shadowColor = '#f43f5e'; ctx.shadowBlur = 35;
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, sr, Math.PI, 0); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#0d0221';
  for (let y = sy; y < sy + sr; y += 16) ctx.fillRect(sx - sr - 10, y, (sr + 10) * 2, Math.max(3, (y - sy) / 5));

  const hz = h * 0.5;
  synthwaveOffset = (synthwaveOffset + 4) % 50;
  ctx.save(); ctx.shadowColor = '#ec4899'; ctx.shadowBlur = 10; ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 2.5;
  for (let i = 0; i <= 12; i++) {
    const xT = (w / 12) * i;
    ctx.beginPath(); ctx.moveTo(xT, hz); ctx.lineTo(w / 2 + (xT - w / 2) * 5, h); ctx.stroke();
  }
  for (let y = hz; y < h; y += 35) {
    const ay = y + synthwaveOffset;
    const alpha = Math.min(1, (ay - hz) / (h - hz));
    ctx.strokeStyle = `rgba(236,72,153,${alpha})`;
    ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(w, ay); ctx.stroke();
  }
  ctx.restore();
};
