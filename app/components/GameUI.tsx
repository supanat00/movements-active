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
  onStart: () => void;
}

export default function GameUI({ timeRemaining, maxTime, score, targetScore, gameStatus, currentExercise, countdownValue, onStart }: GameUIProps) {
  const cleanPercentage = Math.min((score / targetScore) * 100, 100);

  const getExerciseName = () => {
    if (currentExercise === 'squats') return 'สควอท';
    if (currentExercise === 'high_knees') return 'วิ่งอยู่กับที่';
    return 'กระโดดตบ';
  };

  return (
    <div className="absolute inset-0 w-full h-[100dvh] pointer-events-none flex flex-col justify-between p-4 safe-area-pt">
      {/* Top Bar: Timer and Meter (Mobile Layout) */}
      <div className="flex flex-col gap-3 w-full mt-4">
        {/* Timer */}
        <div className="flex justify-center w-full">
          <div className="bg-white/90 backdrop-blur rounded-full px-6 py-2 shadow-xl border border-gray-100">
            <span className="text-3xl font-black text-red-600 tracking-tighter">
              {timeRemaining.toFixed(1)}s
            </span>
          </div>
        </div>
        
        {/* Clean Meter */}
        <div className="w-full max-w-sm mx-auto bg-black/40 p-3 rounded-2xl backdrop-blur-sm">
          <div className="flex justify-between items-end mb-1 px-1">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Clean Meter</span>
            <span className="text-sm font-black text-green-400 drop-shadow-md">{Math.round(cleanPercentage)}%</span>
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
          <div className="text-center bg-black/50 px-6 py-3 rounded-full backdrop-blur-md">
            <p className="text-white font-bold text-2xl drop-shadow-lg uppercase">
              {getExerciseName()}! <span className="text-green-400">{score}/{targetScore}</span>
            </p>
          </div>
        )}
      </div>

      {/* Bottom Action Area */}
      <div className="w-full flex flex-col items-center justify-end pb-8 pointer-events-auto">
        {gameStatus === 'idle' && (
          <button 
            onClick={onStart}
            className="w-full max-w-xs bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-black py-5 px-6 rounded-3xl shadow-[0_10px_25px_rgba(16,185,129,0.5)] text-xl animate-bounce active:scale-95 transition-transform"
          >
            START CHALLENGE
          </button>
        )}

        {gameStatus === 'win' && (
          <div className="bg-white/95 backdrop-blur-lg w-full max-w-xs p-6 rounded-3xl shadow-2xl text-center border-t-4 border-green-500 animate-in slide-in-from-bottom-10 fade-in duration-500">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">✨</span>
            </div>
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-blue-500 mb-2">FRESH!</h2>
            <p className="text-sm font-medium text-gray-600 mb-6">You successfully cleared all the musty smell!</p>
            <button 
              onClick={onStart}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-2xl shadow-lg text-lg active:scale-95 transition-transform"
            >
              Play Again
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
              onClick={onStart}
              className="w-full bg-gray-100 hover:bg-white text-gray-900 font-bold py-4 px-6 rounded-2xl shadow-lg text-lg active:scale-95 transition-transform"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
