import { MISSIONS } from "../data/campaign";
import type { Difficulty } from "../game/ai";

// Story progress: the one thing the site keeps, in this browser's localStorage (CLAUDE.md, Invariants). Which
// missions were won and which commendations earned, nothing else; Reset on the Story page clears it. Storage can
// be missing or blocked (private windows, embedded previews), so every access is guarded and the game works
// without it: progress then lasts for the visit.

export interface Progress {
  won: string[]; // mission ids
  commended: string[];
}

const KEY = "common-ground:progress";
const EMPTY: Progress = { won: [], commended: [] };

export function loadProgress(): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (p && Array.isArray(p.won) && Array.isArray(p.commended))
      return { won: p.won.filter((x: unknown) => typeof x === "string"), commended: p.commended.filter((x: unknown) => typeof x === "string") };
  } catch {
    // unreadable: start fresh
  }
  return EMPTY;
}

function save(p: Progress) {
  try {
    if (p.won.length || p.commended.length) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch {
    // blocked: progress lasts for this visit
  }
}

export function recordWin(p: Progress, id: string, commended: boolean): Progress {
  const next = {
    won: p.won.includes(id) ? p.won : [...p.won, id],
    commended: commended && !p.commended.includes(id) ? [...p.commended, id] : p.commended,
  };
  save(next);
  return next;
}

export function resetProgress(): Progress {
  save(EMPTY);
  return EMPTY;
}

// Missions are played in order: one opens once the playable mission before it (in any campaign) is won. `all`
// opens every one (the debug panel's switch, for testing).
export function missionOpen(p: Progress, id: string, all = false): boolean {
  const i = MISSIONS.findIndex((m) => m.def.id === id);
  return i === 0 || (i > 0 && (all || p.won.includes(MISSIONS[i - 1].def.id)));
}

// The vanity counter: matches won in a row against the AI on Hard (every round on Hard, as for the love letter), and
// the best run. Its own key, so resetting story progress leaves it alone. Only finished matches count: a Hard match
// lost ends the run; matches on other difficulties, and abandoned ones, don't touch it.
export interface HardStreak {
  current: number;
  best: number;
}

const STREAK_KEY = "common-ground:hard-streak";

export function loadHardStreak(): HardStreak {
  try {
    const s = JSON.parse(localStorage.getItem(STREAK_KEY) ?? "null");
    if (s && Number.isInteger(s.current) && Number.isInteger(s.best)) return { current: s.current, best: s.best };
  } catch {
    // unreadable: start fresh
  }
  return { current: 0, best: 0 };
}

export function recordHardMatch(won: boolean): HardStreak {
  const s = loadHardStreak();
  const current = won ? s.current + 1 : 0;
  const next = { current, best: Math.max(s.best, current) };
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(next));
  } catch {
    // blocked: the streak lasts for this visit only through the return value
  }
  return next;
}

// The AI difficulty last picked on Play, so the next visit starts there. Easy until a player picks another.
const DIFFICULTY_KEY = "common-ground:difficulty";

export function loadDifficulty(): Difficulty {
  try {
    const d = localStorage.getItem(DIFFICULTY_KEY);
    if (d === "easy" || d === "normal" || d === "hard") return d;
  } catch {
    // blocked: the default
  }
  return "easy";
}

export function saveDifficulty(d: Difficulty) {
  try {
    localStorage.setItem(DIFFICULTY_KEY, d);
  } catch {
    // blocked: the choice lasts for this visit
  }
}
