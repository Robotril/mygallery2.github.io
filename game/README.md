# CLAYFRONT

An original first-person shooter with stylized clay characters, playable in any modern browser on PC and mobile. No install and no build step: the game is static files served by GitHub Pages.

**Play:** open `/game/` on this site (for example `https://<user>.github.io/<repo>/game/`).

## What's in the game

| Area | Status |
|---|---|
| **Agent 18594** + 14 more playable clay characters | Character select, outfit / secondary / vest / accent colors, 12 helmets, 9 masks, 7 hair styles, 8 accessories. Unlocks by account level. |
| **Weapons** | 20 weapons: 3 pistols, 3 SMGs, 3 assault rifles, 2 shotguns, 2 marksman rifles, 2 snipers, 2 LMGs, 2 launchers and a knife. Each has its own procedural model, sound profile, damage falloff, fire mode (auto / semi / burst / pump / bolt), recoil, spread and magazine. |
| **Attachments & loadouts** | Optics (red dot, holo, 3x, 8x with scope overlay), barrels (suppressor, long, compensator, choke), grips, magazines, 9 weapon skins (unlocked by weapon level), lethals, tacticals, 7 perks, 3 field-gear items, 5 saved loadout slots. |
| **Maps** | **Coral Cove** (beach): resort hotel with pools, boardwalk shops, tiki bar, lifeguard towers, pier and boats, beach houses, military outpost, lighthouse hills with a hidden rock path, jungle ruins. **Neon Harbor** (downtown): skyscrapers, enterable offices and apartments with rooftop access, shops and cafes with breakable glass, a 3-level parking garage, a construction site, parks, a central plaza, an underground passage, parked cars, buses and taxis, working traffic lights, and ambient traffic and pedestrians outside the combat boundary. |
| **Battle Royale** | 50 combatants (1 player + 49 AI when solo). Plane drop with parachute, scattered randomized loot, supply crates, airdrops, armor, heals, 6-phase shrinking storm, death boxes, spectating, placement, results and XP. |
| **Gun Game** | 20-weapon ladder (pistols → knife), melee demotes the victim, progress bar, kill feed, countdown, time limit, scoreboard, victory camera. |
| **Custom Match** | Free-for-All, Team Deathmatch, Gun Game or Battle Royale. Choose map, number of AI, difficulty, duration, score limit, max players, allowed weapon classes and arena size. Play solo, or create a private room with a 6-character join code and a shareable invite link. |
| **AI** | Easy / Normal / Hard / Expert (the difficulty also sets your aim help: Easy almost locks on, Expert has none), plus 5 personalities (rusher, tactician, sniper, looter, camper). Bots navigate with A*, loot, open crates, react to gunfire, take cover, heal, reload, strafe, aim down sights, throw grenades, follow the storm, and recover when stuck. |
| **Progression** | Account XP and levels, weapon XP and levels, character and skin unlocks, 3 daily challenges, 8 achievements, lifetime and per-mode stats, match history. Saved in `localStorage`. |
| **Interface size** | Settings → Graphics → *Text & interface size*. Auto enlarges menus and HUD on computer screens (up to 140%); you can also pick 100–160% manually. |
| **Graphics** | Low / Medium / High / Ultra plus **Auto**. Auto detects the device (GPU string, cores, memory, mobile), then lowers render resolution and finally the preset if the frame rate drops. Ultra adds 4K shadows, bloom and ground-truth ambient occlusion. Auto never picks Ultra, and integrated GPUs get at most Medium. Each preset caps the total rendered pixels, so 4K and high-DPI screens don't render millions of extra pixels, and if the frame rate drops the game scales resolution down within seconds, then steps down a preset (turning shadows off live). For performance, each clay character is merged into about 12 vertex-colored meshes instead of about 55, guns and loot collapse to 1–4 meshes, all neon signs share one atlas mesh, glass panes are a single instanced mesh, static geometry is batched into 120 m chunks, only characters within 32 m cast shadows, and characters switch to a low-detail model beyond 45 m. |
| **Audio** | Fully synthesized with WebAudio: per-weapon gunshots, reloads, footsteps by surface, impacts, explosions, glass, car alarms, ocean, gulls, wind, city traffic, horns, sirens, distant chatter, menu music, victory and defeat stingers. Sounds are positional (HRTF) with distance filtering. |

## New players

