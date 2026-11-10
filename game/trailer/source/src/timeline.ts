// The single source of truth for the edit. Every cut sits on a beat (15 frames @ 120 BPM);
// captions and sound pins are derived from SHOTS so moving a shot moves everything with it.
import { C } from './theme';

export type Shot = { id: string; from: number; dur: number; clip?: string; clipFrom?: number; push?: { to: number; ox: number; oy: number } };
export const SHOTS: Record<string, Shot> = {
  showcase: { id: 'showcase', from: 0, dur: 105, clip: 'showcase', clipFrom: 2 },
  intro: { id: 'intro', from: 105, dur: 90, clip: 'intro', clipFrom: 15 },     // game logs "Go" at clip frame 90 -> timeline 180, the drum drop
  fight: { id: 'fight', from: 195, dur: 150, clip: 'fight', clipFrom: 0 },     // ends before the game's banners pile up
  brdrop: { id: 'brdrop', from: 345, dur: 135, clip: 'brdrop', clipFrom: 0 },
  characters: { id: 'characters', from: 480, dur: 90, clip: 'characters', clipFrom: 4 },
  room: { id: 'room', from: 570, dur: 90, clip: 'room', clipFrom: 2, push: { to: 1.1, ox: 30, oy: 40 } }, // move in on the room code
  victory: { id: 'victory', from: 660, dur: 120, clip: 'victory', clipFrom: 6 }, // the win (clip frame 6) lands on 660, bar 11
  endcard: { id: 'endcard', from: 780, dur: 210 },                              // logo slab lands on the final hit (bar 13)
};
export const TOTAL = SHOTS.endcard.from + SHOTS.endcard.dur;

// pos: where the caption sits, chosen per shot to stay clear of the game's own HUD and banners
export type Caption = { at: number; out: number; text: string; sub?: string; color: string; shade: string; pos: { left?: number; right?: number; top?: number; bottom?: number; center?: boolean }; size?: number };
export const CAPTIONS: Caption[] = [
  { at: SHOTS.showcase.from + 8, out: SHOTS.showcase.from + 89, text: 'Everything is made of clay', color: C.sun, shade: C.sunD, pos: { left: 110, top: 150 } },
  { at: SHOTS.fight.from + 18, out: SHOTS.fight.from + 136, text: 'Every knockout,', sub: 'a new gun', color: C.teal, shade: C.tealD, pos: { left: 110, top: 610 } },
  { at: SHOTS.brdrop.from + 22, out: SHOTS.brdrop.from + 118, text: 'Drop in with 49 bots', color: C.tangerine, shade: C.tangerineD, pos: { right: 110, top: 200 } },
  { at: SHOTS.characters.from + 2, out: SHOTS.characters.from + 75, text: '15 clay heroes', color: C.berry, shade: '#d94a7a', pos: { bottom: 64, center: true }, size: 66 },
  { at: SHOTS.room.from + 2, out: SHOTS.room.from + 75, text: 'Play with friends', sub: 'Share a 6-letter code', color: C.sky, shade: C.skyD, pos: { bottom: 64, center: true } },
];

// trailer-level sound pins (game-sound pins come from the capture logs, see Sfx.tsx)
export const TRAILER_SFX = [
  ...CAPTIONS.map((c) => ({ from: c.at + 9, src: 'squish', volume: 0.5 })),          // each caption slab lands
  { from: SHOTS.fight.from - 7, src: 'whoosh', volume: 0.45 },
  { from: SHOTS.brdrop.from - 12, src: 'whoosh', volume: 0.55 },                     // clay slab wipe
  { from: SHOTS.brdrop.from + 34, src: 'whoosh', volume: 0.5 },                      // jump out of the plane
  ...[22, 48, 74].map((d) => ({ from: SHOTS.characters.from + d, src: 'press-hi', volume: 0.3 })), // character changes
  { from: SHOTS.characters.from - 6, src: 'whoosh', volume: 0.55 },
  { from: SHOTS.room.from - 6, src: 'whoosh', volume: 0.55 },
  { from: SHOTS.endcard.from + 2, src: 'squish', volume: 0.6 },                      // logo slab lands
  { from: SHOTS.endcard.from + 8, src: 'sparkle', volume: 0.55 },
  { from: SHOTS.endcard.from + 34, src: 'press-hi', volume: 0.35 },                  // tagline
];
