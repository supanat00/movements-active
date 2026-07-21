'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
  PoseLandmarker,
  ImageSegmenter,
  FilesetResolver,
  ImageSegmenterResult,
} from '@mediapipe/tasks-vision';

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

  const onPoseDetectedRef      = useRef(onPoseDetected);
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  const staticBgImgRef   = useRef<HTMLImageElement | null>(null);

  // Keep state refs in sync for render loop
  const uiStateRef = useRef({ gamePoints, globalTime, currentExercise, gameStatus, countdownValue, removeBackground, bgType, bgVideoUrl });

  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    onPoseDetectedRef.current      = onPoseDetected;
    onRecordingCompleteRef.current = onRecordingComplete;
    uiStateRef.current = { gamePoints, globalTime, currentExercise, gameStatus, countdownValue, removeBackground, bgType, bgVideoUrl };
  }, [onPoseDetected, onRecordingComplete, gamePoints, globalTime, currentExercise, gameStatus, countdownValue, removeBackground, bgType, bgVideoUrl]);

  // ── Init tasks-vision models and UI images ────────────────────────────────
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  
  useEffect(() => {
    if (bgType === 'image') {
      const img = new Image();
      img.src = '/game_bg.webp';
      if (img.complete) {
        staticBgImgRef.current = img;
      } else {
        img.onload = () => { staticBgImgRef.current = img; };
      }
    }
    
    const logo = new Image();
    logo.src = '/logo.webp';
    if (logo.complete) {
      logoImgRef.current = logo;
    } else {
      logo.onload = () => { logoImgRef.current = logo; };
    }
  }, [bgType]);

  // MediaRecorder logic based on gameStatus
  useEffect(() => {
    if (gameStatus === 'countdown' || gameStatus === 'playing') {
      if (canvasRef.current && !mediaRecorderRef.current) {
        // Record from the Canvas
        const videoStream = canvasRef.current.captureStream(30); // 30 FPS is usually more stable
        const combinedStream = videoStream;

        const preferredMime = 'video/webm;codecs=vp8';
        
        let recorderOptions: MediaRecorderOptions | undefined;
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported(preferredMime)) {
            recorderOptions = { mimeType: preferredMime, videoBitsPerSecond: 3000000 };
          } else if (MediaRecorder.isTypeSupported('video/webm')) {
            recorderOptions = { mimeType: 'video/webm', videoBitsPerSecond: 3000000 };
          } else if (MediaRecorder.isTypeSupported('video/mp4')) {
            recorderOptions = { mimeType: 'video/mp4', videoBitsPerSecond: 3000000 };
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

  // ── Init tasks-vision models ──────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        if (!alive) return;
        setIsReady(true);
        // Store resolvers in window for main effect
        (window as any).__visionFileset = vision;
      } catch (e) {
        console.error('FilesetResolver failed', e);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ── Core camera + render loop ──────────────────────────────────────────────
  useEffect(() => {
    if (!isReady || !videoRef.current) return;

    const vision = (window as any).__visionFileset;
    if (!vision) return;

    let poseLandmarker: PoseLandmarker | null = null;
    let imageSegmenter: ImageSegmenter | null = null;
    let animFrameId: number;
    let alive = true;

    const MODEL_BASE = 'https://storage.googleapis.com/mediapipe-models';

    const initModels = async () => {
      try {
        // Init both in parallel — use CPU as fallback if GPU fails
        const poseOptions = {
          baseOptions: {
            modelAssetPath: `${MODEL_BASE}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            delegate: 'GPU' as const,
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
            delegate: 'GPU' as const,
          },
          runningMode: 'VIDEO' as const,
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        };

        try {
          [poseLandmarker, imageSegmenter] = await Promise.all([
            PoseLandmarker.createFromOptions(vision, poseOptions),
            ImageSegmenter.createFromOptions(vision, segOptions),
          ]);
        } catch (gpuErr) {
          console.warn('GPU delegate failed, falling back to CPU:', gpuErr);
          [poseLandmarker, imageSegmenter] = await Promise.all([
            PoseLandmarker.createFromOptions(vision, { ...poseOptions, baseOptions: { ...poseOptions.baseOptions, delegate: 'CPU' } }),
            ImageSegmenter.createFromOptions(vision, { ...segOptions, baseOptions: { ...segOptions.baseOptions, delegate: 'CPU' } }),
          ]);
        }

        if (!alive) return;
        startCamera();
      } catch (err) {
        console.error('Model init failed:', err);
        // Still start camera so user sees themselves even without segmentation
        if (alive) startCamera();
      }
    };

    // ── rAF render loop ───────────────────────────────────────────────────────
    const renderFrame = () => {
      if (!alive) return;
      if (!videoRef.current || !canvasRef.current) {
        animFrameId = requestAnimationFrame(renderFrame);
        return;
      }

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) { animFrameId = requestAnimationFrame(renderFrame); return; }

          const TARGET_W = 720;
          const TARGET_H = 1280;
          if (canvasRef.current.width !== TARGET_W) {
            canvasRef.current.width = TARGET_W;
            canvasRef.current.height = TARGET_H;
          }

      const vW = videoRef.current.videoWidth;
      const vH = videoRef.current.videoHeight;
      if (!vW || !vH) { animFrameId = requestAnimationFrame(renderFrame); return; }

      const scale   = Math.max(TARGET_W / vW, TARGET_H / vH);
      const drawW   = vW * scale;
      const drawH   = vH * scale;
      const offsetX = (TARGET_W - drawW) / 2;
      const offsetY = (TARGET_H - drawH) / 2;

      const { gamePoints, globalTime, currentExercise, countdownValue, gameStatus: status, removeBackground, bgType } = uiStateRef.current;

      // ── 1. Always draw mirrored camera first (base layer / fallback) ─────────
      ctx.save();
      ctx.translate(TARGET_W, 0); ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, offsetX, offsetY, drawW, drawH);
      ctx.restore();

      // ── 2. If removeBackground: overlay synthetic bg + composited person ─────
      if (removeBackground) {
        // Draw the background
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

        // Overlay person on top of background using segmentation mask
        if (segMaskDataRef.current) {
          const maskSource = segMaskDataRef.current;
          
          if (maskSource.width > 0 && maskSource.height > 0) {
            if (!maskCanvasRef.current) maskCanvasRef.current = document.createElement('canvas');
            const mc = maskCanvasRef.current;
            if (mc.width !== TARGET_W || mc.height !== TARGET_H) { mc.width = TARGET_W; mc.height = TARGET_H; }
            const mCtx = mc.getContext('2d')!;
            
            mCtx.clearRect(0, 0, TARGET_W, TARGET_H);
            mCtx.save();
            mCtx.translate(TARGET_W, 0); mCtx.scale(-1, 1);
            mCtx.drawImage(maskSource, offsetX, offsetY, drawW, drawH);
            mCtx.restore();

            // Person canvas: mirrored video cut by blurred mask
            if (!offscreenRef.current) offscreenRef.current = document.createElement('canvas');
            const oc = offscreenRef.current;
            if (oc.width !== TARGET_W || oc.height !== TARGET_H) { oc.width = TARGET_W; oc.height = TARGET_H; }
            const oCtx = oc.getContext('2d')!;
            oCtx.clearRect(0, 0, TARGET_W, TARGET_H);
            oCtx.save();
            oCtx.translate(TARGET_W, 0); oCtx.scale(-1, 1);
            oCtx.drawImage(videoRef.current, offsetX, offsetY, drawW, drawH);
            oCtx.restore();
            oCtx.globalCompositeOperation = 'destination-in';
            oCtx.drawImage(mc, 0, 0);
            oCtx.globalCompositeOperation = 'source-over';

            ctx.drawImage(oc, 0, 0);
          }
        } else {
           // If mask is completely missing, draw the camera back on top as a fallback
           ctx.save();
           ctx.translate(TARGET_W, 0); ctx.scale(-1, 1);
           ctx.drawImage(videoRef.current, offsetX, offsetY, drawW, drawH);
           ctx.restore();
        }
      }

      // ── 3. HUD ───────────────────────────────────────────────────────────────
      if (status === 'countdown') {
        const cdValue = uiStateRef.current.countdownValue;
        if (cdValue !== undefined && cdValue !== null) {
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = 'italic 900 250px sans-serif';
          
          const text = cdValue > 0 ? cdValue.toString() : 'GO!';
          const x = TARGET_W / 2;
          const y = TARGET_H / 2;

          // Outline
          ctx.lineWidth = 15;
          ctx.strokeStyle = '#06b6d4'; // cyan-500
          ctx.strokeText(text, x, y);

          // Fill
          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, x, y);
          
          // Shadow/glow effect
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 20;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 10;
          ctx.fillText(text, x, y);

          ctx.restore();
        }
      }
      if (status === 'playing') {
        ctx.save();

        // 1. Top Left: SCORE
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 2;
        ctx.fillText('SCORE', 110, 55);

        ctx.font = 'italic 900 80px sans-serif';
        ctx.shadowColor = 'rgba(0,51,102,0.8)';
        ctx.shadowBlur = 12; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
        ctx.fillText(`${gamePoints}`, 110, 130);

        // 2. Top Center: LOGO
        if (logoImgRef.current) {
          const logoW = 180;
          const logoH = (logoImgRef.current.height / logoImgRef.current.width) * logoW;
          ctx.shadowColor = 'rgba(255,255,255,0.4)';
          ctx.shadowBlur = 10; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 4;
          ctx.drawImage(logoImgRef.current, (TARGET_W - logoW) / 2, 25, logoW, logoH);
        }

        // 3. Top Right: TIME (Glassmorphic digit boxes)
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 2;
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('TIME', TARGET_W - 110, 55);

        const secVal = Math.floor(Math.max(0, globalTime));
        const msVal = Math.floor(Math.max(0, (globalTime - secVal) * 100));
        const sStr = secVal.toString().padStart(2, '0');
        const msStr = msVal.toString().padStart(2, '0');
        const digits = [sStr[0], sStr[1], ':', msStr[0], msStr[1]];

        const startX = TARGET_W - 200;
        const startY = 70;
        let curX = startX;

        digits.forEach((d) => {
          if (d === ':') {
            ctx.font = 'bold 32px sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(':', curX + 6, startY + 32);
            curX += 14;
          } else {
            // Draw glass Box
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(curX, startY, 34, 46, 8);
            ctx.fill();
            ctx.stroke();

            // Digit text
            ctx.font = 'bold 30px sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(d, curX + 17, startY + 34);
            curX += 40;
          }
        });

        // 4. Exercise Banner (Below Logo)
        const getExName = (ex?: string) => {
          if (ex === 'squats') return 'สควอช';
          if (ex === 'high_knees') return 'วิ่งเข่าสูง';
          return 'กระโดดตบ';
        };
        const exBannerText = `${getExName(currentExercise)} ให้มากที่สุด`;
        ctx.font = 'italic 900 24px sans-serif';
        const textW = ctx.measureText(exBannerText).width;
        const bannerW = textW + 50;
        const bannerH = 46;
        const bannerX = (TARGET_W - bannerW) / 2;
        const bannerY = 120;

        // Draw Pill Gradient Background
        const pGrad = ctx.createLinearGradient(bannerX, 0, bannerX + bannerW, 0);
        pGrad.addColorStop(0, 'rgba(29, 78, 216, 0.6)');
        pGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.6)');
        pGrad.addColorStop(1, 'rgba(29, 78, 216, 0.6)');
        ctx.fillStyle = pGrad;
        ctx.strokeStyle = 'rgba(165, 243, 252, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 23);
        ctx.fill();
        ctx.stroke();

        // Banner Text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 4;
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

      animFrameId = requestAnimationFrame(renderFrame);
    };

    // ── Camera start ──────────────────────────────────────────────────────────
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (!videoRef.current || !alive) return;
        videoRef.current.srcObject = stream;
        const onLoaded = () => {
            videoRef.current?.play();

            // Wait for background image before signaling ready
            const checkReady = () => {
              if (bgType === 'image' && !staticBgImgRef.current) {
                setTimeout(checkReady, 100);
                return;
              }
              if (onSystemReady) onSystemReady();
            };
            checkReady();

            let lastPoseTime = -1;
            let lastSegTime  = -1;

            // ── Pose landmarks: per new video frame ──────────────────────────────
            const runPose = (nowMs: number) => {
              if (!alive || !videoRef.current || !poseLandmarker) return;
              if (nowMs !== lastPoseTime) {
                lastPoseTime = nowMs;
                const result = poseLandmarker.detectForVideo(videoRef.current, nowMs);
                if (result.landmarks?.[0]) {
                  const lms = result.landmarks[0];
                  const vW  = videoRef.current.videoWidth;
                  const vH  = videoRef.current.videoHeight;
                  const cW  = canvasRef.current?.clientWidth  || window.innerWidth;
                  const cH  = canvasRef.current?.clientHeight || window.innerHeight;
                  const sc  = Math.max(cW / vW, cH / vH);
                  const dW  = vW * sc; const dH = vH * sc;
                  const oX  = (cW - dW) / 2; const oY = (cH - dH) / 2;
                  const mapped = lms.map((lm: any) => ({
                    ...lm,
                    x: (oX + lm.x * dW) / cW,
                    y: (oY + lm.y * dH) / cH,
                  }));
                  onPoseDetectedRef.current(mapped);
                }
              }
              if ('requestVideoFrameCallback' in videoRef.current!) {
                (videoRef.current as any).requestVideoFrameCallback((_: any, m: any) => runPose(m.mediaTime * 1000));
              }
            };

            // ── Segmentation: per new video frame (GPU-accelerated) ──────────────
            const runSeg = (nowMs: number) => {
              if (!alive || !videoRef.current || !imageSegmenter) return;
              const { removeBackground } = uiStateRef.current;
              if (removeBackground && nowMs !== lastSegTime) {
                lastSegTime = nowMs;
                imageSegmenter.segmentForVideo(videoRef.current, nowMs, (result) => {
                  const confMask = result.confidenceMasks?.[0];
                  if (confMask) {
                    const w = confMask.width;
                    const h = confMask.height;
                    if (!segMaskDataRef.current) {
                      segMaskDataRef.current = document.createElement('canvas');
                    }
                    const tc = segMaskDataRef.current;
                    if (tc.width !== w || tc.height !== h) {
                      tc.width = w; tc.height = h;
                    }
                    const tCtx = tc.getContext('2d')!;
                    const imgData = tCtx.createImageData(w, h);
                    
                    try {
                      const f32 = confMask.getAsFloat32Array();
                      for (let i = 0; i < f32.length; i++) {
                        let v = f32[i];
                        if (v < 0.4) v = 0;
                        else if (v > 0.7) v = 1;
                        else v = (v - 0.4) / 0.3;
                        
                        const a = v * 255;
                        const idx = i * 4;
                        imgData.data[idx] = 255;
                        imgData.data[idx+1] = 255;
                        imgData.data[idx+2] = 255;
                        imgData.data[idx+3] = a;
                      }
                      tCtx.putImageData(imgData, 0, 0);
                    } catch (e) {
                      console.warn('MPMask getAsFloat32Array error:', e);
                    }
                    
                    confMask.close?.();
                  }
                });
              }
              if ('requestVideoFrameCallback' in videoRef.current!) {
                (videoRef.current as any).requestVideoFrameCallback((_: any, m: any) => runSeg(m.mediaTime * 1000));
              }
            };

            if ('requestVideoFrameCallback' in videoRef.current!) {
              (videoRef.current as any).requestVideoFrameCallback((_: any, m: any) => {
                runPose(m.mediaTime * 1000);
                runSeg(m.mediaTime * 1000);
              });
            }

            renderFrame();
          };

          if (videoRef.current.readyState >= 1) {
            onLoaded();
          } else {
            videoRef.current.onloadedmetadata = onLoaded;
          }
      } catch (err) {
        console.error('Camera error:', err);
      }
    };

    initModels().catch(console.error);

    return () => {
      alive = false;
      cancelAnimationFrame(animFrameId);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      poseLandmarker?.close();
      imageSegmenter?.close();
    };
  }, [isReady]);

  return (
    <div className="absolute inset-0 w-full h-full bg-black overflow-hidden">
      {!isReady && (
        <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center text-white z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mb-4" />
          <p className="text-sm font-semibold">Loading AR Camera...</p>
        </div>
      )}
      <video ref={videoRef} width={640} height={480} className="absolute top-0 left-0 w-1 h-1 opacity-0 pointer-events-none" playsInline autoPlay muted />
      {removeBackground && bgType === 'video' && bgVideoUrl && (
        <video ref={bgVideoRef} src={bgVideoUrl} width={640} height={480}
          className="absolute top-0 left-0 w-1 h-1 opacity-0 pointer-events-none"
          playsInline autoPlay loop muted crossOrigin="anonymous" />
      )}
      <canvas ref={canvasRef} width={720} height={1280} className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none" />
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
