import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Sparkles, Volume2 } from 'lucide-react';
import { InstrumentType, Particle } from '../types';
import { audioEngine } from '../audioEngine';

interface FreePlayProps {
  onBackToMenu: () => void;
  onTrackDrumClick: () => void; // counts total drum hits to unlock performance badge!
}

interface ToySound {
  type: InstrumentType;
  label: string;
  emoji: string;
  key: string;
  color: string;
  description: string;
}

const TOY_SOUNDS: ToySound[] = [
  {
    type: 'drum',
    label: 'こぐま ドラム',
    emoji: '🐻‍❄️',
    key: '1',
    color: 'from-orange-400 to-amber-500 shadow-orange-100 border-orange-200',
    description: 'ドン！とひびくよ'
  },
  {
    type: 'bell',
    label: 'きらきら チャイム',
    emoji: '⭐',
    key: '2',
    color: 'from-indigo-400 to-blue-500 shadow-indigo-100 border-indigo-200',
    description: 'チーンといいおと'
  },
  {
    type: 'cat',
    label: 'こねこ ミャー',
    emoji: '🐱',
    key: '3',
    color: 'from-pink-400 to-rose-500 shadow-pink-100 border-pink-200',
    description: 'ニャーン！と鳴くよ'
  },
  {
    type: 'dog',
    label: 'こいぬ ワフワフ',
    emoji: '🐶',
    key: '4',
    color: 'from-amber-400 to-yellow-500 shadow-amber-100 border-amber-200',
    description: 'ワンワン！と吼えるよ'
  },
  {
    type: 'frog',
    label: 'カエル ケロケロ',
    emoji: '🐸',
    key: '5',
    color: 'from-emerald-400 to-green-500 shadow-emerald-100 border-emerald-200',
    description: 'ゲコゲコッとお歌'
  }
];

