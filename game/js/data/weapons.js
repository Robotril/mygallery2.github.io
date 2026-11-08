// Weapon database. All stats live here so balancing never touches gameplay code.
// spread values are radians, ranges in meters, rpm = rounds per minute.

export const AMMO = {
  light: { name: 'Light Ammo', color: '#f2c14e', pickup: 60 },
  rifle: { name: 'Rifle Ammo', color: '#7fc8a9', pickup: 60 },
  shell: { name: 'Shells', color: '#e45a4b', pickup: 16 },
  sniper: { name: 'Sniper Ammo', color: '#6aa6ff', pickup: 12 },
  rocket: { name: 'Explosives', color: '#c58cff', pickup: 3 },
};

const W = (o) => ({
  head: 1.6, burst: 1, burstDelay: 0.3, pellets: 1, minDmg: 0.6, adsFov: 1.2, adsTime: 0.2, move: 1, recoilH: 0.006,
  spreadMove: 1.6, reserve: 4, explosive: null, tube: false, ...o,
});

export const WEAPONS = [
  W({ id: 'sidekick', name: 'Sidekick P9', cls: 'pistol', ammo: 'light', dmg: 26, head: 1.8, rpm: 420, mode: 'semi', mag: 15, reload: 1.35, near: 14, far: 34, spreadHip: 0.022, spreadAds: 0.006, recoilV: 0.014, adsFov: 1.15, adsTime: 0.14, move: 1.0,
    snd: { pitch: 1.25, body: 220, crack: 0.7, tail: 0.25 }, model: { len: 0.2, h: 0.09, barrel: 0.02, br: 0.012, stock: 'none', magT: 'pistol', grip: 'pistol', color: '#2c2f36', accent: '#c9752f' }, desc: 'Reliable sidearm. Quick to aim, forgiving recoil.' }),
  W({ id: 'mule', name: 'Mule .50 Magnum', cls: 'pistol', ammo: 'light', dmg: 58, head: 1.6, rpm: 150, mode: 'semi', mag: 6, reload: 2.2, near: 18, far: 45, spreadHip: 0.03, spreadAds: 0.005, recoilV: 0.05, recoilH: 0.012, adsFov: 1.2, adsTime: 0.18,
    snd: { pitch: 0.8, body: 120, crack: 1, tail: 0.6 }, model: { len: 0.27, h: 0.1, barrel: 0.1, br: 0.018, stock: 'none', magT: 'cyl', grip: 'pistol', color: '#8a8f99', accent: '#5a3a22' }, desc: 'Hand cannon. Two body shots and your target is putty.' }),
  W({ id: 'viper', name: 'Viper MP', cls: 'pistol', ammo: 'light', dmg: 18, rpm: 950, mode: 'auto', mag: 22, reload: 1.6, near: 9, far: 24, minDmg: 0.55, spreadHip: 0.034, spreadAds: 0.016, recoilV: 0.011, recoilH: 0.01, adsTime: 0.15,
    snd: { pitch: 1.4, body: 260, crack: 0.5, tail: 0.18 }, model: { len: 0.24, h: 0.1, barrel: 0.03, br: 0.012, stock: 'none', magT: 'pistolLong', grip: 'pistol', color: '#3d2b4f', accent: '#e8c35a' }, desc: 'Machine pistol that sprays a storm up close.' }),
  W({ id: 'wasp', name: 'Wasp SMG', cls: 'smg', ammo: 'light', dmg: 21, rpm: 820, mode: 'auto', mag: 30, reload: 1.9, near: 12, far: 30, spreadHip: 0.03, spreadAds: 0.009, recoilV: 0.011, recoilH: 0.008, adsFov: 1.2, adsTime: 0.17, move: 0.98,
    snd: { pitch: 1.3, body: 240, crack: 0.55, tail: 0.2 }, model: { len: 0.34, h: 0.12, barrel: 0.1, br: 0.014, stock: 'skeleton', magT: 'box', grip: 'pistol', color: '#f2b134', accent: '#222' }, desc: 'Hive-yellow bullet hose. Best hip-fire in the armory.' }),
  W({ id: 'kestrel', name: 'Kestrel K9', cls: 'smg', ammo: 'light', dmg: 25, rpm: 690, mode: 'auto', mag: 32, reload: 2.0, near: 15, far: 36, spreadHip: 0.03, spreadAds: 0.008, recoilV: 0.013, recoilH: 0.007, adsTime: 0.18, move: 0.97,
    snd: { pitch: 1.15, body: 210, crack: 0.6, tail: 0.25 }, model: { len: 0.38, h: 0.13, barrel: 0.12, br: 0.015, stock: 'full', magT: 'curved', grip: 'pistol', color: '#3a4a3a', accent: '#a0a0a0' }, desc: 'Balanced SMG that still bites at mid range.' }),
  W({ id: 'buzzsaw', name: 'Buzzsaw R-40', cls: 'smg', ammo: 'light', dmg: 17, rpm: 1080, mode: 'auto', mag: 40, reload: 2.2, near: 9, far: 24, minDmg: 0.55, spreadHip: 0.036, spreadAds: 0.012, recoilV: 0.01, recoilH: 0.012, adsTime: 0.17, move: 0.98,
    snd: { pitch: 1.45, body: 280, crack: 0.45, tail: 0.16 }, model: { len: 0.36, h: 0.12, barrel: 0.06, br: 0.016, stock: 'skeleton', magT: 'drumSmall', grip: 'pistol', color: '#b33d3d', accent: '#ddd' }, desc: 'Absurd fire rate. Melts at close range, useless far away.' }),
  W({ id: 'sentinel', name: 'Sentinel M-18', cls: 'ar', ammo: 'rifle', dmg: 28, rpm: 720, mode: 'auto', mag: 30, reload: 2.2, near: 30, far: 70, minDmg: 0.7, spreadHip: 0.04, spreadAds: 0.004, recoilV: 0.017, recoilH: 0.008, adsFov: 1.3, adsTime: 0.24, move: 0.94,
    snd: { pitch: 1, body: 170, crack: 0.8, tail: 0.4 }, model: { len: 0.5, h: 0.14, barrel: 0.2, br: 0.016, stock: 'full', magT: 'curved', grip: 'pistol', rail: true, color: '#2d3540', accent: '#e07b2a' }, desc: 'Agent 18594\'s trusted rifle. Does everything well.' }),
  W({ id: 'kraken', name: 'Kraken AR-7', cls: 'ar', ammo: 'rifle', dmg: 34, rpm: 600, mode: 'auto', mag: 30, reload: 2.4, near: 35, far: 75, minDmg: 0.7, spreadHip: 0.045, spreadAds: 0.005, recoilV: 0.024, recoilH: 0.013, adsFov: 1.3, adsTime: 0.26, move: 0.92,
    snd: { pitch: 0.88, body: 140, crack: 0.9, tail: 0.5 }, model: { len: 0.54, h: 0.15, barrel: 0.18, br: 0.019, stock: 'full', magT: 'curvedBig', grip: 'pistol', color: '#5b4632', accent: '#2a2a2a' }, desc: 'Heavy-hitting rifle with a kick to match.' }),
  W({ id: 'bulwark', name: 'Bulwark BR-3', cls: 'ar', ammo: 'rifle', dmg: 34, rpm: 900, mode: 'burst', burst: 3, burstDelay: 0.28, mag: 24, reload: 2.3, near: 40, far: 85, minDmg: 0.72, spreadHip: 0.04, spreadAds: 0.003, recoilV: 0.016, adsFov: 1.4, adsTime: 0.25, move: 0.93,
    snd: { pitch: 1.05, body: 180, crack: 0.85, tail: 0.4 }, model: { len: 0.52, h: 0.15, barrel: 0.16, br: 0.017, stock: 'bullpup', magT: 'box', grip: 'pistol', rail: true, color: '#d9d4c7', accent: '#38506b' }, desc: 'Three-round burst. Precise and lethal at range.' }),
  W({ id: 'breacher', name: 'Breacher 12', cls: 'shotgun', ammo: 'shell', dmg: 15, head: 1.3, pellets: 9, rpm: 72, mode: 'pump', mag: 6, tube: true, reload: 0.5, near: 6, far: 18, minDmg: 0.25, spreadHip: 0.075, spreadAds: 0.06, recoilV: 0.06, recoilH: 0.01, adsFov: 1.1, adsTime: 0.2, move: 0.95,
    snd: { pitch: 0.75, body: 95, crack: 1, tail: 0.7 }, model: { len: 0.5, h: 0.13, barrel: 0.28, br: 0.022, stock: 'full', magT: 'tube', grip: 'stock', pump: true, color: '#4a2f1f', accent: '#2a2a2a' }, desc: 'Pump-action door kicker. One shot up close.' }),
  W({ id: 'riot', name: 'Riot Auto-8', cls: 'shotgun', ammo: 'shell', dmg: 11, head: 1.3, pellets: 8, rpm: 230, mode: 'semi', mag: 8, reload: 2.6, near: 6, far: 16, minDmg: 0.25, spreadHip: 0.07, spreadAds: 0.058, recoilV: 0.045, adsFov: 1.1, adsTime: 0.2, move: 0.94,
    snd: { pitch: 0.82, body: 105, crack: 0.9, tail: 0.6 }, model: { len: 0.46, h: 0.15, barrel: 0.22, br: 0.024, stock: 'full', magT: 'box', grip: 'pistol', color: '#232628', accent: '#6b8e23' }, desc: 'Semi-auto shotgun. Fast follow-ups.' }),
  W({ id: 'ranger', name: 'Ranger M21', cls: 'marksman', ammo: 'rifle', dmg: 44, head: 1.9, rpm: 330, mode: 'semi', mag: 15, reload: 2.4, near: 45, far: 110, minDmg: 0.8, spreadHip: 0.05, spreadAds: 0.002, recoilV: 0.03, adsFov: 1.6, adsTime: 0.28, move: 0.92, defOptic: 'reddot',
    snd: { pitch: 0.95, body: 150, crack: 1, tail: 0.6 }, model: { len: 0.6, h: 0.14, barrel: 0.26, br: 0.016, stock: 'full', magT: 'box', grip: 'pistol', rail: true, color: '#6d5a3c', accent: '#2b2b2b' }, desc: 'Semi-auto marksman rifle with a rapid trigger.' }),
  W({ id: 'longbow', name: 'Longbow DMR', cls: 'marksman', ammo: 'rifle', dmg: 54, head: 2.0, rpm: 250, mode: 'semi', mag: 12, reload: 2.6, near: 55, far: 130, minDmg: 0.82, spreadHip: 0.055, spreadAds: 0.0015, recoilV: 0.036, adsFov: 2.4, adsTime: 0.3, move: 0.9, defOptic: 'acog',
    snd: { pitch: 0.9, body: 140, crack: 1.1, tail: 0.7 }, model: { len: 0.64, h: 0.14, barrel: 0.3, br: 0.017, stock: 'full', magT: 'box', grip: 'pistol', rail: true, color: '#41505a', accent: '#c7c7c7' }, desc: 'Precision DMR. Headshots hit like a truck.' }),
  W({ id: 'thunder', name: 'Thunder .50', cls: 'sniper', ammo: 'sniper', dmg: 92, head: 2.2, rpm: 90, mode: 'semi', mag: 7, reload: 3.0, near: 90, far: 220, minDmg: 0.85, spreadHip: 0.08, spreadAds: 0.001, recoilV: 0.07, recoilH: 0.015, adsFov: 4, adsTime: 0.36, move: 0.86, defOptic: 'scope8',
    snd: { pitch: 0.6, body: 80, crack: 1.3, tail: 1.1 }, model: { len: 0.75, h: 0.16, barrel: 0.4, br: 0.022, stock: 'full', magT: 'box', grip: 'pistol', rail: true, brake: true, color: '#3a3f2e', accent: '#1c1c1c' }, desc: 'Semi-auto anti-materiel rifle.' }),
  W({ id: 'hawkeye', name: 'Hawkeye .338', cls: 'sniper', ammo: 'sniper', dmg: 110, head: 2.5, rpm: 46, mode: 'bolt', mag: 5, reload: 2.8, near: 110, far: 260, minDmg: 0.9, spreadHip: 0.09, spreadAds: 0.0005, recoilV: 0.08, adsFov: 5, adsTime: 0.36, move: 0.87, defOptic: 'scope8',
    snd: { pitch: 0.55, body: 70, crack: 1.4, tail: 1.3 }, model: { len: 0.78, h: 0.14, barrel: 0.46, br: 0.018, stock: 'full', magT: 'box', grip: 'stock', bolt: true, rail: true, color: '#2f4f3f', accent: '#8b6b3e' }, desc: 'Bolt-action. One headshot, one elimination.' }),
  W({ id: 'grinder', name: 'Grinder LMG', cls: 'lmg', ammo: 'rifle', dmg: 27, rpm: 760, mode: 'auto', mag: 100, reload: 4.2, near: 30, far: 70, minDmg: 0.7, spreadHip: 0.055, spreadAds: 0.007, recoilV: 0.017, recoilH: 0.011, adsFov: 1.3, adsTime: 0.34, move: 0.84,
    snd: { pitch: 0.95, body: 150, crack: 0.85, tail: 0.5 }, model: { len: 0.66, h: 0.17, barrel: 0.26, br: 0.022, stock: 'full', magT: 'drum', grip: 'pistol', bipod: true, rail: true, color: '#4f5233', accent: '#1d1d1d' }, desc: 'Belt-fed suppression. Never stop shooting.' }),
  W({ id: 'titan', name: 'Titan HMG', cls: 'lmg', ammo: 'rifle', dmg: 35, rpm: 560, mode: 'auto', mag: 75, reload: 4.6, near: 35, far: 80, minDmg: 0.72, spreadHip: 0.06, spreadAds: 0.008, recoilV: 0.024, recoilH: 0.014, adsFov: 1.35, adsTime: 0.38, move: 0.82,
    snd: { pitch: 0.78, body: 110, crack: 1, tail: 0.7 }, model: { len: 0.7, h: 0.19, barrel: 0.3, br: 0.026, stock: 'full', magT: 'boxBig', grip: 'pistol', bipod: true, color: '#26292c', accent: '#b5651d' }, desc: 'Massive damage, massive weight.' }),
  W({ id: 'splat', name: 'Splat Launcher', cls: 'special', ammo: 'rocket', dmg: 0, rpm: 80, mode: 'semi', mag: 4, reload: 3.0, near: 0, far: 60, spreadHip: 0.01, spreadAds: 0.004, recoilV: 0.05, adsFov: 1.2, adsTime: 0.26, move: 0.9, reserve: 2,
    explosive: { speed: 38, gravity: 9, radius: 6, dmg: 120, fuse: 3 }, snd: { pitch: 0.5, body: 70, crack: 0.2, tail: 0.4, thump: true }, model: { len: 0.46, h: 0.16, barrel: 0.22, br: 0.04, stock: 'full', magT: 'cyl', grip: 'pistol', color: '#2c6e49', accent: '#f4d35e' }, desc: 'Lobs sticky clay grenades in an arc.' }),
  W({ id: 'rocket', name: 'Clayzooka RPG', cls: 'special', ammo: 'rocket', dmg: 0, rpm: 50, mode: 'semi', mag: 1, reload: 2.8, near: 0, far: 120, spreadHip: 0.012, spreadAds: 0.003, recoilV: 0.07, adsFov: 1.4, adsTime: 0.3, move: 0.86, reserve: 3,
    explosive: { speed: 60, gravity: 0, radius: 7, dmg: 150, fuse: 6 }, snd: { pitch: 0.45, body: 60, crack: 0.3, tail: 0.9, thump: true }, model: { len: 0.9, h: 0.12, barrel: 0.1, br: 0.06, stock: 'tubeL', magT: 'none', grip: 'pistol', color: '#4b5320', accent: '#c1272d' }, desc: 'Rocket tube. Clears rooftops and crowds.' }),
  W({ id: 'knife', name: 'Combat Knife', cls: 'melee', ammo: null, dmg: 100, head: 1, rpm: 110, mode: 'melee', mag: 0, reload: 0, near: 2.4, far: 2.4, spreadHip: 0, spreadAds: 0, recoilV: 0, adsFov: 1, adsTime: 0.1, move: 1.08,
    snd: { pitch: 1, body: 0, crack: 0, tail: 0 }, model: { knife: true, color: '#444', accent: '#8b5a2b' }, desc: 'Silent. Lethal. Final weapon of Gun Game.' }),
];

