import { SAVE_KEY } from './Progression.js';

// ---------------------------------------------------------------------------
// Save schema. Bump SAVE_VERSION when the persisted shape changes.
//     1 -> pre-pass saves: {cats, gary:{memory}, prog:{chow,night,upgrades,bestRating}}
//     2 -> adds gary.personality[]
//     3 -> adds gary.history[] (persistent recognition streaks / favorite side)
// loadSave() is the single entry point and is intentionally defensive so a
// malformed or legacy save can never crash the launch.
// ---------------------------------------------------------------------------
export const SAVE_VERSION = 3;

const CURRENT_PROG_DEFAULTS = { chow: 0, night: 1, upgrades: {}, bestRating: 'F' };

function clampNum(v, min, max, dflt) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
}

// Normalize the progression block toward safe current defaults.
export function normalizeProg(p = {}) {
  p = p && typeof p === 'object' ? p : {};
  const upgrades = {};
  if (p.upgrades && typeof p.upgrades === 'object') {
    for (const k in p.upgrades) {
      const l = Math.floor(Number(p.upgrades[k]) || 0);
      if (l > 0) upgrades[k] = l;
    }
  }
  return {
    chow: clampNum(p.chow, 0, 10 ** 9, CURRENT_PROG_DEFAULTS.chow),
    night: clampNum(p.night, 1, 10 ** 9, CURRENT_PROG_DEFAULTS.night),
    upgrades,
    bestRating: typeof p.bestRating === 'string' ? p.bestRating : CURRENT_PROG_DEFAULTS.bestRating
  };
}

function normalizeMemory(m = {}) {
  m = m && typeof m === 'object' ? m : {};
  return {
    sprinkler: clampNum(m.sprinkler, 0, 999, 0),
    hose: clampNum(m.hose, 0, 999, 0),
    barrier: clampNum(m.barrier, 0, 999, 0),
    raised: clampNum(m.raised, 0, 999, 0),
    light: clampNum(m.light, 0, 999, 0)
  };
}

function normalizePersonality(p) {
  if (!Array.isArray(p)) return null;
  const known = ['BRAZEN', 'SNEAKY', 'PATIENT', 'GREEDY', 'JUMPY', 'CLEVER', 'MENACE'];
  const clean = p.filter(t => known.includes(t));
  return clean.length ? clean : null;
}

const hi = v => clampNum(v, 0, 10 ** 9, 0);
// Gary's persistent behavioral history, used to grow recognition writing.
function normalizeHistory(h = {}) {
  h = h && typeof h === 'object' ? h : {};
  return {
    sprinkler: { total: hi(h.sprinkler && h.sprinkler.total), streak: hi(h.sprinkler && h.sprinkler.streak) },
    side: { east: hi(h.side && h.side.east), west: hi(h.side && h.side.west) },
    climbs: { total: hi(h.climbs && h.climbs.total), streak: hi(h.climbs && h.climbs.streak) },
    barrier: { total: hi(h.barrier && h.barrier.total), streak: hi(h.barrier && h.barrier.streak) },
    bigTheft: hi(h.bigTheft)
  };
}

// Central load. Returns normalized, version-annotated data. Never throws.
export function loadSave() {
  let raw = null;
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (text) raw = JSON.parse(text);
  } catch {
    raw = null; // malformed JSON -> fresh state
  }
  const data = raw && typeof raw === 'object' ? raw : {};
  const version = clampNum(data.version, 1, SAVE_VERSION, 1);
  const cats = data.cats && typeof data.cats === 'object' ? data.cats : {};
  const gary = data.gary && typeof data.gary === 'object' ? data.gary : {};
  return {
    version,
    existed: raw !== null && typeof raw === 'object' && !!(raw.cats || raw.gary || raw.prog),
    cats,                       // {id:trust} copied through as-is (Game validates)
    gary: {
      memory: normalizeMemory(gary.memory),
      personality: normalizePersonality(gary.personality),
      history: normalizeHistory(gary.history)
    },
    prog: normalizeProg(data.prog),
    // True when no personality exists yet (brand-new or legacy save).
    needsPersonality: !Array.isArray(gary.personality) || !gary.personality.length,
    migrated: version < SAVE_VERSION
  };
}

export function buildSave({ cats = {}, garyMemory = {}, garyPersonality = [], garyHistory = {}, prog = {} } = {}) {
  return {
    version: SAVE_VERSION,
    cats,
    gary: {
      memory: normalizeMemory(garyMemory),
      personality: normalizePersonality(garyPersonality) || [],
      history: normalizeHistory(garyHistory)
    },
    prog: normalizeProg(prog)
  };
}

export function persistSave(payload) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(buildSave(payload))); } catch { /* storage full/blocked */ }
}