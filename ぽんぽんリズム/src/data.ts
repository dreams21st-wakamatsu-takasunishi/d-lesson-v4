import { Song, Lane, Badge } from './types';

export const LANES: Lane[] = [
  {
    id: 0,
    name: 'こぐまちゃん',
    emoji: '🐻',
    color: 'from-orange-400 to-amber-500 shadow-orange-200',
    key: 'd',
    soundFreq: 150,
    soundType: 'drum'
  },
  {
    id: 1,
    name: 'うさぎちゃん',
    emoji: '🐰',
    color: 'from-pink-400 to-rose-400 shadow-pink-200',
    key: 'f',
    soundFreq: 987,
    soundType: 'bell'
  },
  {
    id: 2,
    name: 'ケロちゃん',
    emoji: '🐸',
    color: 'from-emerald-400 to-green-500 shadow-emerald-200',
    key: 'j',
    soundFreq: 261,
    soundType: 'frog'
  }
];

// Helper to quickly generate custom unique note IDs
const makeId = (prefix: string, beat: number) => `${prefix}_${beat}`;

// Song 1: Twinkle Twinkle Little Star (きらきら星)
const twinkleMelody = [
  // C4 C4 G4 G4 A4 A4 G4
  { note: 'C4', duration: 1, beat: 0 },
  { note: 'C4', duration: 1, beat: 1 },
  { note: 'G4', duration: 1, beat: 2 },
  { note: 'G4', duration: 1, beat: 3 },
  { note: 'A4', duration: 1, beat: 4 },
  { note: 'A4', duration: 1, beat: 5 },
  { note: 'G4', duration: 2, beat: 6 },
  
  // F4 F4 E4 E4 D4 D4 C4
  { note: 'F4', duration: 1, beat: 8 },
  { note: 'F4', duration: 1, beat: 9 },
  { note: 'E4', duration: 1, beat: 10 },
  { note: 'E4', duration: 1, beat: 11 },
  { note: 'D4', duration: 1, beat: 12 },
  { note: 'D4', duration: 1, beat: 13 },
  { note: 'C4', duration: 2, beat: 14 },

  // G4 G4 F4 F4 E4 E4 D4
  { note: 'G4', duration: 1, beat: 16 },
  { note: 'G4', duration: 1, beat: 17 },
  { note: 'F4', duration: 1, beat: 18 },
  { note: 'F4', duration: 1, beat: 19 },
  { note: 'E4', duration: 1, beat: 20 },
  { note: 'E4', duration: 1, beat: 21 },
  { note: 'D4', duration: 2, beat: 22 },

  // G4 G4 F4 F4 E4 E4 D4
  { note: 'G4', duration: 1, beat: 24 },
  { note: 'G4', duration: 1, beat: 25 },
  { note: 'F4', duration: 1, beat: 26 },
  { note: 'F4', duration: 1, beat: 27 },
  { note: 'E4', duration: 1, beat: 28 },
  { note: 'E4', duration: 1, beat: 29 },
  { note: 'D4', duration: 2, beat: 30 },

  // C4 C4 G4 G4 A4 A4 G4
  { note: 'C4', duration: 1, beat: 32 },
  { note: 'C4', duration: 1, beat: 33 },
  { note: 'G4', duration: 1, beat: 34 },
  { note: 'G4', duration: 1, beat: 35 },
  { note: 'A4', duration: 1, beat: 36 },
  { note: 'A4', duration: 1, beat: 37 },
  { note: 'G4', duration: 2, beat: 38 },

  // F4 F4 E4 E4 D4 D4 C4
  { note: 'F4', duration: 1, beat: 40 },
  { note: 'F4', duration: 1, beat: 41 },
  { note: 'E4', duration: 1, beat: 42 },
  { note: 'E4', duration: 1, beat: 43 },
  { note: 'D4', duration: 1, beat: 44 },
  { note: 'D4', duration: 1, beat: 45 },
  { note: 'C4', duration: 2, beat: 46 }
];

