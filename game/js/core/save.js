// Persistent profile: settings, progression, loadouts, stats. Versioned and defensive against storage failures.
import { DEFAULT_LOADOUTS, WEAPONS } from '../data/weapons.js';
import { hashString, mulberry32 } from './util.js';

const KEY = 'clayfront.profile.v1';
export const SAVE_VERSION = 1;

export const DEFAULT_SETTINGS = {
  graphics: 'auto', renderScale: 1, fov: 78, sensitivity: 1, adsSensitivity: 0.8, invertY: false,
  master: 0.8, sfx: 0.9, music: 0.5, ambience: 0.7, showFps: false, fullscreen: true, crosshairColor: '#ffffff',
  uiScale: 'auto', keyHints: true, autoSprint: true, autoPickup: true, pcAimAssist: true, touchSensitivity: 1, aimAssist: true, autoFire: false, buttonScale: 1, touchLayout: {}, touchLayoutP: {}, holdToCrouch: false, holdToAim: true,
};

function freshProfile() {
  return {
    version: SAVE_VERSION,
    name: 'Agent 18594',
    xp: 0,
    character: 'agent',
    custom: {},
    loadouts: JSON.parse(JSON.stringify(DEFAULT_LOADOUTS)),
    activeLoadout: 0,
    weaponXp: {},
    settings: { ...DEFAULT_SETTINGS },
    stats: { matches: 0, wins: 0, losses: 0, kills: 0, deaths: 0, headshots: 0, damage: 0, shots: 0, hits: 0, playTime: 0,
      br: { matches: 0, wins: 0, top10: 0, bestPlace: 0, kills: 0 }, gg: { matches: 0, wins: 0, kills: 0 }, custom: { matches: 0, wins: 0, kills: 0 }, crates: 0 },
    challenges: { day: '', list: [] },
    achievements: {},
    history: [],
    tutorialDone: false,
    tutorialOffered: false,
  };
}

let profile = null;
const listeners = new Set();

export function loadProfile() {
  let data = null;
  try { const raw = localStorage.getItem(KEY); if (raw) data = JSON.parse(raw); } catch (e) { data = null; }
  const fresh = freshProfile();
  if (!data || typeof data !== 'object') profile = fresh;
  else {
    profile = { ...fresh, ...data, settings: { ...fresh.settings, ...(data.settings || {}) }, stats: deepMerge(fresh.stats, data.stats || {}) };
    if (!Array.isArray(profile.loadouts) || profile.loadouts.length < 3) profile.loadouts = fresh.loadouts;
  }
  refreshChallenges();
  return profile;
}

function deepMerge(a, b) {
  const o = { ...a };
  for (const k in b) o[k] = (a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) ? deepMerge(a[k], b[k]) : b[k];
  return o;
}

export function getProfile() { return profile || loadProfile(); }

let saveTimer = 0;
export function saveProfile(immediate = false) {
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) { /* storage full or blocked: keep in memory */ } };
  clearTimeout(saveTimer);
  if (immediate) write(); else saveTimer = setTimeout(write, 300);
  listeners.forEach((f) => f(profile));
}
export function onProfileChange(f) { listeners.add(f); return () => listeners.delete(f); }
export function resetProfile() { profile = freshProfile(); refreshChallenges(); saveProfile(true); }

// ---------- XP & levels ----------
export const xpForLevel = (lvl) => 1000 + (lvl - 1) * 300;
export function levelInfo(xp = getProfile().xp) {
  let lvl = 1, rem = xp;
  while (rem >= xpForLevel(lvl) && lvl < 100) { rem -= xpForLevel(lvl); lvl++; }
  return { level: lvl, into: rem, need: xpForLevel(lvl), pct: rem / xpForLevel(lvl) };
}

// ---------- Daily challenges ----------
const CHALLENGE_POOL = [
  { id: 'kills15', text: 'Get 15 eliminations', stat: 'kills', goal: 15, xp: 1500 },
  { id: 'head5', text: 'Land 5 headshot eliminations', stat: 'headshots', goal: 5, xp: 1200 },
  { id: 'ggwin', text: 'Win a Gun Game match', stat: 'ggWins', goal: 1, xp: 2000 },
  { id: 'brtop10', text: 'Place top 10 in Battle Royale', stat: 'brTop10', goal: 1, xp: 1500 },
  { id: 'crates3', text: 'Open 3 supply crates', stat: 'crates', goal: 3, xp: 1000 },
  { id: 'dmg2500', text: 'Deal 2,500 damage', stat: 'damage', goal: 2500, xp: 1200 },
  { id: 'smg8', text: 'Get 8 SMG eliminations', stat: 'kills_smg', goal: 8, xp: 1200 },
  { id: 'ar8', text: 'Get 8 Assault Rifle eliminations', stat: 'kills_ar', goal: 8, xp: 1200 },
  { id: 'snipe3', text: 'Get 3 Sniper eliminations', stat: 'kills_sniper', goal: 3, xp: 1400 },
  { id: 'matches3', text: 'Complete 3 matches', stat: 'matches', goal: 3, xp: 900 },
  { id: 'explo3', text: 'Get 3 explosive eliminations', stat: 'kills_explosive', goal: 3, xp: 1300 },
];
export function todayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
export function refreshChallenges() {
  const p = profile; const day = todayKey();
  if (p.challenges.day === day && p.challenges.list.length) return;
  const r = mulberry32(hashString(day));
  const pool = CHALLENGE_POOL.slice(); const list = [];
  while (list.length < 3) { const c = pool.splice(Math.floor(r() * pool.length), 1)[0]; list.push({ id: c.id, progress: 0, done: false }); }
  p.challenges = { day, list };
}
export function challengeDefs() {
  return getProfile().challenges.list.map((c) => ({ ...CHALLENGE_POOL.find((d) => d.id === c.id), ...c }));
}
export function bumpChallenge(stat, amount) {
  const out = [];
  for (const c of getProfile().challenges.list) {
    const def = CHALLENGE_POOL.find((d) => d.id === c.id);
    if (!def || c.done || def.stat !== stat) continue;
    c.progress = Math.min(def.goal, c.progress + amount);
    if (c.progress >= def.goal) { c.done = true; out.push(def); }
  }
  return out;
}

