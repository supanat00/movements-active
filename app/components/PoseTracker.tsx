'use client';

import React, { useRef, useEffect, useState } from 'react';

interface PoseTrackerProps {
  onPoseDetected: (landmarks: any) => void;
}

export default function PoseTracker({ onPoseDetected }: PoseTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  // Store the latest callback in a ref to avoid re-triggering the camera setup when state changes
  const onPoseDetectedRef = useRef(onPoseDetected);
  
  useEffect(() => {
    onPoseDetectedRef.current = onPoseDetected;
  }, [onPoseDetected]);

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
    if (!isReady || !videoRef.current || !canvasRef.current) return;

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
      if (!canvasRef.current || !videoRef.current) return;
      const canvasCtx = canvasRef.current.getContext('2d');
      if (!canvasCtx) return;

      // Ensure canvas matches video dimensions for perfect drawing overlay
      if (canvasRef.current.width !== videoRef.current.videoWidth) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
      }

      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      
      // Draw the video frame to canvas
      canvasCtx.drawImage(results.image, 0, 0, canvasRef.current.width, canvasRef.current.height);

      if (results.poseLandmarks) {
        // Pass landmarks up to calculate exercise logic
        onPoseDetectedRef.current(results.poseLandmarks);
      }
      canvasCtx.restore();
    });

    let animationFrameId: number;
    let isStreamActive = true;

    // Native Camera System for HD/FullHD
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1080 },  // Request FullHD Portrait
            height: { ideal: 1920 }
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

    let lastProcessTime = 0;
    const targetFpsMs = 1000 / 30; // Target ~30 FPS

    const processVideo = async () => {
      if (!isStreamActive || !videoRef.current) return;
      
      const now = performance.now();
      if (now - lastProcessTime >= targetFpsMs) {
        // Send the current video frame to MediaPipe Pose
        await pose.send({ image: videoRef.current });
        lastProcessTime = performance.now();
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
        className="hidden" 
        playsInline 
        autoPlay 
        muted 
      />
      <canvas 
        ref={canvasRef} 
        className="w-full h-full object-cover scale-x-[-1]" 
      />
    </div>
  );
}
