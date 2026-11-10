# CLAYFRONT trailer source

How the trailer in `game/trailer/` was made, so it can be rebuilt or edited.

1. **Capture real gameplay.** Serve the repository root (for example `python3 -m http.server 8765`), then run `node capture/run.js <clip>` for each clip in `capture/clips.js` (needs Playwright). The game runs on a virtual clock, so every frame is exactly 1/30 s, and every game sound is logged with its frame. Frames land in `frames/<clip>/`.
2. **Make the music and sound effects.** `python3 audio-src/compose.py` (needs numpy and scipy) writes `public/audio/bgm.wav` and `public/audio/sfx/*.wav`. Everything is synthesized and original.
3. **Set up the video project.** Copy the game's fonts into `public/fonts/`, link `public/frames` to `../frames`, run `npm install` and `node scripts-gen-sfx.mjs`.
4. **Render.** Run `npx remotion render src/index.ts Trailer out/trailer.mp4`, plus `--props=props-nobgm.json` for the version without music. Then limit peaks with `ffmpeg -i in.mp4 -c:v copy -af "alimiter=limit=0.84:level=false" -c:a aac -b:a 192k out.mp4`.

The edit lives in `src/timeline.ts`: shots, captions and sound timings. `DESIGN-SPEC.md` has the plan and storyboard. Built with Remotion; check Remotion's own license if the trailer is ever used by a company.
