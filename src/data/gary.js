// ---------------------------------------------------------------------------
// Gary's persistent personality. Each save rolls 2-3 traits from a small pool.
// Traits are NOT stat labels; each nudges a specific decision Gary already
// makes. They persist for the life of a save and surface only through behavior
// (and eventually Results observations once there's evidence).
// ---------------------------------------------------------------------------

export const TRAITS = {
  BRAZEN: {
    adjusters: { bold: 1.35, startleResist: .3, sprintCommit: true },
    hints: ['more willing to cross open yard', 'barely flinches under the sprinkler now']
  },
  SNEAKY: {
    adjusters: { flank: .8, preferCover: true },
    hints: ['keeps to the shadows', 'comes in through the bushes']
  },
  PATIENT: {
    adjusters: { probe: 1.5, probeMax: 2, watch: 1.2 },
    hints: ['waits out the sprinkler boundary', 'takes his time sizing up the yard']
  },
  GREEDY: {
    adjusters: { eatCommit: 1.4, fedTarget: .46 },
    hints: ['hunkers down once he reaches the bowls', 'commits hard to a full feed']
  },
  JUMPY: {
    adjusters: { fearMult: 1.6, fearRecovery: .7 },
    hints: ['spooks hard at first contact', 'runs further from a loud deterrent']
  },
  CLEVER: {
    adjusters: { adaptRate: 1.6, appetite: .85, raidsBias: -1 },
    hints: ['caught the trick faster than expected', 'attacks less, learns more']
  },
  MENACE: {
    adjusters: { raidsBias: 1 },
    hints: ['came back for seconds', 'kept returning after being chased off']
  }
};

export const TRAIT_NAMES = Object.keys(TRAITS);

// Roll a lightweight but distinct personality for a new save: 2-3 unique traits.
export function rollTraits(rng = Math.random) {
  const count = 2 + Math.floor(rng() * 2); // 2 or 3
  const pool = TRAIT_NAMES.slice();
  const picked = [];
  while (picked.length < count && pool.length) {
    const i = Math.floor(rng() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

// Merge the adjusters for a set of trait names into one lookup.
export function behaviorOf(traits = []) {
  const b = {};
  for (const t of traits) {
    const a = TRAITS[t] && TRAITS[t].adjusters;
    if (!a) continue;
    for (const k in a) b[k] = (b[k] || 0) + a[k]; // additive so extra effects are possible
  }
  return b;
}

// Soft, evidence-gated hints (never a label dumped on Night 1).
export function traitEvidenceHints(traits = [], counts = {}) {
  const out = [];
  for (const t of traits) {
    const hints = TRAITS[t].hints;
    const pick = hints[apply01(counts) % hints.length];
    out.push(pick);
  }
  return out;
}

// Deterministic-ish index into each trait's hint list to avoid repetition.
function apply01(counts) {
  let n = 0;
  for (const k in counts) n += (typeof counts[k] === 'number' ? counts[k] : 0);
  return n ? n % 3 : 0;
}