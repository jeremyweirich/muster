import type { ReactNode } from "react";
import type { Speaker } from "../data/campaign";

// Small vector portraits for the story's cast (CAST in src/data/campaign.ts), drawn in a 64×64 box: a face in a
// round frame tinted by the speaker's side. Stand-ins until there's real art; a new speaker needs one here.

const FACES: Record<Speaker, ReactNode> = {
  // Sergeant Dunmor: a dwarf in an iron helm with a nose guard, most of the face beard
  sergeant: (
    <>
      <circle cx="32" cy="37" r="15" fill="#e3b48b" />
      {/* iron helm: a dome, a riveted rim and a nose guard */}
      <path d="M14 33 Q14 9 32 9 Q50 9 50 33 Z" fill="#8c96a3" />
      <path d="M22 14 Q32 10 42 14" stroke="#b7c0cb" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x="12" y="30" width="40" height="5" rx="2" fill="#6f7884" />
      <circle cx="18" cy="32.5" r="1" fill="#b7c0cb" />
      <circle cx="46" cy="32.5" r="1" fill="#b7c0cb" />
      <rect x="30" y="31" width="4" height="12" rx="1.5" fill="#6f7884" />
      <circle cx="25" cy="39" r="1.8" fill="#2a1d14" />
      <circle cx="39" cy="39" r="1.8" fill="#2a1d14" />
      <path d="M16 42 Q18 62 32 63 Q46 62 48 42 Q42 48 32 47 Q22 48 16 42 Z" fill="#a0673a" />
      <path d="M24 48 Q32 52 40 48" stroke="#6e4322" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M27 55 Q32 58 37 55" stroke="#6e4322" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </>
  ),
  // Archivist Ithiel: an elf with long pale hair, pointed ears and small round spectacles
  archivist: (
    <>
      {/* long hair behind, falling past the shoulders on both sides */}
      <path d="M16 32 Q15 9 32 9 Q49 9 48 32 L52 64 L41 64 L43 36 L21 36 L23 64 L12 64 Z" fill="#e8dcae" />
      <path d="M21 35 L7 22 L22 41 Z" fill="#f0d2b4" stroke="#d9b897" strokeWidth="0.8" />
      <path d="M43 35 L57 22 L42 41 Z" fill="#f0d2b4" stroke="#d9b897" strokeWidth="0.8" />
      <ellipse cx="32" cy="36" rx="12" ry="15" fill="#f3d9bf" />
      <path d="M20 31 Q22 15 32 15 Q42 15 44 31 Q40 22 32 21 Q24 22 20 31 Z" fill="#e8dcae" />
      <circle cx="26" cy="35" r="4" fill="none" stroke="#7a6a48" strokeWidth="1.3" />
      <circle cx="38" cy="35" r="4" fill="none" stroke="#7a6a48" strokeWidth="1.3" />
      <path d="M30 35 H34" stroke="#7a6a48" strokeWidth="1.3" />
      <circle cx="26" cy="35" r="1.3" fill="#3b4a5a" />
      <circle cx="38" cy="35" r="1.3" fill="#3b4a5a" />
      <path d="M28 45 Q32 47 36 45" stroke="#b07a62" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </>
  ),
  // The Boss: a big goblin with sideways ears, a dented crown and a tusky grin
  boss: (
    <>
      <path d="M18 34 L3 24 L17 42 Z" fill="#6f9e45" />
      <path d="M46 34 L61 24 L47 42 Z" fill="#6f9e45" />
      <ellipse cx="32" cy="38" rx="16" ry="15" fill="#7fb04f" />
      <path d="M19 26 L22 14 L27 22 L32 11 L37 22 L42 14 L45 26 Z" fill="#d9a520" stroke="#8a6410" strokeWidth="1" />
      <path d="M22 33 L29 35" stroke="#2c3a18" strokeWidth="2" strokeLinecap="round" />
      <path d="M42 33 L35 35" stroke="#2c3a18" strokeWidth="2" strokeLinecap="round" />
      <circle cx="26" cy="38" r="2.4" fill="#f2e04a" />
      <circle cx="38" cy="38" r="2.4" fill="#f2e04a" />
      <circle cx="26" cy="38" r="1" fill="#1d1d0b" />
      <circle cx="38" cy="38" r="1" fill="#1d1d0b" />
      <path d="M21 45 Q32 55 43 45 Q32 49 21 45 Z" fill="#3a1c14" />
      <path d="M25 46 L26.5 50 L28 46.6 Z M36 46.6 L37.5 50 L39 46 Z" fill="#f4efd8" />
    </>
  ),
  // The Tinker: a lean goblin in a leather cap, brass goggles pushed up, one eye behind a jeweller's lens, a pencil
  // behind one ear for working out the odds
  tinker: (
    <>
      <path d="M19 36 L5 30 L18 43 Z" fill="#79a64c" />
      <path d="M45 36 L59 30 L46 43 Z" fill="#79a64c" />
      <rect x="47" y="25" width="2.4" height="13" rx="1" transform="rotate(35 48 31)" fill="#e3b341" />
      <ellipse cx="32" cy="40" rx="13.5" ry="14" fill="#86b85a" />
      {/* leather cap and the goggles on it */}
      <path d="M17 32 Q17 13 32 13 Q47 13 47 32 Q40 26 32 26 Q24 26 17 32 Z" fill="#7a5233" />
      <rect x="17" y="24" width="30" height="3.4" rx="1.5" fill="#4a3220" />
      <circle cx="25.5" cy="23.5" r="4.6" fill="#c9a24a" stroke="#7d6122" strokeWidth="1.2" />
      <circle cx="38.5" cy="23.5" r="4.6" fill="#c9a24a" stroke="#7d6122" strokeWidth="1.2" />
      <circle cx="25.5" cy="23.5" r="2.7" fill="#a9d4e6" />
      <circle cx="38.5" cy="23.5" r="2.7" fill="#a9d4e6" />
      {/* one plain eye, one magnified behind the lens */}
      <circle cx="26" cy="38" r="2.2" fill="#f2e04a" />
      <circle cx="26" cy="38" r="0.9" fill="#1d1d0b" />
      <circle cx="38.5" cy="38" r="5.4" fill="#cfe6ef" fillOpacity="0.55" stroke="#7d6122" strokeWidth="1.6" />
      <circle cx="38.5" cy="38" r="3.4" fill="#f2e04a" />
      <circle cx="38.5" cy="38" r="1.5" fill="#1d1d0b" />
      <path d="M43.6 39.5 L47 46" stroke="#7d6122" strokeWidth="1.2" />
      {/* a lopsided, hopeful grin and a smudge of soot */}
      <path d="M24 46 Q31 51 40 45" stroke="#3a1c14" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M33 48.4 L34.2 51 L35.4 48" fill="#f4efd8" />
      <ellipse cx="22" cy="44" rx="2.6" ry="1.4" fill="#4b5a36" fillOpacity="0.6" />
    </>
  ),
};

const FRAME: Record<Speaker, string> = {
  sergeant: "#2c4a6e",
  archivist: "#2c4a6e",
  boss: "#6e2c33",
  tinker: "#6e2c33",
};

export function Portrait({ who, size = 48 }: { who: Speaker; size?: number }) {
  return (
    <svg className="portrait" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <clipPath id={`portrait-${who}`}>
          <circle cx="32" cy="32" r="30" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="31" fill={FRAME[who]} />
      <g clipPath={`url(#portrait-${who})`}>{FACES[who]}</g>
      <circle cx="32" cy="32" r="30.5" fill="none" stroke="#d8c08a" strokeWidth="1.5" />
    </svg>
  );
}
