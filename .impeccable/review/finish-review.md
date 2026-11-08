# Finish review: game/index.html (Plasticine Tray)

Run inline (this harness was not asked to spawn agents), from the degraded finish-reviewer role. No approved comp: code-led build. Critique reference: none (the concept roll ran degraded with no challengers; direction chosen by the user in an interview).

## Round 1

disposition: fix

### persistence
pass. PRODUCT.md exists. Surface brief `.impeccable/surfaces/game-index-html.md` carries the direction contract with `seed:0c0f71e53f3e667b`. Code-led build, so no state.json or comp approval is owed. DESIGN.md is new and is written after this review.

### fidelity
No comp. TYPE: Baloo 2 800 display, Nunito body, self-hosted. Matches OWN-WORLD. MATERIAL: grain canvas plus inset highlight and shade on every surface. This is the world's own material (painted clay), applied consistently, not an imitation of a material the page never renders. Match. GROUND: OWN-WORLD names a light scene. The live 3D beach shows through, and menu sub-screens sit on a pale clay veil. Match.
- Wordmark slab: match
- Battle Royale slab with Play: match
- Gun Game and Custom side by side: match
- Round button row: match
- Challenge chip: match
- Hero on the right: match (live 3D character on a pedestal)
- Phone compact layout: acceptable adaptation (BR subtitle hidden below 540px tall; cited: user said phone home was hard to scroll)

### ceiling
Not reached on secondary screens: map previews were gradient swatches, sliders kept the browser's dark track.

### material_fixes
1. Map picker previews are decorative gradients (one hot pink "neon"), outside the world. Draw both maps as flat clay scenes.
2. Range sliders show the browser's dark grey track. Give them a clay track and thumb.
3. Touch tutorial panel overlaps the right-hand button column on 844x390. Narrow it.
4. Unicode glyphs used as icons: equipped check, active loadout star, level-up arrow, big-map legend shapes, headshot emoji in the kill feed. Replace with the SVG set or drawn CSS marks.
5. Results banner used another game's catchphrase ("Victory Royale"). Product truth requires original content. Rewrite.
6. Results screen nests stat cards inside a panel and repeats "Training complete" with a meaningless winner line. Flatten and fix copy.
7. Gun Game setup copy used different words from home ("elimination", "demote"). Match the home wording.

### keep
The tray of bright slabs over the live 3D scene, the squash-on-press motion, and the big readable type on large monitors.

## Verdict pass (after fixes, recaptured over the same files)

### verdict
1. resolved: `desktop-gungame-setup.png` shows a palm-and-sea scene and a skyline scene.
2. resolved: same capture shows pale clay tracks with tangerine thumbs.
3. resolved: `mobile-match.png` tutorial ends left of the button column.
4. resolved: source scan finds no glyph icons in UI code (one arrow remains inside an in-world 3D street sign texture, which is scenery).
5. resolved: banner reads "Last one standing!" / "You win!" / "You placed #N" / "Good try!".
6. resolved: results capture shows flat stats with rule lines and "You are ready to play."
7. resolved.

### remaining
Detector warnings kept on purpose: spring overshoot easing (the world's squash signature), inset bottom shading (slab thickness), damage vignette glow (functional feedback). Touch scrolling could not be machine-verified in headless Chromium; the CSS path is in place.

disposition: ship (covers the scored fixes above)
