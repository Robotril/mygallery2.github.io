// Kinetic type for the game's big moments, in the "clay press" style:
// letters drop in stretched tall with a vertical motion blur, land, squash wide and settle;
// they leave faster than they came (fly up, blur, fade). One signature move used everywhere.
// Uses the Web Animations API (transform + opacity only, so it stays on the compositor) and a
// short-lived SVG blur that is only attached while letters are moving.

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE_IN = 'cubic-bezier(.55,0,1,.45)';   // exits: accelerate away
const SETTLE = 'cubic-bezier(.2,.9,.25,1)';     // entrances: fast in, soft landing
let defs = null, fid = 0;

function blurDefs() {
  if (defs) return defs;
  defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  defs.setAttribute('width', '0'); defs.setAttribute('height', '0'); defs.setAttribute('aria-hidden', 'true');
  defs.style.position = 'absolute';
  document.body.appendChild(defs); return defs;
}

// Directional (one-axis) motion blur on `el`: from `a` to `b` px over `ms`, then the filter is removed.
function streak(el, axis, a, b, ms) {
  if (REDUCED) return;
  const id = 'ktb' + (++fid); const svg = blurDefs();
  const f = document.createElementNS(svg.namespaceURI, 'filter');
  f.setAttribute('id', id); f.setAttribute('x', '-60%'); f.setAttribute('y', '-90%'); f.setAttribute('width', '220%'); f.setAttribute('height', '280%');
  const g = document.createElementNS(svg.namespaceURI, 'feGaussianBlur'); f.appendChild(g); svg.appendChild(f);
  const set = (v) => g.setAttribute('stdDeviation', axis === 'y' ? `${(v * 0.06).toFixed(2)} ${v.toFixed(2)}` : `${v.toFixed(2)} ${(v * 0.06).toFixed(2)}`);
  set(a); el.style.filter = `url(#${id})`;
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms); const e = a > b ? 1 - (1 - k) ** 3 : k * k; set(a + (b - a) * e);
    if (k < 1 && el.isConnected) requestAnimationFrame(step); else { el.style.filter = ''; f.remove(); }
  };
  requestAnimationFrame(step);
}

function letters(text) {
  const frag = document.createDocumentFragment(); const list = [];
  for (const word of String(text).split(' ')) {
    const w = document.createElement('span'); w.className = 'kt-w';
    for (const ch of word) { const s = document.createElement('span'); s.className = 'kt-ch'; s.textContent = ch; w.appendChild(s); list.push(s); }
    frag.appendChild(w); frag.appendChild(document.createTextNode(' '));
  }
  return { frag, list };
}

const PRESS_IN = [
  { opacity: 0, transform: 'translateY(-75%) scale(.86, 1.5)' },
  { opacity: 1, transform: 'translateY(8%) scale(1.16, .8)', offset: 0.52 },
  { transform: 'translateY(-3%) scale(.95, 1.06)', offset: 0.78 },
  { opacity: 1, transform: 'none' },
];
const SLIDE_IN = [
  { opacity: 0, transform: 'translateX(-60%) scale(1.25, .9)' },
  { opacity: 1, transform: 'translateX(5%) scale(.94, 1.06)', offset: 0.6 },
  { opacity: 1, transform: 'none' },
];
const FLY_OUT = [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-90%) scale(.9, 1.4)' }];

/**
 * Show a line of kinetic text inside `parent`.
 * opts: cls (extra class), from ('top' press | 'left' slide), stagger (s), delay (s), hold (s, then exits; 0 = stay),
 *       slab (true = a clay slab squashes in behind the text first), sub (small second line, max one).
 * Returns { el, exit() }.
 */
export function kinetic(parent, text, opts = {}) {
  const { cls = '', from = 'top', stagger = 0.03, delay = 0, hold = 1.6, slab = false, sub = '' } = opts;
  const el = document.createElement('div'); el.className = 'kt ' + cls + (slab ? ' kt-slab' : '');
  const line = document.createElement('div'); line.className = 'kt-line';
  const { frag, list } = letters(text); line.appendChild(frag); el.appendChild(line);
  let subEl = null; if (sub) { subEl = document.createElement('div'); subEl.className = 'kt-sub'; subEl.textContent = sub; el.appendChild(subEl); }
  parent.appendChild(el);
  const d0 = delay * 1000; let done = false;

  if (REDUCED) {
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: d0, fill: 'both' });
  } else {
    if (slab) el.animate([{ transform: 'scale(0, .6)', opacity: 0 }, { transform: 'scale(1.08, .9)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 380, delay: d0, easing: SETTLE, fill: 'both' });
    const lag = d0 + (slab ? 120 : 0); const kf = from === 'left' ? SLIDE_IN : PRESS_IN; const dur = from === 'left' ? 520 : 600;
    list.forEach((s, i) => s.animate(kf, { duration: dur, delay: lag + i * stagger * 1000, easing: SETTLE, fill: 'both' }));
    setTimeout(() => streak(line, from === 'left' ? 'x' : 'y', 18, 0, 320 + list.length * stagger * 1000), lag);
    if (subEl) subEl.animate([{ opacity: 0, transform: 'translateY(60%)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: lag + 260 + list.length * stagger * 600, easing: SETTLE, fill: 'both' });
  }

  const exit = () => {
    if (done) return; done = true;
    if (REDUCED || !el.isConnected) { el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'both' }).onfinish = () => el.remove(); return; }
    const n = list.length; let last = null;
    list.forEach((s, i) => { last = s.animate(FLY_OUT, { duration: 260, delay: (n - 1 - i) * 12, easing: EASE_IN, fill: 'both' }); });
    streak(line, 'y', 0, 16, 280 + n * 12);
    if (subEl) subEl.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-40%)' }], { duration: 200, easing: EASE_IN, fill: 'both' });
    if (slab) el.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(1.06, .2)', opacity: 0 }], { duration: 300, delay: 120, easing: EASE_IN, fill: 'both' });
    const end = () => el.remove(); if (last) last.onfinish = end; else end();
  };
  if (hold > 0) setTimeout(exit, d0 + hold * 1000 + list.length * stagger * 1000);
  return { el, exit };
}
