'use client';

import React, { useRef, useEffect, useState } from 'react';

interface PoseTrackerProps {
  onPoseDetected: (landmarks: any) => void;
}

export default function PoseTracker({ onPoseDetected }: PoseTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
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
        className="w-full h-full object-cover scale-x-[-1]" 
        playsInline 
        autoPlay 
        muted 
      />
    </div>
  );
}
