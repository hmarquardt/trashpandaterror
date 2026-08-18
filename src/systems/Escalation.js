// ---------------------------------------------------------------------------
// Night-by-night escalation plan. Design beats, not hard scripts: Gary
// personality and the player's actual choices still warp everything.
// Gary remains the persistent nemesis; kits and the human support that story.
// ---------------------------------------------------------------------------

// How many kits are about tonight (0..2). Introduced at Night 4.
export function kitsFor(night, rnd = Math.random) {
  if (night <= 3) return 0;
  if (night === 4) return 1;                                   // first kit
  if (night === 5) return rnd() < 0.5 ? 1 : 0;                 // sometimes alone
  if (night >= 10) return 2;                                   // family raid
  if (night >= 8) return rnd() < 0.6 ? 2 : 1;                  // possible two kits
  return rnd() < 0.75 ? 1 : 0;                                 // nights 6-7, one kit
}

export const HUMAN_INTRO_NIGHT = 5;

// Should the human appear tonight? First time is near-guaranteed; later only
// when the raccoon pressure / past acts justify it. Never every single night.
export function humanShouldAct(night, chaos, humanSeen, rnd = Math.random) {
  if (night < HUMAN_INTRO_NIGHT) return false;
  if (!humanSeen) return rnd() < 0.92;
  if (chaos >= 2) return rnd() < 0.42;   // multiple raccoons at once
  if (night % 3 === 0) return rnd() < 0.3;
  return false;
}

// Visually distinct night "moods". Atmosphere only; readability stays first.
export const NIGHT_MOODS = ['clear', 'warm', 'firefly', 'hazy', 'storm', 'neighbor'];
export function pickMood(night, rnd = Math.random) {
  // keep the yard feeling grounded: a small biased pool, never pure noise
  const w = { clear: 1, warm: 1, firefly: 1, hazy: 1, storm: 0.8, neighbor: 0.8 };
  let keys = Object.keys(w);
  const r = rnd() * keys.reduce((s, k) => s + w[k], 0);
  let acc = 0; for (const k of keys) { acc += w[k]; if (r <= acc) return k; }
  return 'clear';
}

// Gary approach pool + a rarely central "bold" lane reserved for BRAZEN Gary.
export const GARY_APPROACHES = [
  { name: 'shed', pos: [-11, 8], tags: ['cover'] },
  { name: 'east-fence', pos: [9, 5], tags: ['east'] },
  { name: 'west-bushes', pos: [-12, 6], tags: ['west', 'cover'] },
  { name: 'porch-side', pos: [-8, -6], tags: ['west'] },
  { name: 'back-corner', pos: [9, -7], tags: ['east', 'back'] }
];
export const GARY_BOLD_APPROACH = { name: 'bold-center', pos: [-1, 7], tags: ['bold'] };