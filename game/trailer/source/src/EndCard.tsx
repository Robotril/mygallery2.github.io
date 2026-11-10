import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { C, EASE, FONT } from './theme';
import { ClayType } from './ClayType';

// Brand end card: sky-blue clay world with slowly drifting clay blobs, the CLAYFRONT logo pressed in on the final
// hit, then one line and the link. Holds well over a second before the music rings out.
const BLOBS = [
  { x: 180, y: 220, r: 120, c: C.tangerine, d: C.tangerineD, sp: 0.9 }, { x: 1690, y: 180, r: 90, c: C.sun, d: C.sunD, sp: 1.2 },
  { x: 1560, y: 840, r: 150, c: C.teal, d: C.tealD, sp: 0.7 }, { x: 330, y: 880, r: 80, c: C.berry, d: '#d94a7a', sp: 1.4 },
  { x: 980, y: 1010, r: 60, c: C.grass, d: C.grassD, sp: 1.1 }, { x: 1240, y: 120, r: 50, c: C.white, d: C.whiteD, sp: 1.6 },
];
export const EndCard: React.FC = () => {
  const f = useCurrentFrame(); // local to the end card
  const zoom = interpolate(f, [0, 22], [1.18, 1], { extrapolateRight: 'clamp', easing: EASE.out }) * (1 + 0.012 * Math.sin(f / 30));
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 38%, #8cc8ff 0%, ${C.sky} 45%, ${C.skyD} 100%)`, transform: `scale(${zoom})` }}>
      {BLOBS.map((b, i) => {
        const pop = interpolate(f, [4 + i * 3, 18 + i * 3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.out });
        const dx = Math.sin(f / 40 * b.sp + i) * 18, dy = Math.cos(f / 52 * b.sp + i * 2) * 14;
        return <div key={i} style={{ position: 'absolute', left: b.x - b.r + dx, top: b.y - b.r + dy, width: b.r * 2, height: b.r * 2 * 0.92, borderRadius: '52% 48% 50% 50% / 55% 50% 50% 45%',
          background: b.c, transform: `scale(${pop}) rotate(${i * 23 + f * 0.1 * b.sp}deg)`, boxShadow: `inset 0 ${b.r * 0.12}px 0 rgba(255,255,255,.45), inset 0 -${b.r * 0.18}px 0 ${b.d}, 0 ${b.r * 0.2}px ${b.r * 0.5}px -${b.r * 0.15}px rgba(29,34,66,.35)` }} />;
      })}
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34 }}>
        <ClayType id="logo" text="CLAYFRONT" at={-8} size={210} stagger={2} slab={{ color: C.skyDeep, shade: '#163f70' }} color={C.white}
          alt={{ from: 4, color: C.sun }} />
        <ClayType id="tag" text="Free to play in your browser" sub="PC and phone · robotril.github.io/mygallery2.github.io/game" at={26} size={72} stagger={0.8} slab={{ color: C.white, shade: C.whiteD }} subScale={0.62} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
