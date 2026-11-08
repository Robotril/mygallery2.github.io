// Unified input: keyboard/mouse (pointer lock) + touchscreen controls with editable layout.
import { getProfile, saveProfile } from '../core/save.js';
import { icon } from '../ui/icons.js';

const KEYMAP = {
  // move: arrow keys or WASD
  ArrowUp: 'fwd', ArrowDown: 'back', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'fwd', KeyS: 'back', KeyA: 'left', KeyD: 'right',
  Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint', ControlLeft: 'crouch', ControlRight: 'crouch', KeyC: 'crouch',
  KeyF: 'fire', KeyZ: 'aim', KeyR: 'reload', KeyE: 'interact', KeyQ: 'slot',
  // items on the number keys
  Digit1: 'grenade', Digit2: 'tactical', Digit3: 'heal', Digit4: 'melee', Digit5: 'gear',
  Numpad1: 'grenade', Numpad2: 'tactical', Numpad3: 'heal', Numpad4: 'melee', Numpad5: 'gear',
  KeyG: 'grenade', KeyT: 'tactical', KeyH: 'heal', KeyV: 'melee', KeyX: 'gear',
  Tab: 'scores', Escape: 'pause', KeyP: 'pause', Enter: 'skip', NumpadEnter: 'skip', KeyI: 'inspect', KeyM: 'map',
};

export const TOUCH_BUTTONS = [
  { id: 'fire', label: 'fire', x: 0.86, y: 0.58, size: 92, hold: true, drag: true },
  { id: 'fire2', label: 'fire', x: 0.07, y: 0.52, size: 60, hold: true, map: 'fire' },
  { id: 'aim', label: 'aim', x: 0.94, y: 0.38, size: 64, hold: true, toggle: true },
  { id: 'jump', label: 'jump', x: 0.93, y: 0.82, size: 68 },
  { id: 'crouch', label: 'crouch', x: 0.81, y: 0.86, size: 62 },
  { id: 'reload', label: 'reload', x: 0.75, y: 0.66, size: 56 },
  { id: 'slot', label: 'swap', x: 0.64, y: 0.88, size: 56 },
  { id: 'grenade', label: 'grenade', x: 0.76, y: 0.43, size: 52 },
  { id: 'tactical', label: 'smoke', x: 0.70, y: 0.30, size: 48 },
  { id: 'interact', label: 'hand', x: 0.6, y: 0.62, size: 58 },
  { id: 'heal', label: 'heal', x: 0.53, y: 0.88, size: 50 },
  { id: 'gear', label: 'radar', x: 0.83, y: 0.22, size: 46 },
  { id: 'melee', label: 'knife', x: 0.64, y: 0.45, size: 46 },
  { id: 'scores', label: 'list', x: 0.45, y: 0.07, size: 40 },
  { id: 'pause', label: 'pause', x: 0.52, y: 0.07, size: 40 },
  { id: 'map', label: 'map', x: 0.59, y: 0.07, size: 40 },
];

// Portrait (phone held upright): buttons gather in the lower right, stick on the lower left, top row stays clear for the HUD.
export const TOUCH_PORTRAIT = {
  fire: { x: 0.77, y: 0.77, size: 84 }, fire2: { x: 0.12, y: 0.56, size: 54 }, aim: { x: 0.91, y: 0.62, size: 56 },
  jump: { x: 0.89, y: 0.91, size: 60 }, crouch: { x: 0.69, y: 0.93, size: 52 }, reload: { x: 0.57, y: 0.82, size: 50 },
  slot: { x: 0.47, y: 0.93, size: 48 }, grenade: { x: 0.62, y: 0.67, size: 46 }, tactical: { x: 0.91, y: 0.48, size: 42 },
  interact: { x: 0.47, y: 0.71, size: 50 }, heal: { x: 0.30, y: 0.94, size: 44 }, gear: { x: 0.76, y: 0.55, size: 40 },
  melee: { x: 0.52, y: 0.59, size: 42 }, scores: { x: 0.64, y: 0.035, size: 36 }, pause: { x: 0.76, y: 0.035, size: 36 }, map: { x: 0.88, y: 0.035, size: 36 },
};
export const isPortrait = () => window.innerHeight > window.innerWidth;
// Default spot for a button in the current orientation, with the player's saved layout for that orientation on top.
function touchSpot(b, s) {
  const port = isPortrait(); const saved = (port ? s.touchLayoutP : s.touchLayout) || {};
  const def = port ? { ...b, ...TOUCH_PORTRAIT[b.id] } : b;
  return { x: (saved[b.id] || def).x, y: (saved[b.id] || def).y, size: def.size };
}

