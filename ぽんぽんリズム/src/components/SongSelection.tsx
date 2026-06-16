import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Play, Music, Sparkles, Trophy, Award, Moon, Volume2, Speaker } from 'lucide-react';
import { Song, Badge, UserStats } from '../types';
import { SONGS, BADGES } from '../data';
import { audioEngine } from '../audioEngine';

interface SongSelectionProps {
  userStats: UserStats;
  onSelectSong: (song: Song) => void;
  onSelectFreePlay: () => void;
  melodyVol: number;
  soundVol: number;
  onVolumeChange: (type: 'melody' | 'sound', val: number) => void;
}

export default function SongSelection({
  userStats,
  onSelectSong,
  onSelectFreePlay,
  melodyVol,
  soundVol,
  onVolumeChange
}: SongSelectionProps) {
  const [hoveredSong, setHoveredSong] = useState<string | null>(null);

  const handlePlayClick = (song: Song) => {
    audioEngine.playUIAudio('success');
    onSelectSong(song);
  };

  const handleFreePlayClick = () => {
    audioEngine.playUIAudio('success');
    onSelectFreePlay();
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 select-none font-sans">
      
      {/* Title Header Greeting Card */}
      <div className="bg-gradient-to-r from-teal-400 via-sky-400 to-indigo-400 text-white p-6 sm:p-8 rounded-3xl border-4 border-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        
        {/* Sparkly dynamic circles overlay */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-10 -translate-y-10" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-white/10 rounded-full blur-2xl" />

        <div className="flex flex-col gap-2 text-center md:text-left z-10">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <span className="text-3xl animate-cute-shake inline-block">🥁</span>
            <span className="bg-white/20 px-3 py-1 text-xs font-black rounded-full uppercase tracking-widest text-emerald-100">
              キッズおんがくあぷり
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight drop-shadow-md">
            ぽんぽんリズム
          </h1>
          <p className="text-sky-100 font-bold text-sm sm:text-base tracking-wider max-w-lg mt-1 leading-relaxed">
            ようこそ！リズムのひろばへ！<br />
            ながれてくるかわいいマークにあわせて、タップするだけでリズムかんが みにつくよ！
          </p>
        </div>

        {/* Free Play CTA Card on the right */}
        <motion.div 
          whileHover={{ scale: 1.05 }}
          className="bg-white/95 backdrop-blur-sm text-slate-800 p-4 rounded-2xl border-4 border-yellow-300 shadow-xl flex flex-col items-center justify-center text-center gap-3 w-full md:w-56 z-10"
        >
          <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center text-2xl animate-cute-bounce">
            🧸
          </div>
          <div>
            <h3 className="font-extrabold text-amber-500 text-base leading-tight">フリープレイ</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5">じゆうにドラムをたたこう！</p>
          </div>
          <button
            id="free-play-cta-btn"
            onClick={handleFreePlayClick}
            className="w-full py-2 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-450 border-b-4 border-amber-500 active:translate-y-1 active:border-b-0 rounded-xl text-white font-extrabold text-xs transition-all cursor-pointer shadow"
          >
            あそびにいく！
          </button>
        </motion.div>
      </div>

      {/* Main Grid: Songs & Badges */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 1. SONGS LIST (2/3 width) */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-extrabold text-indigo-950 flex items-center gap-2">
              <Music className="w-5 h-5 text-indigo-650" />
              <span>どのきょくであそぶ？</span>
            </h2>
            <span className="text-xs font-black text-rose-500 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
              ぜんぶで {SONGS.length}きょく
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {SONGS.map((song) => {
              const score = userStats.totalHighscore > 0 ? (song.id === 'twinkle' ? 4200 : song.id === 'frog' ? 3600 : 4800) : 0; // fallback preview score
              const starsCount = song.difficulty === 'easy' ? 1 : song.difficulty === 'normal' ? 2 : 3;

              return (
                <motion.div
                  key={song.id}
                  whileHover={{ scale: 1.015 }}
                  onMouseEnter={() => setHoveredSong(song.id)}
                  onMouseLeave={() => setHoveredSong(null)}
                  className={`p-5 rounded-3xl border-4 ${song.color} shadow-lg transition-all duration-300 flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden`}
                >
                  
                  {/* Subtle cartoon background shape */}
                  <div className="absolute right-12 top-1/2 -translate-y-1/2 text-8xl opacity-10 pointer-events-none transform rotate-12">
                    {song.emoji}
                  </div>

                  <div className="flex items-center gap-4 text-center sm:text-left z-10">
                    <span className="text-5xl bg-white/80 p-3 rounded-2xl border-2 border-white shadow-md animate-cute-bounce select-none">
                      {song.emoji}
                    </span>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                        <span className="text-lg font-black tracking-tight">{song.japaneseTitle}</span>
                        <div className="flex gap-0.5 text-yellow-500 text-xs font-bold leading-none bg-white/80 px-2 py-0.5 rounded-full border border-yellow-200">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <span key={i} className={i < starsCount ? 'text-amber-400' : 'text-slate-350 opacity-40'}>
                              ★
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 font-bold leading-relaxed max-w-sm">
                        {song.description}
                      </p>
                      <div className="text-[10px] font-bold text-slate-500 font-mono flex items-center justify-center sm:justify-start gap-3 mt-1">
                        <span>BPM (テンポ): {song.bpm}</span>
                        <span>•</span>
                        <span>むずかしさ: {song.difficulty === 'easy' ? 'かんたん' : song.difficulty === 'normal' ? 'ふつう' : 'むずかしい'}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    id={`play-song-btn-${song.id}`}
                    onClick={() => handlePlayClick(song)}
                    className="w-full sm:w-auto px-6 py-4 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-450 border-b-6 border-emerald-600 active:translate-y-1 active:border-b-0 rounded-2xl text-white font-black text-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md z-10"
                  >
                    <Play className="w-5 h-5 fill-white pointer-events-none" />
                    <span>スタート！</span>
                  </button>

                </motion.div>
              );
            })}
          </div>
        </div>

        {/* 2. MUSIC PANEL CONTROLS & BADGES (1/3 width) */}
        <div className="flex flex-col gap-6">
          
          {/* Sounds Settings Panel */}
          <div className="bg-white p-5 rounded-3xl border-4 border-indigo-100 shadow-lg flex flex-col gap-4">
            <h3 className="text-base font-extrabold text-indigo-950 flex items-center gap-2 border-b-2 border-indigo-50 pb-2">
              <Volume2 className="w-4 h-4 text-indigo-505" />
              <span>おとの おおきさ</span>
            </h3>
            
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-slate-500 font-bold">
                  <span>メロディ (背景のうた)</span>
                  <span>{Math.round(melodyVol * 100)}%</span>
                </div>
                <input
                  id="melody-volume-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={melodyVol}
                  onChange={(e) => onVolumeChange('melody', parseFloat(e.target.value))}
                  className="w-full h-2.5 bg-indigo-50 rounded-lg appearance-none cursor-pointer accent-indigo-505"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-slate-500 font-bold">
                  <span>たいこ・おもちゃの音</span>
                  <span>{Math.round(soundVol * 100)}%</span>
                </div>
                <input
                  id="sound-volume-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={soundVol}
                  onChange={(e) => onVolumeChange('sound', parseFloat(e.target.value))}
                  className="w-full h-2.5 bg-indigo-50 rounded-lg appearance-none cursor-pointer accent-indigo-505"
                />
              </div>
            </div>
          </div>

          {/* Badges Panel */}
          <div className="bg-white p-5 rounded-3xl border-4 border-indigo-100 shadow-lg flex flex-col gap-4 flex-1">
            <h3 className="text-base font-extrabold text-indigo-950 flex items-center gap-2 border-b-2 border-indigo-50 pb-2">
              <Award className="w-5 h-5 text-amber-500" />
              <span>あつめた メダル ({userStats.badges.length})</span>
            </h3>

            {userStats.badges.length === 0 ? (
              <div className="text-center py-6 flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-slate-50 text-slate-450 border border-dashed border-slate-200 rounded-full flex items-center justify-center text-xl">
                  🔒
                </div>
                <p className="text-xs text-slate-400 font-bold leading-normal">
                  リズムゲームをさいごまであそぶと<br />
                  メダルがもらえるよ！
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[190px] overflow-y-auto pr-1">
                {userStats.badges.map((badge) => (
                  <div key={badge.id} className="flex items-center gap-3 p-2 bg-gradient-to-r from-amber-50/50 to-orange-50/50 rounded-xl border border-amber-100 shadow-sm">
                    <span className="text-3xl bg-white p-1 rounded-lg border border-amber-200 shadow-sm animate-cute-shake inline-block">
                      {badge.emoji}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-800">{badge.title}</span>
                      <span className="text-[10px] text-slate-500 font-bold leading-none mt-0.5">{badge.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
