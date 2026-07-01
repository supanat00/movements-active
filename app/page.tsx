'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Script from 'next/script';
import PoseTracker from './components/PoseTracker';
import VFXOverlay from './components/VFXOverlay';
import GameUI from './components/GameUI';

export default function Home() {
  const [gameStatus, setGameStatus] = useState<'idle' | 'countdown' | 'playing' | 'win' | 'lose'>('idle');
  const [currentExercise, setCurrentExercise] = useState<'jumping_jacks' | 'squats' | 'high_knees'>('jumping_jacks');
  const [gameMode, setGameMode] = useState<'normal' | 'score'>('normal');
  const [globalTime, setGlobalTime] = useState(30.0);
  const [exerciseTime, setExerciseTime] = useState(5.0);
  const [gamePoints, setGamePoints] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [floatingPoints, setFloatingPoints] = useState<{id: number, text: string, type: 'plus'|'minus'|'bonus'}[]>([]);

  const [timeRemaining, setTimeRemaining] = useState(15.0);
  const [score, setScore] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const getTargetScore = (mode: 'normal' | 'score', ex: string) => {
    if (mode === 'score') {
      if (ex === 'jumping_jacks') return 3;
      if (ex === 'squats') return 2;
      return 5;
    } else {
      return ex === 'squats' ? 5 : 10;
    }
  };
  const targetScore = getTargetScore(gameMode, currentExercise);
  const maxTime = gameMode === 'score' ? 30.0 : 15.0;

  const currentLandmarks = useRef<any>(null);

  // Pose logic state ref to avoid stale closures in callbacks without re-renders
  const poseState = useRef({
    isJumping: false,
    isSquatting: false,
    lastKneeLifted: null as 'left' | 'right' | null,
    lastTime: Date.now()
  });

  // Helper to generate a new random exercise
  const nextRandomExercise = useCallback(() => {
    const exercises: Array<'jumping_jacks' | 'squats' | 'high_knees'> = ['jumping_jacks', 'squats', 'high_knees'];
    const randomExercise = exercises[Math.floor(Math.random() * exercises.length)];
    setCurrentExercise(randomExercise);
    setScore(0);
    setExerciseTime(5.0);
    poseState.current.isJumping = false;
    poseState.current.isSquatting = false;
    poseState.current.lastKneeLifted = null;
  }, []);

  const addFloatingPoint = useCallback((text: string, type: 'plus'|'minus'|'bonus') => {
    const id = Date.now();
    setFloatingPoints(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setFloatingPoints(prev => prev.filter(p => p.id !== id));
    }, 1500);
  }, []);

  // Game Loop Timer
  useEffect(() => {
    if (gameStatus === 'playing') {
      if (gameMode === 'normal') {
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
      } else if (gameMode === 'score') {
        if (globalTime <= 0) {
          setGameStatus('win'); // Use win state to show summary
          return;
        }
        
        if (score >= targetScore) {
          const newCombo = comboCount + 1;
          setComboCount(newCombo);
          
          let pointsGained = 1;
          let pointType: 'plus' | 'bonus' = 'plus';
          let pointText = '+1';
          
          if (newCombo % 3 === 0) {
            pointsGained = 2;
            pointType = 'bonus';
            pointText = '+2 Bonus!';
          }
          
          setGamePoints(prev => prev + pointsGained);
          addFloatingPoint(pointText, pointType);
          nextRandomExercise();
          return;
        }
        
        if (exerciseTime <= 0) {
          setComboCount(0);
          setGamePoints(prev => Math.max(0, prev - 1));
          addFloatingPoint('-1', 'minus');
          nextRandomExercise();
          return;
        }

        const timer = setInterval(() => {
          setGlobalTime((prev) => Math.max(0, prev - 0.1));
          setExerciseTime((prev) => Math.max(0, prev - 0.1));
        }, 100);
        return () => clearInterval(timer);
      }
    }
  }, [score, targetScore, gameStatus, timeRemaining, gameMode, globalTime, exerciseTime, comboCount, addFloatingPoint, nextRandomExercise]);

  useEffect(() => {
    if (gameStatus === 'countdown') {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setGameStatus('playing');
        if (gameMode === 'normal') setTimeRemaining(maxTime);
        // Reset pose states right when playing starts
        poseState.current.isJumping = false;
        poseState.current.isSquatting = false;
        poseState.current.lastKneeLifted = null;
      }
    }
  }, [gameStatus, countdown]);

  const startGame = (mode?: 'normal' | 'score', exercise?: 'jumping_jacks' | 'squats' | 'high_knees') => {
    if (!mode) {
      setGameStatus('idle');
      setScore(0);
      setTimeRemaining(15.0);
      setGlobalTime(30.0);
      setExerciseTime(5.0);
      setGamePoints(0);
      setComboCount(0);
      setFloatingPoints([]);
      return;
    }
    
    setGameMode(mode);
    setScore(0);
    setGamePoints(0);
    setComboCount(0);
    setCountdown(3);
    setFloatingPoints([]);
    
    if (mode === 'score') {
      setGlobalTime(30.0);
      setExerciseTime(5.0);
      const exercises: Array<'jumping_jacks' | 'squats' | 'high_knees'> = ['jumping_jacks', 'squats', 'high_knees'];
      setCurrentExercise(exercises[Math.floor(Math.random() * exercises.length)]);
    } else {
      setTimeRemaining(15.0);
      if (exercise) setCurrentExercise(exercise);
    }
    
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
      if (!rightHip || !rightKnee || !leftHip || !leftKnee || !rightAnkle || !leftAnkle) return;
      
      // Calculate leg length to make the threshold dynamic based on user's distance from camera
      const rightLegLength = rightAnkle.y - rightHip.y;
      const leftLegLength = leftAnkle.y - leftHip.y;
      const avgLegLength = (rightLegLength + leftLegLength) / 2;
      
      // Threshold is 25% of the leg length, but at least 8% of the screen height to prevent noise triggers
      const threshold = Math.max(0.08, avgLegLength * 0.25);

      const rightKneeForward = rightKnee.y < leftKnee.y - threshold;
      const leftKneeForward = leftKnee.y < rightKnee.y - threshold;

      if (rightKneeForward && state.lastKneeLifted !== 'right') {
        state.lastKneeLifted = 'right';
        if (now - state.lastTime > 250) {
          setScore((prev) => prev + 1);
          state.lastTime = now;
        }
      } else if (leftKneeForward && state.lastKneeLifted !== 'left') {
        state.lastKneeLifted = 'left';
        if (now - state.lastTime > 250) {
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
          gameMode={gameMode}
          globalTime={globalTime}
          exerciseTime={exerciseTime}
          gamePoints={gamePoints}
          comboCount={comboCount}
          floatingPoints={floatingPoints}
          onStart={startGame}
        />
      </div>
    </main>
  );
}
