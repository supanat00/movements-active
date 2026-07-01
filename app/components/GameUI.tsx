'use client';

import React from 'react';

interface GameUIProps {
  timeRemaining: number;
  maxTime: number;
  score: number;
  targetScore: number;
  gameStatus: 'idle' | 'countdown' | 'playing' | 'win' | 'lose';
  currentExercise: 'jumping_jacks' | 'squats' | 'high_knees';
  countdownValue?: number;
  gameMode?: 'normal' | 'score';
  globalTime?: number;
  exerciseTime?: number;
  gamePoints?: number;
  comboCount?: number;
  floatingPoints?: {id: number, text: string, type: 'plus'|'minus'|'bonus'}[];
  onStart: (mode?: 'normal' | 'score', exercise?: 'jumping_jacks' | 'squats' | 'high_knees') => void;
}

export default function GameUI({ 
  timeRemaining, maxTime, score, targetScore, gameStatus, currentExercise, countdownValue, 
  gameMode = 'normal', globalTime = 30, exerciseTime = 5, gamePoints = 0, comboCount = 0, floatingPoints = [],
  onStart 
}: GameUIProps) {
  const cleanPercentage = Math.min((score / targetScore) * 100, 100);

  const getExerciseName = () => {
    if (currentExercise === 'squats') return 'สควอท';
    if (currentExercise === 'high_knees') return 'วิ่งอยู่กับที่';
    return 'กระโดดตบ';
  };

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

      {/* Top Bar: Timer and Meter (Mobile Layout) */}
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

      {/* Center Instructions (when playing) */}
      <div className="flex-1 flex items-center justify-center pointer-events-none">
        {gameStatus === 'countdown' && (
          <div className="flex flex-col items-center justify-center">
            <h2 className="text-white font-bold text-2xl drop-shadow-md mb-4 uppercase">
              เตรียมตัว {getExerciseName()}!
            </h2>
            <div className="text-9xl font-black text-white drop-shadow-[0_0_30px_rgba(34,197,94,0.8)] animate-ping">
              {countdownValue}
            </div>
          </div>
        )}

        {gameStatus === 'playing' && (
          <div className="flex flex-col items-center">
            <div className="text-center bg-black/70 px-8 py-4 rounded-3xl backdrop-blur-md border border-white/10 shadow-2xl">
              <p className="text-white font-bold text-3xl drop-shadow-lg uppercase mb-2">
                {getExerciseName()}!
              </p>
              <div className="text-2xl text-green-400 font-black">
                {score} / {targetScore}
              </div>
            </div>
            
            {gameMode === 'score' && (
              <div className="mt-8 flex flex-col items-center w-56 bg-black/50 p-4 rounded-2xl backdrop-blur-md">
                 <span className="text-white font-bold mb-2">เวลาทำท่านี้</span>
                 <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden border border-white/20">
                   <div 
                     className={`h-full transition-all duration-100 ease-linear ${exerciseTime < 2 ? 'bg-red-500' : 'bg-orange-400'}`}
                     style={{ width: `${(exerciseTime / 5) * 100}%` }}
                   />
                 </div>
                 <span className="text-white font-black text-2xl mt-2">{exerciseTime.toFixed(1)}s</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Area */}
      <div className="w-full flex flex-col items-center justify-end pb-8 pointer-events-auto">
        {gameStatus === 'idle' && (
          <div className="w-full max-w-sm flex flex-col gap-6 px-4">
             <div className="flex flex-col gap-3">
               <div className="bg-black/60 backdrop-blur-md rounded-xl py-2 mb-1 shadow-lg">
                 <h3 className="text-yellow-400 text-center font-black uppercase tracking-wider">🎯 โหมดเก็บคะแนน (30 วิ)</h3>
               </div>
               <button 
                 onClick={() => onStart('score')}
                 className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-300 hover:to-orange-400 text-white font-black py-5 px-6 rounded-3xl shadow-[0_10px_25px_rgba(234,179,8,0.5)] text-2xl active:scale-95 transition-transform animate-pulse"
               >
                 🔥 เริ่ม SCORE MODE 🔥
               </button>
             </div>

             <div className="flex flex-col gap-3 border-t border-white/30 pt-6">
               <div className="bg-black/40 backdrop-blur-sm rounded-xl py-2 mb-1">
                 <h3 className="text-white text-center font-bold">🏋️ โหมดฝึกซ้อม (เลือกท่าเอง)</h3>
               </div>
               <button 
                 onClick={() => onStart('normal', 'jumping_jacks')}
                 className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-2xl shadow-lg text-lg active:scale-95 transition-transform"
               >
                 กระโดดตบ (Jumping Jacks)
               </button>
               <button 
                 onClick={() => onStart('normal', 'squats')}
                 className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold py-3 px-6 rounded-2xl shadow-lg text-lg active:scale-95 transition-transform"
               >
                 สควอท (Squats)
               </button>
               <button 
                 onClick={() => onStart('normal', 'high_knees')}
                 className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold py-3 px-6 rounded-2xl shadow-lg text-lg active:scale-95 transition-transform"
               >
                 วิ่งอยู่กับที่ (High Knees)
               </button>
             </div>
          </div>
        )}

        {gameStatus === 'win' && (
          <div className="bg-white/95 backdrop-blur-lg w-full max-w-xs p-6 rounded-3xl shadow-2xl text-center border-t-4 border-green-500 animate-in slide-in-from-bottom-10 fade-in duration-500">
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
          <div className="bg-gray-900/95 backdrop-blur-lg w-full max-w-xs p-6 rounded-3xl shadow-2xl text-center border-t-4 border-red-500 animate-in slide-in-from-bottom-10 fade-in duration-500">
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
    </div>
  );
}
