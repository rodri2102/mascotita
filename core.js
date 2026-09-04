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
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  floorY = H - clamp(H * 0.2, 140, 170);
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
  ctx: null, muted: false,
  ensure() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
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
  pet()   { this.tone(620, 940, 0.1, 'sine', 0.16); },
  boing() { this.tone(240, 130, 0.16, 'sine', 0.18); },
  munch() { this.tone(190, 140, 0.07, 'square', 0.08); },
  pop()   { this.tone(500, 760, 0.08, 'sine', 0.14); },
  catchS(){ this.tone(520, 820, 0.1, 'sine', 0.15); this.tone(780, 1040, 0.12, 'sine', 0.1); },
  eventS(){ [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.14, 'sine', 0.12), i * 90)); },
  sleepS(){ this.tone(520, 420, 0.5, 'sine', 0.08); this.tone(390, 330, 0.6, 'sine', 0.07); },
  wakeS() { [392, 523, 659].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.12, 'sine', 0.1), i * 70)); },
  fanfare(){ [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.22, 'sine', 0.14), i * 110)); },
  faintS(){ this.tone(300, 120, 0.7, 'triangle', 0.1); },
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
  ctx.beginPath(); ctx.ellipse(W / 2, cy, rx - 18, 18, 0, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
}
function drawScene() {
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

// initial sizing (after all declarations)
resize();