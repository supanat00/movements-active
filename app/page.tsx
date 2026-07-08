'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Script from 'next/script';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import PoseTracker from './components/PoseTracker';
import VFXOverlay from './components/VFXOverlay';
import GameUI from './components/GameUI';

let audioCtx: AudioContext | null = null;
let audioDest: MediaStreamAudioDestinationNode | null = null;

const initAudioContext = () => {
  if (!audioCtx && typeof window !== 'undefined') {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioDest = audioCtx.createMediaStreamDestination();
    (window as any).gameAudioStream = audioDest.stream;
  }
  if (audioCtx?.state === 'suspended') {
    audioCtx.resume();
  }
};

const playRoutedSound = (src: string) => {
  if (typeof Audio === 'undefined') return;
  const audio = new Audio(src);
  audio.crossOrigin = "anonymous";
  
  if (audioCtx && audioDest) {
    try {
      const source = audioCtx.createMediaElementSource(audio);
      source.connect(audioCtx.destination);
      source.connect(audioDest);
    } catch (e) {
      console.error("Audio routing failed", e);
    }
  }
  audio.play().catch(e => console.log('Audio play blocked:', e));
};

const playExerciseSound = (exercise: string) => {
  let src = '';
  if (exercise === 'jumping_jacks') src = '/sound/jump.mp3';
  else if (exercise === 'squats') src = '/sound/squat.mp3';
  else if (exercise === 'high_knees') src = '/sound/run.mp3';
  
  if (src) playRoutedSound(src);
};

const playScoreSound = () => {
  playRoutedSound('/sound/score.mp3');
};

