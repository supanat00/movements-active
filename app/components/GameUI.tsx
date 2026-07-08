'use client';

import React, { useState } from 'react';

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
  onStart: (mode?: 'normal' | 'score', exercise?: 'jumping_jacks' | 'squats' | 'high_knees') => void;
  onSave?: () => void;
  onShare?: () => void;
}

export default function GameUI({ 
  timeRemaining, maxTime, score, targetScore, gameStatus, currentExercise, countdownValue, 
  gameMode = 'normal', globalTime = 30, exerciseTime = 5, gamePoints = 0, comboCount = 0, floatingPoints = [],
  recordedVideoUrl = null, isProcessingVideo = false,
  onStart, onSave, onShare
}: GameUIProps) {
  const cleanPercentage = Math.min((score / targetScore) * 100, 100);

  const getExerciseName = () => {
    if (currentExercise === 'squats') return 'สควอท';
    if (currentExercise === 'high_knees') return 'วิ่งอยู่กับที่';
    return 'กระโดดตบ';
  };

  const [showHowToPlay, setShowHowToPlay] = useState(true);

  const VideoResult = () => (
    <div className="mt-2 mb-6 w-full flex justify-center">
      {recordedVideoUrl ? (
        <div className="flex flex-col gap-4 w-full max-w-[280px]">
          <div className="w-full aspect-[9/16] rounded-2xl shadow-xl border border-gray-600 bg-black overflow-hidden relative">
            <video 
              src={recordedVideoUrl} 
              className="absolute inset-0 w-full h-full object-cover"
              autoPlay 
              loop 
              muted 
              playsInline
            />
          </div>
          <div className="flex gap-2">
            <button onClick={onSave} disabled={isProcessingVideo} className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-black text-white font-bold py-3 px-2 rounded-xl shadow-md text-sm transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100">
               {isProcessingVideo ? 'รอสักครู่...' : '⬇️ บันทึก'}
            </button>
            <button onClick={onShare} disabled={isProcessingVideo} className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-2 rounded-xl shadow-md text-sm transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100">
               {isProcessingVideo ? 'รอสักครู่...' : '📲 แชร์'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="absolute inset-0 w-full h-[100dvh] pointer-events-none flex flex-col justify-between p-4 safe-area-pt overflow-hidden">
      
      {/* Floating Points Animations */}
      {floatingPoints.map(fp => (
        <div 
          key={fp.id} 
          className={`absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 text-5xl font-black drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-bottom-10 zoom-in duration-500 pointer-events-none z-50
            ${fp.type === 'plus' ? 'text-green-400' : 
              fp.type === 'bonus' ? 'text-yellow-400 scale-125' : 'text-red-500'}`}
        >
          {fp.text}
        </div>
      ))}

      {/* Top Bar: Timer and Meter (Mobile Layout) - Hidden on idle */}
      {gameStatus !== 'idle' && (
        <div className="flex flex-col gap-3 w-full mt-4">
          {gameMode === 'normal' ? (
            <div className="flex justify-center w-full">
              <div className="bg-white/90 backdrop-blur rounded-full px-6 py-2 shadow-xl border border-gray-100">
                <span className="text-3xl font-black text-red-600 tracking-tighter">
                  {timeRemaining.toFixed(1)}s
                </span>
              </div>
            </div>
          ) : (
            <div className="flex justify-between w-full px-2">
              <div className="bg-gray-900/90 backdrop-blur rounded-2xl px-6 py-2 border-2 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.4)]">
                <span className="block text-[11px] text-yellow-400 font-bold uppercase tracking-widest text-center">Score</span>
                <span className="block text-4xl font-black text-white text-center leading-none">{gamePoints}</span>
              </div>
              <div className="bg-white/95 backdrop-blur rounded-2xl px-6 py-2 shadow-xl border border-gray-100 flex flex-col justify-center">
                 <span className="block text-[11px] text-gray-500 font-bold uppercase tracking-widest text-center">Time Left</span>
                 <span className="block text-4xl font-black text-red-600 text-center leading-none">{globalTime.toFixed(1)}s</span>
              </div>
            </div>
          )}
          
          {/* Clean Meter */}
          <div className="w-full max-w-sm mx-auto bg-black/60 p-3 rounded-2xl backdrop-blur-md border border-white/10">
            <div className="flex justify-between items-end mb-1 px-1">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                 {gameMode === 'score' ? `🔥 Combo: ${comboCount}` : 'Clean Meter'}
              </span>
              <span className="text-sm font-black text-green-400 drop-shadow-md">
                 {gameMode === 'score' ? `${score}/${targetScore}` : `${Math.round(cleanPercentage)}%`}
              </span>
            </div>
            <div className="h-5 w-full bg-gray-800 rounded-full overflow-hidden shadow-inner border border-white/20">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-green-400 transition-all duration-300 ease-out"
                style={{ width: `${cleanPercentage}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Exercise Instructions (when playing) */}
      {gameStatus === 'countdown' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30">
          <h2 className="text-white font-bold text-2xl drop-shadow-md mb-4 uppercase">
            เตรียมตัว {getExerciseName()}!
          </h2>
          <div className="text-9xl font-black text-white drop-shadow-[0_0_30px_rgba(34,197,94,0.8)] animate-ping">
            {countdownValue}
          </div>
        </div>
      )}

      {gameStatus === 'playing' && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none w-full z-30 px-4">
          <div className="flex items-center justify-center gap-4 bg-black/80 px-8 py-3 rounded-full backdrop-blur-md border border-white/20 shadow-2xl">
            <p className="text-white font-bold text-2xl drop-shadow-md uppercase">
              {getExerciseName()}
            </p>
            <div className="text-2xl text-green-400 font-black">
              {score} / {targetScore}
            </div>
          </div>
          
          {gameMode === 'score' && (
            <div className="mt-4 flex items-center justify-center gap-3 bg-black/70 px-5 py-2 rounded-full backdrop-blur-md shadow-2xl border border-white/20 w-64">
               <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden shadow-inner">
                 <div 
                   className={`h-full transition-all duration-100 ease-linear ${exerciseTime < 2 ? 'bg-red-500' : 'bg-orange-400'}`}
                   style={{ width: `${(exerciseTime / 5) * 100}%` }}
                 />
               </div>
               <span className="text-white font-black text-xl w-12 text-right">{exerciseTime.toFixed(1)}s</span>
            </div>
          )}
        </div>
      )}

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
              กลับไปหน้าเลือกโหมด
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
              กลับไปหน้าเลือกโหมด
            </button>
          </div>
        )}
      </div>

      {/* Ending Overlay */}
      {gameStatus === 'ending' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
          <div className="text-[120px] mb-4 animate-[bounce_1s_ease-in-out_infinite] drop-shadow-[0_0_30px_rgba(255,255,0,0.8)]">🏆</div>
          <div className="text-6xl font-black text-yellow-400 drop-shadow-[0_5px_5px_rgba(0,0,0,1)] tracking-widest">SCORE: {gamePoints}</div>
        </div>
      )}

      {/* Preview Full Screen */}
      {gameStatus === 'preview' && (
        <div className="absolute inset-0 z-50 bg-gray-900 flex flex-col pointer-events-auto animate-in fade-in duration-500">
           <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-lg mx-auto">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-6 uppercase tracking-wider drop-shadow-md">Video Preview</h2>
              <VideoResult />
              {!isProcessingVideo && (
                <button 
                  onClick={() => onStart()}
                  className="w-full mt-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold py-4 px-6 rounded-2xl shadow-lg text-lg active:scale-95 transition-all duration-300 border-b-4 border-blue-800"
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
              <div className="bg-blue-50 p-4 rounded-2xl">
                <h3 className="font-bold text-blue-800 mb-1">🎮 โหมดเก็บคะแนน</h3>
                <p className="text-sm">ทำท่าออกกำลังกายให้ถูกต้องเพื่อสะสมคะแนนภายในเวลาที่กำหนด</p>
              </div>
              <div className="bg-green-50 p-4 rounded-2xl">
                <h3 className="font-bold text-green-800 mb-1">🏋️ โหมดฝึกซ้อม</h3>
                <p className="text-sm">ฝึกท่าออกกำลังกายทีละท่าเพื่อให้ AI ตรวจจับท่าทางได้อย่างแม่นยำ</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-2xl">
                <h3 className="font-bold text-yellow-800 mb-1">📸 การตั้งกล้อง</h3>
                <p className="text-sm">วางอุปกรณ์ให้เห็นเต็มตัว ตั้งแต่ศีรษะจนถึงเท้า และอยู่ในที่ที่มีแสงสว่างเพียงพอ</p>
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
    </div>
  );
}
