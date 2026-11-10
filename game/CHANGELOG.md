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

## 11. Big moments, directed like a film

You gave creative direction through a set of motion and video skills. Three of them shaped this update: bang-motion (moves like video, not slides; one signature move; text that leaves faster than it arrives), remotion-motion-graphics (no constant-speed motion, staggered letters, synthesized sound) and video-shotcraft (sound that goes riser, impact, sparkle on the beat). I used them to direct the game's big moments the way a film director would.

- **Opening shot:** during the 3-2-1 countdown the camera swings around your own clay character, from the front to behind, then flies into its eyes and hands over to first person on "Go" with a quick wide-angle whoosh. Your character stays on the right of the screen so the numbers and the title never cover its face. It's skipped if your device asks for reduced motion.
- **Clay-press text:** big words now drop in letter by letter, stretched tall with a motion blur, then land with a squash and settle. They leave faster than they arrive, flying upward. This one move is used for every big moment.
- **Title cards:** each match opens with its mode on its own clay color (Battle Royale tangerine, Gun Game teal, Custom sky) and the map name underneath.
- **Countdown:** each number presses in with a soft clay squelch, the last second builds with a rising whoosh, and "Go" lands on a green clay slab with a thump and a sparkle.
- **Knockouts:** "Knocked out [name]" slides in with your XP. Streaks get their own teal slab with a sparkle, and the camera gives a small punch-in. The old "ELIMINATED" card is gone.
- **New moments:** "Knife round" when you reach the last weapon in Gun Game, "Final two" in Battle Royale when only you and one other player are left, and a big "Victory" slab while the camera circles you after a win. If someone else wins, their name appears instead.
- **Sound:** a new set of synthesized sounds (a rising whoosh, a clay thump, sparkles and a clay press) is timed to land with the text.

## 12. Easier modes, aim help by difficulty, and less lag

- **Aim help follows the difficulty:** on Easy your aim snaps onto enemies almost perfectly while you shoot or zoom, and your shots are tighter. Normal gives some help, Hard a little, and Expert none. The difficulty picker now says what each level means. Turning aim assist off in **Settings → Controls** still switches it off completely.
- **Every mode is a bit easier:** at every difficulty, bots react more slowly, miss more and do less damage. Each level up is still clearly harder than the one below.
- **Less lag and no more freezes:** the game used to pause for a moment whenever it met something new during a match (the first explosion, a new gun in someone's hands, a part of the map you hadn't looked at yet) because it was building graphics code on the spot. All of that is now done on the loading screen ("Warming up the clay…"), so matches don't hitch. Explosions also no longer force the whole world's graphics to rebuild when they light up.
