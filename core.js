'use strict';
/* ================= utils ================= */
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

/* ================= canvas ================= */
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1, floorY = 0;
let globalT = 0;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // piso alto para que la mascota nunca quede tapada por el HUD
  floorY = Math.max(150, H - Math.round(clamp(H * 0.28, 190, 250)));
  makeStars(); makeClouds();
}
window.addEventListener('resize', resize);

function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ================= audio ================= */
const AudioSys = {
  ctx: null, muted: false, _buffs: {}, _loadStarted: false,
  ensure() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    this.loadSamples();
  },
  // decodifica los WAV CC0 embebidos (Kenney UI audio) y los deja listos
  loadSamples() {
    if (this._loadStarted || !this.ctx) return;
    let data = null;
    try { data = (typeof SFX_DATA !== 'undefined') ? SFX_DATA : null; } catch (e) {}
    if (!data) return;
    this._loadStarted = true;
    for (const k in data) {
      try {
        const bin = atob(data[k]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        this.ctx.decodeAudioData(bytes.buffer,
          b => { this._buffs[k] = b; },
          () => {}
        );
      } catch (e) {}
    }
  },
  play(name, vol) {
    if (this.muted || !this.ctx) return;
    const b = this._buffs[name];
    if (!b) return;
    try {
      const s = this.ctx.createBufferSource();
      s.buffer = b;
      const g = this.ctx.createGain();
      g.gain.value = (vol == null) ? 1 : vol;
      s.connect(g); g.connect(this.ctx.destination);
      s.start();
    } catch (e) {}
  },
  tone(f0, f1, dur, type, vol) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1 || f0), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.14, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  },
  pet()   { this.play('rollover2', 0.8); this.tone(620, 940, 0.08, 'sine', 0.08); },
  boing() { this.tone(240, 130, 0.16, 'sine', 0.18); },
  munch() { this.tone(190, 140, 0.07, 'square', 0.08); },
  pop()   { this.play('click3', 0.9); this.tone(500, 760, 0.05, 'sine', 0.06); },
  catchS(){ this.tone(520, 820, 0.1, 'sine', 0.15); this.tone(780, 1040, 0.12, 'sine', 0.1); },
  eventS(){ [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.14, 'sine', 0.12), i * 90)); },
  sleepS(){ this.tone(520, 420, 0.5, 'sine', 0.08); this.tone(390, 330, 0.6, 'sine', 0.07); },
  wakeS() { [392, 523, 659].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.12, 'sine', 0.1), i * 70)); },
  fanfare(){ [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.22, 'sine', 0.14), i * 110)); },
  faintS(){ this.tone(300, 120, 0.7, 'triangle', 0.1); },
  coin(){ this.tone(1100, 1500, 0.09, 'sine', 0.12); setTimeout(() => this.tone(1500, 1900, 0.12, 'sine', 0.1), 70); },
  buy(){ this.play('click1', 0.8); this.tone(700, 1050, 0.1, 'sine', 0.1); setTimeout(() => this.tone(1050, 1400, 0.14, 'sine', 0.08), 90); },
};

