'use client';

import React, { useRef, useEffect, useState } from 'react';

interface PoseTrackerProps {
  onPoseDetected: (landmarks: any) => void;
  gameStatus: string;
  onRecordingComplete?: (blob: Blob) => void;
  gamePoints?: number;
  globalTime?: number;
  gameMode?: string;
  currentExercise?: string;
  countdownValue?: number;
  score?: number;
  targetScore?: number;
  timeRemaining?: number;
  exerciseTime?: number;
  comboCount?: number;
  floatingPoints?: { id: number, text: string, type: 'plus' | 'minus' | 'bonus' }[];
}

export default function PoseTracker({
  onPoseDetected, gameStatus, onRecordingComplete,
  gamePoints = 0, globalTime = 0, gameMode = 'normal', currentExercise = '', countdownValue = 3,
  score = 0, targetScore = 1, timeRemaining = 0, exerciseTime = 0, comboCount = 0, floatingPoints = []
}: PoseTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  // Store the latest callback in a ref to avoid re-triggering the camera setup when state changes
  const onPoseDetectedRef = useRef(onPoseDetected);
  const onRecordingCompleteRef = useRef(onRecordingComplete);
  const uiStateRef = useRef({ gamePoints, globalTime, gameMode, currentExercise, gameStatus, countdownValue, score, targetScore, timeRemaining, exerciseTime, comboCount, floatingPoints });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    onPoseDetectedRef.current = onPoseDetected;
    onRecordingCompleteRef.current = onRecordingComplete;
    uiStateRef.current = { gamePoints, globalTime, gameMode, currentExercise, gameStatus, countdownValue, score, targetScore, timeRemaining, exerciseTime, comboCount, floatingPoints };
  }, [onPoseDetected, onRecordingComplete, gamePoints, globalTime, gameMode, currentExercise, gameStatus, countdownValue, score, targetScore, timeRemaining, exerciseTime, comboCount, floatingPoints]);

  // MediaRecorder logic based on gameStatus
  useEffect(() => {
    if (gameStatus === 'countdown' || gameStatus === 'playing') {
      if (canvasRef.current && !mediaRecorderRef.current) {
        // Record from the Canvas at 30 FPS instead of the raw video
        const videoStream = canvasRef.current.captureStream(60);
        const audioStream = (window as any).gameAudioStream as MediaStream;

        let combinedStream = videoStream;
        if (audioStream) {
          const tracks = [...videoStream.getVideoTracks(), ...audioStream.getAudioTracks()];
          combinedStream = new MediaStream(tracks);
        }

        try {
          mediaRecorderRef.current = new MediaRecorder(combinedStream, {
            mimeType: 'video/webm;codecs=vp8,opus',
            videoBitsPerSecond: 8000000 // 8 Mbps for high quality
          });
        } catch (e) {
          try {
            mediaRecorderRef.current = new MediaRecorder(combinedStream, {
              mimeType: 'video/webm',
              videoBitsPerSecond: 8000000
            });
          } catch (e2) {
            mediaRecorderRef.current = new MediaRecorder(combinedStream, {
              videoBitsPerSecond: 8000000
            });
          }
        }

        recordedChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current.onstop = () => {
          if (recordedChunksRef.current.length > 0) {
            const mimeType = mediaRecorderRef.current?.mimeType || 'video/webm';
            const blob = new Blob(recordedChunksRef.current, { type: mimeType });
            if (onRecordingCompleteRef.current) {
              onRecordingCompleteRef.current(blob);
            }
          }
          recordedChunksRef.current = [];
        };

        mediaRecorderRef.current.start(1000);
      }
    } else if (gameStatus === 'preview' || gameStatus === 'win' || gameStatus === 'lose' || gameStatus === 'idle') {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
    }
  }, [gameStatus]);

  useEffect(() => {
    // Check if mediapipe is loaded from CDN
    const checkMediaPipe = setInterval(() => {
      if ((window as any).Pose) {
        clearInterval(checkMediaPipe);
        setIsReady(true);
      }
    }, 100);

    return () => clearInterval(checkMediaPipe);
  }, []);

  useEffect(() => {
    if (!isReady || !videoRef.current) return;

    const { Pose } = (window as any);

    const pose = new Pose({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 0, // 0=light (best for mobile/web AR), 1=full, 2=heavy
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults((results: any) => {
      if (results.poseLandmarks && videoRef.current) {
        const vW = videoRef.current.videoWidth;
        const vH = videoRef.current.videoHeight;
        const cW = window.innerWidth;
        const cH = window.innerHeight;

        // Calculate object-cover dimensions to map coordinates correctly
        const scale = Math.max(cW / vW, cH / vH);
        const drawW = vW * scale;
        const drawH = vH * scale;
        const offsetX = (cW - drawW) / 2;
        const offsetY = (cH - drawH) / 2;

        const mappedLandmarks = results.poseLandmarks.map((lm: any) => {
          const pixelX = offsetX + (lm.x * drawW);
          const pixelY = offsetY + (lm.y * drawH);

          return {
            ...lm,
            x: pixelX / cW,
            y: pixelY / cH
          };
        });

        // Pass transformed landmarks up
        onPoseDetectedRef.current(mappedLandmarks);
      }
    });

    let animationFrameId: number;
    let isStreamActive = true;
    let isProcessingPose = false;
    let lastPoseTime = 0;

    // Native Camera System for HD/FullHD
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user'
          }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            // Start the processing loop
            processVideo();
          };
        }
      } catch (err) {
        console.error("Error accessing native camera: ", err);
      }
    };

    const processVideo = async () => {
      if (!isStreamActive || !videoRef.current) return;

      // 1. Draw to canvas as fast as possible for smooth recording
      if (canvasRef.current && videoRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          const TARGET_W = 720;
          const TARGET_H = 1280;
          if (canvasRef.current.width !== TARGET_W) {
            canvasRef.current.width = TARGET_W;
            canvasRef.current.height = TARGET_H;
          }

          const vW = videoRef.current.videoWidth;
          const vH = videoRef.current.videoHeight;
          const scale = Math.max(TARGET_W / vW, TARGET_H / vH);
          const drawW = vW * scale;
          const drawH = vH * scale;
          const offsetX = (TARGET_W - drawW) / 2;
          const offsetY = (TARGET_H - drawH) / 2;

          // Draw video frame (object-cover crop)
          ctx.save();
          ctx.translate(canvasRef.current.width, 0); // Mirror horizontally
          ctx.scale(-1, 1);
          ctx.drawImage(videoRef.current, offsetX, offsetY, drawW, drawH);
          ctx.restore();

          // Get current UI states
          const { gamePoints, globalTime, gameStatus: status, countdownValue, score, targetScore, timeRemaining, exerciseTime, comboCount, gameMode, currentExercise, floatingPoints } = uiStateRef.current;

          if (status === 'countdown') {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 90px sans-serif';
            ctx.fillText('เตรียมตัว!', canvasRef.current.width / 2, canvasRef.current.height / 2 - 120);

            ctx.fillStyle = '#22c55e';
            ctx.font = '900 230px sans-serif';
            ctx.fillText(`${countdownValue}`, canvasRef.current.width / 2, canvasRef.current.height / 2 + 100);
          }

          if (status === 'playing') {
            const drawRoundRect = (x: number, y: number, w: number, h: number, radius: number, fill?: string, stroke?: string) => {
              ctx.beginPath();
              ctx.roundRect(x, y, w, h, radius);
              if (fill) { ctx.fillStyle = fill; ctx.fill(); }
              if (stroke) { ctx.lineWidth = 4; ctx.strokeStyle = stroke; ctx.stroke(); }
            };

            const cleanPercentage = Math.min(((score || 0) / (targetScore || 1)) * 100, 100);

            if (gameMode === 'score') {
              // Top Left Score
              drawRoundRect(34, 46, 200, 120, 25, 'rgba(0,0,0,0.3)'); // fake shadow
              drawRoundRect(30, 40, 200, 120, 25, 'rgba(17,24,39,0.95)', '#facc15');
              ctx.fillStyle = '#facc15';
              ctx.font = 'bold 20px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText('SCORE', 130, 75);
              ctx.fillStyle = '#ffffff';
              ctx.font = '900 65px sans-serif';
              ctx.fillText(`${gamePoints || 0}`, 130, 140);

              // Top Right Time
              drawRoundRect(720 - 230 + 5, 40 + 10, 200, 120, 25, 'rgba(0,0,0,0.15)'); // fake shadow
              drawRoundRect(720 - 230, 40, 200, 120, 25, 'rgba(255,255,255,0.98)', '#f3f4f6');
              ctx.fillStyle = '#6b7280';
              ctx.font = 'bold 20px sans-serif';
              ctx.fillText('TIME LEFT', 720 - 130, 75);
              ctx.fillStyle = '#dc2626';
              ctx.font = '900 65px sans-serif';
              ctx.fillText(`${Math.ceil(globalTime || 0)}s`, 720 - 130, 140);
            } else {
              // Top Center Time (Normal)
              drawRoundRect(720 / 2 - 120 + 5, 40 + 10, 240, 90, 45, 'rgba(0,0,0,0.15)'); // fake shadow
              drawRoundRect(720 / 2 - 120, 40, 240, 90, 45, 'rgba(255,255,255,0.95)', '#f3f4f6');
              ctx.fillStyle = '#dc2626';
              ctx.font = '900 54px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(`${Math.ceil(timeRemaining || 0)}s`, 720 / 2, 105);
            }

            // Clean Meter
            const cleanY = gameMode === 'score' ? 190 : 160;
            drawRoundRect(720 / 2 - 300, cleanY, 600, 115, 25, 'rgba(0,0,0,0.7)', 'rgba(255,255,255,0.15)');
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(gameMode === 'score' ? `🔥 COMBO: ${comboCount}` : 'CLEAN METER', 720 / 2 - 270, cleanY + 45);
            ctx.fillStyle = '#4ade80';
            ctx.font = '900 25px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(gameMode === 'score' ? `${score}/${targetScore}` : `${Math.round(cleanPercentage)}%`, 720 / 2 + 270, cleanY + 45);

            // Clean Meter Bar
            drawRoundRect(720 / 2 - 270, cleanY + 65, 540, 30, 15, '#1f2937', 'rgba(255,255,255,0.2)');
            const fillW = 540 * (cleanPercentage / 100);
            const grad = ctx.createLinearGradient(720 / 2 - 270, 0, 720 / 2 - 270 + 540, 0);
            grad.addColorStop(0, '#3b82f6');
            grad.addColorStop(1, '#4ade80');
            if (fillW > 0) {
              ctx.beginPath();
              ctx.roundRect(720 / 2 - 270, cleanY + 65, fillW, 30, 15);
              ctx.fillStyle = grad;
              ctx.fill();
            }

            // Bottom Center Exercise
            const getExName = (ex?: string) => {
              if (ex === 'squats') return 'สควอท';
              if (ex === 'high_knees') return 'วิ่งอยู่กับที่';
              return 'กระโดดตบ';
            };
            const exName = getExName(currentExercise);
            ctx.font = 'bold 43px sans-serif';
            const exWText = ctx.measureText(exName).width;
            const totalBoxW = exWText + 114;
            const baseY = 1280 - (gameMode === 'score' ? 240 : 150);

            drawRoundRect(720 / 2 - totalBoxW / 2 + 5, baseY + 10, totalBoxW, 90, 45, 'rgba(0,0,0,0.4)'); // fake shadow
            drawRoundRect(720 / 2 - totalBoxW / 2, baseY, totalBoxW, 90, 45, 'rgba(0,0,0,0.85)', 'rgba(255,255,255,0.25)');

            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 43px sans-serif';
            ctx.fillText(exName, 720 / 2 - totalBoxW / 2 + 57, baseY + 62);

            if (gameMode === 'score') {
              const timeY = baseY + 118;
              drawRoundRect(720 / 2 - 230 + 5, timeY + 10, 460, 70, 35, 'rgba(0,0,0,0.4)'); // fake shadow
              drawRoundRect(720 / 2 - 230, timeY, 460, 70, 35, 'rgba(0,0,0,0.75)', 'rgba(255,255,255,0.25)');

              // Bar
              drawRoundRect(720 / 2 - 200, timeY + 24, 250, 22, 11, '#1f2937');

              const currentMaxTime = (gamePoints || 0) >= 30 ? 3 : (gamePoints || 0) >= 15 ? 4 : 5;
              const exW = Math.max(0, 250 * ((exerciseTime || 0) / currentMaxTime));

              let barColor = '#fb923c';
              if ((exerciseTime || 0) < 2) {
                barColor = (Math.floor(Date.now() / 150) % 2 === 0) ? '#ef4444' : '#ffbaba';
              }
              ctx.fillStyle = barColor;

              if (exW > 0) {
                ctx.beginPath();
                ctx.roundRect(720 / 2 - 200, timeY + 24, exW, 22, 11);
                ctx.fill();
              }
              ctx.fillStyle = '#ffffff';
              ctx.font = '900 36px sans-serif';
              ctx.textAlign = 'right';
              ctx.fillText(`${Math.ceil(exerciseTime || 0)}s`, 720 / 2 + 200, timeY + 48);
            }

            // Floating Points
            if (floatingPoints && floatingPoints.length > 0) {
              floatingPoints.forEach((fp, i) => {
                ctx.textAlign = 'center';

                let fpColor = '#ef4444';
                let fpFont = '900 90px sans-serif';

                if (fp.type === 'plus') {
                  fpColor = '#4ade80';
                } else if (fp.type === 'bonus') {
                  fpColor = '#facc15';
                  fpFont = '900 110px sans-serif';
                }

                // Fake Text Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.font = fpFont;
                ctx.fillText(fp.text, 720 / 2 + 3, 1280 / 3 - (i * 70) + 5);

                ctx.fillStyle = fpColor;
                ctx.fillText(fp.text, 720 / 2, 1280 / 3 - (i * 70));
              });
            }
          }

          if (status === 'ending') {
            // Dim background
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

            ctx.textAlign = 'center';
            ctx.fillStyle = 'yellow';
            // Try to render a big trophy Emoji
            ctx.font = 'bold 120px sans-serif';
            ctx.fillText('🏆', canvasRef.current.width / 2, canvasRef.current.height / 2 - 80);

            ctx.fillStyle = '#facc15';
            ctx.font = 'bold 80px sans-serif';
            ctx.fillText(`SCORE: ${gamePoints}`, canvasRef.current.width / 2, canvasRef.current.height / 2 + 60);
          }
        }
      }

      // 2. Process pose estimation without blocking the canvas rendering loop
      const now = performance.now();
      if (!isProcessingPose && (now - lastPoseTime > 33)) { // Limit to ~30 FPS
        isProcessingPose = true;
        lastPoseTime = now;
        pose.send({ image: videoRef.current }).catch(console.error).finally(() => {
          isProcessingPose = false;
        });
      }

      // Loop
      animationFrameId = requestAnimationFrame(processVideo);
    };

    startCamera();

    return () => {
      isStreamActive = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      pose.close();
    };
  }, [isReady]);

  return (
    <div className="absolute inset-0 w-full h-full bg-black overflow-hidden">
      {!isReady && (
        <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center text-white z-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mb-4"></div>
          <p className="text-sm font-semibold">Loading AR Camera...</p>
        </div>
      )}
      <video
        ref={videoRef}
        className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
        playsInline
        autoPlay
        muted
      />
      {/* Visible canvas for BOTH playing and recording */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none"
      />
    </div>
  );
}
