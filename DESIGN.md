---
name: CLAYFRONT
description: A bright modeling-clay shooter for kids and teens; every interface surface is a hand-pressed slab of clay.
colors:
  ink: "#1d2242"
  ink-2: "#474e78"
  clay-white: "#f4f7fc"
  clay-white-shade: "#d9e1ef"
  clay-white-2: "#e8eef8"
  tangerine: "#ff8a3d"
  tangerine-shade: "#e0661b"
  teal: "#33c7b8"
  teal-shade: "#1d9d90"
  sky: "#5aaeff"
  sky-shade: "#3487de"
  sun: "#ffd23f"
  sun-shade: "#e9b400"
  berry: "#ff6f9e"
  grass: "#5ccb6b"
  tomato: "#ff5a4e"
typography:
  display:
    fontFamily: "Baloo 2, Nunito, system-ui, sans-serif"
    fontSize: "62px"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Baloo 2, Nunito, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 0.95
  body:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "Nunito, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 800
rounded:
  field: "16px"
  card: "22px"
  slab: "28px 34px 30px 26px / 30px 26px 32px 28px"
  chip: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "18px"
  lg: "26px"
components:
  button:
    backgroundColor: "{colors.clay-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "12px 22px"
  button-primary:
    backgroundColor: "{colors.tangerine}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "12px 22px"
  button-on:
    backgroundColor: "{colors.sun}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
  mode-slab-br:
    backgroundColor: "{colors.tangerine}"
    textColor: "{colors.ink}"
    rounded: "{rounded.slab}"
    padding: "22px 26px 24px"
  mode-slab-gungame:
    backgroundColor: "{colors.teal}"
    textColor: "{colors.ink}"
    rounded: "{rounded.slab}"
  mode-slab-custom:
    backgroundColor: "{colors.sky}"
    textColor: "{colors.ink}"
    rounded: "{rounded.slab}"
  round-button:
    backgroundColor: "{colors.clay-white}"
    textColor: "{colors.ink}"
    size: "64px"
  input:
    backgroundColor: "{colors.clay-white-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "11px 14px"
---

# Design System: CLAYFRONT

Scope: the game under `game/`. The gallery site at the repository root is a separate design and is not covered here.

## Overview

**Creative North Star: "Plasticine Tray"**

The interface is made of the same stuff as the world. Every panel, button, card and HUD box is a thick, rounded slab of bright modeling clay with a fine thumbprint grain, a light top edge and a darker pressed underside. The slabs sit on top of the live 3D beach or city scene, so the menu always feels like you are already on the island.

The audience is kids and teens on laptops, big monitors and phones. The three things the user asked to avoid set the tone: never cluttered, never generic military, never dark or hard to read. So the palette is sunny, the ink is a deep navy instead of black, and text is large. Each game mode owns one clay color, so a player can find a mode by color before reading.

**Key Characteristics:**
- Bright clay slabs with grain over a live, light 3D scene
- Navy ink on every color, never white text on light clay
- One color per mode: Battle Royale tangerine, Gun Game teal, Custom sky, How to play sun
- Rounded display face (Baloo 2) with a friendly body face (Nunito), both self-hosted
- One drawn SVG icon set with a 2.4 stroke; no emoji or symbol characters
- Motion is squash and stretch: slabs drop in and settle, buttons squash when pressed

## Colors

Bright clay colors for surfaces, navy for all text. Each color has a darker "shade" partner used only for the pressed underside of its own slab.

### Primary
- **Tangerine** (tangerine): Battle Royale, primary buttons, slider thumbs, the win banner. The main "go" color.

### Secondary
- **Teal** (teal): Gun Game slab, scrollbars.
- **Sky** (sky): Custom Match slab, page background behind the canvas. Its shade (sky-shade) carries the logo slab and boot screen, where white lettering needs the extra contrast.

### Tertiary
- **Sun** (sun): selected and "on" states, How to play, the tutorial panel, text selection.
- **Berry, Grass, Tomato**: rare accents. Grass is health and success, Tomato is damage, danger and the headshot mark.

### Neutral
- **Ink** (ink): all text and icons, the Play button fill on colored slabs.
- **Ink 2** (ink-2): secondary text, captions.
- **Clay white** (clay-white) and its shade: the default slab for panels, cards, HUD boxes and round buttons.
- **Clay white 2** (clay-white-2): sunken fields such as text inputs.

### Named Rules
**The Navy Ink Rule.** Text on clay is always ink or ink 2. White text appears only on the deep sky shade (logo, boot screen) where it measures above 4.5:1.

**The Shade Partner Rule.** A slab's underside uses its own color's shade, never a gray. Set both `--c` and `--c-d` together.

## Typography

**Display Font:** Baloo 2 (800, 700), rounded and chunky like rolled clay.
**Body Font:** Nunito (600, 700, 800).