export default function Home() {
  const [gameStatus, setGameStatus] = useState<'idle' | 'countdown' | 'playing' | 'ending' | 'preview' | 'win' | 'lose'>('idle');
  const [currentExercise, setCurrentExercise] = useState<'jumping_jacks' | 'squats' | 'high_knees'>('jumping_jacks');
  const [gameMode, setGameMode] = useState<'normal' | 'score'>('normal');
  const [globalTime, setGlobalTime] = useState(5.0);
  const [exerciseTime, setExerciseTime] = useState(5.0);
  const [gamePoints, setGamePoints] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [floatingPoints, setFloatingPoints] = useState<{id: number, text: string, type: 'plus'|'minus'|'bonus'}[]>([]);

  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [rawVideoBlob, setRawVideoBlob] = useState<Blob | null>(null);
  const [processedVideoUrl, setProcessedVideoUrl] = useState<string | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const [timeRemaining, setTimeRemaining] = useState(15.0);
  const [score, setScore] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const targetScore = gameMode === 'score' ? 1 : (currentExercise === 'squats' ? 5 : 10);
  const maxTime = gameMode === 'score' ? 30.0 : 15.0;

  const currentLandmarks = useRef<any>(null);

  // Pose logic state ref to avoid stale closures in callbacks without re-renders
  const poseState = useRef({
    isJumping: false,
    isSquatting: false,
    lastKneeLifted: null as 'left' | 'right' | null,
    lastTime: Date.now()
  });

  const loadFfmpeg = async () => {
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
    if (!ffmpegRef.current) {
      ffmpegRef.current = new FFmpeg();
    }
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg.loaded) {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
    }
  };

  useEffect(() => {
    // Preload ffmpeg on mount
    loadFfmpeg().catch(console.error);
  }, []);

  const handleRecordingComplete = (blob: Blob) => {
    console.log("Recording complete! Type:", blob.type);
    setRawVideoBlob(blob);
    setRecordedVideoUrl(URL.createObjectURL(blob));
    setProcessedVideoUrl(null);
  };

  const processVideoToMp4 = async (): Promise<string | null> => {
    if (processedVideoUrl) return processedVideoUrl;
    if (!rawVideoBlob) return null;
    
    if (rawVideoBlob.type.includes('mp4')) {
      return recordedVideoUrl;
    }

    setIsProcessingVideo(true);
    try {
      if (!ffmpegRef.current) await loadFfmpeg();
      const ffmpeg = ffmpegRef.current!;
      if (!ffmpeg.loaded) await loadFfmpeg();

      await ffmpeg.writeFile("input.webm", await fetchFile(rawVideoBlob));
      await ffmpeg.exec([
        "-i", "input.webm", 
        "-c:v", "libx264",
        "-preset", "ultrafast", 
        "-crf", "22",
        "-r", "60",
        "output.mp4"
      ]);
      
      const data = await ffmpeg.readFile("output.mp4") as any;
      const url = URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" }));
      setProcessedVideoUrl(url);
      return url;
    } catch (err) {
      console.error("FFmpeg processing error:", err);
      return recordedVideoUrl;
    } finally {
      setIsProcessingVideo(false);
    }
  };

  const handleSave = async () => {
    const url = await processVideoToMp4();
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'active-movement.mp4';
      a.click();
    }
  };

  const handleShare = async () => {
    const url = await processVideoToMp4();
    if (navigator.share && url) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], 'active-movement.mp4', { type: "video/mp4" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Active Movement Workout!',
            text: 'I just finished a workout challenge on Active Movement! 🔥',
            files: [file]
          });
        }
      } catch (err) {
        console.log("Share error:", err);
      }
    }
  };

  const nextRandomExercise = useCallback((currentScore: number = 0) => {
    const exercises: Array<'jumping_jacks' | 'squats' | 'high_knees'> = ['jumping_jacks', 'squats', 'high_knees'];
    const randomExercise = exercises[Math.floor(Math.random() * exercises.length)];
    setCurrentExercise(randomExercise);
    setScore(0);

    let newExerciseTime = 5.0;
    if (currentScore >= 30) newExerciseTime = 3.0;
    else if (currentScore >= 15) newExerciseTime = 4.0;
    
    setExerciseTime(newExerciseTime);
    poseState.current.isJumping = false;
    poseState.current.isSquatting = false;
    poseState.current.lastKneeLifted = null;
    
    playExerciseSound(randomExercise);
  }, []);

  const addFloatingPoint = useCallback((text: string, type: 'plus'|'minus'|'bonus') => {
    const id = Date.now();
    setFloatingPoints(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setFloatingPoints(prev => prev.filter(p => p.id !== id));
    }, 1500);
  }, []);

  // 1. Single Timer loop for ALL time decrement
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameStatus === 'playing') {
      timer = setInterval(() => {
        if (gameMode === 'normal') {
          setTimeRemaining((prev) => Math.max(0, prev - 0.1));
        } else if (gameMode === 'score') {
          setGlobalTime((prev) => Math.max(0, prev - 0.1));
          setExerciseTime((prev) => Math.max(0, prev - 0.1));
        }
      }, 100);
    }
    return () => clearInterval(timer);
  }, [gameStatus, gameMode]);

  // 2. Game Logic check loop (watches state changes)
  useEffect(() => {
    if (gameStatus !== 'playing') return;

    if (gameMode === 'normal') {
      if (score >= targetScore) {
        setGameStatus('win');
      } else if (timeRemaining <= 0) {
        setGameStatus('lose');
      }
    } else if (gameMode === 'score') {
      if (globalTime <= 0) {
        // End the game
        setGameStatus('ending');
        setTimeout(() => setGameStatus('preview'), 2000);
      } else if (score >= targetScore) {
        const newCombo = comboCount + 1;
        setComboCount(newCombo);
        
        let pointsGained = 1;
        let pointType: 'plus' | 'bonus' = 'plus';
        let pointText = '+1';
        
        const currentMaxTime = gamePoints >= 30 ? 3.0 : gamePoints >= 15 ? 4.0 : 5.0;
        const timeSpent = currentMaxTime - exerciseTime;
        
        if (timeSpent <= 2.0) {
           pointText = 'PERFECT! ⚡';
           pointType = 'bonus';
           pointsGained += 1;
        }
        
        if (newCombo % 3 === 0) {
          pointsGained += 2;
          pointType = 'bonus';
          pointText = pointText === '+1' ? '🔥 COMBO x3!' : 'PERFECT + COMBO!';
        }
        
        if (newCombo % 5 === 0) {
          setGlobalTime(prev => prev + 5);
          addFloatingPoint('TIME EXTENDED!', 'plus');
        }
        
        const nextScore = gamePoints + pointsGained;
        setGamePoints(nextScore);
        addFloatingPoint(pointText, pointType);
        playScoreSound();
        nextRandomExercise(nextScore);
      } else if (exerciseTime <= 0) {
        setComboCount(0);
        setGamePoints(prev => Math.max(0, prev - 1));
        addFloatingPoint('MISS!', 'minus');
        nextRandomExercise(gamePoints);
      }
    }
  }, [score, targetScore, gameStatus, timeRemaining, gameMode, globalTime, exerciseTime, comboCount, addFloatingPoint, nextRandomExercise, gamePoints]);

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
        
        if (gameMode === 'score') {
          playExerciseSound(currentExercise);
        }
      }
    }
  }, [gameStatus, countdown, gameMode, currentExercise]);

  const startGame = (mode?: 'normal' | 'score', exercise?: 'jumping_jacks' | 'squats' | 'high_knees') => {
    initAudioContext();
    if (!mode) {
      setGameStatus('idle');
      setScore(0);
      setTimeRemaining(15.0);
      setGlobalTime(60.0);
      setExerciseTime(5.0);
      setGamePoints(0);
      setComboCount(0);
      setFloatingPoints([]);
      setRecordedVideoUrl(null);
      setRawVideoBlob(null);
      setProcessedVideoUrl(null);
      setIsProcessingVideo(false);
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
      const randomEx = exercises[Math.floor(Math.random() * exercises.length)];
      setCurrentExercise(randomEx);
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
    
    const isVisible = (...lms: any[]) => lms.every(lm => lm && lm.visibility > 0.65);

    if (currentExercise === 'jumping_jacks') {
      if (!isVisible(rightElbow, rightShoulder, rightHip, leftElbow, leftShoulder, leftHip)) return;
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
      if (!isVisible(rightHip, rightKnee, rightAnkle, leftHip, leftKnee, leftAnkle)) return;
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
      if (!isVisible(rightHip, rightKnee, leftHip, leftKnee, rightAnkle, leftAnkle)) return;
      
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
    <main className="fixed inset-0 flex items-center justify-center bg-gray-950 font-sans overflow-hidden touch-none">
      <Script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js" strategy="afterInteractive" />
      
      {/* 9:16 Aspect Ratio Container */}
      <div 
        className="relative bg-black overflow-hidden shadow-2xl flex-shrink-0"
        style={{ 
          width: '100%', 
          height: '100%', 
          maxWidth: 'calc(100dvh * (9/16))', 
          maxHeight: 'calc(100vw * (16/9))' 
        }}
      >
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
            gameStatus={gameStatus}
            onRecordingComplete={handleRecordingComplete}
            gamePoints={gamePoints}
            globalTime={globalTime}
            gameMode={gameMode}
            currentExercise={currentExercise}
            countdownValue={countdown}
            score={score}
            targetScore={targetScore}
            timeRemaining={timeRemaining}
            exerciseTime={exerciseTime}
            comboCount={comboCount}
            floatingPoints={floatingPoints}
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
            recordedVideoUrl={recordedVideoUrl}
            isProcessingVideo={isProcessingVideo}
            onStart={startGame}
            onSave={handleSave}
            onShare={handleShare}
          />
        </div>
      </div>
    </main>
  );
}
