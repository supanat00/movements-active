'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Script from 'next/script';
import PoseTracker from './components/PoseTracker';
import VFXOverlay from './components/VFXOverlay';
import GameUI from './components/GameUI';

export default function Home() {
  const [gameStatus, setGameStatus] = useState<'idle' | 'countdown' | 'playing' | 'win' | 'lose'>('idle');
  const [currentExercise, setCurrentExercise] = useState<'jumping_jacks' | 'squats' | 'high_knees'>('jumping_jacks');
  const [timeRemaining, setTimeRemaining] = useState(15.0);
  const [score, setScore] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const targetScore = currentExercise === 'squats' ? 5 : 10;
  const maxTime = 15.0;

  const currentLandmarks = useRef<any>(null);

  // Pose logic state ref to avoid stale closures in callbacks without re-renders
  const poseState = useRef({
    isJumping: false,
    isSquatting: false,
    lastKneeLifted: null as 'left' | 'right' | null,
    lastTime: Date.now()
  });

  // Game Loop Timer
  useEffect(() => {
    if (gameStatus === 'playing') {
      if (score >= targetScore) {
        setGameStatus('win');
        return;
      }

      if (timeRemaining <= 0) {
        setGameStatus('lose');
        return;
      }

      const timer = setInterval(() => {
        setTimeRemaining((prev) => Math.max(0, prev - 0.1));
      }, 100);

      return () => clearInterval(timer);
    }
  }, [score, targetScore, gameStatus, timeRemaining]);

  useEffect(() => {
    if (gameStatus === 'countdown') {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setGameStatus('playing');
        setTimeRemaining(maxTime);
        // Reset pose states right when playing starts
        poseState.current.isJumping = false;
        poseState.current.isSquatting = false;
        poseState.current.lastKneeLifted = null;
      }
    }
  }, [gameStatus, countdown]);

  const startGame = (exercise?: 'jumping_jacks' | 'squats' | 'high_knees') => {
    if (!exercise) {
      setGameStatus('idle');
      setScore(0);
      setTimeRemaining(maxTime);
      return;
    }
    
    setScore(0);
    setCurrentExercise(exercise);
    setCountdown(3);
    setGameStatus('countdown');
  };

  const handlePoseDetected = useCallback((landmarks: any) => {
    currentLandmarks.current = landmarks;
    if (gameStatus !== 'playing') return;

    // Calculate angle using vector math (similar to Python OpenCV example)
    const calculateAngle = (a: any, b: any, c: any) => {
      // Vector AB (Elbow to Shoulder)
      const abx = a.x - b.x;
      const aby = a.y - b.y;
      // Vector CB (Hip to Shoulder)
      const cbx = c.x - b.x;
      const cby = c.y - b.y;

      const dotProduct = (abx * cbx + aby * cby);
      const magAB = Math.sqrt(abx * abx + aby * aby);
      const magCB = Math.sqrt(cbx * cbx + cby * cby);
      
      return Math.acos(dotProduct / (magAB * magCB)); // returns radians
    };

    const rightElbow = landmarks[14];
    const rightShoulder = landmarks[12];
    const rightHip = landmarks[24];
    const rightKnee = landmarks[26];
    const rightAnkle = landmarks[28];
    
    const leftElbow = landmarks[13];
    const leftShoulder = landmarks[11];
    const leftHip = landmarks[23];
    const leftKnee = landmarks[25];
    const leftAnkle = landmarks[27];

    const state = poseState.current;
    const now = Date.now();

    if (currentExercise === 'jumping_jacks') {
      if (!rightElbow || !rightShoulder || !rightHip || !leftElbow || !leftShoulder || !leftHip) return;
      const rightTheta = calculateAngle(rightElbow, rightShoulder, rightHip);
      const leftTheta = calculateAngle(leftElbow, leftShoulder, leftHip);
      const theta = Math.max(rightTheta, leftTheta);
      
      if (theta > (3 * Math.PI) / 4) {
        state.isJumping = true;
      } else if (state.isJumping && theta < Math.PI / 4) {
        state.isJumping = false;
        if (now - state.lastTime > 400) {
          setScore((prev) => prev + 1);
          state.lastTime = now;
        }
      }
    } 
    else if (currentExercise === 'squats') {
      if (!rightHip || !rightKnee || !rightAnkle || !leftHip || !leftKnee || !leftAnkle) return;
      const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
      const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
      // Both knees must be bent, so we check the LEAST bent knee (max angle)
      const maxKneeAngle = Math.max(rightKneeAngle, leftKneeAngle); 
      
      // Squat: Both knees bent < 110 degrees (approx 1.9 rad)
      if (maxKneeAngle < 1.9) {
        state.isSquatting = true;
      } 
      // Stand: Both knees straightened > 150 degrees (approx 2.6 rad)
      else if (state.isSquatting && rightKneeAngle > 2.5 && leftKneeAngle > 2.5) {
        state.isSquatting = false;
        if (now - state.lastTime > 500) {
          setScore((prev) => prev + 1);
          state.lastTime = now;
        }
      }
    }
    else if (currentExercise === 'high_knees') {
      if (!rightHip || !rightKnee || !leftHip || !leftKnee) return;
      
      // For light jogging, we don't need absolute angles or Z-depth.
      // We simply compare the height (Y-axis) of the two knees. 
      // If one knee is significantly higher (smaller Y) than the other, it's lifted.
      // 0.04 means 4% of the screen height, perfect for a very light jog.
      const rightKneeForward = rightKnee.y < leftKnee.y - 0.04;
      const leftKneeForward = leftKnee.y < rightKnee.y - 0.04;

      if (rightKneeForward && state.lastKneeLifted !== 'right') {
        state.lastKneeLifted = 'right';
        if (now - state.lastTime > 200) {
          setScore((prev) => prev + 1);
          state.lastTime = now;
        }
      } else if (leftKneeForward && state.lastKneeLifted !== 'left') {
        state.lastKneeLifted = 'left';
        if (now - state.lastTime > 200) {
          setScore((prev) => prev + 1);
          state.lastTime = now;
        }
      }
    }
  }, [gameStatus, currentExercise]);

  return (
    <main className="relative flex h-[100dvh] w-full flex-col items-center justify-center bg-gray-900 overflow-hidden touch-none">
      <Script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js" strategy="beforeInteractive" />
      
      {/* Overlay Effects */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <VFXOverlay 
          timeRemaining={timeRemaining} 
          maxTime={maxTime} 
          score={score}
          targetScore={targetScore}
          gameStatus={gameStatus} 
          currentLandmarks={currentLandmarks}
        />
      </div>

      {/* Main Content (Camera) */}
      <div className="absolute inset-0 z-0">
        <PoseTracker 
          onPoseDetected={handlePoseDetected} 
        />
      </div>

      {/* UI Overlay */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <GameUI 
          timeRemaining={timeRemaining}
          maxTime={maxTime}
          score={score}
          targetScore={targetScore}
          gameStatus={gameStatus}
          currentExercise={currentExercise}
          countdownValue={countdown}
          onStart={startGame}
        />
      </div>
    </main>
  );
}