const twinkleRhythmNotes = [
  // Easy simple beats, matches main notes
  { id: makeId('tw', 0), laneId: 0, beat: 0 },
  { id: makeId('tw', 2), laneId: 1, beat: 2 },
  { id: makeId('tw', 4), laneId: 2, beat: 4 },
  { id: makeId('tw', 6), laneId: 0, beat: 6 },
  
  { id: makeId('tw', 8), laneId: 2, beat: 8 },
  { id: makeId('tw', 10), laneId: 1, beat: 10 },
  { id: makeId('tw', 12), laneId: 0, beat: 12 },
  { id: makeId('tw', 14), laneId: 1, beat: 14 },

  { id: makeId('tw', 16), laneId: 1, beat: 16 },
  { id: makeId('tw', 18), laneId: 2, beat: 18 },
  { id: makeId('tw', 20), laneId: 1, beat: 20 },
  { id: makeId('tw', 22), laneId: 0, beat: 22 },

  { id: makeId('tw', 24), laneId: 1, beat: 24 },
  { id: makeId('tw', 26), laneId: 2, beat: 26 },
  { id: makeId('tw', 28), laneId: 1, beat: 28 },
  { id: makeId('tw', 30), laneId: 0, beat: 30 },

  { id: makeId('tw', 32), laneId: 0, beat: 32 },
  { id: makeId('tw', 34), laneId: 1, beat: 34 },
  { id: makeId('tw', 36), laneId: 2, beat: 36 },
  { id: makeId('tw', 38), laneId: 0, beat: 38 },

  { id: makeId('tw', 40), laneId: 2, beat: 40 },
  { id: makeId('tw', 42), laneId: 1, beat: 42 },
  { id: makeId('tw', 44), laneId: 0, beat: 44 },
  { id: makeId('tw', 46), laneId: 1, beat: 46 }
];


// Song 2: Kaeru no Uta (かえるの合唱)
const frogMelody = [
  // C D E F E D C
  { note: 'C4', duration: 1, beat: 0 },
  { note: 'D4', duration: 1, beat: 1 },
  { note: 'E4', duration: 1, beat: 2 },
  { note: 'F4', duration: 1, beat: 3 },
  { note: 'E4', duration: 1, beat: 4 },
  { note: 'D4', duration: 1, beat: 5 },
  { note: 'C4', duration: 2, beat: 6 },

  // E F G A G F E
  { note: 'E4', duration: 1, beat: 8 },
  { note: 'F4', duration: 1, beat: 9 },
  { note: 'G4', duration: 1, beat: 10 },
  { note: 'A4', duration: 1, beat: 11 },
  { note: 'G4', duration: 1, beat: 12 },
  { note: 'F4', duration: 1, beat: 13 },
  { note: 'E4', duration: 2, beat: 14 },

  // C C C C (rapid croaks)
  { note: 'C4', duration: 1, beat: 16 },
  { note: 'C4', duration: 1, beat: 18 },
  { note: 'C4', duration: 1, beat: 20 },
  { note: 'C4', duration: 1, beat: 22 },

  // C D E F E D C
  { note: 'C4', duration: 0.5, beat: 24 },
  { note: 'C4', duration: 0.5, beat: 24.5 },
  { note: 'D4', duration: 0.5, beat: 25 },
  { note: 'D4', duration: 0.5, beat: 25.5 },
  { note: 'E4', duration: 0.5, beat: 26 },
  { note: 'E4', duration: 0.5, beat: 26.5 },
  { note: 'F4', duration: 0.5, beat: 27 },
  { note: 'F4', duration: 0.5, beat: 27.5 },
  { note: 'E4', duration: 1, beat: 28 },
  { note: 'D4', duration: 1, beat: 29 },
  { note: 'C4', duration: 2, beat: 30 }
];

