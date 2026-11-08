// Playable clay characters. Every visual piece is described by data and assembled by entities/clay.js.

export const HELMETS = [
  { id: 'none', name: 'None' }, { id: 'tactical', name: 'Tactical Helmet + NVG' }, { id: 'boonie', name: 'Boonie Hat' },
  { id: 'beanie', name: 'Beanie' }, { id: 'cap', name: 'Backwards Cap' }, { id: 'hood', name: 'Hood' },
  { id: 'bubble', name: 'Bubble Dome' }, { id: 'visor', name: 'Visor Helmet' }, { id: 'beret', name: 'Beret' },
  { id: 'parka', name: 'Fur Parka Hood' }, { id: 'bandana', name: 'Bandana' }, { id: 'crown', name: 'Clay Crown' },
];
export const MASKS = [
  { id: 'none', name: 'None' }, { id: 'balaclava', name: 'Balaclava' }, { id: 'shemagh', name: 'Shemagh Wrap' },
  { id: 'gasmask', name: 'Gas Mask' }, { id: 'visorGlow', name: 'Glow Visor' }, { id: 'shades', name: 'Aviator Shades' },
  { id: 'goggles', name: 'Snow Goggles' }, { id: 'led', name: 'LED Face Mask' }, { id: 'bandanaMask', name: 'Bandana Mask' },
];
export const HAIR = [
  { id: 'none', name: 'Bald' }, { id: 'short', name: 'Buzz Cut' }, { id: 'mohawk', name: 'Mohawk' }, { id: 'ponytail', name: 'Ponytail' },
  { id: 'spiky', name: 'Spiky' }, { id: 'wild', name: 'Wild Curls' }, { id: 'beard', name: 'Full Beard' },
  { id: 'bob', name: 'Bob' }, { id: 'afro', name: 'Afro' }, { id: 'buns', name: 'Space Buns' }, { id: 'quiff', name: 'Quiff' },
  { id: 'long', name: 'Long' }, { id: 'braids', name: 'Braids' },
];
export const ACCESSORIES = [
  { id: 'none', name: 'None' }, { id: 'backpack', name: 'Assault Pack' }, { id: 'radio', name: 'Long Radio' }, { id: 'scarf', name: 'Scarf' },
  { id: 'necklace', name: 'Tooth Necklace' }, { id: 'pads', name: 'Shoulder Armor' }, { id: 'pouches', name: 'Utility Pouches' }, { id: 'cape', name: 'Short Cape' },
];

export const PALETTE = ['#2b3442', '#3f4a3c', '#6b5b3e', '#c2a26b', '#e8e2d4', '#9fb7c9', '#1d1d22', '#7a2e2e', '#d9502e', '#f2b134', '#5bbf6a', '#2f8f83', '#3a6ea5', '#6b4fa0', '#e86fa8', '#f5f5f5', '#4a4a4a', '#8c6a4f'];

const C = (o) => ({ build: 1, height: 1, eye: '#1a1a1a', unlock: 1, acc: 'none', hair: 'none', ...o });

