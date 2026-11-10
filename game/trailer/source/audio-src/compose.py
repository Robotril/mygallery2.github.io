"""Original music + SFX for the CLAYFRONT trailer, synthesized (deterministic, seeded). 120 BPM: 1 beat = 15 frames @30fps."""
import numpy as np, wave, os
from scipy.signal import butter, sosfilt
SR = 44100; BPM = 120; BEAT = 60 / BPM; BAR = 4 * BEAT
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio')
rng = np.random.default_rng(18594)

def t_(d): return np.arange(int(d * SR)) / SR
def env(d, a=0.005, dec=0.3):
    t = t_(d); e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / dec); return e
def filt(x, kind, f, order=2):
    w = [v / (SR / 2) for v in f] if isinstance(f, (list, tuple)) else f / (SR / 2); sos = butter(order, w, btype=kind, output='sos'); return sosfilt(sos, x)
def sweep(f0, f1, d, shape='sine'):
    t = t_(d); f = f0 * (f1 / f0) ** (t / d); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) if shape == 'sine' else (2 / np.pi) * np.arcsin(np.sin(ph))
def noise(d): return rng.uniform(-1, 1, int(d * SR))
def place(buf, x, at, gain=1.0, pan=0.0):
    i = int(round(at * SR)); j = min(len(buf), i + len(x)); 
    if i >= len(buf) or j <= i: return
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i:j, 0] += x[:j - i] * gain * l * 1.414; buf[i:j, 1] += x[:j - i] * gain * r * 1.414

# ---------- instruments ----------
def kick(): d = 0.4; return sweep(160, 44, d) * env(d, 0.002, 0.13) + filt(noise(d), 'lowpass', 2000) * env(d, 0.001, 0.008) * 0.3
def clap():
    d = 0.25; n = filt(noise(d), 'bandpass', [900, 2600]); e = np.zeros(len(n)); t = t_(d)
    for k in (0, 0.011, 0.022): e += (t >= k) * np.exp(-np.maximum(0, t - k) / 0.05)
    return n * e * 0.45 + np.sin(2 * np.pi * 190 * t) * env(d, 0.001, 0.04) * 0.25
def hat(open_=False): d = 0.25 if open_ else 0.06; return filt(noise(d), 'highpass', 7000) * env(d, 0.001, 0.08 if open_ else 0.018) * 0.35
def marimba(f, d=0.45):
    t = t_(d); return (np.sin(2 * np.pi * f * t) * env(d, 0.002, 0.28) + 0.35 * np.sin(2 * np.pi * f * 4 * t) * env(d, 0.001, 0.05) + 0.15 * np.sin(2 * np.pi * f * 2.01 * t) * env(d, 0.002, 0.12))
def bass(f, d=0.24):
    t = t_(d); x = (2 / np.pi) * np.arcsin(np.sin(2 * np.pi * f * t)) + 0.4 * np.sign(np.sin(2 * np.pi * f * t)) * 0.5
    return filt(x, 'lowpass', 900) * env(d, 0.004, 0.16)
def pad(freqs, d):
    t = t_(d); x = np.zeros(len(t))
    for f in freqs:
        for det in (-0.12, 0.12): x += 2 * ((f * (1 + det / 100) * t) % 1) - 1
    x = filt(x / len(freqs), 'lowpass', 1800); a = min(0.6, d / 3); e = np.minimum(1, t / a) * np.minimum(1, (d - t) / 0.4).clip(0, 1); return x * e * 0.22
def bell(f, d=0.9): t = t_(d); return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t)) * env(d, 0.002, 0.35)
def riser(d):
    t = t_(d); n = noise(d); out = np.zeros(len(t)); seg = 2048
    for s in range(0, len(t), seg):
        k = s / len(t); f = 300 * (5200 / 300) ** k; sl = slice(s, s + seg); out[sl] = filt(n[sl], 'bandpass', [f * 0.7, min(f * 1.4, 20000)])
    return (out * (t / d) ** 2 * 0.6 + sweep(180, 720, d, 'tri') * (t / d) ** 2 * 0.15)
