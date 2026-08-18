import { RATINGS } from '../data/animals.js';

// ---------------------------------------------------------------------------
// Progression & economy
//
// Currency is "Chow" — cat food currency. Earn it by feeding the cats, keeping
// bowls stocked, keeping raccoon theft low and not chancing the cats. Spend it
// in the PREP shop on upgrades to the feeding station. Everything persists.
// ---------------------------------------------------------------------------

export const SAVE_KEY = 'trashPandaTerror.save';

export const UPGRADES = [
  { id:'anchors', name:'Anchored Bowls', icon:'⚓',
    desc:'Weights bolted to every bowl. Gary munches at a gentler pace and steals less per bite.',
    max:3, costs:[25,45,70] },
  { id:'platform', name:'Raised Feeding Deck', icon:'▤',
    desc:'A wobbly deck lifts the bowls. Cats hop right up; Gary has to pause and climb before every snack.',
    max:2, costs:[40,70] },
  { id:'fence', name:'Unbreakable Barrier', icon:'▰',
    desc:'Doubles the fence\u2019s grudge. Gary gets shoved harder and pushed from further away.',
    max:2, costs:[30,55] },
  { id:'sprinklerSmart', name:'Cat-Aware Sensor', icon:'◎',
    desc:'The sprinkler finally learns the difference between a cat and a raccoon. No more friendly fire. Radius +0.3 m.',
    max:1, costs:[50] },
  { id:'sprinklerRadius', name:'Long-Reach Nozzle', icon:'✣',
    desc:'Spray reach stretches further into the night. Radius +0.6 m per level.',
    max:2, costs:[20,35] },
  { id:'sprinklerRecharge', name:'Hydro-Boost Reserve', icon:'↻',
    desc:'A pressurised bottle caches water so the sprinkler recharges faster.',
    max:2, costs:[20,40] },
  { id:'hosePressure', name:'Hose Pressure 5000', icon:'≋',
    desc:'Rat-choked pressure. Flings Gary further. Stings the cats exactly as much as before.',
    max:2, costs:[25,50] },
  { id:'motionLight', name:'Guilt-Free Floodlight', icon:'☀',
    desc:'The porch light flares when Gary slinks toward the bowls. He hesitates, and snacks slowly, in shame.',
    max:1, costs:[45] }
];

// Turn a level map { id: level } into concrete gameplay modifiers.
export function computeEffects(up) {
  const L = id => up[id] || 0;
  return {
    garyEatRate: Math.max(.5, 1 - L('anchors') * .08),
    platformPause: L('platform') * 1.05,          // seconds Gary stops to climb per raised bowl
    barrierRadius: 1.65 * (1 + L('fence') * .45),
    barrierStrength: 1.8 * (1 + L('fence') * .6),
    sprinklerRadius: 4 + L('sprinklerRadius') * .6 + (L('sprinklerSmart') ? .3 : 0),
    sprinklerCooldown: Math.max(2.2, 5.5 - L('sprinklerRecharge') * 1.15),
    sprinklerCatAware: L('sprinklerSmart') >= 1,
    hoseForce: 1 + L('hosePressure') * .45,
    hoseRange: 1.35 + L('hosePressure') * .22,
    motionLight: L('motionLight') >= 1
  };
}
// ---------------------------------------------------------------------------
// Reward. Bounded, readable, and gated to never fully stall progression.
// ---------------------------------------------------------------------------
export function computeReward(night, stats, cats, avgTrust, trustDelta, served) {
  const fed = cats.filter(c => c.wasFed).length;
  const s = Math.max(1, served);
  const catFrac = Math.min(1, stats.catFood / s);
  const theftFrac = Math.min(1, stats.stolen / s);
  const leftover = Math.max(0, s - stats.catFood - stats.stolen);
  const leftoverFrac = Math.min(1, leftover / s);
  const startles = stats.catStartles || 0;

  let total = 8;                                   // participation + a forgiving floor
  total += fed * 5;                                // fed cats
  total += Math.round(catFrac * 8);                // food that actually reached cats
  total += Math.round(leftoverFrac * 3);           // food still in bowls at dawn
  total += Math.round(Math.max(0, avgTrust - 45) / 12); // standing trust bonus
  if (trustDelta > 0) total += 4;                  // trust improved tonight
  total -= Math.round(theftFrac * 14);             // stolen by Gary
  total -= Math.round(startles * 1.25);            // startled cats (still punish, but not crippling)
  total = Math.max(3, Math.round(total));          // always enough to buy something next

  return { total, fed, catFrac, theftFrac, leftoverFrac, startles, trustDelta, served };
}