export const WEAPON_MAP = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
export const CLASS_NAMES = { pistol: 'Pistols', smg: 'SMGs', ar: 'Assault Rifles', shotgun: 'Shotguns', marksman: 'Marksman Rifles', sniper: 'Sniper Rifles', lmg: 'LMGs', special: 'Launchers', melee: 'Melee' };
export const PRIMARY_CLASSES = ['smg', 'ar', 'shotgun', 'marksman', 'sniper', 'lmg', 'special'];
export const GUN_GAME_ORDER = ['sidekick', 'mule', 'viper', 'wasp', 'kestrel', 'buzzsaw', 'sentinel', 'kraken', 'bulwark', 'grinder', 'titan', 'breacher', 'riot', 'ranger', 'longbow', 'thunder', 'hawkeye', 'splat', 'rocket', 'knife'];

// ---------- Attachments ----------
export const ATTACHMENTS = {
  optic: [
    { id: 'iron', name: 'Iron Sights', desc: 'Factory sights.', zoom: 1, ads: 0 },
    { id: 'reddot', name: 'Pinpoint Red Dot', desc: 'Clean sight picture.', zoom: 1.3, ads: 0.01 },
    { id: 'holo', name: 'Halo Holographic', desc: 'Wide ring reticle. Faster aim.', zoom: 1.25, ads: -0.015 },
    { id: 'acog', name: 'Tri-Lens 3x', desc: 'Mid-range magnified optic.', zoom: 2.4, ads: 0.05 },
    { id: 'scope8', name: 'Eagle 8x Scope', desc: 'Long-range scope with overlay.', zoom: 5, ads: 0.09, scope: true },
  ],
  barrel: [
    { id: 'std', name: 'Standard Barrel', desc: 'No changes.' },
    { id: 'suppressor', name: 'Hush Suppressor', desc: 'Quieter shots, hidden from radar. -10% range.', range: 0.9, loud: 0.35 },
    { id: 'long', name: 'Long Barrel', desc: '+25% effective range. Slower aim.', range: 1.25, ads: 0.03 },
    { id: 'comp', name: 'Compensator', desc: '-22% vertical recoil.', recoilV: 0.78 },
    { id: 'choke', name: 'Tight Choke', desc: 'Shotguns only. -30% pellet spread.', spread: 0.7, only: ['shotgun'] },
  ],
  grip: [
    { id: 'none', name: 'No Grip', desc: 'No changes.' },
    { id: 'vertical', name: 'Vertical Grip', desc: '-15% vertical recoil.', recoilV: 0.85 },
    { id: 'angled', name: 'Angled Grip', desc: '-18% aim-down-sight time.', ads: 0.82 },
    { id: 'laser', name: 'Tac Laser', desc: '-30% hip-fire spread.', hip: 0.7 },
  ],
  mag: [
    { id: 'std', name: 'Standard Mag', desc: 'No changes.' },
    { id: 'ext', name: 'Extended Mag', desc: '+50% capacity. +15% reload time.', mag: 1.5, reload: 1.15 },
    { id: 'fast', name: 'Fast Mag', desc: '-25% reload time.', reload: 0.75 },
    { id: 'drum', name: 'Drum Mag', desc: '+100% capacity. +35% reload, -3% speed.', mag: 2, reload: 1.35, move: 0.97, only: ['smg', 'ar', 'lmg'] },
  ],
};

