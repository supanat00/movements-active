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
  gameStateRef: React.RefObject<{
    gamePoints: number;
    globalTime: number;
    currentExercise: 'jumping_jacks' | 'squats' | 'high_knees';
    countdownValue: number;
  }>;
  removeBackground?: boolean;
  bgType?: 'neon-grid' | 'synthwave' | 'video' | 'image';
  bgVideoUrl?: string | null;
  onSystemReady?: () => void;
}

function PoseTracker({
  onPoseDetected, gameStatus, onRecordingComplete,
  gameStateRef,
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
  const lastRawLandmarksRef = useRef<any[] | null>(null);
  const bfsQueueRef         = useRef<Int32Array | null>(null);
  const visitedRef          = useRef<Uint8Array | null>(null);
  const segVideoFrameRef    = useRef<HTMLCanvasElement | null>(null); // holds the video frame matching the current mask

  const onPoseDetectedRef      = useRef(onPoseDetected);
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  const staticBgImgRef   = useRef<HTMLImageElement | null>(null);

  // Keep state refs in sync for render loop (only track slow-changing variables here)
  const uiStateRef = useRef({ gameStatus, removeBackground, bgType, bgVideoUrl });

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
    uiStateRef.current = { gameStatus, removeBackground, bgType, bgVideoUrl };
  }, [onPoseDetected, onRecordingComplete, gameStatus, removeBackground, bgType, bgVideoUrl]);

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
    
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const FRAME_MS = 0; // Run at 60 FPS (no cap)
    let lastRenderTime = 0;
    
    // Performance Throttling Settings
    let lastPoseRunTime = 0;
    let lastSegRunTime = 0;
    const poseThrottleMs = 0;  // Run pose detection at 60 FPS (no cap)
    let segThrottleMs = 0;  // Run segmentation at 60 FPS (no cap)

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
      if (!alive || !videoRef.current) return false;

      const tryMediaDevices = async (constraints: MediaStreamConstraints) => {
        try {
          return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
          return null;
        }
      };

      try {
        let stream: MediaStream | null = null;
        
        // Try 1: Standard HD (1280x720)
        stream = await tryMediaDevices({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          }
        });
        
        // Try 2: Full HD (1920x1080)
        if (!stream) {
          stream = await tryMediaDevices({
            video: {
              facingMode: 'user',
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 }
            }
          });
        }
        
        // Try 3: Standard SD (640x480)
        if (!stream) {
          stream = await tryMediaDevices({
            video: {
              facingMode: 'user',
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 30 }
            }
          });
        }
        
        // Try 4: Generic facing user fallback
        if (!stream) {
          stream = await tryMediaDevices({
            video: { facingMode: 'user' }
          });
        }

        if (!stream) {
          throw new Error('Cannot access front camera');
        }

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

      // Force CPU delegate on mobile for 100% reliable execution (bypasses WebGL/GPU texture rendering bugs that cause segmentation to fail silently)
      const segLoader = isMobile
        ? ImageSegmenter.createFromOptions(visionObj, { ...segOptions, baseOptions: { ...segOptions.baseOptions, delegate: 'CPU' as const } })
            .then(instance => ({ instance, delegate: 'CPU' as const }))
        : createAutoModel(segOptions, (opts) => ImageSegmenter.createFromOptions(visionObj, opts), 'ImageSegmenter');

      segLoader.then(res => {
        if (!alive) return;
        imageSegmenter = res.instance;
        segDelegate    = res.delegate;
        
        // Dynamically adjust throttling speed depending on the active delegate:
        if (res.delegate === 'GPU') {
          segThrottleMs = 0; // GPU: Run at 60 FPS (no cap)
        } else {
          segThrottleMs = isMobile ? 33 : 16; // CPU: 30 FPS on mobile (33ms), 60 FPS on desktop (16ms) to prevent freezing
        }
        
        console.info(`[PoseTracker] ImageSegmenter ready in background (${res.delegate}) - Throttle: ${segThrottleMs}ms`);
      }).catch(e => {
        console.warn('[PoseTracker] ImageSegmenter background load failed:', e);
      });
    };

    // ── Helper to calculate scale and offset to cover the screen ─────────
    const getScaleParams = (vW: number, vH: number, targetW: number, targetH: number) => {
      const scale = Math.max(targetW / vW, targetH / vH);
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
          lastRawLandmarksRef.current = lms; // Store raw landmarks for segmenter seeds
          
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
        const vW = videoRef.current.videoWidth;
        const vH = videoRef.current.videoHeight;
        if (vW === 0 || vH === 0) return;

        // Capture the video frame at the exact moment we start the segmentation
        if (!offscreenRef.current) offscreenRef.current = document.createElement('canvas');
        const offCanvas = offscreenRef.current;
        if (offCanvas.width !== vW || offCanvas.height !== vH) {
          offCanvas.width = vW;
          offCanvas.height = vH;
        }
        const offCtx = offCanvas.getContext('2d')!;
        offCtx.drawImage(videoRef.current, 0, 0, vW, vH);

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

              const size = w * h;
              // Re-use BFS buffers (avoid GC allocations)
              if (!bfsQueueRef.current || bfsQueueRef.current.length < size) {
                bfsQueueRef.current = new Int32Array(size);
              }
              if (!visitedRef.current || visitedRef.current.length < size) {
                visitedRef.current = new Uint8Array(size);
              }

              const queue = bfsQueueRef.current;
              const visited = visitedRef.current;
              visited.fill(0);

              let head = 0;
              let tail = 0;

              // Seed with coordinates of player's main body parts
              if (lastRawLandmarksRef.current) {
                const lms = lastRawLandmarksRef.current;
                const seedIndices = [0, 11, 12, 13, 14, 23, 24, 25, 26]; // Torso, head, arms, legs
                for (const idx of seedIndices) {
                  const lm = lms[idx];
                  if (lm && lm.visibility > 0.5) {
                    const sx = Math.floor(lm.x * w);
                    const sy = Math.floor(lm.y * h);
                    if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
                      const pixelIdx = sy * w + sx;
                      if (maskBytes[pixelIdx] < 0.5 && visited[pixelIdx] === 0) {
                        visited[pixelIdx] = 1;
                        queue[tail++] = (sy << 16) | sx; // Pack (y, x) into integer
                      }
                    }
                  }
                }
              }

              // Run BFS to extract only the connected component of the main player
              if (tail > 0) {
                while (head < tail) {
                  const curr = queue[head++];
                  const cx = curr & 0xffff;  // Unpack x
                  const cy = curr >> 16;     // Unpack y
                  const currIdx = cy * w + cx;

                  // Left
                  if (cx > 0) {
                    const nIdx = currIdx - 1;
                    if (visited[nIdx] === 0 && maskBytes[nIdx] < 0.5) {
                      visited[nIdx] = 1;
                      queue[tail++] = (cy << 16) | (cx - 1);
                    }
                  }
                  // Right
                  if (cx < w - 1) {
                    const nIdx = currIdx + 1;
                    if (visited[nIdx] === 0 && maskBytes[nIdx] < 0.5) {
                      visited[nIdx] = 1;
                      queue[tail++] = (cy << 16) | (cx + 1);
                    }
                  }
                  // Up
                  if (cy > 0) {
                    const nIdx = currIdx - w;
                    if (visited[nIdx] === 0 && maskBytes[nIdx] < 0.5) {
                      visited[nIdx] = 1;
                      queue[tail++] = ((cy - 1) << 16) | cx;
                    }
                  }
                  // Down
                  if (cy < h - 1) {
                    const nIdx = currIdx + w;
                    if (visited[nIdx] === 0 && maskBytes[nIdx] < 0.5) {
                      visited[nIdx] = 1;
                      queue[tail++] = ((cy + 1) << 16) | cx;
                    }
                  }
                }
              }

              const buf32 = new Uint32Array(imgData.data.buffer);
              let personPixels = 0;
              for (let i = 0; i < size; i++) {
                // If tail is 0 (landmarks not detected yet), fallback to original category mask 
                // so the user is drawn before landmarks capture onto the body.
                const isMainPerson = tail > 0 ? (visited[i] === 1) : (maskBytes[i] < 0.5);
                if (isMainPerson) personPixels++;
                buf32[i] = isMainPerson ? 0xffffffff : 0x00000000;
              }

              tCtx.putImageData(imgData, 0, 0);
              hasValidSegMaskRef.current = personPixels > 10;

              // Copy the captured offscreen video frame to segVideoFrameRef if mask is valid
              if (hasValidSegMaskRef.current) {
                if (!segVideoFrameRef.current) segVideoFrameRef.current = document.createElement('canvas');
                const sv = segVideoFrameRef.current;
                if (sv.width !== vW || sv.height !== vH) {
                  sv.width = vW;
                  sv.height = vH;
                }
                const svCtx = sv.getContext('2d')!;
                svCtx.drawImage(offCanvas, 0, 0, vW, vH);
              }
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

    let hasClearedCanvasOnce = false;

    // ── Master rAF loop ──────────────────────────────────────────────────
    const renderFrame = (timestamp: number) => {
      if (!alive) return;

      const { gameStatus: status } = uiStateRef.current;
      const isLoopNeeded = status === 'tutorial' || status === 'countdown' || status === 'playing' || status === 'ending';

      if (!isLoopNeeded) {
        // Skip AI & drawing entirely during idle / preview / win / lose states
        if (!hasClearedCanvasOnce && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          hasClearedCanvasOnce = true;
        }
        animFrameId = requestAnimationFrame(renderFrame);
        return;
      }

      hasClearedCanvasOnce = false; // Reset to allow clearing next time we exit active state

      // Limit rendering loop max FPS
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

        // Run Pose detection independently on every render frame (subject to its throttle)
        // We only need pose detection during play, or when background removal is active (to get BFS seeds)
        const needPose = status === 'playing' || (removeBackground && (status === 'countdown' || status === 'tutorial'));
        if (needPose && (now - lastPoseRunTime >= poseThrottleMs)) {
          runPose(timestamp);
          lastPoseRunTime = now;
        }

        // Run Segmentation independently (subject to its delegate-based throttle)
        if (removeBackground && (now - lastSegRunTime >= segThrottleMs)) {
          runSeg(timestamp);
          lastSegRunTime = now;
        }

        const { drawW, drawH, offsetX, offsetY } = getScaleParams(vW, vH, TARGET_W, TARGET_H);

        const { bgType } = uiStateRef.current;
        const gState = gameStateRef.current;
        if (!gState) {
          animFrameId = requestAnimationFrame(renderFrame);
          return;
        }
        const { gamePoints, globalTime, currentExercise, countdownValue } = gState;

        // 1. Draw composite layers
        ctx.clearRect(0, 0, TARGET_W, TARGET_H);

        if (removeBackground && hasValidSegMaskRef.current && segMaskDataRef.current) {
          // Draw mask on main canvas first (mirrored)
          ctx.save();
          ctx.translate(TARGET_W, 0); ctx.scale(-1, 1);
          
          // Apply a light blur to the mask to feather the edges, making the cutout soft and natural like Google Meet
          ctx.filter = 'blur(4px)';
          ctx.drawImage(segMaskDataRef.current, offsetX, offsetY, drawW, drawH);
          
          // Crop source to keep only the mask shape
          ctx.filter = 'none';
          ctx.globalCompositeOperation = 'source-in';
          // Draw camera feed (synchronized with the mask frame to eliminate lagging cutout edges)
          ctx.drawImage(segVideoFrameRef.current || videoRef.current, offsetX, offsetY, drawW, drawH);
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
          const cdValue = countdownValue;
          if (cdValue !== undefined && cdValue !== null) {
            ctx.save();
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = 'italic 900 250px "Kanit", sans-serif';
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
          ctx.font = 'bold 22px "Kanit", sans-serif';
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 4; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 2;
          ctx.fillText('SCORE', 110, 55);
          ctx.font = 'italic 900 80px "Kanit", sans-serif';
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
          ctx.font = 'bold 22px "Kanit", sans-serif';
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
              ctx.font = 'bold 32px "Kanit", sans-serif';
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
              ctx.font = 'bold 30px "Kanit", sans-serif';
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
          ctx.font = 'italic 900 24px "Kanit", sans-serif';
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
          ctx.textAlign = 'center'; ctx.font = 'bold 120px "Kanit", sans-serif';
          ctx.fillText('🏆', TARGET_W / 2, TARGET_H / 2 - 80);
          ctx.fillStyle = '#facc15'; ctx.font = 'bold 80px "Kanit", sans-serif';
          ctx.fillText(`SCORE: ${gamePoints}`, TARGET_W / 2, TARGET_H / 2 + 60);
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

export default React.memo(PoseTracker);

// ── Background Drawing Helpers ──────────────────────────────────────────────────
let gridOffset = 0;
const drawNeonGridBg = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0f051d'); g.addColorStop(1, '#05010a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

  const hz = h * 0.45;
  
  // 1. Batch Vertical Lines with shadowBlur (glow)
  ctx.save();
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 14; i++) {
    const xT = (w / 14) * i;
    ctx.moveTo(xT, hz);
    ctx.lineTo(w / 2 + (xT - w / 2) * 4, h);
  }
  ctx.stroke();
  ctx.restore();

  // 2. Draw Horizontal Lines without shadowBlur (extremely fast)
  gridOffset = (gridOffset + 3) % 40;
  ctx.save();
  ctx.lineWidth = 2;
  for (let y = hz; y < h; y += 40) {
    const ay = y + gridOffset;
    const alpha = Math.min(1, (ay - hz) / (h - hz));
    ctx.strokeStyle = `rgba(6,182,212,${alpha * 0.7})`;
    ctx.beginPath();
    ctx.moveTo(0, ay);
    ctx.lineTo(w, ay);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Batch particles
  const t = Date.now() * 0.001;
  ctx.save();
  ctx.fillStyle = 'rgba(236,72,153,0.6)';
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const px = (Math.sin(i * 123 + t) * 0.5 + 0.5) * w;
    const py = hz + ((i * 59 + t * 60) % (h - hz));
    const sz = (1 - (py - hz) / (h - hz)) * 8 + 3;
    ctx.moveTo(px + sz, py);
    ctx.arc(px, py, sz, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
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

  // 1. Batch Vertical Lines with shadowBlur
  ctx.save();
  ctx.shadowColor = '#ec4899';
  ctx.shadowBlur = 10;
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i <= 12; i++) {
    const xT = (w / 12) * i;
    ctx.moveTo(xT, hz);
    ctx.lineTo(w / 2 + (xT - w / 2) * 5, h);
  }
  ctx.stroke();
  ctx.restore();

  // 2. Draw Horizontal Lines without shadowBlur (extremely fast)
  synthwaveOffset = (synthwaveOffset + 4) % 50;
  ctx.save();
  ctx.lineWidth = 1.5;
  for (let y = hz; y < h; y += 35) {
    const ay = y + synthwaveOffset;
    const alpha = Math.min(1, (ay - hz) / (h - hz));
    ctx.strokeStyle = `rgba(236,72,153,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(0, ay);
    ctx.lineTo(w, ay);
    ctx.stroke();
  }
  ctx.restore();
};
