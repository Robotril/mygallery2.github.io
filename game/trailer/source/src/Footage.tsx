import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { EASE } from './theme';
import { CLIP_FRAMES } from './gameSfx';
import type { Shot } from './timeline';

// One captured gameplay clip (a JPEG per frame, captured frame-exact from the real game) with a small
// punch-in on the cut so every hard cut lands with energy.
export const Footage: React.FC<{ shot: Shot; punch?: number }> = ({ shot, punch = 0.035 }) => {
  const f = useCurrentFrame();
  const n = Math.max(0, Math.min((shot.clipFrom ?? 0) + f, (CLIP_FRAMES[shot.clip!] ?? 1) - 1));
  const pushK = shot.push ? interpolate(f, [0, shot.dur], [0, 1], { extrapolateRight: 'clamp', easing: EASE.inOut }) : 0;
  const s = (1 + punch * (1 - interpolate(f, [0, 12], [0, 1], { extrapolateRight: 'clamp', easing: EASE.out }))) * (shot.push ? 1 + (shot.push.to - 1) * pushK : 1);
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img src={staticFile(`frames/${shot.clip}/f${String(n).padStart(4, '0')}.jpg`)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${s})`, transformOrigin: shot.push ? `${shot.push.ox}% ${shot.push.oy}%` : '50% 50%', filter: 'saturate(1.08) contrast(1.04)' }} />
    </AbsoluteFill>
  );
};
