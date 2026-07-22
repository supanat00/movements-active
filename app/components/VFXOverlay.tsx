'use client';

import React, { useEffect, useRef } from 'react';

interface VFXOverlayProps {
  score: number;
  targetScore: number;
  gameStatus: 'idle' | 'tutorial' | 'countdown' | 'playing' | 'win' | 'lose' | 'ending' | 'preview';
  currentLandmarks?: React.MutableRefObject<any>;
}

function VFXOverlay({ score, targetScore, gameStatus, currentLandmarks }: VFXOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  // Use a ref to store the latest props so the animation loop doesn't restart every 100ms
  const stateRef = useRef({ score, targetScore, gameStatus });
  
  useEffect(() => {
    stateRef.current = { score, targetScore, gameStatus };
  }, [score, targetScore, gameStatus]);

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

    let active = true;
    const render = () => {
      if (!active) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const { gameStatus } = stateRef.current;

      // Only schedule next frame if actively playing or in countdown
      if (gameStatus === 'playing' || gameStatus === 'countdown') {
        animationRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      active = false;
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [currentLandmarks, gameStatus]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute top-0 left-0 w-full h-full pointer-events-none scale-x-[-1]"
    />
  );
}

export default React.memo(VFXOverlay);