export class Input {
  constructor(canvas) {
    this.canvas = canvas; this.held = new Set(); this.pressed = new Set(); this.look = { x: 0, y: 0 }; this.move = { x: 0, y: 0 };
    this.mouseFire = false; this.mouseAim = false; this.wheel = 0; this.locked = false; this.enabled = false; this.touchMode = false;
    this.touchAimToggle = false; this.onPointerLockLost = null; this.crouchToggle = false;
    window.addEventListener('keydown', (e) => this.key(e, true)); window.addEventListener('keyup', (e) => this.key(e, false));
    canvas.addEventListener('mousedown', (e) => this.mouse(e, true)); window.addEventListener('mouseup', (e) => this.mouse(e, false));
    window.addEventListener('mousemove', (e) => { if (this.enabled && !this.touchMode && (this.locked || this.lockFailed)) { this.look.x += e.movementX; this.look.y += e.movementY; } });
    window.addEventListener('wheel', (e) => { if (this.enabled) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked; this.locked = document.pointerLockElement === canvas; if (this.locked) this.lockFailed = false;
      if (was && !this.locked && this.enabled && !this.touchMode && this.onPointerLockLost) this.onPointerLockLost();
      if (!this.locked) { this.mouseFire = false; this.mouseAim = false; }
    });
    window.addEventListener('blur', () => { this.held.clear(); this.mouseFire = false; this.mouseAim = false; });
  }

  key(e, down) {
    const a = KEYMAP[e.code]; if (!a) return;
    if (this.enabled && (a === 'scores' || a === 'jump' || e.ctrlKey && ['fwd', 'back', 'left', 'right'].includes(a))) e.preventDefault();
    if (a === 'pause' && down && !this.enabled) return;
    if (down) { if (!this.held.has(a)) this.pressed.add(a); this.held.add(a); } else this.held.delete(a);
  }
  mouse(e, down) {
    if (!this.enabled || this.touchMode) return;
    if (down && !this.locked) this.requestLock(); // capture the mouse, but never swallow the shot
    if (e.button === 0) this.mouseL = down; if (e.button === 2) this.mouseR = down; this.mouseFire = !!(this.mouseL || this.mouseR); // left or right click shoots (easy on a touchpad)
    if (e.button === 1 && down) this.pressed.add('melee');
  }
  requestLock() { if (this.touchMode) return; if (!this.canvas.requestPointerLock) { this.lockFailed = true; return; } const quiet = (p) => { if (p && p.catch) p.catch(() => { this.lockFailed = true; }); return p; }; try { const p = this.canvas.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(() => quiet(this.canvas.requestPointerLock())); } catch (e) { try { quiet(this.canvas.requestPointerLock()); } catch (e2) { /* unsupported */ } } }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  // Read & clear per-frame input. Returns a snapshot used by the player controller.
  poll() {
    const h = this.held, P = this.pressed;
    let mx = 0, my = 0;
    if (this.touchMode) { mx = this.move.x; my = this.move.y; }
    else { mx = (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0); my = (h.has('fwd') ? 1 : 0) - (h.has('back') ? 1 : 0); }
    const s = getProfile().settings;
    const snap = {
      mx, my, lookX: this.look.x, lookY: this.look.y,
      fire: this.mouseFire || h.has('fire'), aim: this.aimState(s, this.mouseAim || h.has('aim')) || (this.touchMode && this.touchAimToggle),
      keyYaw: (h.has('lookRight') ? 1 : 0) - (h.has('lookLeft') ? 1 : 0), keyPitch: (h.has('lookUp') ? 1 : 0) - (h.has('lookDown') ? 1 : 0),
      sprint: h.has('sprint') || (this.touchMode && my > 0.92 && Math.abs(mx) < 0.4),
      crouchHeld: h.has('crouch'), crouchPressed: P.has('crouch'), jump: P.has('jump'), jumpHeld: h.has('jump'),
      reload: P.has('reload'), interact: P.has('interact'), interactHeld: h.has('interact'), scores: h.has('scores'), pause: P.has('pause'),
      slot1: P.has('slot1'), slot2: P.has('slot2'), slot3: P.has('slot3'), nextSlot: P.has('slot') || this.wheel !== 0, grenade: P.has('grenade'), tactical: P.has('tactical'),
      melee: P.has('melee'), heal: P.has('heal'), gear: P.has('gear'), inspect: P.has('inspect'), map: P.has('map'), mapHeld: h.has('map'), skip: P.has('skip'),
      touch: this.touchMode, sens: this.touchMode ? s.touchSensitivity : s.sensitivity,
    };
    this.look.x = 0; this.look.y = 0; this.wheel = 0; P.clear();
    return snap;
  }

