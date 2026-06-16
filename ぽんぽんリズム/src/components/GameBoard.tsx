import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, Home, Flame, Star, Volume2 } from 'lucide-react';
import { Song, Lane, RhythmNote, ScoreState, Particle } from '../types';
import { LANES } from '../data';
import { audioEngine } from '../audioEngine';

interface GameBoardProps {
  song: Song;
  onBackToMenu: () => void;
  onGameFinished: (sc: ScoreState) => void;
}

export default function GameBoard({ song, onBackToMenu, onGameFinished }: GameBoardProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(3);
  const [currentBeat, setCurrentBeat] = useState<number>(0);
  const [scoreState, setScoreState] = useState<ScoreState>({
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
  });

  // Track live note states
  const [liveNotes, setLiveNotes] = useState<RhythmNote[]>([]);
  
  // Floating feedback
  const [feedback, setFeedback] = useState<{ text: string; color: string; id: number } | null>(null);
  const feedbackIdCounter = useRef<number>(0);

  // Particles for bursts
  const [particles, setParticles] = useState<Particle[]>([]);

  // Drum visual pulse state
  const [isDrumPressed, setIsDrumPressed] = useState<boolean>(false);

  // Character emotional state ('idle' | 'happy' | 'sad') to match Rhythm Heaven reactions
  const [charEmotion, setCharEmotion] = useState<'idle' | 'happy' | 'sad'>('idle');
  const emotionTimeoutRef = useRef<any>(null);

  // Refs for precise game loop timing
  const startTimeRef = useRef<number>(0);
  const elapsedBeforePauseRef = useRef<number>(0);
  const requestRef = useRef<number>(0);
  const songEndTimeoutRef = useRef<any>(null);

  // Keep latest score state in ref for the requestAnimationFrame loop
  const scoreStateRef = useRef<ScoreState>(scoreState);
  useEffect(() => {
    scoreStateRef.current = scoreState;
  }, [scoreState]);

  // Handle countdown sequences and startup
  useEffect(() => {
    audioEngine.stopAllScheduled();
    setLiveNotes(song.notes.map(n => ({ ...n, hit: false, miss: false })));
    setCountdown(3);
    setIsPlaying(false);
    elapsedBeforePauseRef.current = 0;
    
    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        audioEngine.playUIAudio('click');
      } else {
        clearInterval(interval);
        setCountdown(null);
        startGame();
      }
    }, 1000);

    audioEngine.playUIAudio('click');

    return () => {
      clearInterval(interval);
      cancelAnimationFrame(requestRef.current);
      if (songEndTimeoutRef.current) clearTimeout(songEndTimeoutRef.current);
      if (emotionTimeoutRef.current) clearTimeout(emotionTimeoutRef.current);
      audioEngine.stopAllScheduled();
    };
  }, [song]);

  const startGame = () => {
    audioEngine.resume();
    setIsPlaying(true);
    
    const now = performance.now();
    startTimeRef.current = now - elapsedBeforePauseRef.current;

    // Start background nursery synthesis
    const currentElapsedSeconds = elapsedBeforePauseRef.current / 1000;
    const currentElapsedBeats = currentElapsedSeconds * (song.bpm / 60);

    const ctx = audioEngine.getContext();
    if (ctx) {
      const audioStartSec = ctx.currentTime;
      song.melody.forEach(note => {
        if (note.beat >= currentElapsedBeats) {
          const beatOffset = note.beat - currentElapsedBeats;
          const noteTimeSeconds = beatOffset * (60 / song.bpm);
          audioEngine.playMelodyNote(note.note, audioStartSec + noteTimeSeconds, note.duration * (60 / song.bpm));
        }
      });
    }

    // End song calculation
    const totalSongBeats = Math.max(...song.melody.map(m => m.beat + m.duration), ...song.notes.map(n => n.beat)) + 4;
    const totalSongDurationSec = totalSongBeats * (60 / song.bpm);
    const remainingTimeMs = (totalSongDurationSec - currentElapsedSeconds) * 1000;

    if (songEndTimeoutRef.current) clearTimeout(songEndTimeoutRef.current);
    songEndTimeoutRef.current = setTimeout(() => {
      handleSongFinished();
    }, Math.max(0, remainingTimeMs));

    requestRef.current = requestAnimationFrame(tick);
  };

  const handleSongFinished = () => {
    setIsPlaying(false);
    audioEngine.playUIAudio('levelUp');
    onGameFinished(scoreStateRef.current);
  };

  const pauseGame = () => {
    setIsPlaying(false);
    cancelAnimationFrame(requestRef.current);
    audioEngine.stopAllScheduled();
    if (songEndTimeoutRef.current) clearTimeout(songEndTimeoutRef.current);
    elapsedBeforePauseRef.current = performance.now() - startTimeRef.current;
  };

  const togglePause = () => {
    if (isPlaying) {
      pauseGame();
    } else {
      startGame();
    }
  };

  const restartGame = () => {
    cancelAnimationFrame(requestRef.current);
    if (songEndTimeoutRef.current) clearTimeout(songEndTimeoutRef.current);
    audioEngine.stopAllScheduled();
    
    elapsedBeforePauseRef.current = 0;
    setScoreState({
      perfect: 0,
      great: 0,
      good: 0,
      miss: 0,
      score: 0,
      combo: 0,
      maxCombo: 0,
    });
    setLiveNotes(song.notes.map(n => ({ ...n, hit: false, miss: false })));
    setParticles([]);
    setFeedback(null);
    setCountdown(3);
    setIsPlaying(false);
    setCharEmotion('idle');

    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
        audioEngine.playUIAudio('click');
      } else {
        clearInterval(interval);
        setCountdown(null);
        startGame();
      }
    }, 1000);
  };

  // Precise frame-level tick loop
  const tick = (timestamp: number) => {
    if (!startTimeRef.current) return;
    
    const elapsedSeconds = (performance.now() - startTimeRef.current) / 1000;
    const calcBeat = elapsedSeconds * (song.bpm / 60);
    setCurrentBeat(calcBeat);

    // Auto-detect missed notes that pass the hit window center (left margin is 20%, so beat distance is d < -0.38)
    setLiveNotes(prev => 
      prev.map(note => {
        if (!note.hit && !note.miss && (calcBeat - note.beat) > 0.38) {
          triggerMiss();
          return { ...note, miss: true, evalResult: 'miss' };
        }
        return note;
      })
    );

    // Gravity particles tracker
    setParticles(prev => 
      prev
        .map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.12, // subtle gravity vertical pull
          alpha: p.alpha - 0.022,
        }))
        .filter(p => p.alpha > 0)
    );

    requestRef.current = requestAnimationFrame(tick);
  };

  const triggerMiss = () => {
    setScoreState(prev => {
      const nextCombo = 0;
      return {
        ...prev,
        miss: prev.miss + 1,
        combo: nextCombo,
      };
    });
    showFeedback('どんまい！ぬけたっ💦', 'text-slate-400 bg-slate-50 border-slate-200');
    
    // Set character sad face reaction briefly
    updateCharacterEmoji('sad');
  };

  const showFeedback = (text: string, styleClasses: string) => {
    feedbackIdCounter.current += 1;
    setFeedback({
      text,
      color: styleClasses,
      id: feedbackIdCounter.current,
    });
  };

  const updateCharacterEmoji = (emotion: 'happy' | 'sad') => {
    setCharEmotion(emotion);
    if (emotionTimeoutRef.current) clearTimeout(emotionTimeoutRef.current);
    emotionTimeoutRef.current = setTimeout(() => {
      setCharEmotion('idle');
    }, 700);
  };

  // MAIN RHYTHM HEAVEN TAP ACTION (Triggered via click on the stage, space bar, or drum touch)
  const triggerHitAction = () => {
    // Flash the drum visual instantly
    setIsDrumPressed(true);
    setTimeout(() => {
      setIsDrumPressed(false);
    }, 100);

    // Satisfy browser context
    audioEngine.resume();

    if (!isPlaying) return;

    // Filter unhit, unmissed notes
    const activeNotes = liveNotes.filter(n => !n.hit && !n.miss);
    if (activeNotes.length === 0) {
      // Empty tap (Ad-lib free drumming). Kids love making rhythmic noises anytime!
      // Provide a random cute animal sound depending on song, or a cheerful drum slap
      const defaultLanes = LANES;
      const randomLane = defaultLanes[Math.floor(Math.random() * defaultLanes.length)];
      audioEngine.playInstrument(randomLane.soundType);
      
      // Sparsely scatter custom bubble sparks
      spawnLocalParticles(20, 75, '✨', '#fef08a');
      return;
    }

    // Find the closest note on the horizontal timeline
    const closestNote = activeNotes.reduce((prev, curr) => 
      Math.abs(curr.beat - currentBeat) < Math.abs(prev.beat - currentBeat) ? curr : prev
    );

    // Distance offset in beats
    const diff = Math.abs(closestNote.beat - currentBeat);

    // Check hit window
    if (diff <= 0.38) {
      let rating: 'perfect' | 'great' | 'good' = 'good';
      let scoreAdd = 50;
      let labelText = 'おしい！🙂';
      let styleColor = 'text-emerald-500 bg-emerald-50 border-emerald-200';
      const sparkles = ['⭐', '💖', '🎵', '💥', '🍭'];

      if (diff <= 0.13) {
        rating = 'perfect';
        scoreAdd = 200;
        labelText = 'ジャスト！星３つ！🌟';
        styleColor = 'text-amber-500 bg-amber-50 border-amber-200 ring-4 ring-amber-300/30';
      } else if (diff <= 0.24) {
        rating = 'great';
        scoreAdd = 100;
        labelText = 'ナイス！👍';
        styleColor = 'text-indigo-505 bg-indigo-50 border-indigo-200';
      }

      // Mark note hit
      setLiveNotes(prev => 
        prev.map(n => n.id === closestNote.id ? { ...n, hit: true, evalResult: rating } : n)
      );

      // Play corresponding synchronized note animal/toy instrument beautifully!
      const matchingLane = LANES.find(l => l.id === closestNote.laneId) || LANES[0];
      audioEngine.playInstrument(matchingLane.soundType);

      // Save score metrics
      setScoreState(prev => {
        const nextCombo = prev.combo + 1;
        const nextMaxCombo = Math.max(prev.maxCombo, nextCombo);
        return {
          ...prev,
          [rating]: prev[rating] + 1,
          score: prev.score + scoreAdd,
          combo: nextCombo,
          maxCombo: nextMaxCombo,
        };
      });

      // Show floating label feedback
      showFeedback(labelText, styleColor);

      // Playful reaction emoji update
      updateCharacterEmoji('happy');

      // Spawn colorful particle explosion right at the target center (20% horiz, 75% vert)
      const randomSparkle = sparkles[Math.floor(Math.random() * sparkles.length)];
      spawnLocalParticles(20, 75, randomSparkle, '#fcd34d');
    } else {
      // Too early empty tap! Play casual click/sound as normal
      const matchingLane = LANES[Math.floor(Math.random() * LANES.length)];
      audioEngine.playInstrument(matchingLane.soundType);
    }
  };

  const spawnLocalParticles = (xPercent: number, yPercent: number, emoji: string, colorHex: string) => {
    const count = 12;
    const newParticles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      const angle = (Math.random() * Math.PI * 2); // Full circle burst
      const speed = 3 + (Math.random() * 5);
      newParticles.push({
        id: `p_${Date.now()}_${i}_${Math.random()}`,
        x: xPercent,
        y: yPercent,
        vx: Math.cos(angle) * speed * 0.45,
        vy: Math.sin(angle) * speed * 0.45,
        color: colorHex,
        emoji: Math.random() > 0.45 ? '❤️' : emoji,
        size: 16 + Math.random() * 20,
        alpha: 1.0,
      });
    }

    setParticles(prev => [...prev, ...newParticles]);
  };

  // Keyboard Space Bar listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        triggerHitAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaying, liveNotes, currentBeat]);

  // Determine which character is currently the song mascot
  const getMascot = () => {
    if (song.id === 'twinkle') return { emoji: '🐻', name: 'こぐまちゃん', bg: 'bg-amber-100 border-amber-300' };
    if (song.id === 'frog') return { emoji: '🐸', name: 'ケロちゃん', bg: 'bg-emerald-100 border-emerald-350' };
    return { emoji: '🐑', name: 'ひつじさん', bg: 'bg-sky-100 border-sky-305' };
  };

  const mascot = getMascot();

  // Rhythm Swing calculation based on beat. Characters rock left-right with beat rhythm
  const integerBeat = Math.floor(currentBeat);
  const isOddBeat = integerBeat % 2 === 1;
  const swingRotation = isPlaying ? (isOddBeat ? 8 : -8) : 0;
  // Jump bounce scale logic aligned on each beat tick for visual pulse
  const beatPulseScale = isPlaying ? (currentBeat % 1 < 0.2 ? 1.15 : 1) : 1;

  // Let kids choose mascot expression inside the live board
  const getMascotExpression = () => {
    if (charEmotion === 'happy') return '😆✨';
    if (charEmotion === 'sad') return '🥺💦';
    // Idle face rhythm sync
    return isOddBeat ? '🙂🎵' : '😀⭐';
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col h-[650px] relative rounded-3xl overflow-hidden bg-gradient-to-b from-sky-300 via-sky-50 to-indigo-50 border-8 border-sky-400 shadow-2xl select-none">
      
      {/* Background celebration trim */}
      <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-red-400 via-yellow-400 to-emerald-400 z-30" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-100/30 via-transparent to-transparent pointer-events-none" />

      {/* GAME MASTER HEADER */}
      <div className="px-6 py-4 flex items-center justify-between bg-white/95 backdrop-blur-md border-b-4 border-sky-200 z-10">
        <div className="flex items-center gap-3">
          <button 
            id="back-to-menu-btn"
            onClick={onBackToMenu}
            className="p-3 bg-rose-100 hover:bg-rose-200 text-rose-600 rounded-2xl border-b-4 border-rose-300 active:translate-y-1 active:border-b-0 transition-all font-bold flex items-center gap-2 text-sm md:text-base cursor-pointer"
          >
            <Home className="w-5 h-5 pointer-events-none" />
            <span>やめる</span>
          </button>
          
          <div>
            <h2 className="text-xl font-black text-indigo-900 tracking-wide">{song.japaneseTitle}</h2>
            <div className="flex items-center gap-1">
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md font-bold">
                BPM: {song.bpm}
              </span>
              <span className="text-xs text-indigo-500 font-bold hidden sm:inline">• リズム天国モード 🥁</span>
            </div>
          </div>
        </div>

        {/* Dynamic Combo & Score */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-emerald-600 tracking-wider">とくてん</span>
            <span className="text-3xl font-black text-emerald-500 tracking-tight font-mono">{scoreState.score}</span>
          </div>

          <div className="h-10 w-1 bg-indigo-100 rounded-full" />

          {/* Combo Indicator */}
          <div className="flex items-center gap-2 min-w-[70px]">
            <AnimatePresence mode="wait">
              {scoreState.combo > 0 && (
                <motion.div
                  key={scoreState.combo}
                  initial={{ scale: 0.5, y: 10 }}
                  animate={{ scale: [1.3, 1], y: 0 }}
                  exit={{ scale: 0.5, y: -10 }}
                  className="flex flex-col items-center justify-center bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-2xl px-3 py-1 border-2 border-white shadow-md shadow-pink-100"
                >
                  <span className="text-[8px] font-black tracking-wide leading-none">ヒット</span>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    <span className="text-lg font-black font-mono leading-none">{scoreState.combo}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Controller Buttons */}
        <div className="flex items-center gap-2">
          <button
            id="pause-toggle-btn"
            disabled={countdown !== null}
            onClick={togglePause}
            className={`p-3 rounded-2xl border-b-4 transition-all ${
              countdown !== null
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700 border-indigo-300 active:translate-y-1 active:border-b-0 cursor-pointer'
            }`}
          >
            {isPlaying ? <Pause className="w-5 h-5 pointer-events-none" /> : <Play className="w-5 h-5 pointer-events-none" />}
          </button>

          <button
            id="restart-game-btn"
            onClick={restartGame}
            className="p-3 bg-amber-100 hover:bg-amber-250 text-amber-700 border-b-4 border-amber-300 rounded-2xl active:translate-y-1 active:border-b-0 transition-all cursor-pointer"
          >
            <RotateCcw className="w-5 h-5 pointer-events-none" />
          </button>
        </div>
      </div>

      {/* RHYTHM PLAYSTAGE: CLICK ON STAGE TO BEAT! */}
      <div 
        onClick={triggerHitAction}
        className="flex-1 w-full bg-slate-900/10 cursor-pointer relative overflow-hidden flex flex-col justify-between"
      >
        
        {/* Helper instruction tooltip */}
        <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none z-10 p-2">
          <span className="bg-white/80 backdrop-blur-md px-4 py-1.5 rounded-full border border-sky-100 text-xs font-black text-indigo-900 tracking-wider shadow-sm flex items-center gap-2 animate-cute-bounce">
            <span>🖱️ 画面のどこをクリックしても、スペースキーを押しても タイコが叩けます！</span>
          </span>
        </div>

        {/* Countdown Overlay Screen */}
        <AnimatePresence>
          {countdown !== null && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 z-20 flex flex-col items-center justify-center text-white p-6"
            >
              <motion.div
                initial={{ scale: 0.3 }}
                animate={{ scale: [1, 1.2, 1] }}
                key={countdown}
                transition={{ duration: 0.8 }}
                className="text-9xl font-black text-yellow-350 drop-shadow-[0_8px_8px_rgba(0,0,0,0.5)] font-mono"
              >
                {countdown}
              </motion.div>
              <div className="mt-6 text-2xl font-black tracking-widest text-emerald-300 antialiased text-center">
                リズムにあわせて 画面をクリックするか、<br />
                スペースキーをポンッ！と おそう！ 🥁
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pause Screen Overlay */}
        {!isPlaying && countdown === null && (
          <div className="absolute inset-0 bg-slate-950/70 z-20 flex flex-col items-center justify-center text-white p-6 text-center">
            <div className="bg-slate-900/90 border-4 border-indigo-400 p-8 rounded-3xl max-w-sm shadow-2xl flex flex-col items-center gap-4">
              <span className="text-4xl">⏸️</span>
              <h3 className="text-2xl font-black text-indigo-300">ゲームを一時停止中</h3>
              <p className="text-sm text-slate-300 font-bold leading-relaxed">
                もう一度ボタンを押すか、<br />下のボタンでスタート！
              </p>
              
              <button
                id="resume-btn"
                onClick={(e) => {
                  e.stopPropagation(); // prevent triggering hit on stage!
                  togglePause();
                }}
                className="w-full py-4 px-6 bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-300 hover:to-green-450 border-b-6 border-emerald-600 active:translate-y-1 active:border-b-0 rounded-2xl font-black text-white text-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <Play className="w-6 h-6 fill-white pointer-events-none" />
                <span>つづける！</span>
              </button>
            </div>
          </div>
        )}

        {/* MASCOT ZONE: RHYTHM DANCE & EMOTIONS */}
        <div className="absolute left-8 bottom-28 w-44 flex flex-col items-center pointer-events-none select-none z-10">
          
          {/* Reaction speech bubble */}
          <div className="bg-white border-2 border-slate-100 px-3 py-1 rounded-full text-xs font-black shadow-md text-indigo-905 mb-2 h-7 flex items-center justify-center">
            {charEmotion === 'happy' ? 'すごーい！🎉' : charEmotion === 'sad' ? 'あれれ？💧' : 'おんがく大好き！🎨'}
          </div>

          {/* Rocking synced mascot avatar body */}
          <div 
            style={{ 
              transform: `rotate(${swingRotation}deg) scale(${beatPulseScale})`,
              transition: isPlaying ? 'transform 0.08s ease-out' : 'transform 0.3s ease-out'
            }}
            className="flex flex-col items-center justify-center drop-shadow-2xl"
          >
            <div className={`w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center text-6xl shadow-xl ${mascot.bg}`}>
              <span className="scale-110">{mascot.emoji}</span>
              <span className="text-[11px] font-black tracking-widest mt-1 bg-white/70 px-2 py-0.5 rounded-full select-none">
                {getMascotExpression()}
              </span>
            </div>
            
            <div className="mt-2 text-xs font-black bg-white/95 text-indigo-950 border-2 border-indigo-200 px-3 py-0.5 rounded-full shadow-sm">
              {mascot.name}
            </div>
          </div>
        </div>

        {/* HORIZONTAL TRACK FLOW (Nots flow from Right side [100%] to Left side [20%]) */}
        <div className="flex-1 w-full relative flex flex-col justify-end pb-12">
          
          {/* horizontal background stream lane */}
          <div className="absolute left-0 right-0 bottom-[60px] h-[55px] bg-white/40 border-y-4 border-white/20 backdrop-blur-xs flex items-center">
            
            {/* flowing arrow guide indicators to suggest horizontally scrolling tracks */}
            <div className="absolute inset-x-0 inset-y-0 opacity-10 flex justify-between px-12 overflow-hidden text-slate-805 text-4xl select-none font-mono pointer-events-none">
              <span>◀◀</span><span>◀◀</span><span>◀◀</span><span>◀◀</span><span>◀◀</span>
            </div>

            {/* Target Area Line - absolute at 20% left margin */}
            <div 
              style={{ left: '20%' }}
              className="absolute -translate-x-1/2 flex flex-col items-center z-10"
            >
              {/* Pulsing high contrast drum pad directly on the hit center */}
              <div 
                className={`relative w-24 h-24 rounded-full bg-gradient-to-b from-sky-450 to-indigo-505 border-6 border-white shadow-2xl flex items-center justify-center transition-all ${
                  isDrumPressed ? 'scale-125 border-yellow-300 brightness-110 shadow-yellow-200/50' : 'hover:scale-105'
                }`}
              >
                {/* inner concentric circles reminiscent of Taiko / Rhythm Heaven target keys */}
                <div className="absolute inset-1.5 rounded-full border-4 border-dashed border-white/40 animate-spin-slow pointer-events-none" />
                <div className="absolute inset-4 rounded-full border-2 border-white/60 pointer-events-none" />
                <span className="text-3xl filter drop-shadow animate-pulse">🥁</span>
              </div>

              {/* alignment indicator */}
              <div className="mt-2 text-[10px] bg-indigo-950 text-white px-2 py-0.5 rounded-full font-black tracking-widest leading-none border border-white">
                たいこ
              </div>
            </div>

          </div>

          {/* RHYTHM NOTES IN MOTION PLANE */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden pb-12 select-none">
            {liveNotes.map((note) => {
              // Relative beat distance. 
              const relativeBeat = note.beat - currentBeat;

              // Only render notes in playable screenspace
              // Max distance: 4.5 beats ahead (right border). Min: -0.4 beats behind
              if (relativeBeat > 4.5 || relativeBeat < -0.4) {
                return null;
              }

              // Map beat distance to Horizontal position percentage (0% is Left, 100% is Right)
              // Target is at 20%. Beat 0.0 must map exactly to 20%.
              // We want notes to flow: x = 20% + (relativeBeat * scrollSpeedFactor)
              const scrollSpeedFactor = 16.5; // Controls horizontal layout density
              const leftPos = 20 + (relativeBeat * scrollSpeedFactor);

              const lane = LANES[note.laneId] || LANES[0];

              // Rhythm note represented as a fun jumping round balloon with fruit/icon!
              return (
                <div
                  key={note.id}
                  style={{
                    left: `${leftPos}%`,
                    bottom: '60px', // Matches center of stream lane
                    transform: 'translate(-50%, 50%)',
                  }}
                  className={`absolute z-15 transition-opacity duration-100 ${
                    note.hit ? 'opacity-0 scale-150 pointer-events-none' : 'opacity-100'
                  }`}
                >
                  <motion.div
                    animate={isPlaying ? { y: [0, -15, 0] } : {}}
                    transition={{ repeat: Infinity, duration: 0.5, ease: 'easeOut' }}
                    className={`w-16 h-16 rounded-full bg-gradient-to-br ${
                      note.laneId === 0 ? 'from-orange-400 via-red-400 to-amber-500 border-orange-200' : 
                      note.laneId === 1 ? 'from-pink-400 via-rose-400 to-amber-300 border-pink-200' : 
                      'from-emerald-400 via-green-400 to-yellow-300 border-emerald-200'
                    } flex items-center justify-center border-4 border-white shadow-xl`}
                  >
                    {/* Character/Fruit indicator on the note */}
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-3.5xl filter drop-shadow">
                        {note.laneId === 0 ? '🍎' : note.laneId === 1 ? '🍓' : '🍈'}
                      </span>
                    </div>

                    {/* Cute cartoon ribbon tail */}
                    <div className="absolute -bottom-1 w-2 h-2.5 bg-white rounded-full" />
                  </motion.div>
                </div>
              );
            })}
          </div>

          {/* DYNAMIC PARTICLES GRAPHIC LAYER */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
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
                <div 
                  style={{ fontSize: `${p.size}px` }} 
                  className="filter drop-shadow-md select-none font-sans"
                >
                  {p.emoji}
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>

      {/* RATING ACCURACY SPEECH TOOLTIP */}
      <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-30 select-none">
        <AnimatePresence mode="wait">
          {feedback && (
            <motion.div
              key={feedback.id}
              initial={{ scale: 0.5, y: 15, opacity: 0 }}
              animate={{ scale: [1, 1.25, 1], y: -35, opacity: 1 }}
              exit={{ opacity: 0, y: -65 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className={`px-6 py-2.5 rounded-full border-3 font-black text-lg md:text-xl shadow-lg flex items-center justify-center gap-1.5 select-none ${feedback.color}`}
            >
              <span>{feedback.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
