import { RATINGS } from '../data/animals.js';
import { REWARD, DEFENSE } from './Tuning.js';

// ---------------------------------------------------------------------------
// Progression & economy. Currency is "Chow", earned each dawn and spent in the
// PREP shop. Each upgrade fills a distinct niche so the defense meta stays
// complementary (detection + protection + active deterrence) instead of
// "buy every sprinkler part".
// ---------------------------------------------------------------------------

export const SAVE_KEY = 'trashPandaTerror.save';

export const UPGRADES = [
  { id:'anchors', name:'Anchored Bowls', icon:'⚓',
    desc:'Weights bolt to every bowl. Gary steals slower once he reaches food.',
    max:3, costs:[20,35,50] },
  { id:'platform', name:'Raised Feeding Deck', icon:'▤',
    desc:'Lifts the bowls clear of the lawn. Cats hop up in one bound; Gary has to stop and climb.',
    max:2, costs:[35,60] },
  { id:'fence', name:'Unbreakable Barrier', icon:'▰',
    desc:'Redirects Gary around a wider, harsher keep-out radius instead of stopping him cold.',
    max:2, costs:[25,45] },
  { id:'sprinklerSmart', name:'Cat-Aware Sensor', icon:'◎',
    desc:'Stops spraying cats entirely. Gary still learns the wet zone every time you rely on it.',
    max:1, costs:[45] },
  { id:'sprinklerRadius', name:'Long-Reach Nozzle', icon:'✣',
    desc:'Wider spray arc. Course-corrects, but Gary reads a big ring faster than a small one.',
    max:2, costs:[30,50] },
  { id:'sprinklerRecharge', name:'Hydro-Boost Reserve', icon:'↻',
    desc:'Pressurised water cache recharges the sprinkler sooner between blasts.',
    max:2, costs:[30,50] },
  { id:'hosePressure', name:'Hose Pressure 5000', icon:'≋',
    desc:'Manual, attention-hungry but brutal: flings Gary further and can shove a cat now and then.',
    max:2, costs:[30,55] },
  { id:'motionLight', name:'Guilt-Free Floodlight', icon:'☀',
    desc:'Burns away darkness so Gary hesitates and snacks slower. Costs nothing to run, but it has a tell.',
    max:1, costs:[40] }
];

// Turn a level map { id: level } into concrete gameplay modifiers.
export function computeEffects(up) {
  const L = id => up[id] || 0;
  return {
    garyEatRate: Math.max(.5, 1 - L('anchors') * .11),
    platformPause: L('platform') * 1.15,            // seconds Gary stops to climb each deck
    barrierRadius: DEFENSE.barrierRadius + L('fence') * .5,
    barrierStrength: DEFENSE.barrierStrength * (1 + L('fence') * .5),
    sprinklerRadius: Math.min(5.5, DEFENSE.sprinklerRadius + L('sprinklerRadius') * .5 + (L('sprinklerSmart') ? .2 : 0)),
    sprinklerCooldown: Math.max(3.2, DEFENSE.sprinklerCooldown - L('sprinklerRecharge') * 1.15),
    sprinklerCatAware: L('sprinklerSmart') >= 1,
    hoseForce: DEFENSE.hoseForce + L('hosePressure') * .35,
    hoseRange: DEFENSE.hoseRange + L('hosePressure') * .16,
    motionLight: L('motionLight') >= 1
  };
}

// Readable numeric "current -> next" change for a shop card (PASS 3 readability).
function fmt(v) { return Math.round(v * 100) / 100; }
export function nextDelta(up, level) {
  const now = computeEffects({ [up.id]: level });
  const next = computeEffects({ [up.id]: level + 1 });
  switch (up.id) {
    case 'anchors': return `theft speed ${fmt(now.garyEatRate)}x → ${fmt(next.garyEatRate)}x`;
    case 'platform': return formatNil(now.platformPause, next.platformPause, 's climb');
    case 'fence': return `${fmt(now.barrierRadius)}m → ${fmt(next.barrierRadius)}m keep-out`;
    case 'sprinklerSmart': return 'stops bathing your cats';
    case 'sprinklerRadius': { const a = fmt(now.sprinklerRadius), b = fmt(next.sprinklerRadius); return a === b ? `spray ${a}m (cap)` : `${a}m → ${b}m spray`; }
    case 'sprinklerRecharge': return `${fmt(now.sprinklerCooldown)}s → ${fmt(next.sprinklerCooldown)}s recharge`;
    case 'hosePressure': return `${fmt(now.hoseForce)}x → ${fmt(next.hoseForce)}x force`;
    case 'motionLight': return 'Gary hesitates & eats slowly in the light';
    default: return '';
  }
}
function formatNil(a, b, unit) { return `${fmt(a)}${unit} → ${fmt(b)}${unit}`; }

// ---------------------------------------------------------------------------
// Reward. Central values live in Tuning.reward.
// ---------------------------------------------------------------------------
export function computeReward(night, stats, cats, avgTrust, trustDelta, served, fedOverride) {
  const fed = fedOverride != null ? fedOverride : cats.filter(c => c.wasFed).length;
  const s = Math.max(1, served);
  const catFrac = Math.min(1, stats.catFood / s);
  const theftFrac = Math.min(1, stats.stolen / s);
  const leftover = Math.max(0, s - stats.catFood - stats.stolen);
  const leftoverFrac = Math.min(1, leftover / s);
  const startles = stats.catStartles || 0;

  let total = REWARD.base;
  total += fed * REWARD.perFed;
  total += Math.round(catFrac * REWARD.catFrac);
  total += Math.round(leftoverFrac * REWARD.leftover);
  total += Math.round(Math.max(0, avgTrust - REWARD.trustStand) / REWARD.trustStandScalar);
  if (trustDelta > 0) total += REWARD.trustDelta;
  total -= Math.round(theftFrac * REWARD.theftPenalty);
  total -= Math.round(startles * REWARD.startlePenalty);
  total = Math.max(3, Math.round(total));

  return { total, fed, catFrac, theftFrac, leftoverFrac, startles, trustDelta, served };
}

// ---------------------------------------------------------------------------
// Headline — rule based, deterministic-ish, tone-matched to the night.
// ---------------------------------------------------------------------------
export function headline(night, stats, cats, rw, extras) {
  const fed = cats.filter(c => c.wasFed).length;
  const names = cats.map(c => c.def.name);
  const heist = rw.theftFrac > .4;
  const tidy = rw.theftFrac < .12 && fed === cats.length;
  const doomed = fed === 0;
  const skittishHurt = (stats.catStartles || 0) > 2;
  extras = extras || {};

  if (extras.raids > 2) {
    return `Gary staged ${extras.raids} excursions tonight and still found ${Math.round(rw.theftFrac * 100)}%. Dedication.`;
  }
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
  if (extras.climbs > 0) pool.push(`Gary balanced on a ${extras.climbs > 1 ? 'couple of' : ''} feeding decks to reach the spoils.`);

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
