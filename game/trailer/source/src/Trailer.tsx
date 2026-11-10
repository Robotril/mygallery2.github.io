import React from 'react';
import { AbsoluteFill, Sequence, staticFile } from 'remotion';
import { C } from './theme';
import { CAPTIONS, SHOTS } from './timeline';
import { Footage } from './Footage';
import { ClayType } from './ClayType';
import { SlabWipe } from './SlabWipe';
import { EndCard } from './EndCard';
import { Finish } from './Finish';
import { SoundLayer } from './Sfx';

const fontCss = `
@font-face { font-family: "Baloo 2"; font-weight: 700; src: url(${staticFile('fonts/baloo-2-latin-700-normal.woff2')}) format("woff2"); }
@font-face { font-family: "Baloo 2"; font-weight: 800; src: url(${staticFile('fonts/baloo-2-latin-800-normal.woff2')}) format("woff2"); }
@font-face { font-family: Nunito; font-weight: 600; src: url(${staticFile('fonts/nunito-latin-600-normal.woff2')}) format("woff2"); }
@font-face { font-family: Nunito; font-weight: 700; src: url(${staticFile('fonts/nunito-latin-700-normal.woff2')}) format("woff2"); }
@font-face { font-family: Nunito; font-weight: 800; src: url(${staticFile('fonts/nunito-latin-800-normal.woff2')}) format("woff2"); }`;

export const Trailer: React.FC<{ bgm: boolean }> = ({ bgm }) => (
  <AbsoluteFill style={{ background: C.skyD }}>
    <style>{fontCss}</style>
    {/* layer 1-2: footage */}
    {Object.values(SHOTS).filter((s) => s.clip).map((s) => (
      <Sequence key={s.id} from={s.from} durationInFrames={s.dur}><Footage shot={s} punch={s.id === 'showcase' ? 0 : 0.018} /></Sequence>
    ))}
    <Sequence from={SHOTS.endcard.from} durationInFrames={SHOTS.endcard.dur}><EndCard /></Sequence>
    {/* layer 3: trailer captions in the game's clay-press style (right side, clear of the game's own HUD on the left) */}
    {CAPTIONS.map((c, i) => (
      <AbsoluteFill key={i}>
        <div style={c.pos.center ? { position: 'absolute', left: 0, right: 0, bottom: c.pos.bottom, display: 'flex', justifyContent: 'center' } : { position: 'absolute', left: c.pos.left, right: c.pos.right, top: c.pos.top, bottom: c.pos.bottom }}>
          <ClayType id={'cap' + i} text={c.text} sub={c.sub} at={c.at} out={c.out} size={c.size ?? 84} slab={{ color: c.color, shade: c.shade }} stagger={0.7} inDur={14} />
        </div>
      </AbsoluteFill>
    ))}
    {/* transition with depth into Battle Royale */}
    <SlabWipe at={SHOTS.brdrop.from} />
    {/* layer 4-5: grade, vignette, grain */}
    <Finish />
    <SoundLayer bgm={bgm} />
  </AbsoluteFill>
);
