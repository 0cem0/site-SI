# Musique + bruitages de la vidéo (synthèse numpy). Lit out/events.json, écrit out/audio.wav
import json, sys, math
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
DUR = 49.0
N = int((DUR + 1.5) * SR)
EV = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'out/events.json'))
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)
MUS_L = np.zeros(N); MUS_R = np.zeros(N)

def tt(d): return np.arange(int(d * SR)) / SR
def mf(m): return 440.0 * 2 ** ((m - 69) / 12)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], btype='band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, btype='low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, btype='high', fs=SR, output='sos'), x)
def put(bufL, bufR, t0, sig, g=1.0, pan=0.0):
    i = int(t0 * SR)
    if i < 0 or i >= N: return
    n = min(len(sig), N - i)
    a = math.sqrt((1 - pan) / 2) * math.sqrt(2) * .7071; b = math.sqrt((1 + pan) / 2) * math.sqrt(2) * .7071
    bufL[i:i + n] += sig[:n] * g * a * 1.0; bufR[i:i + n] += sig[:n] * g * b * 1.0

# ---------- instruments ----------
def marimba(f, d=.6):
    t = tt(d); e = np.exp(-t * 7.5) * (1 - np.exp(-t * 500))
    s = np.sin(2 * np.pi * f * t) + .30 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t * 30) + .10 * np.sin(2 * np.pi * 9.9 * f * t) * np.exp(-t * 60)
    return s * e
def bell(f, d=1.8):
    t = tt(d); s = 0
    for r, a, dc in [(1, 1, 2.6), (2.76, .32, 4.5), (5.4, .14, 8), (8.93, .06, 12)]:
        s = s + a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * dc)
    return s * (1 - np.exp(-t * 600))
def bass(f, d=.9):
    t = tt(d); e = np.exp(-t * 3.2) * (1 - np.exp(-t * 90))
    return (np.sin(2 * np.pi * f * t) + .28 * np.sin(4 * np.pi * f * t) * np.exp(-t * 6)) * e
def pad(notes, d):
    t = tt(d); s = 0
    for m in notes:
        f = mf(m)
        s = s + np.sin(2 * np.pi * f * 1.003 * t) + np.sin(2 * np.pi * f * .997 * t + 1.1) + .3 * np.sin(2 * np.pi * 2 * f * t)
    a = 1.0; at = np.minimum(1, t / .9); rl = np.minimum(1, (d - t) / .9)
    return lp(s, 2200) * at * rl / len(notes) * .5
def kick(v=1.0):
    t = tt(.35); f = 48 + 90 * np.exp(-t * 30); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 11) * v
def hat(v=1.0, open_=False):
    t = tt(.25 if open_ else .07); n = hp(rng.standard_normal(len(t)), 6500)
    return n * np.exp(-t * (14 if open_ else 70)) * v
def shaker(v=1.0):
    t = tt(.09); n = bp(rng.standard_normal(len(t)), 4000, 9000)
    return n * np.exp(-t * 40) * np.minimum(1, t * 400) * v
def clap(v=1.0):
    t = tt(.2); n = bp(rng.standard_normal(len(t)), 900, 3500)
    e = np.exp(-t * 28) + .6 * np.exp(-np.maximum(0, t - .02) * 35) * (t > .02)
    return n * e * v

# ---------- musique ----------
CH = [(36, [60, 64, 67, 72], [48, 55, 60, 64]),   # C
      (43, [59, 62, 67, 71], [47, 55, 59, 62]),   # G
      (45, [57, 60, 64, 69], [45, 52, 57, 60]),   # Am
      (41, [57, 60, 65, 69], [41, 48, 57, 60])]   # F
