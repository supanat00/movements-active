'use client';

import React, { useEffect, useRef } from 'react';

interface VFXOverlayProps {
  timeRemaining: number;
  maxTime: number;
  score: number;
  targetScore: number;
  gameStatus: 'idle' | 'countdown' | 'playing' | 'win' | 'lose' | 'ending' | 'preview';
  currentLandmarks?: React.MutableRefObject<any>;
}

// Removed Particle interface as we only use the mist image now

export default function VFXOverlay({ timeRemaining, maxTime, score, targetScore, gameStatus, currentLandmarks }: VFXOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  // Use a ref to store the latest props so the animation loop doesn't restart every 100ms
  const stateRef = useRef({ timeRemaining, maxTime, score, targetScore, gameStatus });
  
  useEffect(() => {
    stateRef.current = { timeRemaining, maxTime, score, targetScore, gameStatus };
  }, [timeRemaining, maxTime, score, targetScore, gameStatus]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle resizing
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Load custom mist image
    const mistImg = new Image();
    mistImg.src = '/mist.png';

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const { score, targetScore, gameStatus } = stateRef.current;

      if (gameStatus === 'win' || gameStatus === 'lose') {
         // Do not render anything
      } else if (currentLandmarks && currentLandmarks.current && (gameStatus === 'idle' || gameStatus === 'playing' || gameStatus === 'countdown')) {
        const lms = currentLandmarks.current;
        
        // Calculate intensity
        const fogIntensity = Math.max(0, 1 - (score / targetScore));
        
        // Ensure we have upper body and lower body tracking (Shoulders and Hips)
        if (lms[11] && lms[12] && lms[23] && lms[24]) {
          const chestX = ((lms[11].x + lms[12].x) / 2) * canvas.width;
          const chestY = ((lms[11].y + lms[12].y) / 2) * canvas.height;
          
          const hipX = ((lms[23].x + lms[24].x) / 2) * canvas.width;
          const hipY = ((lms[23].y + lms[24].y) / 2) * canvas.height;
          
          // Calculate Stomach position (midpoint between chest and hips)
          const stomachX = (chestX + hipX) / 2;
          const stomachY = (chestY + hipY) / 2;

          const shoulderWidth = Math.abs(lms[11].x - lms[12].x) * canvas.width;

          // 1. Draw "Musty/Sweaty" Aura around the stomach
          if (fogIntensity > 0) {
             if (mistImg.complete && mistImg.naturalWidth > 0) {
                 ctx.save();
                 ctx.translate(stomachX, stomachY);
                 
                 const timePulse = Date.now() / 500;
                 const width = (shoulderWidth * 4) + Math.sin(timePulse) * 15;
                 const height = width * 0.7; // Mist image is typically wide
                 
                 ctx.globalCompositeOperation = 'source-over';
                 ctx.globalAlpha = fogIntensity * 0.8; // Set opacity based on progress
                 
                 // Draw the mist image centered on the stomach
                 ctx.drawImage(mistImg, -width / 2, -height / 2, width, height);
                 
                 ctx.restore();
                 ctx.globalAlpha = 1.0; // Reset alpha for other drawings
             }
          }
        }
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [currentLandmarks]); // Only depend on currentLandmarks so the loop doesn't restart every 100ms

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute top-0 left-0 w-full h-full pointer-events-none scale-x-[-1]"
    />
  );
}