/* ================= particles ================= */
const particles = [];
function spawn(p) {
  particles.push(Object.assign({
    x: 0, y: 0, vx: 0, vy: 0, life: 1, max: 1, size: 6, rot: 0, vr: 0, grav: 0, color: '#ff6f91', type: 'heart'
  }, p));
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt / p.max;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy += (p.grav || 0) * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
  }
}
function heartPath(x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.32);
  ctx.bezierCurveTo(x - s * 1.05, y - s * 0.12, x - s * 0.5, y - s * 0.85, x, y - s * 0.22);
  ctx.bezierCurveTo(x + s * 0.5, y - s * 0.85, x + s * 1.05, y - s * 0.12, x, y + s * 0.32);
  ctx.closePath();
}
function starPath(x, y, r, points) {
  const n = points || 5;
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / n;
    const rr2 = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
  }
  ctx.closePath();
}
function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    switch (p.type) {
      case 'heart': heartPath(0, 0, p.size); ctx.fill(); break;
      case 'star': starPath(0, 0, p.size, 5); ctx.fill(); break;
      case 'sparkle': {
        ctx.strokeStyle = p.color; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        const s = p.size;
        ctx.beginPath();
        ctx.moveTo(-s, 0); ctx.lineTo(s, 0);
        ctx.moveTo(0, -s); ctx.lineTo(0, s);
        ctx.stroke(); break;
      }
      case 'note': {
        ctx.beginPath(); ctx.arc(p.size * 0.4, 0, p.size * 0.45, 0, TAU); ctx.fill();
        ctx.fillRect(p.size * 0.4 - p.size * 0.12, -p.size * 2.1, p.size * 0.24, p.size * 2.1);
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size * 0.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.size * 0.52, -p.size * 2.1); ctx.quadraticCurveTo(p.size * 1.2, -p.size * 1.7, p.size * 1.15, -p.size * 1.2); ctx.stroke();
        break;
      }
      case 'zzz': {
        ctx.font = '700 ' + Math.round(p.size) + 'px Fredoka, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('z', 0, 0); break;
      }
      case 'crumb': ctx.beginPath(); ctx.arc(0, 0, p.size, 0, TAU); ctx.fill(); break;
      case 'text': {
        ctx.font = '700 ' + Math.round(p.size) + 'px Fredoka, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
        ctx.strokeText(p.txt || '', 0, 0);
        ctx.fillText(p.txt || '', 0, 0);
        break;
      }
      case 'confetti': {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); break;
      }
      case 'dash': {
        ctx.fillRect(-p.size, -1.6, p.size * 2, 3.2); break;
      }
      case 'rainbow': {
        const cols = ['#ff6f91', '#ffc94d', '#8fd977', '#6cc9ff', '#9a8cff'];
        ctx.lineWidth = 3.4; ctx.lineCap = 'round';
        for (let k = 0; k < cols.length; k++) {
          ctx.strokeStyle = cols[k];
          ctx.beginPath(); ctx.arc(0, 0, p.size + k * 4, -0.9, 0.9); ctx.stroke();
        }
        break;
      }
      case 'dust': ctx.beginPath(); ctx.arc(0, 0, p.size, 0, TAU); ctx.fill(); break;
      case 'stink': {
        // nubecita de "olor a aventura" (verde grisáceo, sube y ondula)
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(120,140,95,.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.size * 0.6, -p.size * 0.5, p.size * 0.55, 0, TAU); ctx.stroke();
        break;
      }
      case 'bubble': {
        const gr = ctx.createRadialGradient(-p.size * 0.3, -p.size * 0.35, p.size * 0.05, 0, 0, p.size);
        gr.addColorStop(0, 'rgba(255,255,255,.95)');
        gr.addColorStop(0.55, 'rgba(190,225,255,.65)');
        gr.addColorStop(1, 'rgba(130,190,240,.3)');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, TAU); ctx.fill();
        break;
      }
      case 'drop': {
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.quadraticCurveTo(p.size * 1.1, p.size * 0.2, 0, p.size * 0.9);
        ctx.quadraticCurveTo(-p.size * 1.1, p.size * 0.2, 0, -p.size);
        ctx.fill(); break;
      }
    }
    ctx.restore();
  }
}

/* ================= ambient scene ================= */
let hour = new Date().getHours();
let isNight = hour < 7 || hour >= 20;
let isDusk = (hour >= 7 && hour < 9) || (hour >= 18 && hour < 20);
function refreshDayCycle() {
  hour = new Date().getHours();
  isNight = hour < 7 || hour >= 20;
  isDusk = (hour >= 7 && hour < 9) || (hour >= 18 && hour < 20);
}

