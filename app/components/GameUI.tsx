'use client';

import React, { useState } from 'react';

interface VideoResultProps {
  recordedVideoUrl?: string | null;
  isProcessingVideo?: boolean;
  onSave?: (resolution: '360p' | '720p') => void;
  onShare?: () => void;
}

const VideoResult = ({ recordedVideoUrl, isProcessingVideo, onSave, onShare }: VideoResultProps) => {
  const [isMuted, setIsMuted] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  return (
    <div className="mt-2 mb-0 w-full flex justify-center">
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
          <div className="flex gap-2">
            <button onClick={() => onSave?.('360p')} disabled={isProcessingVideo} className="flex-1 flex items-center justify-center gap-1 bg-gray-800 hover:bg-black text-white font-bold py-3 px-1 rounded-xl shadow-md text-sm transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100">
               {isProcessingVideo ? 'รอสักครู่...' : '⬇️ 360p'}
            </button>
            <button onClick={() => onSave?.('720p')} disabled={isProcessingVideo} className="flex-1 flex items-center justify-center gap-1 bg-gray-800 hover:bg-black text-white font-bold py-3 px-1 rounded-xl shadow-md text-sm transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100">
               {isProcessingVideo ? 'รอสักครู่...' : '⬇️ 720p'}
            </button>
            <button onClick={onShare} disabled={isProcessingVideo} className="flex-1 flex items-center justify-center gap-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-1 rounded-xl shadow-md text-sm transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100">
               {isProcessingVideo ? 'รอสักครู่...' : '📲 แชร์'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

interface GameUIProps {
  timeRemaining: number;
  maxTime: number;
  score: number;
  targetScore: number;
  gameStatus: 'idle' | 'countdown' | 'playing' | 'win' | 'lose' | 'ending' | 'preview';
  currentExercise: 'jumping_jacks' | 'squats' | 'high_knees';
  countdownValue?: number;
  gameMode?: 'normal' | 'score';
  globalTime?: number;
  exerciseTime?: number;
  gamePoints?: number;
  comboCount?: number;
  floatingPoints?: {id: number, text: string, type: 'plus'|'minus'|'bonus'}[];
  recordedVideoUrl?: string | null;
  isProcessingVideo?: boolean;
  removeBackground?: boolean;
  bgType?: 'neon-grid' | 'synthwave' | 'video';
  bgVideoUrl?: string | null;
  setRemoveBackground?: (val: boolean) => void;
  setBgType?: (val: 'neon-grid' | 'synthwave' | 'video') => void;
  setBgVideoUrl?: (val: string | null) => void;
  onStart: (mode?: 'normal' | 'score', exercise?: 'jumping_jacks' | 'squats' | 'high_knees') => void;
  onSave?: (resolution: '360p' | '720p') => void;
  onShare?: () => void;
}

export default function GameUI({ 
  timeRemaining, maxTime, score, targetScore, gameStatus, currentExercise, countdownValue, 
  gameMode = 'normal', globalTime = 30, exerciseTime = 5, gamePoints = 0, comboCount = 0, floatingPoints = [],
  recordedVideoUrl = null, isProcessingVideo = false,
  removeBackground = false, bgType = 'neon-grid', bgVideoUrl = null,
  setRemoveBackground, setBgType, setBgVideoUrl,
  onStart, onSave, onShare
}: GameUIProps) {
  const cleanPercentage = Math.min((score / targetScore) * 100, 100);

  const getExerciseName = () => {
    if (currentExercise === 'squats') return 'สควอท';
    if (currentExercise === 'high_knees') return 'วิ่งอยู่กับที่';
    return 'กระโดดตบ';
  };

  const [showHowToPlay, setShowHowToPlay] = useState(true);
  const [showBgSettings, setShowBgSettings] = useState(false);

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none flex flex-col justify-between p-4 safe-area-pt overflow-hidden">
      
      {/* Floating Points Animations (Now handled by Canvas) */}

      {/* Playing UI is now rendered on Canvas, so no DOM UI needed for countdown and playing */}

      {/* Main Menu Overlay (Centered) */}
      {gameStatus === 'idle' && (
        <div 
          className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-auto bg-cover bg-center"
          style={{ backgroundImage: 'url(/fitness_bg.png)' }}
        >
          
          {/* Title */}
          <div className="mt-8 mb-2 text-center animate-in slide-in-from-top-10 fade-in duration-700">
            <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 via-orange-500 to-red-600 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] mb-2 tracking-tighter uppercase">
              Movement
            </h1>
            <h1 className="text-5xl md:text-6xl font-black text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] mb-3 tracking-tighter uppercase">
              Active
            </h1>
            <div className="inline-block bg-white/20 backdrop-blur-sm px-4 py-1 rounded-full border border-white/30 shadow-lg">
               <p className="text-yellow-300 font-bold text-sm tracking-widest uppercase drop-shadow-md">AI Fitness Challenge</p>
            </div>
          </div>
          {/* Start Button */}
          <div className="w-full max-w-[220px] flex flex-col gap-6 px-6 mt-48">
            <button 
              onClick={() => onStart('score')}
              className="relative group w-full bg-gradient-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-white font-black py-3 px-4 rounded-2xl shadow-[0_6px_20px_rgba(6,182,212,0.5)] text-xl active:scale-95 transition-all duration-300 overflow-hidden border-b-4 border-blue-800"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out rounded-2xl"></div>
              <span className="relative z-10 flex items-center justify-center gap-2 drop-shadow-md">
                เริ่มเกม <span className="text-2xl animate-pulse">⚡</span>
              </span>
            </button>
          </div>

          {/* Help Button */}
          {!showHowToPlay && (
            <button 
              onClick={() => setShowHowToPlay(true)}
              className="absolute top-4 left-4 w-10 h-10 bg-black/40 hover:bg-black/60 backdrop-blur-md border-2 border-white/30 rounded-full flex items-center justify-center text-white font-black text-xl shadow-[0_0_10px_rgba(0,0,0,0.5)] active:scale-95 transition-all duration-300 z-50 group"
            >
              <span className="group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300">?</span>
            </button>
          )}

          {/* Settings Button */}
          <button 
            onClick={() => setShowBgSettings(true)}
            className="absolute top-4 right-4 w-10 h-10 bg-black/40 hover:bg-black/60 backdrop-blur-md border-2 border-white/30 rounded-full flex items-center justify-center text-white text-lg shadow-[0_0_10px_rgba(0,0,0,0.5)] active:scale-95 transition-all duration-300 z-50 group pointer-events-auto"
          >
            <span className="group-hover:rotate-45 transition-transform duration-300">⚙️</span>
          </button>
          
          {/* Version Number */}
          <div className="absolute bottom-4 right-4 text-white/40 text-[10px] font-mono tracking-widest pointer-events-none">
            v{process.env.NEXT_PUBLIC_COMMIT_HASH || 'dev'}
          </div>
        </div>
      )}

      {/* Bottom Action Area (Win/Lose screens) */}
      <div className="w-full flex flex-col items-center justify-end pb-8 pointer-events-auto">

        {gameStatus === 'win' && (
          <div className="bg-white/95 backdrop-blur-lg w-full max-w-sm p-6 rounded-3xl shadow-2xl text-center border-t-4 border-green-500 animate-in slide-in-from-bottom-10 fade-in duration-500 overflow-y-auto max-h-[85vh]">
            {gameMode === 'score' ? (
              <>
                <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <span className="text-5xl">🏆</span>
                </div>
                <h2 className="text-3xl font-black text-gray-800 mb-1">TIME UP!</h2>
                <p className="text-sm font-medium text-gray-500 mb-6">จบเกมชาเลนจ์</p>
                
                <div className="bg-gray-100 rounded-2xl p-4 mb-8 shadow-inner border border-gray-200">
                  <p className="text-xs text-gray-500 font-bold uppercase mb-1">คะแนนรวม</p>
                  <p className="text-6xl font-black text-yellow-500 drop-shadow-sm">{gamePoints}</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-3xl">✨</span>
                </div>
                <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-blue-500 mb-2">FRESH!</h2>
                <p className="text-sm font-medium text-gray-600 mb-6">You successfully cleared all the musty smell!</p>
              </>
            )}
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
        <div className="absolute inset-0 z-50 bg-gray-900 flex flex-col pointer-events-auto animate-in fade-in duration-500">
           <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-lg mx-auto">
              <VideoResult 
                recordedVideoUrl={recordedVideoUrl} 
                isProcessingVideo={isProcessingVideo} 
                onSave={onSave} 
                onShare={onShare} 
              />
              {!isProcessingVideo && (
                <button 
                  onClick={() => onStart()}
                  className="w-full max-w-[280px] mt-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold py-2 px-4 rounded-xl shadow-md text-sm active:scale-95 transition-all duration-300 border-b-2 border-blue-800"
                >
                  เล่นอีกครั้ง
                </button>
              )}
           </div>
        </div>
      )}

      {/* How to Play Modal */}
      {showHowToPlay && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setShowHowToPlay(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full font-bold active:scale-95 transition-transform"
            >
              ✕
            </button>
            <h2 className="text-2xl font-black text-center text-gray-800 mb-6 uppercase">
              วิธีการเล่น
            </h2>
            <div className="space-y-4 text-gray-600">
              <div className="bg-yellow-50 p-4 rounded-2xl">
                <h3 className="font-bold text-yellow-800 mb-1">📸 1. การเตรียมตัว</h3>
                <p className="text-sm">วางกล้องให้เห็นเต็มตัว และเว้นระยะห่างให้พอดี AI จะคอยจับการเคลื่อนไหวของคุณ</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl">
                <h3 className="font-bold text-blue-800 mb-1">🏃‍♂️ 2. แข่งกับเวลา</h3>
                <p className="text-sm">ระบบจะสุ่มท่าให้ทำทีละ 1 ท่า โดยมีเวลาจำกัดเพียง <strong>5 วินาที</strong> ยิ่งคะแนนเยอะเวลาจะยิ่งน้อยลงเรื่อยๆ!</p>
              </div>
              <div className="bg-green-50 p-4 rounded-2xl">
                <h3 className="font-bold text-green-800 mb-1">⚡ 3. โบนัสพิเศษ</h3>
                <ul className="text-sm list-disc list-inside space-y-1">
                  <li><strong>Perfect:</strong> ทำท่าเสร็จใน 2 วิแรก ได้คะแนน +2</li>
                  <li><strong>Combo x3:</strong> ทำสำเร็จ 3 ท่าติด ได้โบนัสคะแนน</li>
                  <li><strong>Combo x5:</strong> ทำสำเร็จ 5 ท่าติด ได้เวลาเพิ่ม +5 วินาที</li>
                </ul>
              </div>
            </div>
            <button 
              onClick={() => setShowHowToPlay(false)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-2xl shadow-lg text-lg active:scale-95 transition-transform mt-6"
            >
              เข้าใจแล้ว เริ่มเลย!
            </button>
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
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all ${
                        bgType === 'neon-grid' 
                          ? 'bg-cyan-950/50 border-cyan-500 text-cyan-400 font-bold shadow-[0_0_15px_rgba(6,182,212,0.25)]' 
                          : 'bg-gray-800/40 border-gray-800 hover:border-gray-700 text-gray-300'
                      }`}
                    >
                      <span className="text-2xl mb-1">🌐</span>
                      <span className="text-xs">Neon Grid</span>
                    </button>
                    <button 
                      onClick={() => setBgType?.('synthwave')}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all ${
                        bgType === 'synthwave' 
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
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all ${
                        bgType === 'video' && bgVideoUrl === 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
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
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all relative ${
                        bgType === 'video' && bgVideoUrl && bgVideoUrl !== 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
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
