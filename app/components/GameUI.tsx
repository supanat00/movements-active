'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface VideoResultProps {
  recordedVideoUrl?: string | null;
  isProcessingVideo?: boolean;
  onSave?: (resolution: '360p' | '720p') => void;
  onShare?: () => void;
}

const VideoResult = ({ recordedVideoUrl, isProcessingVideo, onSave, onShare }: VideoResultProps) => {
  const [isMuted, setIsMuted] = React.useState(true);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  React.useEffect(() => {
    if (recordedVideoUrl && videoRef.current) {
      videoRef.current.load(); // Force the browser to reload the media element when src changes
      
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => console.warn("[VideoResult] Autoplay prevented or error:", e));
      }
    }
  }, [recordedVideoUrl]);

  return (
    <div className="mt-1 mb-0 w-full flex justify-center">
      {recordedVideoUrl ? (
        <div className="flex flex-col gap-4 w-full max-w-[280px]">
          <div className="w-full aspect-[9/16] rounded-2xl shadow-xl border border-gray-600 bg-black overflow-hidden relative group">
            <video
              ref={videoRef}
              src={recordedVideoUrl}
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay
              loop
              playsInline
              muted={isMuted}
            />
            <button
              onClick={toggleMute}
              className="absolute top-3 right-3 w-10 h-10 bg-black/40 hover:bg-black/70 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all shadow-lg active:scale-95 opacity-80 hover:opacity-100"
            >
              {isMuted ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full aspect-[9/16] rounded-2xl shadow-xl border border-gray-600/50 bg-black overflow-hidden relative max-w-[280px]" />
      )}
    </div>
  );
};

interface GameUIProps {
  gameStatus: 'idle' | 'tutorial' | 'countdown' | 'playing' | 'win' | 'lose' | 'ending' | 'preview';
  currentExercise: 'jumping_jacks' | 'squats' | 'high_knees';
  countdownValue?: number;
  globalTime?: number;
  gamePoints?: number;
  showWarning?: string[] | null;
  recordedVideoUrl?: string | null;
  isProcessingVideo?: boolean;
  removeBackground?: boolean;
  bgType?: 'neon-grid' | 'synthwave' | 'video' | 'image';
  bgVideoUrl?: string | null;
  isStarting?: boolean;
  setRemoveBackground?: (val: boolean) => void;
  setBgType?: (val: 'neon-grid' | 'synthwave' | 'video' | 'image') => void;
  setBgVideoUrl?: (val: string | null) => void;
  onStart: (mode?: 'normal' | 'score', exercise?: 'jumping_jacks' | 'squats' | 'high_knees') => void;
  onTutorialComplete?: () => void;
  onSave?: (resolution: '360p' | '720p') => void;
  onShare?: () => void;
}