export default function FreePlay({ onBackToMenu, onTrackDrumClick }: FreePlayProps) {
  const [totalHits, setTotalHits] = useState<number>(0);
  const [activePressed, setActivePressed] = useState<Record<string, boolean>>({});
  const [particles, setParticles] = useState<Particle[]>([]);
  const [encouragement, setEncouragement] = useState<string>('にぎやかに ポンポンたたこう！🎈');

  const triggerSound = (toy: ToySound) => {
    // 1. Play real synthesized sound Instantly
    audioEngine.playInstrument(toy.type);
    
    // 2. Add to hits tally
    setTotalHits(prev => {
      const next = prev + 1;
      onTrackDrumClick(); // inform main parent to unlock badge!
      
      // Fun dynamic messages depending on hitting thresholds
      if (next === 10) setEncouragement('いいかんじ！ノリノリだね！✨');
      if (next === 25) setEncouragement('もしかして天才ドラマー？！🥁');
      if (next === 50) setEncouragement('すごすぎる！おんがくのてんさい！👑');
      if (next === 80) setEncouragement('おそらの星がかがやいてるよ！🌟');
      return next;
    });

    // 3. Set visual active state
    setActivePressed(prev => ({ ...prev, [toy.type]: true }));
    setTimeout(() => {
      setActivePressed(prev => ({ ...prev, [toy.type]: false }));
    }, 150);

    // 4. Spawn colorful cute particles
    spawnFreeParticles(toy);
  };

  const spawnFreeParticles = (toy: ToySound) => {
    const count = 10;
    const newParticles: Particle[] = [];
    // Give it customized coordinates in screen
    const targetX = 20 + Math.random() * 60; // range 20% to 80%
    const targetY = 30 + Math.random() * 30; // middle screen

    const emojis = ['✨', '🎵', '❤️', '🌈', '🍭', '🎈'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 5;
      newParticles.push({
        id: `free_p_${Date.now()}_${i}_${Math.random()}`,
        x: targetX,
        y: targetY,
        vx: Math.cos(angle) * speed * 0.4,
        vy: Math.sin(angle) * speed * 0.4,
        color: '#ffffff',
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        size: 18 + Math.random() * 18,
        alpha: 1.0,
      });
    }

    setParticles(prev => [...prev, ...newParticles]);
  };

  // Keyboard controls for free-tapping
  useEffect(() => {
    const handleKeyDown = (e: React.KeyboardEvent | KeyboardEvent) => {
      const match = TOY_SOUNDS.find(t => t.key === e.key);
      if (match) {
        triggerSound(match);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Visual particle loop
  useEffect(() => {
    let active = true;
    const updateTick = () => {
      if (!active) return;
      setParticles(prev => 
        prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.12, // subtle gravity
            alpha: p.alpha - 0.025,
          }))
          .filter(p => p.alpha > 0)
      );
      requestAnimationFrame(updateTick);
    };
    updateTick();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col h-[650px] relative rounded-3xl overflow-hidden bg-gradient-to-b from-amber-50 via-sky-100 to-indigo-150 border-8 border-yellow-300 shadow-2xl select-none text-slate-800 font-sans">
      
      {/* Sparkles / Cloud shapes decorations */}
      <div className="absolute top-12 left-10 text-6xl opacity-15 animate-cute-bounce pointer-events-none">☁️</div>
      <div className="absolute bottom-16 right-10 text-7xl opacity-15 animate-cute-bounce pointer-events-none">☁️</div>

      {/* HEADER SECTION */}
      <div className="px-6 py-4 bg-white/95 border-b-4 border-yellow-100 flex items-center justify-between z-10">
        <button
          id="back-menu-from-freeplay-btn"
          onClick={onBackToMenu}
          className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-600 border-b-4 border-slate-300 rounded-2xl active:translate-y-1 active:border-b-0 transition-all font-bold flex items-center gap-2 text-sm cursor-pointer"
        >
          <Home className="w-4 h-5 pointer-events-none" />
          <span>もどる</span>
        </button>

        <div className="text-center">
          <h2 className="text-xl font-black text-indigo-950 flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500 animate-cute-shake" />
            <span>どうぶつ フリーたいこ 🥁</span>
          </h2>
          <p className="text-xs text-slate-500 font-bold tracking-wider mt-0.5">
            すきなどうぶつを タップして じゆうに演奏しよう！
          </p>
        </div>

        {/* Total hits counter */}
        <div className="bg-amber-100 text-amber-800 border-2 border-amber-200 px-4 py-1.5 rounded-2xl text-right flex flex-col">
          <span className="text-[9px] font-black tracking-wider uppercase leading-none">たたいた かず</span>
          <span className="text-xl font-black font-mono leading-none mt-1">{totalHits}</span>
        </div>
      </div>

      {/* RHYTHMIC STAGE DISPLAY */}
      <div className="flex-1 w-full relative overflow-hidden px-6 py-4 flex flex-col justify-between">
        
        {/* Particle and star bursts backdrop */}
        <div className="absolute inset-0 pointer-events-none">
          {particles.map((p) => (
            <div
              key={p.id}
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                transform: 'translate(-50%, -50%)',
                opacity: p.alpha,
              }}
              className="absolute z-20"
            >
              <div style={{ fontSize: `${p.size}px` }} className="filter drop-shadow-md">
                {p.emoji}
              </div>
            </div>
          ))}
        </div>

        {/* Encouraging Banner Speech Bubble */}
        <div className="w-full flex justify-center mt-2 z-10">
          <div className="bg-white/90 border-3 border-indigo-200 px-8 py-3 rounded-2xl shadow-md text-center max-w-md transform animate-cute-bounce">
            <span className="text-base sm:text-lg font-black text-indigo-900 tracking-wide">
              {encouragement}
            </span>
          </div>
        </div>

        {/* THE INTERACTIVE GIGANTIC TOY SOUND PAD KEYS */}
        <div className="w-full flex items-center justify-center gap-4 sm:gap-6 flex-wrap px-4 pb-8 z-10">
          {TOY_SOUNDS.map((toy) => {
            const isPressed = activePressed[toy.type];
            return (
              <motion.button
                key={toy.type}
                id={`freeplay-toy-btn-${toy.type}`}
                onClick={() => triggerSound(toy)}
                onMouseDown={() => triggerSound(toy)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  triggerSound(toy);
                }}
                whileHover={{ scale: 1.05 }}
                className={`relative w-36 sm:w-40 p-4 rounded-3xl bg-gradient-to-b ${toy.color} border-4 border-white shadow-xl hover:shadow-2xl transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                  isPressed ? 'scale-95 border-yellow-300' : ''
                }`}
              >
                {/* Embedded key shortcut labeled round */}
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/15 flex items-center justify-center text-xs font-black text-white font-mono">
                  {toy.key}
                </div>

                <div className="w-20 h-20 bg-white/70 rounded-2xl flex items-center justify-center shadow-inner text-5xl">
                  {toy.emoji}
                </div>

                <div className="text-center mt-1">
                  <h4 className="text-sm font-black text-white tracking-wide">{toy.label}</h4>
                  <p className="text-[9px] text-white/95 font-bold leading-none mt-0.5">{toy.description}</p>
                </div>

                {isPressed && (
                  <span className="absolute -inset-3 rounded-3xl bg-white/30 border-2 border-white animate-ping pointer-events-none" />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Keyboard accessibility instructions for child's parent */}
        <div className="w-full text-center pb-2 z-10">
          <span className="text-[10px] font-black text-indigo-500 bg-white/80 border border-indigo-100 px-4 py-1.5 rounded-full shadow-sm tracking-wider">
            💻 キーボードのすうじ [ 1 ], [ 2 ], [ 3 ], [ 4 ], [ 5 ] キーでも ドラムがたたけるよ！
          </span>
        </div>

      </div>

    </div>
  );
}
