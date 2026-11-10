// Virtual clock for frame-exact capture: replaces performance.now/Date.now, rAF, timers and drives WAAPI/CSS animations.
window.__installVC = function () {
  if (window.__vc) return;
  const VC = window.__vc = { t: performance.now(), base: Date.now() - performance.now(), timers: [], raf: [], id: 1 };
  performance.now = () => VC.t; Date.now = () => Math.round(VC.base + VC.t);
  window.requestAnimationFrame = (cb) => { const id = VC.id++; VC.raf.push({ id, cb }); return id; };
  window.cancelAnimationFrame = (id) => { VC.raf = VC.raf.filter((r) => r.id !== id); };
  window.setTimeout = (cb, ms = 0, ...a) => { const id = VC.id++; VC.timers.push({ id, at: VC.t + (+ms || 0), cb: typeof cb === 'function' ? () => cb(...a) : () => {} }); return id; };
  window.clearTimeout = (id) => { VC.timers = VC.timers.filter((x) => x.id !== id); };
  window.setInterval = (cb, ms = 0, ...a) => { const id = VC.id++; const tick = () => { cb(...a); VC.timers.push({ id, at: VC.t + Math.max(1, +ms || 0), cb: tick }); }; VC.timers.push({ id, at: VC.t + Math.max(1, +ms || 0), cb: tick }); return id; };
  window.clearInterval = window.clearTimeout;
  VC.step = (ms) => {
    const end = VC.t + ms;
    for (;;) { // fire due timers in time order
      VC.timers.sort((a, b) => a.at - b.at); const n = VC.timers[0];
      if (!n || n.at > end) break; VC.timers.shift(); VC.t = Math.max(VC.t, n.at); try { n.cb(); } catch (e) { console.error(e); }
    }
    VC.t = end;
    for (const a of document.getAnimations()) { try { if (a.__vt == null) { a.__vt = a.currentTime || 0; a.pause(); } a.__vt += ms; a.currentTime = a.__vt; } catch (e) { /* ignore */ } }
    const list = VC.raf; VC.raf = []; for (const r of list) { try { r.cb(VC.t); } catch (e) { console.error(e); } }
  };
};