export const OPTICS_FOR = {
  pistol: ['iron', 'reddot'], smg: ['iron', 'reddot', 'holo'], ar: ['iron', 'reddot', 'holo', 'acog'], shotgun: ['iron', 'reddot', 'holo'],
  marksman: ['iron', 'reddot', 'holo', 'acog', 'scope8'], sniper: ['acog', 'scope8'], lmg: ['iron', 'reddot', 'holo', 'acog'], special: ['iron', 'reddot'], melee: ['iron'],
};

export function allowedAttachments(w, slot) {
  if (w.cls === 'melee') return [ATTACHMENTS[slot][0]];
  if (slot === 'optic') return ATTACHMENTS.optic.filter((a) => OPTICS_FOR[w.cls].includes(a.id));
  if (w.cls === 'special' && slot !== 'optic') return [ATTACHMENTS[slot][0]];
  return ATTACHMENTS[slot].filter((a) => !a.only || a.only.includes(w.cls));
}

export const SKINS = [
  { id: 'factory', name: 'Factory', level: 1, pattern: 'none' },
  { id: 'desert', name: 'Dune Camo', level: 2, pattern: 'camo', colors: ['#c8a165', '#a07b47', '#e1c793'] },
  { id: 'jungle', name: 'Palm Camo', level: 3, pattern: 'camo', colors: ['#3d5a2a', '#25381c', '#6f8f3c'] },
  { id: 'arctic', name: 'Arctic Digital', level: 4, pattern: 'digital', colors: ['#e9eef2', '#b8c6d1', '#7f97ab'] },
  { id: 'tiger', name: 'Tiger Stripe', level: 5, pattern: 'tiger', colors: ['#e3842a', '#1c1c1c'] },
  { id: 'swirl', name: 'Clay Swirl', level: 6, pattern: 'swirl', colors: ['#ff6fa5', '#5bd0d6', '#ffe066'] },
  { id: 'neon', name: 'Neon Circuit', level: 8, pattern: 'neon', colors: ['#121218', '#ff2bd6', '#28e7ff'] },
  { id: 'obsidian', name: 'Obsidian', level: 10, pattern: 'hex', colors: ['#141414', '#2c2c34', '#8a5cff'] },
  { id: 'gold', name: 'Gilded', level: 12, pattern: 'gold', colors: ['#d4a62a', '#8f6a12', '#ffe28a'] },
];
export const SKIN_MAP = Object.fromEntries(SKINS.map((s) => [s.id, s]));