export const CHARACTERS = [
  C({ id: 'agent', name: 'Agent 18594', role: 'Tactical Operator', bio: 'Field-tested, unflappable, numbered not named. The face of CLAYFRONT.',
    skin: '#d9a07a', outfit: '#2b3442', outfit2: '#3c4656', vest: '#4b5a3e', accent: '#e07b2a', boots: '#1f1f22', gloves: '#2a2a2a', helmet: 'tactical', mask: 'none', hair: 'short', acc: 'pouches', patch: '18594' , headScale: 1.16, hairColor: '#3a2a1e', brow: 'stern', mouth: 'smirk' }),
  C({ id: 'mako', name: 'Mako', role: 'Tropical Commando', bio: 'Knows every cove on Coral Cove. Never without shades.', skin: '#a8714f', outfit: '#3d5a2a', outfit2: '#6f8f3c', vest: '#7b5e3b', accent: '#ff8c42', boots: '#3b2a1c', gloves: '#3b2a1c', helmet: 'bandana', mask: 'shades', hair: 'none', acc: 'necklace' , headScale: 1.18, brow: 'calm', mouth: 'grin', cheeks: true }),
  C({ id: 'sandstorm', name: 'Sandstorm', role: 'Desert Combat Soldier', bio: 'Patient as the dunes. Wrapped head to toe.', skin: '#c58c63', outfit: '#c2a26b', outfit2: '#a68a55', vest: '#8a6f45', accent: '#5a3e2b', boots: '#6b5236', gloves: '#6b5236', helmet: 'boonie', mask: 'shemagh', acc: 'backpack' , headScale: 1.14, brow: 'stern', mouth: 'flat', height: 1.04 }),
  C({ id: 'frostbite', name: 'Frostbite', role: 'Arctic Specialist', bio: 'Brought the cold with her. Snow goggles never come off.', skin: '#f0c9a8', outfit: '#e8eef2', outfit2: '#9fb7c9', vest: '#7f97ab', accent: '#3aa0ff', boots: '#5d6a75', gloves: '#5d6a75', helmet: 'parka', mask: 'goggles', unlock: 2 , headScale: 1.2, hairColor: '#f4f1ea', brow: 'raised', mouth: 'smile', cheeks: true, freckles: true }),
  C({ id: 'wraith', name: 'Wraith', role: 'Stealth Operative', bio: 'You won\'t hear the footsteps. Only the green glow.', skin: '#8f6a55', outfit: '#1d1d22', outfit2: '#2a2a31', vest: '#121216', accent: '#3dff8b', boots: '#111', gloves: '#111', helmet: 'hood', mask: 'visorGlow', acc: 'cape', unlock: 3 , headScale: 1.12, brow: 'angry', mouth: 'flat', height: 1.06, build: 0.94 }),
  C({ id: 'volt', name: 'Volt', role: 'Futuristic Specialist', bio: 'Chrome armor, cyan visor, overclocked reflexes.', skin: '#e2b590', outfit: '#e9ecef', outfit2: '#2f3440', vest: '#cfd6dd', accent: '#28e7ff', boots: '#2f3440', gloves: '#2f3440', helmet: 'visor', mask: 'none', acc: 'pads', unlock: 4 , headScale: 1.16, brow: 'raised', mouth: 'grin' }),
  C({ id: 'krill', name: 'Krill', role: 'Urban Street Fighter', bio: 'Downtown born. Headphones on, safety off.', skin: '#7b4b33', outfit: '#6b4fa0', outfit2: '#222', vest: '#3a2d5a', accent: '#f2b134', boots: '#f5f5f5', gloves: '#222', helmet: 'cap', mask: 'bandanaMask', hair: 'short', acc: 'scarf', unlock: 1 , headScale: 1.2, brow: 'angry', mouth: 'smirk', build: 0.96 }),
  C({ id: 'ember', name: 'Ember', role: 'Demolitions Expert', bio: 'Breathes smoke, sleeps never. Mohawk is fireproof.', skin: '#e0a37f', outfit: '#7a2e2e', outfit2: '#d9502e', vest: '#3a2a22', accent: '#ffb02e', boots: '#2a1d16', gloves: '#2a1d16', helmet: 'none', mask: 'gasmask', hair: 'mohawk', acc: 'pouches', unlock: 2 , headScale: 1.16, hairColor: '#ff5a2a', brow: 'angry', mouth: 'grin' }),
  C({ id: 'bubblegum', name: 'Bubblegum', role: 'Experimental Clay', bio: 'Escaped from the clay lab. Pop goes the weasel.', skin: '#ff9ec7', outfit: '#e86fa8', outfit2: '#5bd0d6', vest: '#ffe066', accent: '#5bd0d6', boots: '#6b4fa0', gloves: '#6b4fa0', helmet: 'bubble', mask: 'none', eye: '#3a1a5a', unlock: 5 , headScale: 1.3, hair: 'buns', hairColor: '#5bd0d6', brow: 'raised', mouth: 'open', cheeks: true, freckles: true, height: 0.9, build: 0.92 }),
  C({ id: 'tusk', name: 'Tusk', role: 'Heavy Gunner', bio: 'Big build, bigger beard, biggest gun.', skin: '#c48a64', outfit: '#3f4a3c', outfit2: '#2e3a2a', vest: '#556b2f', accent: '#d9a441', boots: '#2b2b2b', gloves: '#2b2b2b', helmet: 'beanie', mask: 'none', hair: 'beard', acc: 'backpack', build: 1.18, unlock: 3 , headScale: 1.08, hairColor: '#6b3f22', brow: 'stern', mouth: 'frown', height: 1.08 }),
  C({ id: 'rook', name: 'Neon Rook', role: 'Cyber Street Runner', bio: 'Lit up like the downtown skyline.', skin: '#b07a5a', outfit: '#121218', outfit2: '#2a2a3a', vest: '#1d1d2b', accent: '#ff2bd6', boots: '#28e7ff', gloves: '#121218', helmet: 'none', mask: 'led', hair: 'spiky', acc: 'pads', unlock: 6 , headScale: 1.18, hairColor: '#ff2bd6', brow: 'raised', mouth: 'smirk', build: 0.94 }),
  C({ id: 'gator', name: 'Gator', role: 'Swamp Scout', bio: 'Ghillie hood, croc teeth, zero patience.', skin: '#9c6b48', outfit: '#4a5a2a', outfit2: '#6b5b3e', vest: '#3a4a22', accent: '#d4c26a', boots: '#3b2a1c', gloves: '#3b2a1c', helmet: 'hood', mask: 'balaclava', acc: 'necklace', unlock: 4 , headScale: 1.14, brow: 'angry', mouth: 'flat' }),
  C({ id: 'marigold', name: 'Marigold', role: 'Combat Medic', bio: 'Patches you up, then patches them out.', skin: '#e8b48f', outfit: '#f5f5f5', outfit2: '#f2b134', vest: '#d9d9d9', accent: '#e63946', boots: '#4a4a4a', gloves: '#e63946', helmet: 'beret', mask: 'none', acc: 'pouches', unlock: 2 , headScale: 1.22, hairColor: '#c2552b', brow: 'calm', mouth: 'smile', cheeks: true, freckles: true, hair: 'braids' }),
  C({ id: 'putty', name: 'Professor Putty', role: 'Mad Clay Scientist', bio: 'Invented clay armor. Also invented clay explosions.', skin: '#f2c49b', outfit: '#e8e2d4', outfit2: '#5bbf6a', vest: '#9fb7c9', accent: '#ff6f3c', boots: '#3a3a3a', gloves: '#5bbf6a', helmet: 'none', mask: 'goggles', hair: 'wild', acc: 'radio', unlock: 7 , headScale: 1.26, hairColor: '#f2f2f2', brow: 'raised', mouth: 'open', height: 0.95 }),
  C({ id: 'regent', name: 'Regent', role: 'Royal Clay Champion', bio: 'Crowned after a thousand victories. Wants a thousand more.', skin: '#d1946b', outfit: '#3a2d5a', outfit2: '#d4a62a', vest: '#2a2140', accent: '#ffe28a', boots: '#1d1d22', gloves: '#d4a62a', helmet: 'crown', mask: 'none', acc: 'cape', unlock: 10 , headScale: 1.18, hairColor: '#2a1d16', brow: 'calm', mouth: 'smirk', hair: 'quiff', height: 1.04 }),
];
export const CHAR_MAP = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

// Merge a base character with player customization.
export function resolveLook(charId, custom = {}) {
  const base = CHAR_MAP[charId] || CHARACTERS[0];
  const out = { ...base };
  for (const k of ['outfit', 'outfit2', 'vest', 'accent', 'helmet', 'mask', 'hair', 'acc']) if (custom[k]) out[k] = custom[k];
  return out;
}
