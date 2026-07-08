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
        
        // Removed mist drawing based on user request
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
