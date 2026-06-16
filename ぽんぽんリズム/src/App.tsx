import React, { useState, useEffect } from 'react';
import { Song, ScoreState, UserStats, Badge } from './types';
import { SONGS, BADGES } from './data';
import { audioEngine } from './audioEngine';
import SongSelection from './components/SongSelection';
import GameBoard from './components/GameBoard';
import FreePlay from './components/FreePlay';
import ScoreScreen from './components/ScoreScreen';
import { Sparkles, HelpCircle, Music } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'ponpon_rhythm_stats_v1';

export default function App() {
  const [view, setView] = useState<'menu' | 'playing' | 'freeplay' | 'results'>('menu');
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [userStats, setUserStats] = useState<UserStats>({
    heartsCollected: 0,
    totalHighscore: 0,
    completedSongs: [],
    badges: [],
  });

  const [melodyVol, setMelodyVol] = useState<number>(0.5);
  const [soundVol, setSoundVol] = useState<number>(0.7);

  const [sessionScoreState, setSessionScoreState] = useState<ScoreState | null>(null);
  const [justUnlockedBadges, setJustUnlockedBadges] = useState<Badge[]>([]);
  const [freeplayHitCounter, setFreeplayHitCounter] = useState<number>(0);

  // 1. Load User Stats from LocalStorage safely
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        setUserStats(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load user stats', e);
    }

    // Lazy setup audio volumes
    audioEngine.setMelodyVolume(0.5);
    audioEngine.setSoundVolume(0.7);
  }, []);

  // 2. Persist User Stats when changed
  const saveStats = (updated: UserStats) => {
    setUserStats(updated);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save user stats', e);
    }
  };

  const handleVolumeChange = (type: 'melody' | 'sound', val: number) => {
    if (type === 'melody') {
      setMelodyVol(val);
      audioEngine.setMelodyVolume(val);
    } else {
      setSoundVol(val);
      audioEngine.setSoundVolume(val);
    }
  };

  // 3. Track freeplay counts to unlock the free_performer badge!
  const handleFreePlayHit = () => {
    setFreeplayHitCounter(prev => {
      const next = prev + 1;
      if (next >= 40) {
        // Unlock badge!
        unlockBadgeIfNew('free_performer');
      }
      return next;
    });
  };

  // Generic badge unlock logic
  const unlockBadgeIfNew = (badgeId: string): Badge[] => {
    const isAlreadyUnlocked = userStats.badges.some(b => b.id === badgeId);
    if (isAlreadyUnlocked) return [];

    const badgeToUnlock = BADGES.find(b => b.id === badgeId);
    if (!badgeToUnlock) return [];

    const newBadge: Badge = {
      ...badgeToUnlock,
      unlockedAt: new Date().toISOString()
    };

    const updatedBadges = [...userStats.badges, newBadge];
    
    // Save to memory and storage
    const updatedStats = {
      ...userStats,
      badges: updatedBadges
    };
    saveStats(updatedStats);
    
    // Return to let results screen celebrate
    return [newBadge];
  };

  // 4. Game finish evaluation & Badge checker!
  const handleGameFinished = (finalScoreState: ScoreState) => {
    if (!selectedSong) return;

    setSessionScoreState(finalScoreState);
    setView('results');

    // Update global song list & highscores
    const alreadyCompleted = userStats.completedSongs.includes(selectedSong.id);
    const nextCompletedSongs = alreadyCompleted
      ? userStats.completedSongs
      : [...userStats.completedSongs, selectedSong.id];

    const nextHeartsCollected = userStats.heartsCollected + finalScoreState.score;
    const nextTotalScore = userStats.totalHighscore + finalScoreState.score;

    // Check badges
    const newlyEarnedBadges: Badge[] = [];

    // Save preliminary metrics
    let statsProposed: UserStats = {
      ...userStats,
      completedSongs: nextCompletedSongs,
      heartsCollected: nextHeartsCollected,
      totalHighscore: nextTotalScore,
    };

    // Evaluate badges sequentially
    // A. "First Play"
    const firstPlayBadge = BADGES.find(b => b.id === 'first_play');
    if (firstPlayBadge && !userStats.badges.some(b => b.id === 'first_play')) {
      const unlocked = { ...firstPlayBadge, unlockedAt: new Date().toISOString() };
      statsProposed.badges.push(unlocked);
      newlyEarnedBadges.push(unlocked);
    }

    // B. "Perfect Combo"
    const comboBadge = BADGES.find(b => b.id === 'perfect_combo');
    if (comboBadge && finalScoreState.maxCombo >= 10 && !userStats.badges.some(b => b.id === 'perfect_combo')) {
      const unlocked = { ...comboBadge, unlockedAt: new Date().toISOString() };
      statsProposed.badges.push(unlocked);
      newlyEarnedBadges.push(unlocked);
    }

    // C. "All Songs"
    const allBadge = BADGES.find(b => b.id === 'all_songs');
    const hasFinishedAll = SONGS.every(s => s.id === selectedSong.id || userStats.completedSongs.includes(s.id));
    if (allBadge && hasFinishedAll && !userStats.badges.some(b => b.id === 'all_songs')) {
      const unlocked = { ...allBadge, unlockedAt: new Date().toISOString() };
      statsProposed.badges.push(unlocked);
      newlyEarnedBadges.push(unlocked);
    }

    // D. "Star Collector"
    const starsBadge = BADGES.find(b => b.id === 'star_collector');
    if (starsBadge && nextTotalScore >= 1000 && !userStats.badges.some(b => b.id === 'star_collector')) {
      const unlocked = { ...starsBadge, unlockedAt: new Date().toISOString() };
      statsProposed.badges.push(unlocked);
      newlyEarnedBadges.push(unlocked);
    }

    // Check if free play earned triggered in this runtime
    if (freeplayHitCounter >= 40 && !userStats.badges.some(b => b.id === 'free_performer')) {
      const freeBadge = BADGES.find(b => b.id === 'free_performer');
      if (freeBadge) {
        const unlocked = { ...freeBadge, unlockedAt: new Date().toISOString() };
        statsProposed.badges.push(unlocked);
        newlyEarnedBadges.push(unlocked);
      }
    }

    saveStats(statsProposed);
    setJustUnlockedBadges(newlyEarnedBadges);
  };

  const handleSelectSong = (song: Song) => {
    setSelectedSong(song);
    setView('playing');
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 flex flex-col justify-between select-none">
      
      {/* Dynamic Screen Routing */}
      <main className="flex-1 flex items-center justify-center w-full">
        {view === 'menu' && (
          <SongSelection
            userStats={userStats}
            onSelectSong={handleSelectSong}
            onSelectFreePlay={() => setView('freeplay')}
            melodyVol={melodyVol}
            soundVol={soundVol}
            onVolumeChange={handleVolumeChange}
          />
        )}

        {view === 'playing' && selectedSong && (
          <GameBoard
            song={selectedSong}
            onBackToMenu={() => {
              audioEngine.playUIAudio('click');
              setView('menu');
            }}
            onGameFinished={handleGameFinished}
          />
        )}

        {view === 'freeplay' && (
          <FreePlay
            onBackToMenu={() => {
              audioEngine.playUIAudio('click');
              setView('menu');
            }}
            onTrackDrumClick={handleFreePlayHit}
          />
        )}

        {view === 'results' && selectedSong && sessionScoreState && (
          <ScoreScreen
            scoreState={sessionScoreState}
            song={selectedSong}
            onRestart={() => {
              audioEngine.playUIAudio('click');
              setView('playing');
            }}
            onBackToMenu={() => {
              audioEngine.playUIAudio('click');
              setView('menu');
            }}
            newBadgesUnlocked={justUnlockedBadges}
          />
        )}
      </main>

      {/* Humble Footer containing clear information, conforming with architectural honesty */}
      <footer className="w-full text-center py-6 mt-8 border-t border-slate-200/60 max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between text-slate-450 gap-4">
        <p className="text-xs font-black tracking-wider text-slate-550 flex items-center gap-1.5">
          <Music className="w-4 h-4 text-indigo-505" />
          <span>ぽんぽんリズム 🥁 - 子ども向けおんがくリズムゲーム</span>
        </p>
        <p className="text-[10px] font-black tracking-wide text-slate-400">
          タップ または スペースキーでかんたん演奏 🥁
        </p>
      </footer>

    </div>
  );
}