const frogRhythmNotes = [
  // Intro frog beats
  { id: makeId('fr', 0), laneId: 2, beat: 0 },
  { id: makeId('fr', 2), laneId: 2, beat: 2 },
  { id: makeId('fr', 4), laneId: 2, beat: 4 },
  { id: makeId('fr', 6), laneId: 0, beat: 6 },

  { id: makeId('fr', 8), laneId: 1, beat: 8 },
  { id: makeId('fr', 10), laneId: 1, beat: 10 },
  { id: makeId('fr', 12), laneId: 1, beat: 12 },
  { id: makeId('fr', 14), laneId: 0, beat: 14 },

  // Flutter / Rapid segment (kerokero!) - perfect for green frog lane 2
  { id: makeId('fr', 16), laneId: 2, beat: 16 },
  { id: makeId('fr', 17), laneId: 2, beat: 17 },
  { id: makeId('fr', 18), laneId: 2, beat: 18 },
  { id: makeId('fr', 19), laneId: 2, beat: 19 },
  { id: makeId('fr', 20), laneId: 2, beat: 20 },
  { id: makeId('fr', 21), laneId: 2, beat: 21 },
  { id: makeId('fr', 22), laneId: 2, beat: 22 },
  { id: makeId('fr', 23), laneId: 2, beat: 23 },

  // Finale
  { id: makeId('fr', 24), laneId: 0, beat: 24 },
  { id: makeId('fr', 25), laneId: 1, beat: 25 },
  { id: makeId('fr', 26), laneId: 2, beat: 26 },
  { id: makeId('fr', 27), laneId: 0, beat: 27 },
  { id: makeId('fr', 28), laneId: 1, beat: 28 },
  { id: makeId('fr', 29), laneId: 2, beat: 29 },
  { id: makeId('fr', 30), laneId: 0, beat: 30 }
];


// Song 3: Mary Had a Little Lamb (メリーさんのひつじ)
const maryMelody = [
  // E D C D E E E
  { note: 'E4', duration: 1, beat: 0 },
  { note: 'D4', duration: 1, beat: 1 },
  { note: 'C4', duration: 1, beat: 2 },
  { note: 'D4', duration: 1, beat: 3 },
  { note: 'E4', duration: 1, beat: 4 },
  { note: 'E4', duration: 1, beat: 5 },
  { note: 'E4', duration: 2, beat: 6 },

  // D D D E G G
  { note: 'D4', duration: 1, beat: 8 },
  { note: 'D4', duration: 1, beat: 9 },
  { note: 'D4', duration: 2, beat: 10 },
  { note: 'E4', duration: 1, beat: 12 },
  { note: 'G4', duration: 1, beat: 13 },
  { note: 'G4', duration: 2, beat: 14 },

  // E D C D E E E E D D E D C
  { note: 'E4', duration: 1, beat: 16 },
  { note: 'D4', duration: 1, beat: 17 },
  { note: 'C4', duration: 1, beat: 18 },
  { note: 'D4', duration: 1, beat: 19 },
  { note: 'E4', duration: 1, beat: 20 },
  { note: 'E4', duration: 1, beat: 21 },
  { note: 'E4', duration: 1, beat: 22 },
  { note: 'E4', duration: 1, beat: 23 },
  { note: 'D4', duration: 1, beat: 24 },
  { note: 'D4', duration: 1, beat: 25 },
  { note: 'E4', duration: 1, beat: 26 },
  { note: 'D4', duration: 1, beat: 27 },
  { note: 'C4', duration: 4, beat: 28 }
];