def impact(big=True):
    d = 1.4 if big else 0.6; return sweep(150 if big else 190, 46, d) * env(d, 0.003, 0.35 if big else 0.18) * 0.9 + filt(noise(d), 'lowpass', 600) * env(d, 0.002, 0.12) * 0.6
def sparkle(n=5):
    x = np.zeros(int(1.2 * SR))
    for i, f in enumerate([1568, 2093, 2637, 3136, 3951][:n]):
        b = bell(f, 0.7) * (0.5 - i * 0.06); s = int(i * 0.055 * SR); x[s:s + len(b)] += b[:len(x) - s]
    return x * 0.5
def whoosh(d=0.5):
    t = t_(d); n = noise(d); out = np.zeros(len(t)); seg = 1024
    for s in range(0, len(t), seg):
        k = s / len(t); f = 500 + 2200 * np.sin(np.pi * k); out[s:s + seg] = filt(n[s:s + seg], 'bandpass', [f * 0.6, f * 1.5])
    return out * np.sin(np.pi * t / d) ** 2 * 0.7
def pop(seed):
    r = np.random.default_rng(seed); d = 0.16; t = t_(d); f = 850 + r.uniform(-120, 120)
    return filt(r.uniform(-1, 1, len(t)), 'bandpass', [f * 0.6, f * 1.8]) * env(d, 0.001, 0.03) * 0.7 + sweep(140, 55, d) * env(d, 0.002, 0.05) * 0.8
def tick(head=False): d = 0.08; t = t_(d); return np.sin(2 * np.pi * (2600 if head else 1900) * t) * env(d, 0.001, 0.02) * 0.5
def ko(): d = 0.35; t = t_(d); return sweep(320, 170, d) * env(d, 0.003, 0.09) * 0.8 + np.sin(2 * np.pi * 880 * t) * env(d, 0.002, 0.12) * 0.3
def press(hi=False): d = 0.22; return sweep(520 if hi else 340, 300 if hi else 190, d) * env(d, 0.003, 0.07) * 0.8 + filt(noise(d), 'lowpass', 900) * env(d, 0.001, 0.03) * 0.4
def squish(): d = 0.28; t = t_(d); return sweep(240, 105, d) * (1 + 0.3 * np.sin(2 * np.pi * 28 * t)) * env(d, 0.004, 0.08) * 0.7 + filt(noise(d), 'lowpass', 500) * env(d, 0.002, 0.05) * 0.4

def write(name, x, stereo=True):
    x = np.asarray(x); 
    if x.ndim == 1: x = np.stack([x, x], 1)
    pk = np.max(np.abs(x)) or 1; x = x / pk * 0.89
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype('<i2').tobytes())

# ---------- the track (timed to the edit: bar k starts at 2k s = frame 60k) ----------
DUR = 34.5; mix = np.zeros((int(DUR * SR), 2))
N = {'C': 261.63, 'D': 293.66, 'E': 329.63, 'F': 349.23, 'G': 392.0, 'A': 440.0, 'B': 493.88}
CH = [('C', [261.63, 329.63, 392.0], 130.81), ('A', [220.0, 261.63, 329.63], 110.0), ('F', [174.61, 220.0, 261.63], 87.31), ('G', [196.0, 246.94, 293.66], 98.0)]
HOOK = ['E', 'G', 'A', 'G', 'E', 'D', 'C', 'D', 'E', 'G', 'C5', 'A', 'G', 'E', 'D', None]  # 2-bar motif in 8ths
def note(n): return 523.25 if n == 'C5' else N[n]
def bar_chord(b): return CH[b % 4]

# intro: bars 0-2 (0-6 s) pad + marimba arpeggio; riser over bar 2 into the drop at 6.0 s ("Go")
for b in range(0, 3):
    nm, tri, root = bar_chord(b); place(mix, pad(tri, BAR + 0.3), b * BAR, 0.9)
    for k in range(8): place(mix, marimba(tri[k % 3] * (2 if k >= 4 else 1)), b * BAR + k * BEAT / 2, 0.22, pan=-0.3 + 0.2 * (k % 3))