  // Hold-to-aim by default; Settings can switch it to press-once-to-toggle.
  aimState(s, held) {
    if (s.holdToAim !== false) return held;
    if (held && !this._aimPrev) this.aimToggled = !this.aimToggled; this._aimPrev = held; return !!this.aimToggled;
  }
  // ---------- Touch controls ----------
  setupTouch(root) {
    this.touchMode = true; this.touchRoot = root; root.innerHTML = '';
    const s = getProfile().settings; const scale = s.buttonScale || 1;
    const zoneL = el('div', 'tz-left'), zoneR = el('div', 'tz-right'); root.append(zoneL, zoneR);
    const stickBase = el('div', 'stick-base'), stickKnob = el('div', 'stick-knob'); stickBase.append(stickKnob); root.append(stickBase); stickBase.style.display = 'none';
    this.buttons = {};
    for (const b of TOUCH_BUTTONS) {
      const d = el('div', 'tbtn tb-' + b.id); d.innerHTML = icon(b.label); d.setAttribute('aria-label', b.id);
      root.append(d); this.buttons[b.id] = d; d.dataset.id = b.id;
    }
    this.layoutTouch(); if (!this._touchResize) { this._touchResize = () => this.layoutTouch(); addEventListener('resize', this._touchResize); }
    let stickId = null, sx = 0, sy = 0, lookId = null, lx = 0, ly = 0; const R = 60 * scale;
    const btnTouches = new Map();
    zoneL.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) if (stickId === null) { stickId = t.identifier; sx = t.clientX; sy = t.clientY; stickBase.style.display = 'block'; stickBase.style.left = sx - R + 'px'; stickBase.style.top = sy - R + 'px'; stickBase.style.width = stickBase.style.height = R * 2 + 'px'; stickKnob.style.transform = 'translate(-50%,-50%)'; } e.preventDefault(); }, { passive: false });
    zoneR.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; } e.preventDefault(); }, { passive: false });
    const move = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) {
          let dx = t.clientX - sx, dy = t.clientY - sy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
          this.move.x = dx / R; this.move.y = -dy / R; stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        } else if (t.identifier === lookId) { this.look.x += (t.clientX - lx) * 2.2; this.look.y += (t.clientY - ly) * 2.2; lx = t.clientX; ly = t.clientY; }
        else if (btnTouches.has(t.identifier)) { const bt = btnTouches.get(t.identifier); if (bt.drag) { this.look.x += (t.clientX - bt.x) * 2.2; this.look.y += (t.clientY - bt.y) * 2.2; bt.x = t.clientX; bt.y = t.clientY; } }
      }
      e.preventDefault();
    };
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === stickId) { stickId = null; this.move.x = this.move.y = 0; stickBase.style.display = 'none'; }
        if (t.identifier === lookId) lookId = null;
        if (btnTouches.has(t.identifier)) { const bt = btnTouches.get(t.identifier); btnTouches.delete(t.identifier); if (bt.hold) this.held.delete(bt.action); bt.el.classList.remove('down'); }
      }
    };
    root.addEventListener('touchmove', move, { passive: false }); root.addEventListener('touchend', end); root.addEventListener('touchcancel', end);
    for (const b of TOUCH_BUTTONS) {
      const d = this.buttons[b.id]; const action = b.map || b.id;
      d.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        for (const t of e.changedTouches) {
          btnTouches.set(t.identifier, { el: d, action, hold: b.hold && !b.toggle, drag: b.drag, x: t.clientX, y: t.clientY }); d.classList.add('down');
          if (b.toggle) { this.touchAimToggle = !this.touchAimToggle; d.classList.toggle('on', this.touchAimToggle); }
          else if (b.hold) this.held.add(action);
          else if (action === 'scores') { this.held.has('scores') ? this.held.delete('scores') : this.held.add('scores'); }
          else this.pressed.add(action);
        }
      }, { passive: false });
    }
  }
  // Place every button for the current orientation. Runs again whenever the phone is turned.
  layoutTouch() {
    if (!this.buttons) return; const s = getProfile().settings; const short = Math.min(innerWidth, innerHeight);
    const scale = (s.buttonScale || 1) * (short < 380 ? Math.max(0.7, short / 380) : 1); // small screens get smaller buttons
    for (const b of TOUCH_BUTTONS) {
      const d = this.buttons[b.id]; const pos = touchSpot(b, s); const sz = pos.size * scale;
      Object.assign(d.style, { left: `calc(${(pos.x * 100).toFixed(2)}% - ${sz / 2}px)`, top: `calc(${(pos.y * 100).toFixed(2)}% - ${sz / 2}px)`, width: sz + 'px', height: sz + 'px', fontSize: sz * 0.42 + 'px' });
    }
  }
  setButtonVisible(id, v) { if (this.buttons && this.buttons[id]) this.buttons[id].style.display = v ? '' : 'none'; }
  teardownTouch() { if (this.touchRoot) this.touchRoot.innerHTML = ''; this.buttons = null; }
}

