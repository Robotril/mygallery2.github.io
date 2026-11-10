# CLAYFRONT trailer: design spec (video-shotcraft, autonomous free creation)

## Product brief
- **Product:** CLAYFRONT, a free browser first-person shooter where everything (characters, guns, maps) is made of clay. Plays on PC and phone, no install. Live at https://robotril.github.io/mygallery2.github.io/game/
- **Audience:** kids and teens; parents may watch too. Friendly, playful, not military, not dark (from the game's PRODUCT.md / DESIGN.md).
- **Purpose:** a short promo the owner can share. 16:9, 1920×1080, 30 fps, about 33 s, English, music + sound effects, no voiceover.
- **Core selling points (must show):** the clay look; the cinematic match opening; Gun Game (every knockout gives a new gun); Battle Royale (plane drop, 49 bots); 15 characters; playing with friends via a room code; winning; free in the browser on PC and phone.
- **Data:** no personal or customer data. All footage is the real game with bots. The room clip's invite link is shown as it appears on the real public site (the capture ran on localhost, so the hostname was swapped to the public one; the room code itself is real).

## Requirement → execution decisions
| Requirement | Decision |
|---|---|
| Real product, not a mock | All gameplay and menu footage is captured from the actual game, frame by frame, with a virtual clock (`capture/`). No hand-built UI except trailer captions and the end card. |
| Show it plays well | Footage captured at 1920×1080 on the Medium preset (clay shader on), 30 fps exact, no dropped frames. |
| Fun, kid-friendly energy | Motion preset "playful/bold" (fast-in, soft landing, visible squash), 120 BPM upbeat original track. |
| Cuts on the beat | Track composed for the edit: 120 BPM, beat = 15 frames; every cut sits on a beat; drum drop = "Go" (frame 180); break → "Victory" hit (frame 660); final hit = logo (frame 780). |
| No Freesound access (blocked from this machine) | All SFX synthesized (`audio-src/compose.py`), deterministic, seeded. |
| No bundled BGM in this copy of the skill | Original music synthesized in the same script. |

## Visual direction and tokens (from the game itself, DESIGN.md "Plasticine Tray")
- Fonts: Baloo 2 800 (display), Nunito 800 (sub lines); self-hosted copies of the game's fonts.
- Colors: ink #1d2242; clay slabs per meaning: sun #ffd23f (clay), teal #33c7b8 (Gun Game), tangerine #ff8a3d (Battle Royale), berry #ff6f9e (characters), sky #5aaeff (friends), logo slab #1f5fa6 with white CLAY + sun FRONT (the game's logo).
- Slabs: uneven hand-pressed radius `28px 34px 30px 26px / 30px 26px 32px 28px`, light top inset, darker same-hue underside, soft drop shadow (game's Shade Partner Rule). Navy text on clay, never white on light clay.
- Signature move: the game's own "clay press" (letters drop in stretched tall with a one-axis vertical motion blur, squash wide, settle; exit faster than entry, flying up).
- Motion tokens: entrance ~18 f with settle bezier(0.2,0.9,0.25,1) and overshoot (y +8 %, squash 1.16 × 0.8); exits ~9 f bezier(0.55,0,1,0.45); cut punch-in 3.5 % over 12 f.
- Finish stack: footage → captions → slight grade (saturate 1.08, contrast 1.04) → vignette + living grain (7 %).
- Styleframe: skipped as a separate HTML page because the game already has a strict design system (DESIGN.md); the end card and caption stills were verified as styleframes (`out/qa/`).

## Shot cards
No Gallery shot cards are used. The cards are built around 2.5D page-capture cameras (PageCam) for web/SaaS products; this trailer is real 3D gameplay footage, where the "camera work" is done inside the game during capture (the opening orbit, the plane dive, the victory orbit). Custom pieces (clay-press captions, slab wipe, end card) follow the skill's aesthetic rules and the game's own motion language.

## Storyboard (frames @30 fps)
| # | Frames | Shot | Key motion | Caption | Sound |
|---|---|---|---|---|---|
| 1 | 0–96 | Menu showcase: Agent 18594 on the beach turntable, slow push-in | camera push | "Everything is made of clay" (sun slab, upper left) | marimba intro |
| 2 | 96–195 | Real match opening: camera orbits the character, countdown 3-2-1, flies into first person, "Go" | in-game cinematic camera, clay-press numbers | game's own "Gun Game / Coral Cove" card | game press sounds, riser, impact on "Go" = drum drop (180) |
| 3 | 195–360 | Gun Game fight in Neon Harbor: firing, damage numbers, knockout, new gun | gameplay | "Every knockout, a new gun" (teal) | pops, hit ticks, knockout |
| 4 | 360–480 | Battle Royale plane over Coral Cove, jump, dive to the beach | tangerine clay slab wipe in; dive | "Drop in with 49 bots" (tangerine, upper right) | whoosh |
| 5 | 480–570 | Characters screen flipping through characters | cut on downbeat | "15 clay heroes" (berry, bottom) | whoosh |
| 6 | 570–654 | Room created with a 6-letter code, slow push to the code | push-in | "Play with friends / Share a 6-letter code" (sky, bottom) | music break starts 630 |
| 7 | 654–780 | Victory: camera circles the winner, "Victory" clay slab | in-game | none (game's own "Victory") | impact on 660 |
| 8 | 780–990 | End card: logo slab presses in on the final hit, tagline + link, clay blobs drift | push-out, clay press | "Free to play in your browser · PC and phone · link" | big hit, sparkle, ringing chord |