export const WEAPON_XP_PER_LEVEL = 900;
export const weaponLevel = (xp) => 1 + Math.floor((xp || 0) / WEAPON_XP_PER_LEVEL);

// Resolve final stats for a weapon + attachment build.
export function buildStats(weaponId, build = {}, rarity = 0) {
  const w = WEAPON_MAP[weaponId];
  const s = { ...w };
  const pick = (slot, def) => ATTACHMENTS[slot].find((a) => a.id === (build[slot] || def)) || ATTACHMENTS[slot][0];
  const optic = pick('optic', w.defOptic || 'iron');
  const barrel = pick('barrel', 'std'), grip = pick('grip', 'none'), mag = pick('mag', 'std');
  s.optic = optic.id; s.barrel = barrel.id; s.grip = grip.id; s.magType = mag.id; s.skin = build.skin || 'factory';
  s.adsFov = Math.max(w.adsFov, optic.zoom);
  if (optic.id === 'iron' && w.defOptic) s.adsFov = 1.3;
  s.scope = !!optic.scope;
  s.adsTime = (w.adsTime + (optic.ads || 0) + (barrel.ads || 0)) * (grip.ads || 1);
  const rm = barrel.range || 1; s.near = w.near * rm; s.far = w.far * rm;
  s.recoilV = w.recoilV * (barrel.recoilV || 1) * (grip.recoilV || 1);
  s.spreadHip = w.spreadHip * (grip.hip || 1) * (barrel.spread || 1);
  s.spreadAds = w.spreadAds * (barrel.spread || 1);
  s.loud = barrel.loud || 1; s.suppressed = barrel.id === 'suppressor';
  s.mag = Math.round(w.mag * (mag.mag || 1)); s.reload = w.reload * (mag.reload || 1); s.move = w.move * (mag.move || 1);
  const rb = [1, 1.05, 1.1, 1.15, 1.2][rarity] || 1; s.dmg = w.dmg * rb; s.rarity = rarity;
  if (s.explosive) s.explosive = { ...s.explosive, dmg: s.explosive.dmg * rb };
  s.interval = 60 / w.rpm;
  return s;
}