const maryRhythmNotes = [
  { id: makeId('my', 0), laneId: 1, beat: 0 },
  { id: makeId('my', 1), laneId: 0, beat: 1 },
  { id: makeId('my', 2), laneId: 1, beat: 2 },
  { id: makeId('my', 3), laneId: 2, beat: 3 },
  { id: makeId('my', 4), laneId: 1, beat: 4 },
  { id: makeId('my', 5), laneId: 1, beat: 5 },
  { id: makeId('my', 6), laneId: 0, beat: 6 },

  { id: makeId('my', 8), laneId: 0, beat: 8 },
  { id: makeId('my', 9), laneId: 0, beat: 9 },
  { id: makeId('my', 10), laneId: 0, beat: 10 },
  { id: makeId('my', 12), laneId: 1, beat: 12 },
  { id: makeId('my', 13), laneId: 2, beat: 13 },
  { id: makeId('my', 14), laneId: 2, beat: 14 },

  { id: makeId('my', 16), laneId: 1, beat: 16 },
  { id: makeId('my', 17), laneId: 0, beat: 17 },
  { id: makeId('my', 18), laneId: 1, beat: 18 },
  { id: makeId('my', 19), laneId: 2, beat: 19 },
  { id: makeId('my', 20), laneId: 1, beat: 20 },
  { id: makeId('my', 21), laneId: 1, beat: 21 },
  { id: makeId('my', 22), laneId: 1, beat: 22 },
  { id: makeId('my', 23), laneId: 1, beat: 23 },
  { id: makeId('my', 24), laneId: 0, beat: 24 },
  { id: makeId('my', 25), laneId: 0, beat: 25 },
  { id: makeId('my', 26), laneId: 1, beat: 26 },
  { id: makeId('my', 27), laneId: 0, beat: 27 },
  { id: makeId('my', 28), laneId: 2, beat: 28 }
];

export const SONGS: Song[] = [
  {
    id: 'twinkle',
    title: 'Twinkle Twinkle Little Star',
    japaneseTitle: 'きらきらぼし 🌟',
    description: 'お空にきらきら光るお星さま。みんなでいっしょにポンポンしよう！',
    emoji: '🌟',
    bpm: 100,
    difficulty: 'easy',
    color: 'from-amber-100 to-orange-100 border-amber-300 text-amber-800',
    beatsPerBar: 4,
    notes: twinkleRhythmNotes,
    melody: twinkleMelody
  },
  {
    id: 'frog',
    title: 'Frog Song (Kaeru no Uta)',
    japaneseTitle: 'かえるのがっしょう 🐸',
    description: 'ケロケロケロケロクワックワックワッ！高速リズムがとってもたのしいよ！',
    emoji: '🐸',
    bpm: 110,
    difficulty: 'normal',
    color: 'from-green-100 to-emerald-100 border-green-300 text-green-800',
    beatsPerBar: 4,
    notes: frogRhythmNotes,
    melody: frogMelody
  },
  {
    id: 'mary',
    title: 'Mary Had a Little Lamb',
    japaneseTitle: 'メリーさんのひつじ 🐑',
    description: 'まっしろでフワフワなかわいいひつじさん。ウキウキなリズムでおどろう！',
    emoji: '🐑',
    bpm: 105,
    difficulty: 'hard',
    color: 'from-sky-100 to-blue-200 border-sky-300 text-sky-800',
    beatsPerBar: 4,
    notes: maryRhythmNotes,
    melody: maryMelody
  }
];

export const BADGES: Badge[] = [
  {
    id: 'first_play',
    title: 'はじめてのポン！',
    emoji: '🥁',
    description: 'はじめてリズムゲームであそんだよ！'
  },
  {
    id: 'perfect_combo',
    title: 'コンボのたつじん！',
    emoji: '🔥',
    description: 'コンボを 10 かい つなげたよ！'
  },
  {
    id: 'all_songs',
    title: 'ぜんきょくせいは！',
    emoji: '👑',
    description: 'すべての曲をさいごまで演奏したよ！'
  },
  {
    id: 'star_collector',
    title: 'ハートマスター',
    emoji: '❤️',
    description: 'ハート（得点）を 1,000こ いじょう あつめたよ！'
  },
  {
    id: 'free_performer',
    title: 'フリー演奏のてんさい',
    emoji: '🦊',
    description: 'フリープレイでたくさんドラムをたたいたよ！'
  }
];
