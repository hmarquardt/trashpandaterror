// ---------------------------------------------------------------------------
// Central tuning constants. Keeps balance readable in one place instead of
// buried across the simulation code. Everything here is gameplay tuning.
// ---------------------------------------------------------------------------

export const NIGHT = {
  duration: 115,          // game-seconds to go from dusk-lit to the dawn threshold
  dawn: 5,                // seconds the yard sits in first light before RESULTS
  progressStart: .13,
  progressEnd: .88
};

export const CATS = {
  feedNeeded: .18,        // food consumed per cat before it counts as fed
  baseEat: .011,          // base consume rate (seconds^-1) before pace/scaling
  trustGain: { tom: 2, princess: 5, nero: 2 },
  feedBonus: 5            // reward chow per fed cat
};

export const GARY = {
  appetiteBase: .018,
  appetitePerNight: .035, // extra appetite each night (pressure, not speed/health)
  fedTarget: .32,         // how much he eats before heading home (raised by GREEDY)
  fearDecay: .08,         // per-second fear recovery
  boostFear: .4           // fear threshold for sprinting while fleeing
};

export const RAIDS = {
  // one raid on the very first nights, growing to three; MENACE pushes +1
  perNight(n) { return Math.min(3, 1 + Math.floor((n - 1) / 2)); },
  // Night 1 ~6-9s: enough calm for cats to arrive, short enough that the first
  // encounter feels anticipated rather than delayed. Later nights tighten.
  firstDelay(night) { return Math.max(3, 9 - (night - 1) * 1.0 + Math.random() * 3); },
  gap() { return 7 + Math.random() * 4; }
};

// The "Gary found the gap" tension beat: a short, restrained slow-motion + sting.
export const TENSION = {
  beatDuration: 1.0,     // seconds of damped time on a breakthrough theft
  timeScale: .35,        // simulation speed during the beat
  catReachBeat: .5       // lighter beat when a cat reaches food after a long approach
};

export const ADAPT = {
  sprinkleLearnAt: 2,     // sprinkler "testing" behavior starts here
  sprinkleBoldAt: 3,      // at 3+ he resists the spray better
  probeLimit: 4           // hard cap on boundary pokes before he commits anyway
};

export const REWARD = {
  base: 8,
  perFed: 5,
  perFedBase: 3,
  catFrac: 8,
  leftover: 3,
  trustStand: 45,
  trustStandScalar: 12,
  trustDelta: 4,
  theftPenalty: 14,
  startlePenalty: 1.25
};

export const DEFENSE = {
  // Baseline placeable-object behavior (upgrades bend these in Progression).
  barrierRadius: 1.65, barrierStrength: 1.8,
  sprinklerRadius: 4, sprinklerCooldown: 5.5,
  hoseRange: 1.35, hoseForce: 1,
  catStartleDistance: 12   // seconds to ignore a cat the sprinkler already sprayed
};