place(mix, riser(2.0), 4.0, 0.5)
for k in range(8): place(mix, clap(), 5.0 + k * BEAT / 4, 0.12 + 0.05 * k)

def groove(b0, b1, lift=False, stop=None):
    def place(buf, x, at, gain=1.0, pan=0.0):  # skip anything at or after `stop` (for the break)
        if stop is None or at < stop - 1e-6: globals()['place'](buf, x, at, gain, pan)
    for b in range(b0, b1):
        nm, tri, root = bar_chord(b); t0 = b * BAR
        for k in range(4): place(mix, kick(), t0 + k * BEAT, 0.95)
        for k in (1, 3): place(mix, clap(), t0 + k * BEAT, 0.55, 0.1)
        for k in range(8): place(mix, hat(k % 2 == 1 and k == 7), t0 + k * BEAT / 2 + (0.012 if k % 2 else 0), 0.5, 0.35)
        pat = [1, 1, 2, 1, 1, 2, 1, 1.5]
        for k in range(8): place(mix, bass(root * pat[k]), t0 + k * BEAT / 2, 0.55)
        for k in range(8):
            n = HOOK[(b % 2) * 8 + k]
            if n: place(mix, marimba(note(n) * (2 if lift else 1)), t0 + k * BEAT / 2, 0.3, pan=0.25)
        place(mix, pad(tri, BAR), t0, 0.35)
groove(3, 6)                       # 6-12 s: Go, Gun Game fight
groove(6, 10, lift=True)           # 12-20 s: Battle Royale, characters
groove(10, 11, stop=21.0)          # 20-21 s, then the break
# break 21.0-22.0 s (frames 630-660): drums out, short riser, hit on 22.0 = Victory
place(mix, riser(1.0), 21.0, 0.45)
place(mix, impact(False), 22.0, 0.6)
# victory: bars 11-12 (22-26 s) groove + fanfare bells
groove(11, 13, lift=True)
for i, f in enumerate([523.25, 659.25, 783.99, 1046.5]): place(mix, bell(f, 1.2), 22.0 + i * BEAT / 2, 0.22, pan=0.2)
# riser into the logo at 26.0 s (frame 780), then the final hit and a ringing C chord
place(mix, riser(1.0), 25.0, 0.4)
place(mix, impact(True), 26.0, 0.75)
place(mix, pad([261.63, 329.63, 392.0, 523.25], 7.5), 26.0, 1.3)
for k in range(6): place(mix, marimba([523.25, 659.25, 783.99][k % 3]), 26.0 + k * BEAT, 0.18 * (1 - k / 7))
place(mix, kick(), 26.0, 1.0); place(mix, clap(), 26.0, 0.5)
# master: gentle glue + soft clip + fade out
mix = np.tanh(mix * 0.9) / np.tanh(0.9)
fade = np.ones(len(mix)); f0 = int(31.5 * SR); fade[f0:] = np.linspace(1, 0, len(mix) - f0) ** 1.5; mix *= fade[:, None]
write('bgm.wav', mix)

# ---------- SFX kit ----------
S = os.path.join('sfx')
for i in range(4): write(f'sfx/pop{i}.wav', pop(100 + i))
write('sfx/tick.wav', tick()); write('sfx/tick-head.wav', tick(True)); write('sfx/ko.wav', ko())
write('sfx/press.wav', press()); write('sfx/press-hi.wav', press(True)); write('sfx/riser1.wav', riser(0.95))
write('sfx/impact.wav', impact(True)); write('sfx/impact-small.wav', impact(False)); write('sfx/sparkle.wav', sparkle())
write('sfx/whoosh.wav', whoosh()); write('sfx/squish.wav', squish())
print('ok', len(mix) / SR, 's')