// Damage at distance with linear falloff between near and far.
export function damageAt(s, dist) {
  if (dist <= s.near) return s.dmg;
  if (dist >= s.far) return s.dmg * s.minDmg;
  const t = (dist - s.near) / (s.far - s.near);
  return s.dmg * (1 - t * (1 - s.minDmg));
}

// ---------- Equipment / perks ----------
export const LETHALS = [
  { id: 'frag', name: 'Frag Grenade', desc: 'Cooked fuse, big radius.', radius: 7, dmg: 130, fuse: 2.4, sticky: false, color: '#556b2f' },
  { id: 'sticky', name: 'Sticky Clay Bomb', desc: 'Sticks to anything it touches.', radius: 5.5, dmg: 125, fuse: 1.8, sticky: true, color: '#ff5d8f' },
];
export const TACTICALS = [
  { id: 'smoke', name: 'Smoke Canister', desc: 'Thick wall of smoke that blocks vision.', color: '#bbbbbb' },
  { id: 'stun', name: 'Stun Charge', desc: 'Dazes and slows enemies in range.', color: '#ffd166' },
];
export const PERKS = [
  { id: 'lightweight', name: 'Lightweight', desc: '+8% movement speed.', icon: '🪶' },
  { id: 'quickhands', name: 'Quick Hands', desc: '-25% reload and swap time.', icon: '✋' },
  { id: 'steady', name: 'Steady Aim', desc: '-30% hip-fire spread.', icon: '🎯' },
  { id: 'tough', name: 'Tough Clay', desc: '+25 starting armor; faster health regen.', icon: '🛡️' },
  { id: 'scavenger', name: 'Scavenger', desc: 'Eliminations refill ammo.', icon: '🎒' },
  { id: 'quiet', name: 'Quiet Step', desc: 'Silent footsteps; bots hear you 60% less.', icon: '👟' },
  { id: 'hardline', name: 'Deep Pockets', desc: '+1 lethal and +1 tactical.', icon: '💣' },
];
export const GEAR = [
  { id: 'medkit', name: 'Field Medkit', desc: 'Press H: heal 60 HP (once per life, recharges 45s).', cooldown: 45 },
  { id: 'plates', name: 'Armor Plates', desc: 'Start every life with +50 armor.', cooldown: 0 },
  { id: 'pulse', name: 'Recon Pulse', desc: 'Press X: reveal enemies within 45m for 5s (40s cooldown).', cooldown: 40 },
];
export const RARITY = [
  { name: 'Common', color: '#b8c0c8' }, { name: 'Uncommon', color: '#5ad25a' }, { name: 'Rare', color: '#4aa3ff' },
  { name: 'Epic', color: '#b46cff' }, { name: 'Legendary', color: '#ffb02e' },
];