### Hierarchy
- **Display** (800, 62px, 0.95): the Battle Royale slab title and result banners (banners scale with the viewport up to 120px).
- **Title** (800, 34–44px, 0.95): other mode slabs, screen headings.
- **Body** (600, 17px, 1.4): descriptions, settings, guide text.
- **Label** (800, 15px): round button captions, stat labels, chips.

All menu and HUD type is multiplied by the interface zoom (`--uiz`), which grows with the screen up to 3.2x on large monitors and stays between 1x and 1.5x on touch screens. Players can pick Smaller, Bigger, Much bigger or Huge on top of that.

### Named Rules
**The Big Screen Rule.** Size type for a kid across the room from a big monitor. When in doubt, go bigger and let the zoom do the scaling; never set fixed tiny pixel sizes in the HUD.

**The No Eyebrow Rule.** Headings stand alone. Counts like "3 of 14" sit inline after the title in a lighter weight.

## Layout

Home is a left column of mode slabs (Battle Royale large on top, Gun Game and Custom side by side, then a row of round buttons) with the 3D character on its pedestal filling the right. Sub-screens use a pale clay veil over the scene with a heading, a short line of plain copy, then content. On short phone screens (under 540px tall) the Battle Royale slab turns into a single row with its Play button and descriptions hide, so the whole home fits without scrolling. Content panels scroll vertically with touch panning allowed; the 3D canvas, HUD and touch controls block page gestures.

## Elevation & Depth

Depth comes from the clay itself, not from layered cards. Every slab carries three shadows: a light inset along the top edge, its color's shade as an inset along the bottom, and a soft drop shadow under it.

### Shadow Vocabulary
- **Slab** (`inset 0 3px 0 rgba(255,255,255,.55), inset 0 -5px 0 <shade>, 0 10px 18px -8px rgba(29,34,66,.38)`): every clay surface.
- **Sunken** (`inset 0 3px 5px rgba(29,34,66,.14)`): inputs and slider tracks, pressed into the clay.

### Named Rules
**The One Layer Rule.** A slab never sits inside another slab. Stats inside a panel are flat text with a rule line under them.

## Shapes

Everything is soft. Buttons and chips are full pills. Mode slabs use a slightly uneven radius (`28px 34px 30px 26px / 30px 26px 32px 28px`) so they look hand-pressed rather than machine-cut. Cards use 22px corners, fields 16px. Round buttons and the minimap are true circles.

## Components

### Buttons
Pill slabs, 800 weight, 17px. White by default, tangerine for the main action, sun when selected, tomato for danger. Hover lifts 3px; press plays a quick squash (wider and shorter, then springs back).

### Chips
The daily challenge chip and room code chips are white pill slabs with an icon and short text.

### Cards / Containers
Panels and character or map cards are white slabs. A selected card turns sun. Locked character cards use a solid desaturated fill, never transparency. Map cards show a small drawn flat scene of the map.

### Inputs / Fields
Sunken clay-white-2 fields with 16px corners. Sliders have a sunken pale track and a tangerine clay thumb that squashes when grabbed.

### Navigation
Home uses the mode slabs and the round button row. Sub-screens have a Back pill top right next to the player chip (level coin, name, XP bar).

### Mode Slab
The signature component. A large clay slab in the mode's color with a display title, one plain sentence, and for Battle Royale a navy Play pill. Slabs drop in one after another (70ms apart) and settle with a squash.

### Kinetic Moments
Big moments (countdown, Go, knockouts, streaks, Final two, Knife round, Victory, title cards) use one signature move, the **clay press**: letters drop in stretched tall with a vertical motion blur, land with a squash and settle; they exit faster than they enter, flying up. A moment has at most two text levels (a line and one small sub-line). Words standing on the 3D scene are light clay with a navy pressed edge; words on a slab are navy. Slabs take the moment's color: Go grass, streaks teal, Final two tangerine, Knife round tomato, Victory sun, title cards the mode color. Every moment lands with a sound (riser into impact, sparkle after). Reduced motion: fade only.

## Do's and Don'ts

### Do:
- **Do** give every new surface the slab material and set its color and shade together.
- **Do** write copy in short plain sentences a 10-year-old can read.
- **Do** use the SVG `icon()` set for every icon.
- **Do** keep each mode on its own color everywhere it appears.
- **Do** respect reduced motion: slabs appear in place with no drop or squash.

### Don't:
- **Don't** make it dark, cluttered or military: no camo, no stencil type, no neon on black.
- **Don't** use emoji or Unicode symbols as icons.
- **Don't** put white text on light clay.
- **Don't** nest slabs inside slabs.
- **Don't** add eyebrows or labels above headings.
- **Don't** use gradients as decoration; draw the thing instead.
- **Don't** borrow catchphrases, names or art from other games.
