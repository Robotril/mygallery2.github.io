# CLAYFRONT changelog

What was asked for and what was done, in order. Play it at https://robotril.github.io/mygallery2.github.io/game/

## 1. The game

A clay-style first-person shooter starring Agent 18594, with 12 or more characters.

- **Battle Royale:** you against 49 bots.
- **Gun Game:** work through 20 guns and win with the knife.
- **Custom matches:** rooms, join codes, invite links and real multiplayer between devices.
- **Maps:** Coral Cove (beach) and Neon Harbor (city).
- **Weapons:** attachments and loadouts.
- **Controls:** PC and phone.
- **Graphics:** automatic Low, Medium, High or Ultra quality.
- **Progress:** XP, levels, challenges and achievements, saved in the browser.

## 2. Hosting

The game lives in this repository under `game/` and is served by GitHub Pages. The gallery site is unchanged.

## 3. Bigger text, a tutorial and left click to shoot

- Text is bigger on computers.
- A 14-step training mode and a How to play guide teach every control.
- Left click shoots.

## 4. Speed

The game was slow and laggy, so I made it draw less and added automatic quality drops when the frame rate falls.

## 5. Easier controls and readable text

- Walk over guns, ammo, heals and armor to pick them up.
- Text grows to match large monitors.
- The home screen scrolls on phones.
- Running, aim assist and keyboard play are easier.

## 6. New look: Plasticine Tray

Every panel, button and HUD box is now a bright slab of modeling clay over the live 3D scene. Each mode has its own color, fonts are rounded and friendly, and all icons are drawn. The style was chosen for kids and teens: not cluttered, not military, not dark. The design rules are in `DESIGN.md`.

## 7. Phones

- The game plays upright or sideways, with a separate touch layout for each.
- The menu fits inside Safari's address and tab bars.
- An Add to Home Screen tip lets iPhone players run the game fullscreen.

## 8. Computer controls and a respawn fix

| Key | Action |
|---|---|
| Arrow keys (or W A S D) | Move. Hold Up to start running |
| Touchpad or mouse | Look around |
| Left or right click (or F) | Shoot |
| Space | Jump |
| 1 | Grenade |
| 2 | Smoke or stun |
| 3 | Heal |
| 4 | Melee |
| 5 | Gear |
| Q or scroll wheel | Switch weapon |
| Z | Zoom |
| R | Reload |
| E | Open crates |

The "Knocked out" card no longer stays on screen after you respawn in Gun Game.

## 9. Major visual and gameplay upgrade

- **World:** grass that blows in the wind and parts as players walk through it, flowers, bushes, rocks, city planters, swaying trees, drifting pollen, and rain showers in some matches.
- **Characters:** cartoon faces with eyes that blink, eyebrows and mouths with personality, new hairstyles and a body shape for each character, with smoother animation.
- **Combat:** rounded, detailed guns, a draw animation, tumbling shell casings, impact sparks, and explosions with debris, fire, scorch marks and smoke.
- **Pause menu:** match stats, Resume, Settings, Controls and Leave match, with your character beside it.
- **Results:** separate presentations for first, top 3, middle and last place, with medals, poses, stats, an XP bar and a ranked leaderboard.
- **Fixes:**
  - Leaving a match no longer counts as a loss or names a winner.
  - Battle Royale placements are correct. Players are no longer all shown as #1.

## 10. Real clay look, a brighter beach and damage numbers

- **Everything looks like clay:** characters, guns, buildings, props and the ground now have soft lumps, thumb dents and hand-mixed color, with a soft glow along their edges like real plasticine. On High and Ultra you can see little fingerprint marks up close. The effect is off on Low, and it turns itself off if the game has to drop to Low to stay smooth.
- **Matte clay, not plastic:** characters and guns are less shiny, so they look molded instead of glossy.
- **Brighter beach:** Coral Cove has a clearer blue sky and less white haze, so the island looks colorful from the plane and on the ground.
- **Damage numbers:** each hit pops a chunky clay number over the player you hit. Quick hits on the same player add up into one number, headshots are yellow and knockouts are red. Turn them off in **Settings → Controls**.
- **Fix:** the Gun Game box no longer splits "1 of 20" onto two lines when the clock shows a long time.
