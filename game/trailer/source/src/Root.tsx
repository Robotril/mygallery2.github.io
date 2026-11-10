import React from 'react';
import { Composition } from 'remotion';
import { Trailer } from './Trailer';
import { TOTAL } from './timeline';
import { FPS } from './theme';
export const Root: React.FC = () => (
  <Composition id="Trailer" component={Trailer} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} defaultProps={{ bgm: true }} />
);
