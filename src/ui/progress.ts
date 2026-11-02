import { MISSIONS } from "../data/campaign";

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