On first launch a welcome popup offers the **2-minute interactive training**, which you can also start any time from **How to Play** in the main menu. It walks through 14 steps on the beach: look, move, sprint, jump, crouch, slide, shoot, aim, reload, switch weapons, loot, grenade and melee, then eliminating 3 target dummies that don't shoot back. Each step shows the exact key or button, and Enter (or the Skip button on touch) skips a step. The How to Play screen also covers controls for computer and mobile, the game modes, and tips.

## Controls

**PC:** **Arrow keys move** (W A S D works too) · touchpad or mouse looks around · **left or right click shoots** (F too) · Z zoom · Space jump · Shift run · C or Ctrl crouch (slide while running) · R reload · Q or wheel switch weapon · E open crates and swap guns · **1 grenade · 2 smoke or stun · 3 heal · 4 melee · 5 gear** · Tab scoreboard · M map · Esc pause. The first click also captures the pointer; if the browser refuses, the game falls back to free look.

Running is automatic once you've held Up for a moment, gentle aim assist helps on PC, and you pick up guns, ammo, heals and armor by walking over them. A one-line key reminder shows for the first 45 seconds of a match, and every hit pops a damage number over the player you hit (yellow for headshots, red for knockouts). These can be switched off in **Settings → Controls**, which also has toggle-to-zoom. Text size is under **Settings → Graphics**.

**Phone (sideways or upright):** floating left stick (push fully forward to sprint), drag the right side to look, drag on the fire button to aim while shooting, plus buttons for aim, jump, crouch/slide, reload, swap, grenade, tactical, interact, heal, gear, melee, scoreboard, pause and map. The buttons have a separate layout for each way you hold the phone, and switch over when you turn it. Button positions (saved per orientation), size and sensitivity are adjustable under **Settings → Touch**, and aim assist is optional.

## World, characters and effects

- **Living maps** (`js/world/nature.js`): wind-blown grass that parts around players, flowers, bushes, pebbles and boulders on Coral Cove, planters along Neon Harbor's sidewalks, palms and trees that sway in gusts, drifting pollen and dust. Grass is chunked and fades with distance; how much grows depends on the graphics preset (about 14k tufts on Low, 45k on High, 65k on Ultra). None of it has collision, so gameplay and bots are unchanged.
- **Weather**: most matches are dry, some get passing showers that roll in during the match with rain, mist, dimmer light and a rain sound layer. The pattern comes from the map seed, so everyone in a room sees the same sky.
- **Characters**: bigger cartoon heads, glossy eyes that blink (and squeeze shut when hit), eyebrows and mouths with personality, rosy cheeks and freckles on some, six new hairstyles (bob, afro, space buns, quiff, long, braids), chunkier hands and boots, collars and cuffs, and a body shape per character. Poses now blend smoothly between running, aiming and reloading, and idle characters breathe and glance around.
- **Clay surfaces** (`js/engine/clayLook.js`): every lit surface gets soft lumps, thumb dents, hand-mixed color and a gentle edge glow, measured in real-world size so the pattern stays the same scale on every object. High and Ultra add fingerprint ridges up close. Low skips the effect, and an automatic drop to Low turns it off.
- **Weapons and effects**: rounded gun bodies with ejection ports, trigger guards, vents, flash hiders and an orange CLAYFRONT stripe; guns swing up when you switch; shots add a little roll; real brass casings tumble and bounce; impacts spark; explosions throw clay debris, leave a scorch mark and keep burning with a smoke column.

## Big moments

Matches open with a camera shot that swings around your character and flies into first person on "Go", with a title card in the mode's color. Countdown numbers, "Go", knockouts, streaks, "Knife round" (Gun Game), "Final two" (Battle Royale) and "Victory" use one kinetic text style, the clay press (`js/ui/kinetic.js`): letters drop in stretched with a vertical motion blur, squash and settle, then fly out faster than they came. Each moment is paired with synthesized sound (rising whoosh, clay thump, sparkle) from `js/engine/audio.js`. Reduced-motion settings turn the camera shot off and make the text fade instead.

## Pause and results

- **Pause** shows the mode, map, your knockouts, deaths, damage and clock, four clear buttons (Resume, Settings, Controls, Leave match) and your character idling beside the menu. Esc resumes.
- **Results** are staged by how you did: first place, top 3, mid-table and last each get their own title, medal and character pose (your character celebrates when you place top 3; otherwise the winner takes the pedestal). Stats, an animated XP bar, rewards and a ranked leaderboard follow.
- **Leaving a match** now shows "You left the match" with no winner, no XP and no change to your stats. It used to be recorded as a loss.
- **Placements** are correct: Battle Royale ranks players by the place they finished, not by kills, and nobody is shown as #1 unless they won.