let stars = [], clouds = [];
function makeStars() {
  stars = [];
  for (let i = 0; i < 55; i++) {
    stars.push({ x: rand(0, W), y: rand(0, H * 0.75), r: rand(0.6, 1.8), tw: rand(0.5, 2.5), ph: rand(0, TAU) });
  }
}
function makeClouds() {
  clouds = [];
  for (let i = 0; i < 3; i++) {
    clouds.push({ x: rand(0, W), y: rand(30, H * 0.34), s: rand(0.7, 1.25), v: rand(5, 13) });
  }
}
function drawCloud(cx, cy, s) {
  ctx.fillStyle = isNight ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.78)';
  ctx.beginPath();
  ctx.arc(cx - 26 * s, cy, 22 * s, 0, TAU);
  ctx.arc(cx, cy - 14 * s, 28 * s, 0, TAU);
  ctx.arc(cx + 26 * s, cy, 20 * s, 0, TAU);
  ctx.rect(cx - 46 * s, cy, 92 * s, 22 * s);
  ctx.fill();
}
function drawWindow() {
  const x = 26, y = 26, w = 150, h = 190;
  // shadow
  ctx.fillStyle = 'rgba(90,55,25,.18)';
  rr(x + 5, y + 7, w, h, 16); ctx.fill();
  // frame
  ctx.fillStyle = '#8a5a34';
  rr(x, y, w, h, 16); ctx.fill();
  // glass
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (isNight) { g.addColorStop(0, '#0e1c36'); g.addColorStop(1, '#20375a'); }
  else if (isDusk) { g.addColorStop(0, '#ffb27d'); g.addColorStop(1, '#ffd9a8'); }
  else { g.addColorStop(0, '#8fd0f0'); g.addColorStop(1, '#eaf7ff'); }
  ctx.fillStyle = g;
  rr(x + 10, y + 10, w - 20, h - 20, 10); ctx.fill();
  // sun / moon
  if (isNight) {
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(x + w - 46, y + 40, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#20375a';
    ctx.beginPath(); ctx.arc(x + w - 50, y + 36, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (const s of [{ x: x + 34, y: y + 62 }, { x: x + 66, y: y + 100 }, { x: x + 40, y: y + 132 }]) {
      ctx.beginPath(); ctx.arc(s.x, s.y, 1.6, 0, TAU); ctx.fill();
    }
  } else {
    ctx.fillStyle = 'rgba(255,217,77,.35)';
    ctx.beginPath(); ctx.arc(x + w - 46, y + 40, 24, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath(); ctx.arc(x + w - 46, y + 40, 14, 0, TAU); ctx.fill();
  }
  // cross bars
  ctx.strokeStyle = '#8a5a34'; ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x + 10, y + h / 2); ctx.lineTo(x + w - 10, y + h / 2);
  ctx.moveTo(x + w / 2, y + 10); ctx.lineTo(x + w / 2, y + h - 10);
  ctx.stroke();
  // curtains
  for (const side of [-1, 1]) {
    const cx = side < 0 ? x - 10 : x + w + 10 - 34;
    ctx.fillStyle = '#ff8f6b';
    ctx.beginPath();
    ctx.moveTo(cx, y - 8);
    ctx.lineTo(cx + 34, y - 8);
    ctx.lineTo(cx + 34, y + h + 6);
    ctx.quadraticCurveTo(cx + 22, y + h + 16, cx + 17, y + h + 6);
    ctx.quadraticCurveTo(cx + 12, y + h + 14, cx + 7, y + h + 6);
    ctx.quadraticCurveTo(cx + 2, y + h + 12, cx, y + h + 6);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(200,80,50,.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx + 17, y + 4); ctx.lineTo(cx + 17, y + h + 8); ctx.stroke();
  }
}
function drawPicture() {
  const x = 196, y = 42, w = 96, h = 112;
  ctx.fillStyle = 'rgba(90,55,25,.15)';
  rr(x + 3, y + 5, w, h, 12); ctx.fill();
  ctx.fillStyle = '#e8b45c';
  rr(x, y, w, h, 12); ctx.fill();
  ctx.fillStyle = '#fff6e0';
  rr(x + 7, y + 7, w - 14, h - 14, 8); ctx.fill();
  // banana
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 10; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + 30, y + 94);
  ctx.quadraticCurveTo(x + 18, y + 42, x + 66, y + 94);
  ctx.stroke();
  ctx.fillStyle = '#b9833a';
  ctx.beginPath(); ctx.arc(x + 30, y + 94, 4, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 66, y + 94, 4, 0, TAU); ctx.fill();
}
function drawPlant() {
  const x = W - 64, base = floorY;
  const sway = Math.sin(globalT * 0.9) * 0.04;
  ctx.save();
  ctx.translate(x, base);
  // leaves behind pot
  ctx.save();
  ctx.rotate(sway);
  for (let i = 0; i < 5; i++) {
    const ang = -0.85 + i * 0.42;
    ctx.save();
    ctx.rotate(ang);
    ctx.fillStyle = i === 2 ? '#5db45a' : '#7cc97a';
    ctx.strokeStyle = '#4f9e4f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -72, 13, 34, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  // pot
  ctx.fillStyle = '#e07a52'; ctx.strokeStyle = '#c96a44'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-26, -28); ctx.lineTo(26, -28); ctx.lineTo(20, 8); ctx.lineTo(-20, 8);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8875f';
  rr(-29, -38, 58, 11, 5); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawLamp() {
  const x = W - 172;
  const shadeY = floorY - 128;
  // pole
  ctx.strokeStyle = '#8a5a34'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, floorY); ctx.lineTo(x, shadeY + 16); ctx.stroke();
  // base
  ctx.fillStyle = '#8a5a34';
  ctx.beginPath(); ctx.ellipse(x, floorY + 4, 18, 6, 0, 0, TAU); ctx.fill();
  // glow at night
  if (isNight) {
    const g = ctx.createRadialGradient(x, shadeY, 4, x, shadeY, 160);
    g.addColorStop(0, 'rgba(255,200,110,.42)');
    g.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, shadeY, 160, 0, TAU); ctx.fill();
  }
  // shade
  ctx.fillStyle = '#ffd166'; ctx.strokeStyle = '#e6b84d'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 27, shadeY); ctx.lineTo(x + 27, shadeY);
  ctx.lineTo(x + 20, shadeY - 34); ctx.lineTo(x - 20, shadeY - 34);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff7dd';
  ctx.beginPath(); ctx.ellipse(x, shadeY - 2, 21, 5, 0, 0, TAU); ctx.fill();
}
function drawRug() {
  const rx = Math.min(W * 0.33, 330);
  const cy = floorY + 28;
  ctx.fillStyle = 'rgba(90,55,25,.12)';
  ctx.beginPath(); ctx.ellipse(W / 2, cy + 6, rx, 30, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffdcc4'; ctx.strokeStyle = '#f2b98f'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(W / 2, cy, rx, 28, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(242,185,143,.8)'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
  ctx.beginPath(); ctx.ellipse(W / 2, cy, Math.max(14, rx - 18), 18, 0, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
}
function drawScene() {
  if (gameScene === 'plaza') { drawPlazaScene(); return; }
  if (gameScene === 'bosque') { drawBosqueScene(); return; }
  if (gameScene === 'playa') { drawPlayaScene(); return; }
  if (gameScene === 'garden') { drawGardenScene(); return; }
  // wall
  const wall = ctx.createLinearGradient(0, 0, 0, floorY);
  wall.addColorStop(0, '#ffe9cf'); wall.addColorStop(1, '#f6d6b0');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, floorY);
  // floor
  const fl = ctx.createLinearGradient(0, floorY, 0, H);
  fl.addColorStop(0, '#e2c69c'); fl.addColorStop(1, '#cfae7e');
  ctx.fillStyle = fl;
  ctx.fillRect(0, floorY, W, H - floorY);
  // plank lines
  ctx.strokeStyle = 'rgba(120,90,50,.10)'; ctx.lineWidth = 2;
  for (let x = 70; x < W; x += 110) {
    ctx.beginPath(); ctx.moveTo(x, floorY); ctx.lineTo(x, H); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(120,90,50,.35)';
  ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(W, floorY); ctx.stroke();
  // stars on wall at night
  if (isNight) {
    for (const s of stars) {
      ctx.globalAlpha = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(globalT * s.tw + s.ph));
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // clouds drift
  for (const c of clouds) {
    c.x += c.v * 0.016;
    if (c.x > W + 100) c.x = -120;
    drawCloud(c.x, c.y, c.s);
  }
  // window light shaft (day)
  if (!isNight) {
    ctx.fillStyle = 'rgba(255,250,220,.14)';
    ctx.beginPath();
    ctx.moveTo(26, 210); ctx.lineTo(176, 210); ctx.lineTo(W * 0.42, floorY); ctx.lineTo(W * 0.2, floorY);
    ctx.closePath(); ctx.fill();
  }
  drawWindow();
  drawPicture();
  drawRug();
  drawLamp();
  drawPlant();
  // night dim
  if (isNight) {
    ctx.fillStyle = 'rgba(22,34,64,.42)';
    ctx.fillRect(0, 0, W, H);
    // lamp glow over dim
    drawLampGlowOver();
  }
}
function drawLampGlowOver() {
  const x = W - 172, shadeY = floorY - 128;
  const g = ctx.createRadialGradient(x, shadeY, 6, x, shadeY, 150);
  g.addColorStop(0, 'rgba(255,205,120,.30)');
  g.addColorStop(1, 'rgba(255,205,120,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, shadeY, 150, 0, TAU); ctx.fill();
}

/* ================= garden scene ================= */
function drawGardenScene() {
  const horizon = floorY;
  // sky
  const skyCols = isNight ? ['#0c1a33', '#20345c'] : isDusk ? ['#ffb27d', '#ffdca8'] : ['#8ed4f6', '#e6f7ff'];
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, skyCols[0]); sky.addColorStop(1, skyCols[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon);

  // stars (night)
  if (isNight) {
    for (const s of stars) {
      if (s.y > horizon - 60) continue;
      ctx.globalAlpha = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(globalT * s.tw + s.ph));
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // sun / moon
  const sx = Math.min(W * 0.82, W - 60), sy = 84;
  if (isNight) {
    ctx.fillStyle = 'rgba(255,244,190,.10)';
    ctx.beginPath(); ctx.arc(sx, sy, 60, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(sx, sy, 17, 0, TAU); ctx.fill();
    ctx.fillStyle = skyCols[0];
    ctx.beginPath(); ctx.arc(sx + 8, sy - 4, 14, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    for (let i = 0; i < 7; i++) {
      const a = i * (TAU / 7);
      ctx.beginPath(); ctx.arc(sx + 80 * Math.cos(a), sy + 70 * Math.sin(a), 1.3, 0, TAU); ctx.fill();
    }
  } else {
    ctx.fillStyle = 'rgba(255,220,90,.28)';
    ctx.beginPath(); ctx.arc(sx, sy, 52, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffdf5e';
    ctx.beginPath(); ctx.arc(sx, sy, 30, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffe98a';
    ctx.beginPath(); ctx.arc(sx - 8, sy - 7, 11, 0, TAU); ctx.fill();
  }

  // clouds drift
  for (const c of clouds) {
    c.x += c.v * 0.016;
    if (c.x > W + 120) c.x = -140;
    drawCloud(c.x, c.y, c.s);
  }

  // far hills (peek over the horizon)
  ctx.fillStyle = isNight ? 'rgba(36,74,54,.85)' : 'rgba(104,178,110,.9)';
  for (let i = -1; i < 5; i++) {
    const hx = i * W * 0.34 + (W * 0.17);
    ctx.beginPath();
    ctx.ellipse(hx, horizon - 60, W * 0.36, 110, 0, 0, TAU);
    ctx.fill();
  }

  // ground
  const gr = ctx.createLinearGradient(0, horizon, 0, H);
  if (isNight) { gr.addColorStop(0, '#2f6b43'); gr.addColorStop(1, '#1e4a2d'); }
  else { gr.addColorStop(0, '#7ccb7a'); gr.addColorStop(1, '#4f9e52'); }
  ctx.fillStyle = gr;
  ctx.fillRect(0, horizon, W, H - horizon);
  // mow stripes
  ctx.fillStyle = isNight ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.09)';
  for (let x = 0; x < W; x += 150) ctx.fillRect(x, horizon, 75, H - horizon);

  // fence
  ctx.fillStyle = isNight ? 'rgba(150,110,70,.75)' : '#d9b585';
  for (let x = 6; x < W + 40; x += 52) {
    rr(x, horizon - 62, 34, 62, 7); ctx.fill();
  }
  ctx.fillStyle = isNight ? 'rgba(180,140,95,.85)' : '#c49a6a';
  ctx.fillRect(0, horizon - 50, W, 11);
  ctx.fillRect(0, horizon - 27, W, 11);

  // flowers at the corners
  function flower(fx, base, s, col1, col2) {
    ctx.strokeStyle = '#3e7d3a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(fx, base); ctx.lineTo(fx, base - 26 * s); ctx.stroke();
    ctx.fillStyle = col1;
    ctx.beginPath(); ctx.ellipse(fx, base - 30 * s, 11 * s, 7 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = col2;
    ctx.beginPath(); ctx.arc(fx, base - 31 * s, 3.6 * s, 0, TAU); ctx.fill();
  }
  flower(46, horizon, 1, '#ff8fb1', '#fff');
  flower(96, horizon, 0.8, '#ffd166', '#fff');
  flower(W - 54, horizon, 1, '#c9a2ff', '#fff');
  flower(W - 104, horizon, 0.8, '#ff8fb1', '#fff');
  flower(160, horizon, 0.7, '#8fd977', '#fff');
  flower(W - 160, horizon, 0.7, '#ffd166', '#fff');

  // bush on the left
  ctx.fillStyle = isNight ? '#2c5c38' : '#67b96a';
  ctx.beginPath(); ctx.arc(150, horizon - 2, 26, 0, TAU); ctx.fill();
  ctx.fillStyle = isNight ? '#347043' : '#7ccb7a';
  ctx.beginPath(); ctx.arc(175, horizon - 8, 22, 0, TAU); ctx.fill();

  // night dim + moonlight
  if (isNight) {
    ctx.fillStyle = 'rgba(10,20,40,.34)';
    ctx.fillRect(0, 0, W, H);
    const mg = ctx.createRadialGradient(sx, sy, 8, sx, sy, 260);
    mg.addColorStop(0, 'rgba(210,225,255,.22)');
    mg.addColorStop(1, 'rgba(210,225,255,0)');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(sx, sy, 260, 0, TAU); ctx.fill();
  }
}

/* ================= lugares: plaza ================= */
function drawPlazaScene() {
  const topCols = isNight ? ['#101d3a', '#22365e'] : isDusk ? ['#ff9e66', '#ffd9a8'] : ['#a7d8ff', '#eef8ff'];
  const g = ctx.createLinearGradient(0, 0, 0, floorY);
  g.addColorStop(0, topCols[0]); g.addColorStop(1, topCols[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, floorY);
  if (isNight) {
    for (const s of stars) { if (s.y > floorY - 40) continue; ctx.globalAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(globalT * s.tw + s.ph)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  // sol / luna
  const sx = Math.min(W * 0.18, 120), sy = 90;
  if (isNight) { ctx.fillStyle = 'rgba(255,244,190,.12)'; ctx.beginPath(); ctx.arc(sx, sy, 55, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(sx, sy, 16, 0, TAU); ctx.fill(); ctx.fillStyle = topCols[0]; ctx.beginPath(); ctx.arc(sx + 7, sy - 4, 13, 0, TAU); ctx.fill(); }
  else { ctx.fillStyle = 'rgba(255,220,90,.25)'; ctx.beginPath(); ctx.arc(sx, sy, 46, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffdf5e'; ctx.beginPath(); ctx.arc(sx, sy, 27, 0, TAU); ctx.fill(); }
  // edificios del fondo
  ctx.fillStyle = isNight ? '#28304e' : 'rgba(150,160,190,.5)';
  ctx.fillRect(W * 0.02, floorY - 200, W * 0.12, 200); ctx.fillRect(W * 0.15, floorY - 140, W * 0.1, 140);
  ctx.fillRect(W * 0.8, floorY - 220, W * 0.12, 220); ctx.fillRect(W * 0.93, floorY - 130, W * 0.1, 130);
  if (isNight) { ctx.fillStyle = '#ffd166';
    for (let i = 0; i < 5; i++) { ctx.fillRect(W * 0.03 + i * 14, floorY - 180 + (i % 3) * 26, 5, 8); ctx.fillRect(W * 0.81 + i * 14, floorY - 200 + (i % 3) * 26, 5, 8); } }
  // piso de la plaza
  const fl = ctx.createLinearGradient(0, floorY, 0, H);
  if (isNight) { fl.addColorStop(0, '#8f8aa0'); fl.addColorStop(1, '#6e6980'); } else { fl.addColorStop(0, '#e9e0cf'); fl.addColorStop(1, '#c9bca3'); }
  ctx.fillStyle = fl; ctx.fillRect(0, floorY, W, H - floorY);
  ctx.strokeStyle = isNight ? 'rgba(255,255,255,.08)' : 'rgba(120,100,70,.14)'; ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, floorY); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = floorY + 34; y < H; y += 34) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  // fuente central
  const fx = W / 2;
  ctx.fillStyle = isNight ? '#4a5a7a' : '#b9cfd8';
  ctx.beginPath(); ctx.ellipse(fx, floorY - 34, 74, 14, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = isNight ? 'rgba(120,200,240,.3)' : 'rgba(120,200,240,.55)';
  ctx.beginPath(); ctx.ellipse(fx, floorY - 34, 58, 10, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = isNight ? '#6a7fa8' : '#9db6c4';
  ctx.beginPath(); ctx.ellipse(fx, floorY - 46, 64, 12, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(200,235,255,.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (let k = -1; k <= 1; k++) {
    ctx.beginPath(); ctx.arc(fx + k * 16, floorY - 42, 14 - Math.abs(k) * 3, Math.PI * 0.9, Math.PI * 0.1, true); ctx.stroke();
  }
  // árboles en los costados
  for (const tx of [40, W - 40]) {
    ctx.fillStyle = '#7a4a2a'; ctx.fillRect(tx - 6, floorY - 120, 12, 120);
    ctx.fillStyle = isNight ? '#1f5a33' : '#4f9e52';
    ctx.beginPath(); ctx.arc(tx, floorY - 150, 44, 0, TAU); ctx.fill();
    ctx.fillStyle = isNight ? '#2c6d40' : '#5db45a';
    ctx.beginPath(); ctx.arc(tx - 26, floorY - 132, 30, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(tx + 26, floorY - 132, 30, 0, TAU); ctx.fill();
  }
  // palomas
  for (let i = 0; i < 3; i++) {
    const px = W * 0.35 + i * 44 + Math.sin(globalT * 2 + i) * 6;
    const py = floorY - (i % 2 ? 40 : 22) + Math.sin(globalT * 5 + i) * 3;
    ctx.fillStyle = isNight ? '#8a93a8' : '#cfd4de';
    ctx.beginPath(); ctx.ellipse(px, py, 12, 8, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(px + 11, py - 4, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8a33c'; ctx.beginPath(); ctx.moveTo(px + 15, py - 4); ctx.lineTo(px + 20, py - 3); ctx.lineTo(px + 15, py - 1); ctx.closePath(); ctx.fill();
  }
  if (isNight) { ctx.fillStyle = 'rgba(10,18,40,.4)'; ctx.fillRect(0, 0, W, H);
    for (const lx of [110, W - 110]) {
      const lg = ctx.createRadialGradient(lx, floorY - 40, 4, lx, floorY - 40, 130);
      lg.addColorStop(0, 'rgba(255,210,130,.35)'); lg.addColorStop(1, 'rgba(255,210,130,0)');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lx, floorY - 40, 130, 0, TAU); ctx.fill();
    }
  }
}

/* ================= lugares: bosque ================= */
function drawBosqueScene() {
  const topCols = isNight ? ['#0a1526', '#15283f'] : isDusk ? ['#7a5a86', '#c98fa0'] : ['#8fd0c8', '#d9f2e6'];
  const g = ctx.createLinearGradient(0, 0, 0, floorY);
  g.addColorStop(0, topCols[0]); g.addColorStop(1, topCols[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, floorY);
  // copas del fondo
  ctx.fillStyle = isNight ? '#0e2c1d' : '#2e7d46';
  ctx.beginPath(); ctx.arc(W * 0.12, floorY - 210, 150, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(W * 0.45, floorY - 190, 170, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(W * 0.82, floorY - 210, 160, 0, TAU); ctx.fill();
  // claros de luz
  if (!isNight) {
    ctx.fillStyle = 'rgba(255,250,190,.14)';
    ctx.beginPath(); ctx.moveTo(W * 0.35, 0); ctx.lineTo(W * 0.45, 0); ctx.lineTo(W * 0.6, floorY); ctx.lineTo(W * 0.3, floorY); ctx.closePath(); ctx.fill();
  }
  // piso
  const fl = ctx.createLinearGradient(0, floorY, 0, H);
  if (isNight) { fl.addColorStop(0, '#12351f'); fl.addColorStop(1, '#081f11'); } else { fl.addColorStop(0, '#6cb868'); fl.addColorStop(1, '#3f7c44'); }
  ctx.fillStyle = fl; ctx.fillRect(0, floorY, W, H - floorY);
  // sendero
  ctx.fillStyle = isNight ? '#3a4a38' : '#a9855a';
  ctx.beginPath(); ctx.ellipse(W / 2, H - 20, Math.max(W * 0.3, 120), 70, 0, 0, TAU); ctx.fill();
  // árboles grandes
  for (const tx of [60, W - 70]) {
    ctx.fillStyle = isNight ? '#0a2012' : '#5b3d24';
    ctx.beginPath(); ctx.moveTo(tx - 16, floorY); ctx.lineTo(tx + 16, floorY); ctx.lineTo(tx + 8, floorY - 200); ctx.lineTo(tx - 8, floorY - 200); ctx.closePath(); ctx.fill();
    ctx.fillStyle = isNight ? '#0c2a1a' : '#2f7a41';
    ctx.beginPath(); ctx.arc(tx, floorY - 220, 90, 0, TAU); ctx.fill();
    ctx.fillStyle = isNight ? '#103522' : '#3f9c54';
    ctx.beginPath(); ctx.arc(tx - 60, floorY - 190, 60, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(tx + 62, floorY - 180, 62, 0, TAU); ctx.fill();
  }
  // hongos
  for (let i = 0; i < 5; i++) {
    const hx = W * 0.14 + i * W * 0.18;
    ctx.fillStyle = isNight ? '#e8e2e0' : '#f7f2ef';
    ctx.fillRect(hx - 3, floorY - 14, 6, 14);
    ctx.fillStyle = i % 2 ? '#ff8f6b' : '#e8543f';
    ctx.beginPath(); ctx.ellipse(hx, floorY - 22, 14, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(hx - 5, floorY - 24, 2, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(hx + 5, floorY - 20, 2, 0, TAU); ctx.fill();
  }
  // luciérnagas de noche
  if (isNight) {
    ctx.fillStyle = 'rgba(10,18,35,.35)'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 8; i++) {
      const fxx = (i * 137.5) % W, fyy = floorY - 60 - ((i * 89.3) % (floorY - 140));
      const a = 0.4 + 0.5 * Math.sin(globalT * (1.2 + i * 0.13) + i * 2);
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = '#d8ff7a';
      ctx.beginPath(); ctx.arc(fxx, fyy, 2.6, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(216,255,122,.35)';
      ctx.beginPath(); ctx.arc(fxx, fyy, 7, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/* ================= lugares: playa ================= */
function drawPlayaScene() {
  const seaTop = floorY - Math.min(170, floorY * 0.3);
  const topCols = isNight ? ['#0a1730', '#16304f'] : isDusk ? ['#ffab73', '#ffd9a0'] : ['#8fd8ff', '#e8f9ff'];
  const g = ctx.createLinearGradient(0, 0, 0, seaTop);
  g.addColorStop(0, topCols[0]); g.addColorStop(1, topCols[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, seaTop);
  if (isNight) {
    for (const s of stars) { if (s.y > seaTop - 20) continue; ctx.globalAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(globalT * s.tw + s.ph)); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  const sx = Math.min(W * 0.8, W - 60), sy = 80;
  if (isNight) { ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(sx, sy, 16, 0, TAU); ctx.fill(); ctx.fillStyle = topCols[0]; ctx.beginPath(); ctx.arc(sx + 7, sy - 4, 13, 0, TAU); ctx.fill(); }
  else { ctx.fillStyle = 'rgba(255,220,90,.3)'; ctx.beginPath(); ctx.arc(sx, sy, 50, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffdf5e'; ctx.beginPath(); ctx.arc(sx, sy, 28, 0, TAU); ctx.fill(); }
  // mar
  const mg = ctx.createLinearGradient(0, seaTop, 0, floorY);
  if (isNight) { mg.addColorStop(0, '#0d2244'); mg.addColorStop(1, '#1c3d6e'); } else { mg.addColorStop(0, '#7ec8f0'); mg.addColorStop(1, '#3f9fd8'); }
  ctx.fillStyle = mg; ctx.fillRect(0, seaTop, W, floorY - seaTop);
  // olas animadas
  ctx.strokeStyle = isNight ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const wy = seaTop + 26 + i * 30;
    ctx.globalAlpha = 0.5 + 0.4 * Math.sin(globalT * 2 + i);
    ctx.beginPath();
    for (let wx = 0; wx <= W; wx += 10) {
      const yy = wy + Math.sin(wx * 0.05 + globalT * 2.2 + i) * 4;
      wx === 0 ? ctx.moveTo(wx, yy) : ctx.lineTo(wx, yy);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // gaviota volando
  const gx = (globalT * 24) % (W + 140) - 70;
  const gy = 70 + Math.sin(globalT * 1.4) * 12;
  ctx.strokeStyle = isNight ? 'rgba(220,225,235,.7)' : '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(gx - 11, gy); ctx.quadraticCurveTo(gx - 5, gy - 7, gx, gy); ctx.quadraticCurveTo(gx + 5, gy - 7, gx + 11, gy); ctx.stroke();
  // arena
  const sn = ctx.createLinearGradient(0, floorY, 0, H);
  if (isNight) { sn.addColorStop(0, '#7a6a5e'); sn.addColorStop(1, '#57493f'); } else { sn.addColorStop(0, '#f2dd9f'); sn.addColorStop(1, '#e0c07a'); }
  ctx.fillStyle = sn; ctx.fillRect(0, floorY, W, H - floorY);
  ctx.fillStyle = isNight ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.8)'; ctx.globalAlpha = 0.5;
  ctx.beginPath(); ctx.ellipse(W / 2, floorY + 4, W * 0.55, 10, 0, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  // sombrilla + toallón (abajo, primer plano)
  const ux = W * 0.78, uy = H - 40;
  ctx.fillStyle = isNight ? '#5b4632' : '#7a5230'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(ux - 4, uy); ctx.lineTo(ux + 6, uy - 60); ctx.stroke();
  ctx.fillStyle = '#ff8fb1';
  ctx.beginPath(); ctx.arc(ux + 6, uy - 60, 44, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#e8548a'; ctx.lineWidth = 3;
  for (let a = -1; a <= 1; a++) { ctx.beginPath(); ctx.moveTo(ux + 6, uy - 60); ctx.lineTo(ux + 6 + a * 30, uy - 60 - (a === 0 ? 34 : 12)); ctx.stroke(); }
  ctx.fillStyle = isNight ? '#d9c9d6' : '#cfe0ff';
  rr(W * 0.12, H - 34, 130, 18, 9); ctx.fill();
  // estrella de mar y cangrejo
  ctx.fillStyle = '#ff9e6b';
  ctx.beginPath(); ctx.moveTo(W * 0.3, H - 26); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; const r = k % 2 ? 5 : 11; ctx.lineTo(W * 0.3 + Math.cos(a - Math.PI / 2) * r, H - 26 + Math.sin(a - Math.PI / 2) * r); } ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff5a5a';
  ctx.beginPath(); ctx.ellipse(W * 0.52, H - 22, 13, 8, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(W * 0.52 - 12, H - 26); ctx.lineTo(W * 0.52 - 20, H - 30); ctx.moveTo(W * 0.52 - 12, H - 20); ctx.lineTo(W * 0.52 - 20, H - 16); ctx.stroke();
  // palmera
  const px = 46, py = floorY + 40;
  ctx.strokeStyle = isNight ? '#3a2b1c' : '#8a5a34'; ctx.lineWidth = 12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(px - 20, py); ctx.quadraticCurveTo(px + 6, py - 90, px + 2, py - 140); ctx.stroke();
  ctx.fillStyle = isNight ? '#155a33' : '#2f9e50';
  for (let k = -2; k <= 2; k++) {
    ctx.save(); ctx.translate(px + 2, py - 140); ctx.rotate(k * 0.55);
    ctx.beginPath(); ctx.ellipse(0, -34, 10, 44, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.fillStyle = isNight ? '#3a2b1c' : '#6b4423';
  ctx.beginPath(); ctx.arc(px + 2, py - 140, 11, 0, TAU); ctx.fill();
  // cocos
  ctx.fillStyle = '#7a5230';
  ctx.beginPath(); ctx.arc(px + 2, py - 136, 6, 0, TAU); ctx.fill();
  // noche
  if (isNight) { ctx.fillStyle = 'rgba(8,18,40,.32)'; ctx.fillRect(0, 0, W, H); }
}

// initial sizing (after all declarations)
resize();