// ---------------------------------------------------------------------------
// Headline — rule based, deterministic.
// ---------------------------------------------------------------------------
export function headline(night, stats, cats, rw) {
  const fed = cats.filter(c => c.wasFed).length;
  const names = cats.map(c => c.def.name);
  const heist = rw.theftFrac > .4;
  const tidy = rw.theftFrac < .12 && fed === cats.length;
  const doomed = fed === 0;
  const skittishHurt = (stats.catStartles || 0) > 2;

  if (stats.stolen <= 0 && stats.adaptation > 0) {
    return 'Zero chow stolen. Gary insists he went home for a vegetable. Nobody buys it.';
  }
  const pool = [];
  if (heist && stats.adaptation > 2) pool.push('Gary files a formal complaint with the sprinkler manufacturer. Then a counter-claim on the deck.');
  if (heist && stats.adaptation > 0) pool.push('Mittens ate well. Gary ate better. The bowls would like a word.');
  if (heist) pool.push(`Heist report: ${Math.round(rw.theftFrac * 100)}% of the buffet vanished, and Gary has an alibi and a lawyer.`);
  if (tidy) pool.push('All three cats dined under the porch light. Gary disputes the final score.',
    'The yard is holding. Gary sharpened a claw in frustration. You can hear it from the shed.');
  if (doomed) pool.push('Tonight the bowls fed exactly no one. Gary sends his regards.',
    'Zero cats. One very smug raccoon. Review the footage.');
  if (skittishHurt) pool.push('The hose worked. The cats would like to speak with management.',
    `${names[0]}, ${names[1]} and ${names[2]} filed a noise complaint about the yard equipment.`);
  if (stats.adaptation > 3 && rw.theftFrac > .2) pool.push('Gary is taking notes. Between bites. On your flowers.');
  if (fed === cats.length && rw.theftFrac > .2) pool.push('The cats dined inside. Gary dined outside. Both of them ate well.');
  if (rw.trustDelta > 0) pool.push('The cats are starting to call this place home. Gary redecorates nightly.');

  if (pool.length) return pool[night % pool.length];
  return stats.adaptation > 1
    ? 'Gary tested the perimeter and left with a snack. He will be back, refreshed.'
    : 'The yard remained suspiciously peaceful — for now.';
}

// ---------------------------------------------------------------------------
// Progression state
// ---------------------------------------------------------------------------
export class Progression {
  constructor(saved = {}) {
    this.chow = Math.max(0, saved.chow || 0);
    this.night = Math.max(1, saved.night || 1);
    this.upgrades = saved.upgrades || {};
    this.bestRating = saved.bestRating || 'F';
  }
  effects() { return computeEffects(this.upgrades); }
  level(id) { return this.upgrades[id] || 0; }
  info(id) { return UPGRADES.find(u => u.id === id); }
  maxed(id) { const u = this.info(id); return this.level(id) >= u.max; }
  cost(id) { const u = this.info(id); const l = this.level(id); return l < u.max ? u.costs[l] : null; }
  afford(id) { const c = this.cost(id); return c !== null && this.chow >= c; }
  purchase(id) {
    const c = this.cost(id);
    if (c === null || this.chow < c) return false;
    this.chow -= c;
    this.upgrades[id] = this.level(id) + 1;
    return true;
  }
  addChow(n) { this.chow += n; }
  setBest(grade) {
    const order = ['F','D','C','B','A','S'];
    if (order.indexOf(grade) > order.indexOf(this.bestRating)) this.bestRating = grade;
  }
  nextNight() { this.night += 1; }
  gradeIndex() { const order = ['F','D','C','B','A','S']; return order.indexOf(this.bestRating); }
}