export const DEFAULT_LOADOUTS = [
  { name: 'Assault', primary: 'sentinel', secondary: 'sidekick', builds: { sentinel: { optic: 'reddot', grip: 'vertical' } }, lethal: 'frag', tactical: 'smoke', perks: ['lightweight', 'quickhands', 'tough'], gear: 'medkit' },
  { name: 'Close Quarters', primary: 'wasp', secondary: 'mule', builds: { wasp: { optic: 'holo', grip: 'laser', mag: 'ext' } }, lethal: 'sticky', tactical: 'stun', perks: ['lightweight', 'steady', 'quiet'], gear: 'plates' },
  { name: 'Overwatch', primary: 'hawkeye', secondary: 'viper', builds: { hawkeye: { optic: 'scope8', barrel: 'long' } }, lethal: 'frag', tactical: 'smoke', perks: ['quiet', 'quickhands', 'scavenger'], gear: 'pulse' },
  { name: 'Breacher', primary: 'breacher', secondary: 'sidekick', builds: { breacher: { barrel: 'choke' } }, lethal: 'sticky', tactical: 'stun', perks: ['lightweight', 'tough', 'hardline'], gear: 'plates' },
  { name: 'Suppressor', primary: 'grinder', secondary: 'sidekick', builds: { grinder: { optic: 'reddot', grip: 'vertical' } }, lethal: 'frag', tactical: 'smoke', perks: ['tough', 'scavenger', 'steady'], gear: 'medkit' },
];
