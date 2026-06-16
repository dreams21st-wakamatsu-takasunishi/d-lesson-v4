import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RotateCcw, Home, Star, Heart, Award, ArrowRight } from 'lucide-react';
import { Song, ScoreState, Badge } from '../types';
import { BADGES } from '../data';
import { audioEngine } from '../audioEngine';

interface ScoreScreenProps {
  scoreState: ScoreState;
  song: Song;
  onRestart: () => void;
  onBackToMenu: () => void;
  newBadgesUnlocked: Badge[]; // list of medals unlocked in this exact session
}

export default function ScoreScreen({
  scoreState,
  song,
  onRestart,
  onBackToMenu,
  newBadgesUnlocked
}: ScoreScreenProps) {
  
  // Calculate star rating (out of 3) depending on final score accuracy
  const totalPossiblePoints = song.notes.length * 200; // raw potential perfect score
  const scorePercent = totalPossiblePoints > 0 ? (scoreState.score / totalPossiblePoints) * 100 : 0;

  let starsEarned = 1;
  let summaryText = 'がんばったね！もっとポンポンしてみよう！☀️';
  let bannerEmoji = '🎉';
  
  if (scorePercent >= 85) {
    starsEarned = 3;
    summaryText = 'たいへんよくできました！リズムの天才だね！💮';
    bannerEmoji = '👑';
  } else if (scorePercent >= 55) {
    starsEarned = 2;
    summaryText = 'すごい！とってもじょうずに演奏できたよ！🌟';
    bannerEmoji = '✨';
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 select-none font-sans bg-white p-6 sm:p-8 rounded-3xl border-8 border-indigo-250 shadow-2xl relative text-slate-800">
      
      {/* Top Banner with celebrations */}
      <div className="text-center flex flex-col items-center gap-3">
        <span className="text-5xl animate-cute-bounce inline-block">{bannerEmoji}</span>
        <h1 className="text-3xl font-black text-indigo-950">さいごまでいけたよ！</h1>
        <p className="text-indigo-600 font-extrabold text-sm bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-150">
          演奏曲: {song.japaneseTitle}
        </p>
      </div>

      {/* DYNAMIC RATING STARS (Kids love 3 stars!) */}
      <div className="flex justify-center gap-4 py-2">
        {Array.from({ length: 3 }).map((_, i) => {
          const isActivated = i < starsEarned;
          return (
            <motion.div
              key={i}
              initial={{ scale: 0.1, rotate: -45 }}
              animate={isActivated ? { scale: [1, 1.3, 1], rotate: 0 } : { scale: 0.8 }}
              transition={{ delay: i * 0.2, type: 'spring' }}
              className={`p-1 ${isActivated ? 'text-amber-400 drop-shadow-md' : 'text-slate-200'}`}
            >
              <Star className={`w-14 h-14 ${isActivated ? 'fill-current stroke-amber-500 stroke-2' : ''}`} />
            </motion.div>
          );
        })}
      </div>

      <div className="bg-gradient-to-b from-indigo-50 to-indigo-100/50 p-6 rounded-2xl border-2 border-indigo-150 flex flex-col items-center gap-4">
        <span className="text-xs font-black uppercase text-indigo-650 tracking-wider">ごうけい てんすう</span>
        <span className="text-5xl font-black font-mono text-indigo-900 tracking-tight">{scoreState.score}</span>
        
        <p className="text-center font-black text-slate-700 text-sm max-w-md bg-white px-4 py-2 rounded-xl shadow-xs border border-indigo-50 leading-relaxed">
          {summaryText}
        </p>
      </div>

      {/* DETAILED STATS COUNTER */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-150 text-center font-mono">
        <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex flex-col">
          <span className="text-[10px] font-black text-amber-500 tracking-wider">すばらしい! 🌟</span>
          <span className="text-xl font-black mt-1 text-slate-800">{scoreState.perfect}</span>
        </div>

        <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex flex-col">
          <span className="text-[10px] font-black text-indigo-500 tracking-wider">いいね! 👍</span>
          <span className="text-xl font-black mt-1 text-slate-800">{scoreState.great}</span>
        </div>

        <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex flex-col">
          <span className="text-[10px] font-black text-emerald-500 tracking-wider">おしい! 🙂</span>
          <span className="text-xl font-black mt-1 text-slate-800">{scoreState.good}</span>
        </div>

        <div className="bg-white p-2.5 rounded-xl border border-slate-100 flex flex-col">
          <span className="text-[10px] font-black text-slate-400 tracking-wider">どんまい! 😢</span>
          <span className="text-xl font-black mt-1 text-slate-800">{scoreState.miss}</span>
        </div>
      </div>

      {/* MAXIMUM COMBO INDICATOR */}
      {scoreState.maxCombo > 0 && (
        <div className="flex items-center justify-center gap-2 bg-pink-50 border border-pink-100 px-6 py-2.5 rounded-2xl font-black text-pink-700 text-sm">
          <span>👑 さいだいコンボ : {scoreState.maxCombo} かい れんぞくヒット！</span>
        </div>
      )}

      {/* NEW BADGES/MEDALS UNLOCKED CELEBRATION! */}
      <AnimatePresence>
        {newBadgesUnlocked.length > 0 && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="border-4 border-yellow-300 bg-yellow-50/90 rounded-3xl p-5 shadow-lg flex flex-col items-center gap-3 text-center"
          >
            <div className="w-12 h-12 bg-yellow-400 text-white rounded-full flex items-center justify-center animate-bounce shadow">
              <Award className="w-6 h-6 stroke-[3]" />
            </div>
            <div>
              <span className="text-[10px] font-black text-amber-600 tracking-wider uppercase">あたらしくメダルを ゲットしたよ！</span>
              <h4 className="text-lg font-black text-amber-800 mt-1">{newBadgesUnlocked[0].title}</h4>
              <p className="text-sm text-slate-600 font-bold mt-0.5">{newBadgesUnlocked[0].description}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ACTION CONTROLLERS */}
      <div className="flex flex-col sm:flex-row gap-3 mt-2">
        <button
          id="score-restart-btn"
          onClick={onRestart}
          className="flex-1 py-4 px-6 bg-amber-100 hover:bg-amber-200 text-amber-850 border-b-6 border-amber-300 rounded-2xl font-black text-base active:translate-y-1 active:border-b-0 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-5 h-5 pointer-events-none" />
          <span>もう一回あそぶ</span>
        </button>

        <button
          id="score-menu-btn"
          onClick={onBackToMenu}
          className="flex-1 py-4 px-6 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-450 text-white border-b-6 border-emerald-600 rounded-2xl font-black text-lg active:translate-y-1 active:border-b-0 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
        >
          <Home className="w-5 h-5 pointer-events-none" />
          <span>きょくを選ぶ</span>
        </button>
      </div>

    </div>
  );
}
