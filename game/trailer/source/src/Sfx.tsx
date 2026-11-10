import React from 'react';
import { Audio, Sequence, staticFile } from 'remotion';
import { SHOTS, TRAILER_SFX } from './timeline';
import { GAME_SFX } from './gameSfx';

type Pin = { from: number; src: string; volume: number };
// Game sounds logged during capture are re-voiced with the trailer's kit on the exact frame they happened.
function gamePins(): Pin[] {
  const pins: Pin[] = []; let pop = 0;
  for (const shot of Object.values(SHOTS)) {
    if (!shot.clip) continue; const evs = GAME_SFX[shot.clip] || []; const c0 = shot.clipFrom ?? 0;
    let lastRemote = -99;
    for (const e of evs) {
      if (e.f < c0 || e.f >= c0 + shot.dur) continue; const from = shot.from + (e.f - c0);
      if (e.n === 'gunshot') {
        if (e.a === 'local') pins.push({ from, src: `pop${pop++ % 4}`, volume: 0.3 - (pop % 2) * 0.05 });
        else if (from - lastRemote > 5) { pins.push({ from, src: `pop${(pop + 2) % 4}`, volume: 0.1 }); lastRemote = from; }
      } else if (e.n === 'hitmarker') pins.push({ from, src: e.a === true ? 'tick-head' : 'tick', volume: 0.32 });
      else if (e.n === 'killConfirm') pins.push({ from, src: 'ko', volume: 0.55 });
      else if (e.n === 'press') pins.push({ from, src: e.a === true ? 'press-hi' : 'press', volume: 0.55 });
      else if (e.n === 'riser') pins.push({ from, src: 'riser1', volume: 0.45 });
      else if (e.n === 'impactHit') pins.push({ from, src: e.a === true ? 'impact' : 'impact-small', volume: 0.55 });
      else if (e.n === 'sparkle') pins.push({ from, src: 'sparkle', volume: 0.45 });
    }
  }
  return pins;
}
export const SFX_PINS: Pin[] = [...TRAILER_SFX, ...gamePins()].sort((a, b) => a.from - b.from);

export const SoundLayer: React.FC<{ bgm: boolean }> = ({ bgm }) => (
  <>
    {bgm ? <Audio src={staticFile('audio/bgm.wav')} volume={0.55} /> : null}
    {SFX_PINS.map((p, i) => (
      <Sequence key={i} from={Math.max(0, p.from)} durationInFrames={60} layout="none">
        <Audio src={staticFile(`audio/sfx/${p.src}.wav`)} volume={p.volume} />
      </Sequence>
    ))}
  </>
);