export const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'First Blood', desc: 'Get your first elimination.' },
  { id: 'first_win', name: 'Last Clay Standing', desc: 'Win a Battle Royale.' },
  { id: 'gg_win', name: 'Arsenal Master', desc: 'Win a Gun Game.' },
  { id: 'ten_match', name: 'Sculptor of Chaos', desc: 'Get 10 eliminations in one match.' },
  { id: 'headhunter', name: 'Headhunter', desc: '50 career headshot eliminations.' },
  { id: 'veteran', name: 'Veteran', desc: 'Play 25 matches.' },
  { id: 'centurion', name: 'Centurion', desc: '100 career eliminations.' },
  { id: 'no_damage', name: 'Untouchable', desc: 'Win a match without dying (Gun Game / Custom).' },
];

// Apply end-of-match results; returns a summary for the results screen.
export function recordMatch(r) {
  const p = getProfile(); const s = p.stats;
  const before = levelInfo(p.xp).level;
  s.matches++; s.kills += r.kills; s.deaths += r.deaths; s.headshots += r.headshots; s.damage += Math.round(r.damage);
  s.shots += r.shots; s.hits += r.hits; s.playTime += r.time;
  if (r.won) s.wins++; else s.losses++;
  const unlocked = [];
  const challengesDone = [];
  const bump = (k, v) => { if (v > 0) challengesDone.push(...bumpChallenge(k, v)); };
  if (r.mode === 'br') {
    s.br.matches++; s.br.kills += r.kills; if (r.won) s.br.wins++; if (r.place <= 10) s.br.top10++;
    if (!s.br.bestPlace || r.place < s.br.bestPlace) s.br.bestPlace = r.place; bump('brTop10', r.place <= 10 ? 1 : 0);
  } else if (r.mode === 'gg') { s.gg.matches++; s.gg.kills += r.kills; if (r.won) { s.gg.wins++; bump('ggWins', 1); } }
  else { s.custom.matches++; s.custom.kills += r.kills; if (r.won) s.custom.wins++; }
  s.crates += r.crates || 0;
  bump('kills', r.kills); bump('headshots', r.headshots); bump('crates', r.crates || 0); bump('damage', Math.round(r.damage)); bump('matches', 1);
  for (const [k, v] of Object.entries(r.classKills || {})) bump('kills_' + k, v);
  bump('kills_explosive', r.explosiveKills || 0);
  // XP
  let xp = r.xp;
  const challengeXp = challengesDone.reduce((a, c) => a + c.xp, 0);
  xp += challengeXp;
  p.xp += xp;
  for (const [wid, wxp] of Object.entries(r.weaponXp || {})) p.weaponXp[wid] = (p.weaponXp[wid] || 0) + wxp;
  const ach = (id) => { if (!p.achievements[id]) { p.achievements[id] = Date.now(); unlocked.push(ACHIEVEMENTS.find((a) => a.id === id)); } };
  if (s.kills > 0) ach('first_blood');
  if (r.mode === 'br' && r.won) ach('first_win');
  if (r.mode === 'gg' && r.won) ach('gg_win');
  if (r.kills >= 10) ach('ten_match');
  if (s.headshots >= 50) ach('headhunter');
  if (s.matches >= 25) ach('veteran');
  if (s.kills >= 100) ach('centurion');
  if (r.won && r.deaths === 0 && r.mode !== 'br') ach('no_damage');
  p.history.unshift({ t: Date.now(), mode: r.mode, map: r.map, won: r.won, kills: r.kills, place: r.place, xp });
  p.history = p.history.slice(0, 20);
  saveProfile(true);
  const after = levelInfo(p.xp).level;
  return { xp, challengeXp, challengesDone, achievements: unlocked, levelBefore: before, levelAfter: after };
}

export function weaponsUnlocked() { return WEAPONS.map((w) => w.id); }