function el(tag, cls) { const d = document.createElement(tag); d.className = cls; return d; }

// Drag-to-rearrange layout editor for touch buttons.
export function openLayoutEditor(container, onDone) {
  const s = getProfile().settings; const key = isPortrait() ? 'touchLayoutP' : 'touchLayout'; const layout = { ...(s[key] || {}) }; const scale = s.buttonScale || 1;
  const wrap = el('div', 'layout-editor');
  wrap.innerHTML = '<div class="le-bar"><span>Drag buttons to rearrange (' + (isPortrait() ? 'upright' : 'sideways') + ' layout)</span><button class="btn small" data-a="reset">Reset</button><button class="btn small primary" data-a="save">Save</button></div>';
  for (const b of TOUCH_BUTTONS) {
    const d = el('div', 'tbtn'); d.innerHTML = icon(b.label); const spot = touchSpot(b, s); const p = layout[b.id] || spot; const sz = spot.size * scale;
    Object.assign(d.style, { left: `calc(${p.x * 100}% - ${sz / 2}px)`, top: `calc(${p.y * 100}% - ${sz / 2}px)`, width: sz + 'px', height: sz + 'px', fontSize: sz * 0.42 + 'px' });
    const drag = (cx, cy) => { const x = Math.min(0.98, Math.max(0.02, cx / window.innerWidth)), y = Math.min(0.98, Math.max(0.04, cy / window.innerHeight)); layout[b.id] = { x, y }; d.style.left = `calc(${x * 100}% - ${sz / 2}px)`; d.style.top = `calc(${y * 100}% - ${sz / 2}px)`; };
    d.addEventListener('touchmove', (e) => { e.preventDefault(); drag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
    d.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') return; const mv = (ev) => drag(ev.clientX, ev.clientY); const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); });
    wrap.append(d);
  }
  wrap.querySelector('[data-a=reset]').onclick = () => { s[key] = {}; saveProfile(); wrap.remove(); openLayoutEditor(container, onDone); };
  wrap.querySelector('[data-a=save]').onclick = () => { s[key] = layout; saveProfile(); wrap.remove(); onDone && onDone(); };
  container.append(wrap);
}