export default function GameUI({
  gameStatus, currentExercise, countdownValue,
  globalTime = 15, gamePoints = 0, showWarning = null,
  recordedVideoUrl = null, isProcessingVideo = false,
  removeBackground = false, bgType = 'neon-grid', bgVideoUrl = null,
  isStarting = false,
  setRemoveBackground, setBgType, setBgVideoUrl,
  onStart, onTutorialComplete, onSave, onShare
}: GameUIProps) {
  const [showBgSettings, setShowBgSettings] = useState(false);
  const [randomPoster, setRandomPoster] = useState<string>('/posters/poster1.webp');
  const [tutorialStep, setTutorialStep] = useState<number>(1);

  useEffect(() => {
    const posters = ['/posters/poster1.webp', '/posters/poster2.webp', '/posters/poster3.webp'];
    setRandomPoster(posters[Math.floor(Math.random() * posters.length)]);
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none flex flex-col justify-between p-4 safe-area-pt overflow-hidden">

      {/* Floating Points Animations (Now handled by Canvas) */}


      {/* Playing UI - Warning Popup */}
      {gameStatus === 'playing' && showWarning && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white/30 backdrop-blur-md border border-white/50 px-8 py-6 rounded-3xl flex flex-col items-center shadow-[0_10px_40px_rgba(0,0,0,0.2)] animate-in zoom-in-95 fade-in duration-300 min-w-[280px]">
            <div className="w-20 h-20 bg-[#f83b3b] rounded-full flex items-center justify-center mb-4 shadow-lg border-2 border-transparent">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-white text-2xl font-black text-center leading-tight drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">
              {showWarning[0]}<br />
              {showWarning[1]}
            </p>
          </div>
        </div>
      )}

      {/* Playing HUD is rendered directly on Canvas so it is captured into the recorded video */}

      {/* Main Menu Overlay (Centered) */}
      {gameStatus === 'idle' && (
        <div
          className="absolute inset-0 z-40 flex flex-col pointer-events-auto bg-cover bg-center"
          style={{ backgroundImage: `url(${randomPoster})` }}
        >
          {/* Invisible button placed over the 'เริ่มภารกิจ' button in the poster */}
          <button
            onClick={() => onStart('score')}
            className="absolute bottom-[12%] left-1/2 -translate-x-1/2 w-[70%] h-[12%] opacity-0 cursor-pointer"
            aria-label="เริ่มภารกิจ"
          />
          {/* Version Number */}
          <div className="absolute top-6 left-6 text-white/70 text-xs font-mono tracking-widest pointer-events-none drop-shadow-md">
            v{process.env.NEXT_PUBLIC_COMMIT_HASH || 'dev'}
          </div>

          {/* Loading Indicator */}
          {isStarting && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto rounded-3xl">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(6,182,212,0.5)]"></div>
                <p className="text-white font-bold text-2xl drop-shadow-md tracking-wide">กำลังเตรียมพร้อมระบบ...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tutorial Overlay */}
      {gameStatus === 'tutorial' && tutorialStep < 3 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 pointer-events-auto p-6">
          <div className="bg-gradient-to-b from-cyan-300/40 via-white/20 to-white/10 backdrop-blur-md w-full max-w-[340px] rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative animate-in zoom-in-95 fade-in duration-300 border-[1.5px] border-white/60 flex flex-col items-center overflow-hidden">
            
            {/* Header Area */}
            <div className="w-full bg-cyan-400/50 backdrop-blur-md pt-6 pb-4 relative border-b border-white/40">
              <h2 className="text-[2.5rem] font-black italic text-white text-center tracking-wider leading-none" 
                  style={{ textShadow: '2px 2px 0 #005080, -2px -2px 0 #005080, 2px -2px 0 #005080, -2px 2px 0 #005080, 0 4px 8px rgba(0,0,0,0.4)' }}>
                {tutorialStep === 1 ? 'วิธีเล่น' : 
                  currentExercise === 'jumping_jacks' ? 'กระโดดตบ' :
                  currentExercise === 'squats' ? 'สควอช' : 'วิ่งเข่าสูง'
                }
              </h2>

              {/* Close Button */}
              <button
                onClick={() => {
                  setTutorialStep(3);
                }}
                className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-red-500 hover:bg-red-400 text-white rounded-full font-black text-xl shadow-md active:scale-95 transition-transform"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Content Area */}
            <div className="flex flex-col items-center w-full px-6 py-4">
              
              {/* Content Page 1: General Info */}
              {tutorialStep === 1 && (
                <div className="flex flex-col w-full text-left mb-6 animate-in slide-in-from-right-8 duration-300">
                  
                  {/* Item 1 */}
                  <div className="flex items-center py-4 border-b border-white/30">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white/40 border-[1.5px] border-white/60 flex items-center justify-center mr-5 shadow-[inset_0_2px_5px_rgba(255,255,255,0.8),0_2px_5px_rgba(0,0,0,0.1)]">
                      <span className="text-3xl font-black text-[#1e3a8a] drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">1</span>
                    </div>
                    <div>
                      <h3 className="text-[1.4rem] font-black text-[#1e3a8a] leading-tight tracking-wide drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">ยืนเต็มตัวหน้ากล้อง</h3>
                    </div>
                  </div>

                  {/* Item 2 */}
                  <div className="flex items-start py-4 border-b border-white/30">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white/40 border-[1.5px] border-white/60 flex items-center justify-center mr-5 shadow-[inset_0_2px_5px_rgba(255,255,255,0.8),0_2px_5px_rgba(0,0,0,0.1)]">
                      <span className="text-3xl font-black text-[#1e3a8a] drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">2</span>
                    </div>
                    <div className="pt-1">
                      <h3 className="text-[1.4rem] font-black text-[#1e3a8a] leading-tight mb-1 tracking-wide drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">เกมสุ่ม 1 ท่า</h3>
                      <p className="text-[1.2rem] font-black text-[#1e3a8a] leading-tight drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">สควอช<br/>วิ่งเข่าสูง<br/>กระโดดตบ</p>
                    </div>
                  </div>

                  {/* Item 3 */}
                  <div className="flex items-start py-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white/40 border-[1.5px] border-white/60 flex items-center justify-center mr-5 shadow-[inset_0_2px_5px_rgba(255,255,255,0.8),0_2px_5px_rgba(0,0,0,0.1)]">
                      <span className="text-3xl font-black text-[#1e3a8a] drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)]">3</span>
                    </div>
                    <div className="pt-1">
                      <h3 className="text-[1.4rem] font-black text-[#1e3a8a] leading-tight mb-1 tracking-wide drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">ทำให้ได้มากที่สุด</h3>
                      <h3 className="text-[1.4rem] font-black text-[#1e3a8a] leading-tight tracking-wide drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">ใน 15 วิ</h3>
                    </div>
                  </div>

                </div>
              )}

              {/* Content Page 2: Specific Exercise */}
              {tutorialStep === 2 && (
                <div className="flex flex-col items-center w-full mb-6 animate-in slide-in-from-right-8 duration-300">

                  <p className="text-[1.3rem] font-bold text-white leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-center mb-4">
                    {currentExercise === 'jumping_jacks' && <><span className="block">กระโดดกางแขน-ขา</span><span className="block">แล้วกลับท่าเริ่มต้น</span></>}
                    {currentExercise === 'squats' && <><span className="block">ย่อตัวลง ให้ต้นขา</span><span className="block">ขนานกับพื้น</span><span className="block">แล้วยืดขึ้นจนสุด</span></>}
                    {currentExercise === 'high_knees' && <><span className="block">วิ่งอยู่กับที่</span><span className="block">ยกเข่าสูงสลับขา</span></>}
                  </p>

                  {/* Visual / Emoji */}
                  <div className="h-[140px] flex items-center justify-center">
                    <div className="text-[7rem] drop-shadow-[0_10px_20px_rgba(0,0,0,0.4)]">
                      {currentExercise === 'jumping_jacks' && '🤸‍♀️'}
                      {currentExercise === 'squats' && '🏋️‍♂️'}
                      {currentExercise === 'high_knees' && '🏃'}
                    </div>
                  </div>
                </div>
              )}

              {/* NEXT / START Button */}
              <button
                onClick={() => {
                  if (tutorialStep === 1) {
                    setTutorialStep(2);
                  } else {
                    setTutorialStep(3);
                  }
                }}
                className="mb-2 px-12 py-3 bg-white/20 backdrop-blur-md border-[3px] border-white/80 rounded-[2rem] shadow-[0_8px_16px_rgba(0,0,0,0.2),inset_0_4px_10px_rgba(255,255,255,0.4)] active:scale-95 transition-transform"
              >
                <span className="text-3xl font-black italic text-white tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                  NEXT
                </span>
              </button>
              
            </div>
          </div>
        </div>
      )}

      {/* Start Game Button (Step 3) */}
      {gameStatus === 'tutorial' && tutorialStep === 3 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-auto">
          <button
            onClick={() => {
              setTutorialStep(1);
              onTutorialComplete?.();
            }}
            className="px-12 py-3 bg-white/20 backdrop-blur-md border border-white/70 rounded-[2.5rem] shadow-[0_6px_24px_rgba(0,0,0,0.3),inset_0_0_15px_rgba(255,255,255,0.5)] active:scale-95 transition-all hover:bg-white/30"
          >
            <span className="text-[3.5rem] font-black italic text-white tracking-widest leading-none drop-shadow-[0_3px_6px_rgba(0,0,0,0.6)]" style={{ textShadow: '2.5px 2.5px 0 #005080, -2.5px -2.5px 0 #005080, 2.5px -2.5px 0 #005080, -2.5px 2.5px 0 #005080, 0 6px 12px rgba(0,0,0,0.5)' }}>
              เริ่มเล่น
            </span>
          </button>
        </div>
      )}

      {/* Bottom Action Area (Win/Lose screens) */}
      <div className="w-full flex flex-col items-center justify-end pb-8 pointer-events-auto">

        {gameStatus === 'win' && (
          <div className="bg-white/95 backdrop-blur-lg w-full max-w-sm p-6 rounded-3xl shadow-2xl text-center border-t-4 border-green-500 animate-in slide-in-from-bottom-10 fade-in duration-500 overflow-y-auto max-h-[85vh]">
            <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <span className="text-5xl">🏆</span>
            </div>
            <h2 className="text-3xl font-black text-gray-800 mb-1">TIME UP!</h2>
            <p className="text-sm font-medium text-gray-500 mb-6">จบเกม 15 วินาที</p>

            <div className="bg-gray-100 rounded-2xl p-4 mb-8 shadow-inner border border-gray-200">
              <p className="text-xs text-gray-500 font-bold uppercase mb-1">คะแนนรวม</p>
              <p className="text-6xl font-black text-yellow-500 drop-shadow-sm">{gamePoints}</p>
            </div>

            <button
              onClick={() => onStart()}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-2xl shadow-lg text-lg active:scale-95 transition-transform"
            >
              กลับหน้าหลัก
            </button>
          </div>
        )}

        {gameStatus === 'lose' && (
          <div className="bg-gray-900/95 backdrop-blur-lg w-full max-w-sm p-6 rounded-3xl shadow-2xl text-center border-t-4 border-red-500 animate-in slide-in-from-bottom-10 fade-in duration-500">
            <div className="w-16 h-16 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">💨</span>
            </div>
            <h2 className="text-3xl font-black text-red-500 mb-2">GAME OVER</h2>
            <p className="text-sm font-medium text-gray-300 mb-6">The musty smell took over.</p>

            <button
              onClick={() => onStart()}
              className="w-full bg-gray-100 hover:bg-white text-gray-900 font-bold py-4 px-6 rounded-2xl shadow-lg text-lg active:scale-95 transition-transform"
            >
              กลับหน้าหลัก
            </button>
          </div>
        )}
      </div>

      {/* Ending Overlay (Now handled by Canvas) */}

      {/* Preview Full Screen */}
      {gameStatus === 'preview' && (
        <div className="absolute inset-0 z-50 flex flex-col pointer-events-auto animate-in fade-in duration-500 bg-black/40 backdrop-blur-sm">
          <div className="flex flex-col items-center justify-between h-full w-full px-6 py-6 safe-area-pt">
            
            {/* Top: Logo */}
            <div className="w-[140px] shrink-0 mb-2">
              <img src="/logo.webp" alt="Logo" className="w-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]" />
            </div>

            {/* Middle: Glass Card with Video */}
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-[320px] min-h-0">
              
              <div className="bg-white/10 backdrop-blur-xl border border-white/30 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-3 pb-5 w-full flex flex-col items-center">
                <h2 className="text-lg font-medium tracking-[0.25em] text-white mb-3 mt-2 drop-shadow-md">PREVIEW</h2>
                <VideoResult
                  recordedVideoUrl={recordedVideoUrl}
                  isProcessingVideo={isProcessingVideo}
                />
                
                <div className="text-center mt-4">
                  <p className="text-white text-sm font-medium drop-shadow-md">แชร์วิดีโอของคุณ</p>
                  <p className="text-white text-sm font-medium drop-shadow-md">แล้วแท็กเพื่อนมาท้าดวลกัน!</p>
                </div>
              </div>
            </div>

            {/* Bottom: Action Buttons */}
            <div className="w-full max-w-[320px] flex flex-col gap-3 shrink-0 mt-4 pb-2">
              <div className="flex gap-3">
                <button 
                  onClick={() => onSave?.('360p')} 
                  disabled={isProcessingVideo}
                  className="flex-1 bg-white/15 hover:bg-white/25 backdrop-blur-md border-2 border-white/40 text-white font-black italic tracking-wider py-3.5 px-2 rounded-2xl shadow-[0_4px_20px_rgba(255,255,255,0.1)] text-xl transition-all active:scale-95 disabled:opacity-50"
                >
                  SAVE
                </button>
                <button 
                  onClick={onShare} 
                  disabled={isProcessingVideo}
                  className="flex-1 bg-white/15 hover:bg-white/25 backdrop-blur-md border-2 border-white/40 text-white font-black italic tracking-wider py-3.5 px-2 rounded-2xl shadow-[0_4px_20px_rgba(255,255,255,0.1)] text-xl transition-all active:scale-95 disabled:opacity-50"
                >
                  SHARE
                </button>
              </div>
              
              <button
                onClick={() => onStart()}
                disabled={isProcessingVideo}
                className="w-full bg-white/15 hover:bg-white/25 backdrop-blur-md border-2 border-white/40 text-white font-black italic tracking-wider py-3.5 px-6 rounded-2xl shadow-[0_4px_20px_rgba(255,255,255,0.1)] text-2xl transition-all active:scale-95 disabled:opacity-50"
              >
                PLAY AGAIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Background Settings Modal */}
      {showBgSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm pointer-events-auto p-4">
          <div className="bg-gray-900 border border-gray-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-300 text-white">
            <button
              onClick={() => setShowBgSettings(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-full font-bold active:scale-95 transition-all"
            >
              ✕
            </button>
            <h2 className="text-2xl font-black text-center mb-6 uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              ตั้งค่าพื้นหลัง (AI)
            </h2>
            <div className="space-y-6">
              {/* Toggle switch for Background Removal */}
              <div className="flex items-center justify-between bg-gray-800/50 p-4 rounded-2xl border border-gray-800">
                <div>
                  <h3 className="font-bold text-base">ลบพื้นหลังด้วย AI</h3>
                  <p className="text-xs text-gray-400">แยกตัวคุณออกจากพื้นหลังห้องจริง</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={removeBackground}
                    onChange={(e) => setRemoveBackground?.(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {/* Background Styles (Only visible if background removal is active) */}
              {removeBackground && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-3 duration-300">
                  <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider">เลือกสไตล์พื้นหลัง</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setBgType?.('neon-grid')}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all ${bgType === 'neon-grid'
                        ? 'bg-cyan-950/50 border-cyan-500 text-cyan-400 font-bold shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                        : 'bg-gray-800/40 border-gray-800 hover:border-gray-700 text-gray-300'
                        }`}
                    >
                      <span className="text-2xl mb-1">🌐</span>
                      <span className="text-xs">Neon Grid</span>
                    </button>
                    <button
                      onClick={() => setBgType?.('synthwave')}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all ${bgType === 'synthwave'
                        ? 'bg-pink-950/50 border-pink-500 text-pink-400 font-bold shadow-[0_0_15px_rgba(236,72,153,0.25)]'
                        : 'bg-gray-800/40 border-gray-800 hover:border-gray-700 text-gray-300'
                        }`}
                    >
                      <span className="text-2xl mb-1">🌅</span>
                      <span className="text-xs">Synthwave</span>
                    </button>
                    <button
                      onClick={() => {
                        setBgType?.('video');
                        setBgVideoUrl?.('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4');
                      }}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all ${bgType === 'video' && bgVideoUrl === 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
                        ? 'bg-purple-950/50 border-purple-500 text-purple-400 font-bold shadow-[0_0_15px_rgba(168,85,247,0.25)]'
                        : 'bg-gray-800/40 border-gray-800 hover:border-gray-700 text-gray-300'
                        }`}
                    >
                      <span className="text-2xl mb-1">🎬</span>
                      <span className="text-xs">Sci-Fi City</span>
                    </button>
                    <button
                      onClick={() => {
                        document.getElementById('custom-video-upload')?.click();
                      }}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all relative ${bgType === 'video' && bgVideoUrl && bgVideoUrl !== 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
                        ? 'bg-green-950/50 border-green-500 text-green-400 font-bold shadow-[0_0_15px_rgba(34,197,94,0.25)]'
                        : 'bg-gray-800/40 border-gray-800 hover:border-gray-700 text-gray-300'
                        }`}
                    >
                      <span className="text-2xl mb-1">📂</span>
                      <span className="text-xs truncate max-w-full">
                        {bgType === 'video' && bgVideoUrl && bgVideoUrl !== 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
                          ? 'วิดีโอส่วนตัว'
                          : 'อัปโหลดวิดีโอ'}
                      </span>
                      <input
                        id="custom-video-upload"
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const url = URL.createObjectURL(file);
                            setBgType?.('video');
                            setBgVideoUrl?.(url);
                          }
                        }}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowBgSettings(false)}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-4 px-6 rounded-2xl shadow-lg text-lg active:scale-95 transition-transform mt-8"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      {/* Video Processing Overlay */}
      {isProcessingVideo && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md pointer-events-auto">
          <div className="bg-gray-900 border border-gray-700 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center max-w-sm mx-4 animate-in zoom-in-95 duration-300">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 border-4 border-gray-700 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h3 className="text-2xl font-black text-white mb-2 uppercase">กำลังประมวลผล...</h3>
            <p className="text-gray-400 text-sm">กรุณารอสักครู่ ระบบกำลังแปลงไฟล์วิดีโอคุณภาพสูง</p>
          </div>
        </div>
      )}
    </div>
  );
}
