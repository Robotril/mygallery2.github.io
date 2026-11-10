// Kinetic type in CLAYFRONT's "clay press" style, frame-exact for video:
// letters drop in stretched tall with a vertical motion blur (SVG, one axis only), land, squash wide and settle;
// they leave faster than they came. Optional clay slab squashes in behind the words first.
import React from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { C, EASE, FONT, SLAB_RADIUS } from './theme';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const SETTLE = Easing.bezier(0.2, 0.9, 0.25, 1); // same settle curve the game uses for its letters

// keyframes of the press: 0 → 0.52 overshoot squash → 0.78 rebound → 1 rest (same as the game)
function pressPose(p: number) {
  if (p <= 0) return { y: -75, sx: 0.86, sy: 1.5, o: 0 };
  if (p >= 1) return { y: 0, sx: 1, sy: 1, o: 1 };
  const k = [0, 0.52, 0.78, 1], Y = [-75, 8, -3, 0], SX = [0.86, 1.16, 0.95, 1], SY = [1.5, 0.8, 1.06, 1], O = [0, 1, 1, 1];
  return { y: interpolate(p, k, Y), sx: interpolate(p, k, SX), sy: interpolate(p, k, SY), o: interpolate(p, k, O) };
}

export const ClayType: React.FC<{
  text: string; sub?: string; at: number; out?: number; size: number; slab?: { color: string; shade: string };
  stagger?: number; color?: string; outline?: boolean; align?: 'left' | 'center' | 'right'; id: string; alt?: { from: number; color: string; shadow?: string };
  inDur?: number; subScale?: number;
}> = ({ text, sub, at, out, size, slab, stagger = 2, color = C.ink, outline = false, align = 'left', id, alt, inDur = 18, subScale = 0.52 }) => {
  const f = useCurrentFrame();
  const letters = [...text];
  const outDur = 9;
  const outF = out ?? 1e9;
  // vertical motion blur while letters are moving (in: 16 → 0, out: 0 → 18)
  const lastLand = at + (slab ? 4 : 0) + letters.length * stagger + inDur;
  const blurIn = interpolate(f, [at, lastLand], [16, 0], { ...clamp, easing: EASE.out });
  const blurOut = interpolate(f, [outF, outF + outDur + letters.length * 0.2], [0, 18], { ...clamp, easing: EASE.in });
  const blur = Math.max(blurIn, blurOut);
  const slabP = slab ? interpolate(f, [at, at + 11], [0, 1], { ...clamp, easing: EASE.out }) : 1;
  const slabOut = interpolate(f, [outF + 3, outF + 3 + outDur], [0, 1], { ...clamp, easing: EASE.in });
  const slabScaleX = slab ? (slabP < 0.6 ? interpolate(slabP, [0, 0.6], [0, 1.08]) : interpolate(slabP, [0.6, 1], [1.08, 1])) * (1 + 0.06 * slabOut) : 1;
  const slabScaleY = slab ? (slabP < 0.6 ? interpolate(slabP, [0, 0.6], [0.6, 0.9]) : interpolate(slabP, [0.6, 1], [0.9, 1])) * (1 - 0.8 * slabOut) : 1;
  const visible = f >= at - 1 && f <= outF + outDur + letters.length * 0.2 + 4;
  if (!visible) return null;
  const stroke = outline ? { WebkitTextStroke: `${size * 0.05}px ${C.ink}`, paintOrder: 'stroke fill', textShadow: `0 ${size * 0.06}px 0 ${C.ink}, 0 ${size * 0.16}px ${size * 0.3}px rgba(29,34,66,.35)` } : {};
  const subIn = interpolate(f, [at + 10 + letters.length * stagger * 0.6, at + 24 + letters.length * stagger * 0.6], [0, 1], { ...clamp, easing: EASE.out });
  const subOut = interpolate(f, [outF, outF + 7], [0, 1], { ...clamp, easing: EASE.in });
  return (
    <div style={{ display: 'inline-block', position: 'relative', textAlign: align }}>
      <svg width={0} height={0} style={{ position: 'absolute' }}><defs>
        <filter id={`mb-${id}`} x="-40%" y="-90%" width="180%" height="280%"><feGaussianBlur stdDeviation={`${(blur * 0.06).toFixed(2)} ${blur.toFixed(2)}`} /></filter>
      </defs></svg>
      <div style={{
        position: 'relative', padding: slab ? `${size * 0.16}px ${size * 0.5}px ${size * 0.24}px` : 0, borderRadius: SLAB_RADIUS,
        background: slab ? slab.color : 'none', transform: `scale(${slabScaleX}, ${slabScaleY})`, transformOrigin: '50% 70%',
        opacity: slab ? Math.min(1, slabP * 2) * (1 - slabOut) : 1,
        boxShadow: slab ? `inset 0 4px 0 rgba(255,255,255,.55), inset 0 -${size * 0.12}px 0 ${slab.shade}, 0 ${size * 0.2}px ${size * 0.4}px -${size * 0.12}px rgba(29,34,66,.5)` : 'none',
      }}>
        <div style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: size, lineHeight: 0.95, color, whiteSpace: 'nowrap', filter: blur > 0.05 ? `url(#mb-${id})` : 'none', ...stroke }}>
          {letters.map((ch, i) => {
            const pIn = interpolate(f, [at + (slab ? 4 : 0) + i * stagger, at + (slab ? 4 : 0) + i * stagger + inDur], [0, 1], { ...clamp, easing: SETTLE });
            const pOut = interpolate(f, [outF + (letters.length - 1 - i) * 0.2, outF + (letters.length - 1 - i) * 0.2 + outDur], [0, 1], { ...clamp, easing: EASE.in });
            const a = pressPose(pIn);
            const y = a.y - 90 * pOut, sx = a.sx * (1 - 0.1 * pOut), sy = a.sy * (1 + 0.4 * pOut), o = a.o * (1 - pOut);
            return <span key={i} style={{ display: 'inline-block', transform: `translateY(${y}%) scale(${sx}, ${sy})`, transformOrigin: '50% 100%', opacity: o, whiteSpace: 'pre', ...(alt && i >= alt.from ? { color: alt.color } : {}), ...(alt?.shadow ? { textShadow: alt.shadow } : {}) }}>{ch}</span>;
          })}
        </div>
        {sub ? <div style={{ fontFamily: FONT.body, fontWeight: 800, fontSize: size * subScale, color: slab ? C.ink : C.white, opacity: 0.85 * subIn * (1 - subOut), transform: `translateY(${(1 - subIn) * 40 - subOut * 30}%)`, marginTop: size * 0.12, whiteSpace: 'nowrap' }}>{sub}</div> : null}
      </div>
    </div>
  );
};
