import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { C, EASE, SLAB_RADIUS } from './theme';

// A thick tangerine clay slab sweeps diagonally past the lens and covers the frame exactly on the cut (`at`).
// It has a pressed underside and a vertical-light top edge so it reads as an object with depth, not a flat bar.
export const SlabWipe: React.FC<{ at: number; color?: string; shade?: string }> = ({ at, color = C.tangerine, shade = C.tangerineD }) => {
  const f = useCurrentFrame(); const d = 13;
  if (f < at - d || f > at + d) return null;
  const p = interpolate(f, [at - d, at + d], [-1, 1], { easing: EASE.inOut });
  const x = p * 2900, y = -p * 700, blur = Math.abs(interpolate(f, [at - d, at, at + d], [0, 1, 0])) ;
  const speed = 1 - Math.abs(p); // fastest in the middle
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg width={0} height={0}><defs><filter id="wipe-mb" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={`${(18 * speed).toFixed(1)} ${(4 * speed).toFixed(1)}`} /></filter></defs></svg>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 3000, height: 2200, marginLeft: -1500, marginTop: -1100,
        transform: `translate(${x}px, ${y}px) rotate(-14deg)`, borderRadius: SLAB_RADIUS.replace(/px/g, '0px'), background: color,
        boxShadow: `inset 0 18px 0 rgba(255,255,255,.45), inset 0 -60px 0 ${shade}, 0 50px 90px -20px rgba(29,34,66,.55)`, filter: blur > 0.02 ? 'url(#wipe-mb)' : 'none' }} />
    </AbsoluteFill>
  );
};
