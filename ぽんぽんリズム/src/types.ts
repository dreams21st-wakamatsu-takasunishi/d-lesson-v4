export type InstrumentType = 'drum' | 'bell' | 'cat' | 'dog' | 'frog';

export interface Lane {
  id: number;
  name: string;
  emoji: string;
  color: string;
  key: string; // Keyboard trigger key
  soundFreq: number; // custom base frequency for synth
  soundType: InstrumentType;
}

export interface Song {
  id: string;
  title: string;
  japaneseTitle: string;
  description: string;
  emoji: string;
  bpm: number;
  difficulty: 'easy' | 'normal' | 'hard';
  color: string; // Card background Tailwind classes
  beatsPerBar: number;
  notes: RhythmNote[];
  melody: MelodyNote[]; // The nursery rhyme background melody!
}

export interface RhythmNote {
  id: string;
  laneId: number;
  beat: number; // In beats, so beat 4.0 is exactly at beat 4
  hit?: boolean;
  miss?: boolean;
  evalResult?: 'perfect' | 'great' | 'good' | 'miss';
}

export interface MelodyNote {
  note: string; // e.g., 'C4', 'E4', 'G4'
  duration: number; // e.g., 1 beat, 0.5 beat
  beat: number; // Start relative beat
}

export interface ScoreState {
  perfect: number;
  great: number;
  good: number;
  miss: number;
  score: number;
  combo: number;
  maxCombo: number;
}

export interface UserStats {
  heartsCollected: number;
  totalHighscore: number;
  completedSongs: string[];
  badges: Badge[];
}

export interface Badge {
  id: string;
  title: string;
  emoji: string;
  description: string;
  unlockedAt?: string;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  emoji: string;
  size: number;
  alpha: number;
}