## Phones and the Home Screen

The game plays sideways or upright. Upright, the camera widens so you can still see to the sides, the gun moves in to stay on screen, and the menus stack into one column. Inside a phone browser the address and tab bars take a lot of room, and iPhone Safari doesn't allow web pages to go fullscreen, so on iPhone and iPad the home screen shows a tip: tap Share, then **Add to Home Screen**. Opened from the Home Screen icon, the game runs fullscreen with no browser bars (`manifest.webmanifest`, icons in `icons/`). Layouts also keep clear of the iPhone notch and home bar.

## Look and feel

The menus and HUD use a "Plasticine Tray" style: every panel, button and HUD box is a bright slab of modeling clay with a fine grain, sitting over the live 3D scene. Each mode has its own color (Battle Royale tangerine, Gun Game teal, Custom sky, How to play sun), text is navy on light clay, fonts are Baloo 2 and Nunito (self-hosted in `fonts/`, OFL), and all icons are one hand-drawn SVG set in `js/ui/icons.js`. Slabs drop in and settle, buttons squash when pressed, and both are switched off when the system asks for reduced motion. The design rules are written up in `DESIGN.md` at the repository root.

## Multiplayer

- **Online (peer-to-peer):** the host creates a room and shares the code or invite link. Players on other devices join over WebRTC data channels. A public PeerJS signaling broker introduces the peers, and game traffic then goes directly between browsers. Add `?peer=host:port` to the URL to use your own PeerJS server instead.
- **Same device:** rooms over `BroadcastChannel`, for several tabs or windows of one browser. Needs no network.
- **Authority model:** the host's game is the authoritative simulation. It runs bots, damage, deaths, loot, the storm and mode rules, and does lag-compensated hit detection: it rewinds targets to the snapshot time the shooter was viewing. Clients send movement and fire intents at 20 Hz and render 15 Hz snapshots with interpolation. AI bots fill empty slots and are always labeled **BOT**.
- **Future dedicated servers:** `js/net/transport.js` defines one transport interface. A WebSocket `ServerTransport` stub marks where an authoritative server plugs in. Because `Match` takes a `role` (`solo` / `host` / `client`) and the simulation code has no DOM dependency, the host logic can move server-side without rebuilding the game.

## Project layout

```
game/
  index.html, css/game.css
  vendor/                three.js r170 (+ postprocessing, Sky), PeerJS 1.5.4
  js/main.js             app state machine + main loop
  js/core/               util (seeded RNG, noise), save (profile, XP, challenges, achievements)
  js/data/               weapons, attachments, skins, perks, gear; characters + cosmetics
  js/engine/             graphics presets/detection, input (mouse/keys/touch), audio, procedural textures
  js/world/              collision (AABB grid, raycasts, heightmap), builder (batched geometry, buildings),
                         props, beach + city maps, water shader, A* nav grid, ambient life
  js/entities/           clay figure rig + animation, gun models, combatant, player controller, bot AI, weapon logic
  js/game/               match (combat, damage, explosives, items), modes (BR / Gun Game / DM / TDM), loot, effects
  js/net/                transports, room/lobby, in-match sync
  js/ui/                 menu screens, HUD, 3D menu showcase
```

Adding content is data-driven. A new weapon is one entry in `data/weapons.js` (stats + model spec). A new character is one entry in `data/characters.js`. A new mode is a class in `game/modes.js` registered in `MODE_CLASSES`. A new map is a builder function that returns the same info shape as `buildBeach` / `buildCity`.

## Known limitations

- All art (characters, weapons, buildings, textures) is generated procedurally from primitives in code. It's original and consistent, but it isn't hand-sculpted production art.
- Bots navigate at ground level. They don't climb stairs to upper floors or rooftops, but they do shoot at players they can see there.
- Online play needs the public PeerJS broker (a free third-party service) unless you self-host one. Some strict networks block WebRTC without a TURN server, which isn't configured.
- Movement and ammo are client-reported (fine for friends; a dedicated server should validate them). There are no accounts, friends lists, matchmaking or leaderboards yet.
- "Local multiplayer" is networked play on one device or nearby devices, not split-screen.
