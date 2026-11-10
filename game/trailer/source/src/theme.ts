// One theme object for the whole trailer: CLAYFRONT's own design tokens (DESIGN.md) + motion tokens.
// Motion personality: "playful & bold" (games, kids) — fast-in, soft landing, visible squash.
import { Easing } from 'remotion';

export const C = {
  ink: '#1d2242', ink2: '#474e78', white: '#f4f7fc', whiteD: '#d9e1ef',
  tangerine: '#ff8a3d', tangerineD: '#e0661b', teal: '#33c7b8', tealD: '#1d9d90',
  sky: '#5aaeff', skyD: '#3487de', skyDeep: '#1f5fa6', sun: '#ffd23f', sunD: '#e9b400',
  berry: '#ff6f9e', grass: '#5ccb6b', grassD: '#3aa64a',
};
export const FONT = { display: '"Baloo 2", Nunito, system-ui, sans-serif', body: 'Nunito, system-ui, sans-serif' };
export const FPS = 30;
export const BEAT = 15; // 120 BPM
export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),     // entrances: fast, soft landing
  in: Easing.bezier(0.55, 0, 1, 0.45),     // exits: accelerate away
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
};
export const SLAB_RADIUS = '28px 34px 30px 26px / 30px 26px 32px 28px';
