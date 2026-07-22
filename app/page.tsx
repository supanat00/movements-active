'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

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



const playScoreSound = () => {
  playRoutedSound('/sound/score.mp3');
};

export default function Home() {
  const [gameStatus, setGameStatus] = useState<'idle' | 'tutorial' | 'countdown' | 'playing' | 'ending' | 'preview' | 'win' | 'lose'>('idle');
  const [currentExercise, setCurrentExercise] = useState<'jumping_jacks' | 'squats' | 'high_knees'>('jumping_jacks');
  const [globalTime, setGlobalTime] = useState(15.0);
  const [gamePoints, setGamePoints] = useState(0);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [bgType, setBgType] = useState<'neon-grid' | 'synthwave' | 'video' | 'image'>('image');
  const [bgVideoUrl, setBgVideoUrl] = useState<string | null>(null);

  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [rawVideoBlob, setRawVideoBlob] = useState<Blob | null>(null);
  const [processedVideoUrls, setProcessedVideoUrls] = useState<Record<string, string>>({});
  const ffmpegRef = useRef<FFmpeg | null>(null);

  const [countdown, setCountdown] = useState(4);
  const [showWarning, setShowWarning] = useState<string[] | null>(null);
  
  const [isSystemReady, setIsSystemReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

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

    // Preload assets to prevent flashing
      const preloadImages: string[] = [];
      preloadImages.forEach(src => {
        const img = new Image();
        img.src = src;
      });

      const preloadAudio = ['/sound/score.mp3'];
      preloadAudio.forEach(src => {
        const audio = new Audio();
        audio.src = src;
        audio.preload = 'auto';
      });
  }, []);

  const handleRecordingComplete = (blob: Blob) => {
    console.log("Recording complete! Type:", blob.type);
    setRawVideoBlob(blob);
    setRecordedVideoUrl(URL.createObjectURL(blob));
    setProcessedVideoUrls({});
  };

  const processVideoToMp4 = async (resolution: '360p' | '720p'): Promise<string | null> => {
    if (processedVideoUrls[resolution]) return processedVideoUrls[resolution]!;
    if (!rawVideoBlob) return null;

    setIsProcessingVideo(true);
    try {
      if (!ffmpegRef.current) await loadFfmpeg();
      const ffmpeg = ffmpegRef.current!;
      if (!ffmpeg.loaded) await loadFfmpeg();
      
      // Setup logging to debug if it fails
      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
      });

      await ffmpeg.writeFile("input.webm", await fetchFile(rawVideoBlob));
      
      const args = [
        "-y", // overwrite output files
        "-i", "input.webm", 
        "-c:v", "libx264",
        "-preset", "ultrafast", 
        "-crf", "28", // Slightly lower quality for faster processing
        "-r", "30" // 30fps is enough and matches captureStream
      ];
      
      if (resolution === '360p') {
          args.push("-vf", "scale=360:-2"); // Keep aspect ratio
      } else {
          args.push("-vf", "scale=720:-2");
      }
      
      args.push("output.mp4");

      const ret = await ffmpeg.exec(args);
      
      if (ret !== 0) {
        throw new Error(`FFmpeg exited with code ${ret}`);
      }
      
      const data = await ffmpeg.readFile("output.mp4") as any;
      const url = URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" }));
      
      // Clean up FS
      try {
        await ffmpeg.deleteFile("input.webm");
        await ffmpeg.deleteFile("output.mp4");
      } catch (e) {
        // ignore delete errors
      }
      
      setProcessedVideoUrls(prev => ({ ...prev, [resolution]: url }));
      return url;
    } catch (err) {
      console.error("FFmpeg processing error:", err);
      // Fallback to the raw video URL if processing fails
      return recordedVideoUrl;
    } finally {
      setIsProcessingVideo(false);
    }
  };

  const handleSave = async (resolution: '360p' | '720p') => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    // iOS: <a download> is not supported + FFmpeg WASM requires SharedArrayBuffer
    // → use Web Share API with raw blob so user can "Save to Photos"
    if (isIOS && rawVideoBlob) {
      try {
        const ext  = rawVideoBlob.type.includes('mp4') ? 'mp4' : 'mp4';
        const file = new File([rawVideoBlob], `active-movement.${ext}`, { type: rawVideoBlob.type });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Active Movement Workout! 🔥' });
          return;
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') console.warn('iOS share failed:', e);
        return;
      }
    }

    // Desktop / Android: FFmpeg re-encode → anchor download
    const url = await processVideoToMp4(resolution);
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `active-movement-${resolution}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleShare = async () => {
    const url = await processVideoToMp4('720p');
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



  // Timer loop: decrement global 30s game time
  useEffect(() => {
    let timer: NodeJS.Timeout;
    let lastTime = performance.now();
    
    if (gameStatus === 'playing') {
      timer = setInterval(() => {
        const now = performance.now();
        const dt = (now - lastTime) / 1000;
        lastTime = now;
        setGlobalTime((prev) => Math.max(0, prev - dt));
      }, 100);
    }
    return () => clearInterval(timer);
  }, [gameStatus]);

  // Game Logic check loop
  useEffect(() => {
    if (gameStatus !== 'playing') return;
    if (globalTime <= 0) {
      setGameStatus('ending');
      setTimeout(() => setGameStatus('preview'), 2000);
    }
  }, [gameStatus, globalTime]);

  // Warning Popup on 3s of inactivity (wait 3s -> show 1.5s -> wait 3s)
  useEffect(() => {
    if (gameStatus !== 'playing') {
      setShowWarning(null);
      return;
    }

    let isCancelled = false;
    let timerId: NodeJS.Timeout;

    const loop = () => {
      if (isCancelled) return;
      timerId = setTimeout(() => {
        if (isCancelled) return;
        const warnings = [
          ["เกือบถูกแล้ว!", "ปรับท่าอีกนิด"],
          ["ลองอีกครั้ง!", "ทำท่าให้ถูกต้อง"],
          ["ท่าไม่ถูกต้อง", "ทำท่าใหม่อีกครั้ง"]
        ];
        setShowWarning(warnings[Math.floor(Math.random() * warnings.length)]);
        
        timerId = setTimeout(() => {
          if (isCancelled) return;
          setShowWarning(null);
          loop();
        }, 1500);
      }, 3000);
    };

    loop();

    return () => {
      isCancelled = true;
      clearTimeout(timerId);
      setShowWarning(null);
    };
  }, [gameStatus, gamePoints]);

  useEffect(() => {
    if (gameStatus === 'countdown') {
      if (countdown >= 0) {
        const timer = setTimeout(() => {
          if (countdown === 0) {
            setGameStatus('playing');
            // Reset pose states right when playing starts
            poseState.current.isJumping = false;
            poseState.current.isSquatting = false;
            poseState.current.lastKneeLifted = null;
          } else {
            setCountdown(countdown - 1);
          }
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [gameStatus, countdown, currentExercise]);

  const startGame = (mode?: 'normal' | 'score', exercise?: 'jumping_jacks' | 'squats' | 'high_knees') => {
    initAudioContext();
    if (!mode) {
      setGameStatus('idle');
    setGamePoints(0);
    setGlobalTime(15.0);
    setRecordedVideoUrl(null);
      setRawVideoBlob(null);
      setProcessedVideoUrls({});
      setIsProcessingVideo(false);
      return;
    }
    
    if (exercise) {
      setCurrentExercise(exercise);
    } else {
      // Pick a random exercise at game start and keep it for the whole game
      const exercises: Array<'jumping_jacks' | 'squats' | 'high_knees'> = ['jumping_jacks', 'squats', 'high_knees'];
      const randomEx = exercises[Math.floor(Math.random() * exercises.length)];
      setCurrentExercise(randomEx);
    }

    setGamePoints(0);
    setGlobalTime(15.0);
    
    if (isSystemReady) {
      setGameStatus('tutorial');
    } else {
      setIsStarting(true);
    }
  };

  // Delay tutorial start until system is ready
  useEffect(() => {
    if (isStarting && isSystemReady) {
      setIsStarting(false);
      setGameStatus('tutorial');
    }
  }, [isStarting, isSystemReady]);

  const handlePoseDetected = useCallback((landmarks: any) => {
    currentLandmarks.current = landmarks;
    if (gameStatus !== 'playing') return;

    // Calculate angle using vector math (similar to Python OpenCV example)
    const calculateAngle = (a: any, b: any, c: any) => {
      const abx = a.x - b.x;
      const aby = a.y - b.y;
      const cbx = c.x - b.x;
      const cby = c.y - b.y;
      const dotProduct = (abx * cbx + aby * cby);
      const magAB = Math.sqrt(abx * abx + aby * aby);
      const magCB = Math.sqrt(cbx * cbx + cby * cby);
      return Math.acos(dotProduct / (magAB * magCB));
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
          // Each rep = +1 point directly
          setGamePoints((prev) => prev + 1);
          playScoreSound();
          state.lastTime = now;
        }
      }
    } 
    else if (currentExercise === 'squats') {
      if (!isVisible(rightHip, rightKnee, rightAnkle, leftHip, leftKnee, leftAnkle)) return;
      const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
      const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
      const maxKneeAngle = Math.max(rightKneeAngle, leftKneeAngle); 
      if (maxKneeAngle < 1.9) {
        state.isSquatting = true;
      } else if (state.isSquatting && rightKneeAngle > 2.5 && leftKneeAngle > 2.5) {
        state.isSquatting = false;
        if (now - state.lastTime > 500) {
          setGamePoints((prev) => prev + 1);
          playScoreSound();
          state.lastTime = now;
        }
      }
    }
    else if (currentExercise === 'high_knees') {
      if (!isVisible(rightHip, rightKnee, leftHip, leftKnee, rightAnkle, leftAnkle)) return;
      const rightLegLength = rightAnkle.y - rightHip.y;
      const leftLegLength = leftAnkle.y - leftHip.y;
      const avgLegLength = (rightLegLength + leftLegLength) / 2;
      const threshold = Math.max(0.08, avgLegLength * 0.25);
      const rightKneeForward = rightKnee.y < leftKnee.y - threshold;
      const leftKneeForward = leftKnee.y < rightKnee.y - threshold;
      if (rightKneeForward && state.lastKneeLifted !== 'right') {
        state.lastKneeLifted = 'right';
        if (now - state.lastTime > 250) {
          setGamePoints((prev) => prev + 1);
          playScoreSound();
          state.lastTime = now;
        }
      } else if (leftKneeForward && state.lastKneeLifted !== 'left') {
        state.lastKneeLifted = 'left';
        if (now - state.lastTime > 250) {
          setGamePoints((prev) => prev + 1);
          playScoreSound();
          state.lastTime = now;
        }
      }
    }
  }, [gameStatus, currentExercise]);

  return (
    <main className="fixed inset-0 flex items-center justify-center bg-gray-950 font-sans overflow-hidden touch-none">

      
      {/* Responsive Container */}
      <div 
        className="relative bg-black overflow-hidden shadow-2xl flex-shrink-0 game-container"
      >
        {/* Overlay Effects */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          <VFXOverlay 
            timeRemaining={globalTime} 
            maxTime={30} 
            score={gamePoints}
            targetScore={999}
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
            currentExercise={currentExercise}
            countdownValue={countdown}
            removeBackground={removeBackground}
            bgType={bgType}
            bgVideoUrl={bgVideoUrl}
            onSystemReady={() => setIsSystemReady(true)}
          />
        </div>

        {/* UI Overlay */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          <GameUI 
            showWarning={showWarning}
            gameStatus={gameStatus}
            currentExercise={currentExercise}
            countdownValue={countdown}
            globalTime={globalTime}
            gamePoints={gamePoints}
            recordedVideoUrl={recordedVideoUrl}
            isProcessingVideo={isProcessingVideo}
            removeBackground={removeBackground}
            bgType={bgType}
            bgVideoUrl={bgVideoUrl}
            isStarting={isStarting}
            setRemoveBackground={setRemoveBackground}
            setBgType={setBgType}
            setBgVideoUrl={setBgVideoUrl}
            onTutorialComplete={() => {
              setCountdown(4);
              setGameStatus('countdown');
            }}
            onStart={startGame}
            onSave={handleSave}
            onShare={handleShare}
          />
        </div>
      </div>
    </main>
  );
}