PATT = [0, 1, 2, 3, 2, 1, 2, 3]
def lvl(t, pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return float(np.interp(t, xs, ys))
ARP = [(0, 0), (.3, .55), (3, .8), (5.4, .85), (6, 1), (22, 1.05), (42, 1.1), (49, 1.1)]
HAT = [(0, 0), (5.9, 0), (6, .5), (11.9, .5), (12, .8), (41.9, .8), (42, 1), (49, 1)]
KCK = [(0, 0), (11.9, 0), (12, .7), (21.9, .7), (22, .85), (47.9, .85), (48, 0), (49, 0)]
MEL = [(0, 0), (21.9, 0), (22, .8), (49, .8)]
PAD = [(0, .5), (6, .8), (12, 1), (49, 1)]

def music():
    nb = int(DUR / .5) + 1
    for b8 in range(int(DUR / .25)):                      # croches
        t = b8 * .25
        if t >= 48.9: break
        bar = int(t // 2) % 4; root, arp, padn = CH[bar]
        g = lvl(t, ARP)
        if g > 0:
            note = arp[PATT[b8 % 8]]
            vel = (1.0 if b8 % 2 == 0 else .72) * (1.15 if b8 % 8 == 0 else 1)
            put(MUS_L, MUS_R, t, marimba(mf(note)), .30 * g * vel, pan=-.25 + .5 * ((b8 % 8) / 7))
            if b8 % 4 == 2: put(MUS_L, MUS_R, t, marimba(mf(note + 12), .4), .10 * g * vel, pan=.35)
        # hats / shaker sur les contretemps et croches
        h = lvl(t, HAT)
        if h > 0:
            if b8 % 2 == 1: put(MUS_L, MUS_R, t, hat(1, False), .10 * h, pan=.25)
            else: put(MUS_L, MUS_R, t, shaker(1), .05 * h * (1.2 if b8 % 4 == 0 else .8), pan=-.2)
    for beat in range(int(DUR * 2)):                      # noires
        t = beat * .5
        if t >= 48.9: break
        bar = int(t // 2) % 4; root = CH[bar][0]
        k = lvl(t, KCK)
        pos = beat % 4
        if k > 0 and pos in (0, 2) : put(MUS_L, MUS_R, t, kick(1), .55 * k)
        if k > 0 and pos == 1 and beat % 8 == 5: put(MUS_L, MUS_R, t, kick(.6), .30 * k)
        if k > 0 and pos in (1, 3): put(MUS_L, MUS_R, t, clap(1), .11 * k)
        if pos in (0, 2) or (pos == 3 and lvl(t, KCK) > 0 and beat % 8 == 7):
            put(MUS_L, MUS_R, t + (0 if pos != 3 else .25), bass(mf(root if pos == 0 else root + (7 if bar != 2 else 7)), .9 if pos == 0 else .55), .52 * min(1, .4 + lvl(t, ARP) * .6))
    for bar in range(int(DUR / 2) + 1):                   # nappes
        t = bar * 2.0
        if t >= 49: break
        p = lvl(t, PAD); d = min(2.35, DUR + .6 - t)
        put(MUS_L, MUS_R, t, pad(CH[bar % 4][2], d), .34 * p)
    # mélodie (cloches) : motif de 4 mesures
    mel = [(0, 76), (1, 79), (2, 76), (3, 72), (4, 74), (5, 79), (6, 74), (7, 71), (8, 72), (9, 76), (10, 81), (11, 76), (12, 77), (13, 81), (14, 77), (15, 72)]
    for cyc in range(0, 13):
        for off, m in mel:
            t = 22.0 + cyc * 8.0 + off * .5
            if t >= 48.0 or t < 22.0: continue
            g = lvl(t, MEL)
            put(MUS_L, MUS_R, t, bell(mf(m)), .26 * g, pan=.15)
            if off % 4 == 3: put(MUS_L, MUS_R, t + .25, bell(mf(m + 4 if m % 12 != 11 else m + 3), 1.2), .10 * g, pan=-.1)
    # impacts à chaque début de scène
    for t in (6.0, 12.0, 22.0, 30.0, 42.0):
        put(MUS_L, MUS_R, t, kick(1.0), .75)
        n = hp(rng.standard_normal(int(1.1 * SR)), 5000) * np.exp(-tt(1.1) * 3.5); put(MUS_L, MUS_R, t, n, .09)
        put(MUS_L, MUS_R, t, bell(mf(84), 1.6), .12)
    # fin : accord final
    for m, pn in [(60, -.3), (64, -.1), (67, .1), (72, .3), (76, 0)]:
        put(MUS_L, MUS_R, 48.0, bell(mf(m), 2.0), .20, pan=pn)
    put(MUS_L, MUS_R, 48.0, pad([48, 55, 60, 64, 67], 1.9), .6)
    put(MUS_L, MUS_R, 48.0, bass(mf(36), 1.5), .6)
    put(MUS_L, MUS_R, 48.0, kick(1), .6)
music()

# ---------- bruitages ----------
def noise(d): return rng.standard_normal(int(d * SR))
def sweepnoise(d, f0, f1, peak=.5, q=.35):
    t = tt(d); x = noise(d); out = np.zeros(len(t)); seg = 24; idx = np.linspace(0, len(t), seg + 1).astype(int)
    for k in range(seg):
        u = (k + .5) / seg; fc = f0 * (f1 / f0) ** u
        out[idx[k]:idx[k + 1]] = bp(x, max(60, fc * (1 - q)), min(SR / 2 - 100, fc * (1 + q)), 2)[idx[k]:idx[k + 1]]
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2 if peak == .5 else np.where(t / d < peak, (t / d) / peak, ((1 - t / d) / (1 - peak))) ** 1.5
    return out * e
def tone(f0, f1, d, shape='sin'):
    t = tt(d); f = f0 * (f1 / f0) ** (t / d); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) if shape == 'sin' else np.sign(np.sin(ph)) * .6
PENT = [72, 74, 76, 79, 81, 84, 86, 88]

def sfx(e):
    ty, t, n = e['type'], e['t'], e.get('n', 0)
    if ty == 'pop':
        m = PENT[n % len(PENT)]
        bub = tone(450 + 40 * (n % 5), 900 + 60 * (n % 5), .09) * np.exp(-tt(.09) * 30)
        put(L, R, t, marimba(mf(m), .4), .30, pan=((n * 37) % 100) / 100 - .5)
        put(L, R, t, bub, .12, pan=((n * 37) % 100) / 100 - .5)
    elif ty == 'leaf':
        x = bp(noise(.12), 3000, 7000) * np.exp(-tt(.12) * 35) * np.minimum(1, tt(.12) * 300); put(L, R, t, x, .12, pan=((int(t * 100) % 7) - 3) / 6)
    elif ty == 'whoosh':
        soft = e.get('soft', 0)
        x = sweepnoise(1.3, 250, 4200); put(L, R, t - .05, x, .26 * (.55 if soft else 1), pan=0)
        put(L, R, t + .55, lp(noise(.5), 2500) * np.exp(-tt(.5) * 9), .05)
    elif ty == 'swish':
        put(L, R, t, sweepnoise(.38, 600, 3200), .16, pan=.2)
    elif ty == 'slide':
        put(L, R, t, sweepnoise(.55, 1800, 350), .11, pan=-.2)
    elif ty == 'tick':
        x = np.sin(2 * np.pi * 1800 * tt(.03)) * np.exp(-tt(.03) * 150); put(L, R, t, x, .12)
    elif ty == 'click':
        x = np.zeros(int(.04 * SR)); a = bp(noise(.02), 1500, 6000) * np.exp(-tt(.02) * 280); x[:len(a)] += a
        x += .5 * np.sin(2 * np.pi * 1100 * tt(.04)) * np.exp(-tt(.04) * 120)
        put(L, R, t, x, .3)
    elif ty == 'shutter':
        for dt, g in [(0, 1), (.045, .8)]:
            x = bp(noise(.03), 800, 5000) * np.exp(-tt(.03) * 150); put(L, R, t + dt, x, .35 * g)
        put(L, R, t, np.sin(2 * np.pi * 180 * tt(.1)) * np.exp(-tt(.1) * 35), .2)
    elif ty == 'scan':
        d = 2.3; tm = tt(d); s = tone(350, 1500, d) * (1 + .3 * np.sin(2 * np.pi * 9 * tm)) * np.sin(np.pi * np.clip(tm / d, 0, 1)) ** 1.5
        put(L, R, t, s, .075)
        for k in range(10): put(L, R, t + .2 + k * .2, bell(mf(88 + (k % 4) * 2), .5), .035, pan=-.5 + k / 9)
    elif ty == 'chip':
        for dt, m in [(0, 88), (.07, 93)]:
            put(L, R, t + dt, np.sin(2 * np.pi * mf(m) * tt(.12)) * np.exp(-tt(.12) * 22) * np.minimum(1, tt(.12) * 500), .14)
    elif ty == 'ripple':
        d = .9; tm = tt(d); s = tone(900, 300, d) * np.exp(-tm * 4) * (1 + .4 * np.sin(2 * np.pi * 14 * tm)); put(L, R, t, s, .14)
        put(L, R, t, bell(mf(79), 1.4), .1)
    elif ty == 'beep':
        f = [392, 466, 523][n % 3]
        for dt in (0, .13):
            x = lp(tone(f, f, .09, 'sq'), 1800) * np.minimum(1, np.minimum(tt(.09) * 400, (.09 - tt(.09)) * 400)); put(L, R, t + dt, x, .11, pan=(n - 1) * .3)
    elif ty == 'ding':
        g = .12 if e.get('soft') else .22
        put(L, R, t, bell(mf(88), 1.6), g); put(L, R, t + .09, bell(mf(95), 1.4), g * .7)
    elif ty == 'thud':
        v = e.get('v', 1); d = .35
        s = tone(110, 45, d) * np.exp(-tt(d) * 14); put(L, R, t, s, .6 * v)
        put(L, R, t, lp(noise(.08), 700) * np.exp(-tt(.08) * 50), .2 * v)
    elif ty == 'key':
        x = bp(noise(.012), 1800 + 500 * (n % 4), 6500) * np.exp(-tt(.012) * 350); put(L, R, t, x, .16, pan=((n * 53) % 100) / 100 * .4 - .2)
    elif ty == 'confetti':
        put(L, R, t, sweepnoise(.7, 6000, 1200, peak=.15), .20)
        put(L, R, t, clap(1), .16)
        r2 = np.random.default_rng(3)
        for k in range(22):
            put(L, R, t + .04 + r2.random() * 1.0, bell(mf(84 + int(r2.integers(0, 8)) * 2), .5), .045 * (1 - k / 30), pan=r2.random() * 1.6 - .8)
    elif ty == 'van':
        d = 1.6; tm = tt(d); f = 105 - 40 * np.clip((tm - .4) / 1.2, 0, 1); ph = 2 * np.pi * np.cumsum(f) / SR
        s = lp(((ph / (2 * np.pi)) % 1) * 2 - 1, 380, 2) + .4 * np.sin(ph)
        env = np.minimum(1, tm / .35) * np.clip((d - tm) / .5, 0, 1) * (.5 + .5 * np.clip(1.4 - tm, 0, 1))
        put(L, R, t, s * env * (1 + .15 * np.sin(2 * np.pi * 22 * tm)), .3, pan=-.4)

for e in EV: sfx(e)

# ---------- mixage ----------
def fade(x, a, b):
    t = np.arange(len(x)) / SR; g = np.ones(len(x)); g[t > b] = 0; m = (t >= a) & (t <= b); g[m] = (b - t[m]) / (b - a); return x * g
mus = 1.0
outL = MUS_L * mus + L; outR = MUS_R * mus + R
# léger sidechain : les basses se creusent un peu sur les kicks (déjà doux) -> on saute
outL = fade(outL, 48.4, 49.4); outR = fade(outR, 48.4, 49.4)
outL = outL[:int(DUR * SR)]; outR = outR[:int(DUR * SR)]
# fondu d'entrée très court pour éviter tout clic
fi = np.minimum(1, np.arange(len(outL)) / (.04 * SR)); outL *= fi; outR *= fi
pk = max(abs(outL).max(), abs(outR).max()); print('pic brut', round(pk, 3))
sc = .85 / pk
st = np.stack([outL * sc, outR * sc], 1)
wavfile.write('out/audio_raw.wav', SR, (st * 32767).astype(np.int16))
# niveaux par seconde
x = st.mean(1); print('RMS dB / s :', ' '.join('%d' % round(20 * math.log10(max(1e-5, np.sqrt(np.mean(x[i * SR:(i + 1) * SR] ** 2))))) for i in range(int(DUR))))
