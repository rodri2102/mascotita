'use strict';
/* ================= state ================= */
const R = 52;
const pet = {
  name: 'Pulguito', born: Date.now(),
  x: 0, y: 0, vx: 0, vy: 0, sx: 1, sy: 1, tilt: 0,
  state: 'idle', stateT: 0, phase: 0,
  food: 80, energy: 80, fun: 80, love: 80,
  happy: 0, look: { x: 0, y: 0 }, blinkT: 2, blink: 0,
  walkT: 0, target: null, offX: 0, zt: 0, throwT: 0,
  catches: 0, micro: null, face: 1,
};
const ball = { active: false, held: false, x: 0, y: 0, vx: 0, vy: 0, sy: 1, catches: 0, throwT: 0, lastX: 0, lastY: 0 };
const bowl = { active: false, t: 0, x: 0, y: 0 };
const gift = { active: false, t: 0, x: 0, y: 0, kind: 'sock' };
const bubbles = [];
let day = 1;
let idleT = 6;          // segundos idle antes de animarse a pasear
let lastPetReward = 0;

// economía y progresión
let coins = 10;                       // 🍪 galletas
let ownedItems = [];                  // accesorios comprados
const outfit = { head: null, face: null };  // equipados
let gameScene = 'room';               // 'room' | 'garden'
const shopOpen = { v: false };

// ritmos de decaimiento por segundo (sesión larga, sin matar a la mascota)
const RATES = { food: 0.085, energy: 0.055, fun: 0.065, love: 0.055 };

const ITEMS = [
  { id: 'party',   slot: 'head', name: 'Gorrito de fiesta', price: 15, emoji: '🎉' },
  { id: 'crown',   slot: 'head', name: 'Corona real',       price: 40, emoji: '👑' },
  { id: 'sombrero', slot: 'head', name: 'Sombrero',         price: 50, emoji: '👒' },
  { id: 'lentes',  slot: 'face', name: 'Lentes de sol',     price: 25, emoji: '🕶️' },
  { id: 'mono',    slot: 'face', name: 'Moño',              price: 12, emoji: '🎀' },
];

/* ================= name suggestions ================= */
const NAMES = ['Ñoqui', 'Pulguito', 'Waffle', 'Churro', 'Panceta', 'Mochi', 'Tortellini', 'Lunita', 'Bombón', 'Gordis', 'Pelusa', 'Croqueta', 'Gnocchi', 'Tito', 'Milanesa', 'Copito'];

/* ================= events ================= */
const EVENTS = [
  { id: 'zoomies', dur: 3.4, toast: '¡ZOOMIES! ⚡ Corrió 47 vueltas sin motivo aparente.', bubble: ['rápido rápido rápido…', 'voy a ningún lado y nadie me lo va a impedir'] },
  { id: 'judge', dur: 3.8, toast: 'Juzgó tu historial. No aprueba.', bubble: ['tsk tsk tsk…', 'qué decepción, sinceramente', 'yo te quiero, pero igual… tsk'] },
  { id: 'gift', dur: 3.6, toast: 'Te trajo un regalo: una media. Es su tesoro más preciado.', bubble: ['para vos 🧦', 'es una media. era mía. ahora es tuya'] },
  { id: 'sneeze', dur: 1.8, toast: '¡ACHÍS! Estornudó un arcoíris.', bubble: ['¡achís!', 'disculpe… achís'] },
  { id: 'dance', dur: 4, toast: 'Aprendió a bailar. No importa si le gusta, va a bailar igual.', bubble: ['mirá mi pasito', 'esto lo vio en un tutorial'] },
  { id: 'stare', dur: 4.2, toast: 'Te mira. Lleva 4 minutos. No parpadeó.', bubble: ['…', '… 👁', 'estoy procesando'] },
  { id: 'belly', dur: 4.4, toast: 'Se tiró panza arriba. Es una invitación. O una rendición.', bubble: ['rasca la pancita', 'acá, acá, un poquito más arriba'] },
  { id: 'yawn', dur: 1.5, toast: 'Bostezó tan fuerte que se le despeinó la oreja.', bubble: ['ahhhh… perdón'] },
  { id: 'midair', dur: 2.2, toast: 'Se quedó dormido a mitad de un salto. Impresionante.', bubble: ['zzz…', 'no me despierten…'] },
  { id: 'plant', dur: 2.6, toast: 'Intentó regar la planta con su vasito de jugo. La planta lo perdonó.', bubble: ['toma, plantita', 'te preparé algo'] },
];
let lastEvent = null, eventT = rand(16, 26), microT = rand(4, 8);

/* ================= helpers ================= */
function setState(s, dur) {
  pet.state = s; pet.stateT = dur; pet.phase = 0;
  if (s !== 'walk') pet._giftPending = false;
  if (s === 'zoomies') { pet.zt = 0; pet.face = pick([-1, 1]); }
  if (s === 'sneeze') pet.face = 1;
  if (s === 'judge') pet.face = -1;
  if (s === 'dance') pet.face = 1;
  if (s === 'midair') pet.vy = -620;
}
function showBubble(text, dur) {
  bubbles.push({ text, ttl: dur || 2.3, max: dur || 2.3, w: 0 });
}
function showToast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3400);
}
function burstHearts(n) {
  for (let i = 0; i < n; i++) {
    spawn({
      x: pet.x + rand(-30, 30), y: pet.y - rand(0, 40),
      vx: rand(-60, 60), vy: rand(-190, -90), grav: 60,
      size: rand(7, 13), max: rand(1, 1.6), color: pick(['#ff6f91', '#ff9e7d', '#ffc94d']), type: 'heart'
    });
  }
}
function confettiBurst(x, y, n) {
  const cols = ['#ff6f91', '#ffc94d', '#8fd977', '#6cc9ff', '#9a8cff'];
  for (let i = 0; i < n; i++) {
    spawn({
      x, y, vx: rand(-240, 240), vy: rand(-380, -80), grav: 620,
      size: rand(6, 11), rot: rand(0, TAU), vr: rand(-9, 9), max: rand(1.2, 2.2), color: pick(cols), type: 'confetti'
    });
  }
}
function dustPuff(x, y, n) {
  for (let i = 0; i < n; i++) {
    spawn({
      x: x + rand(-12, 12), y: y + rand(-6, 4),
      vx: rand(-40, 40), vy: rand(-50, -10), grav: 30,
      size: rand(3, 6), max: rand(0.5, 0.9), color: 'rgba(160,130,90,.5)', type: 'dust'
    });
  }
}
function squash(sx, sy) { pet.sx = sx; pet.sy = sy; }

/* ================= economía / accesorios / escenas ================= */
function refreshCoinChip() {
  const el = document.getElementById('coin-chip');
  if (el) el.textContent = '🍪 ' + coins;
  const bal = document.getElementById('shop-balance');
  if (bal) bal.textContent = coins;
}
function addCoin(n, x, y) {
  coins += n;
  refreshCoinChip();
  const el = document.getElementById('coin-chip');
  if (el && n > 0) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  if (n > 0 && x != null && y != null) {
    spawn({ type: 'text', txt: '+' + n, x: x + rand(-10, 10), y: y, vx: rand(-10, 10), vy: -55, size: 15, max: 1.1, color: '#c98a2d' });
  }
  AudioSys.coin();
}

// ---- dibujo de accesorios (coordenadas locales de la mascota) ----
function drawHatItem(id) {
  ctx.save();
  ctx.translate(0, -R * 0.8);
  if (id === 'party') {
    ctx.fillStyle = '#ffd166'; ctx.strokeStyle = '#e6b04a'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-R * 0.34, R * 0.06); ctx.lineTo(R * 0.34, R * 0.06); ctx.lineTo(0, -R * 0.72);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff8fb1';
    ctx.beginPath(); ctx.arc(-R * 0.13, R * 0.12, R * 0.06, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(R * 0.15, R * 0.18, R * 0.05, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff6f91';
    rr(-R * 0.38, -R * 0.02, R * 0.76, R * 0.18, 5); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, -R * 0.8, R * 0.09, 0, TAU); ctx.fill();
  } else if (id === 'crown') {
    ctx.fillStyle = '#ffd166'; ctx.strokeStyle = '#d9a13c'; ctx.lineWidth = 3;
    rr(-R * 0.34, -R * 0.12, R * 0.68, R * 0.24, 5); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const x = -R * 0.32 + i * R * 0.16;
      ctx.beginPath();
      ctx.moveTo(x, -R * 0.12);
      ctx.lineTo(x + R * 0.16, -R * 0.12);
      ctx.lineTo(x + R * 0.08, -R * (i % 2 ? 0.4 : 0.52));
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#ff6f91';
    ctx.beginPath(); ctx.arc(0, 0, R * 0.05, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-R * 0.22, 0, R * 0.05, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(R * 0.22, 0, R * 0.05, 0, TAU); ctx.fill();
  } else if (id === 'sombrero') {
    ctx.fillStyle = '#ecc786';
    ctx.beginPath(); ctx.ellipse(0, R * 0.05, R * 0.78, R * 0.17, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0, R * 0.1, R * 0.3, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6fd3a8';
    ctx.fillRect(-R * 0.3, -R * 0.12, R * 0.6, R * 0.16);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.arc(-R * 0.1, -R * 0.3, R * 0.03, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(R * 0.12, -R * 0.26, R * 0.025, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function drawFaceItem(id) {
  ctx.save();
  if (id === 'lentes') {
    ctx.fillStyle = 'rgba(25,20,40,.22)'; ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 4.5;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.arc(s * R * 0.36, -R * 0.14, R * 0.26, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(-R * 0.11, -R * 0.16); ctx.lineTo(R * 0.11, -R * 0.16); ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-R * 0.62, -R * 0.2); ctx.lineTo(-R * 0.62, -R * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R * 0.62, -R * 0.2); ctx.lineTo(R * 0.62, -R * 0.1); ctx.stroke();
  } else if (id === 'mono') {
    ctx.translate(R * 0.6, -R * 0.58);
    ctx.rotate(0.35);
    ctx.fillStyle = '#ff5f7a'; ctx.strokeStyle = '#d84662'; ctx.lineWidth = 2.5;
    ctx.save();
    ctx.rotate(-0.45); ctx.beginPath(); ctx.ellipse(-R * 0.16, 0, R * 0.14, R * 0.2, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.rotate(0.45); ctx.beginPath(); ctx.ellipse(R * 0.16, 0, R * 0.14, R * 0.2, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.08, 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
function drawOutfit() {
  if (!outfit.head && !outfit.face) return;
  if (outfit.head) drawHatItem(outfit.head);
  if (outfit.face) drawFaceItem(outfit.face);
}

// ---- movimiento autónomo ----
function wander() {
  const m = gameScene === 'garden' ? 80 : 150;
  pet.target = { x: rand(m, W - m), y: floorY - R };
  setState('walk', 0);
}

// ---- tienda ----
function shopClick(id) {
  const it = ITEMS.find(t => t.id === id);
  if (!it) return;
  const owned = ownedItems.includes(id);
  if (owned) {
    outfit[it.slot] = outfit[it.slot] === id ? null : id;
    AudioSys.pop(); save(); renderShop();
    return;
  }
  if (coins < it.price) {
    showBubble('me faltan galletitas 🍪');
    return;
  }
  coins -= it.price;
  ownedItems.push(id);
  outfit[it.slot] = id;
  AudioSys.buy();
  confettiBurst(pet.x, pet.y - R, 12);
  showToast('🎁 ¡Compraste: ' + it.name + '!');
  refreshCoinChip(); save(); renderShop();
}
function renderShop() {
  const list = document.getElementById('shop-list');
  if (!list) return;
  refreshCoinChip();
  list.innerHTML = '';
  for (const it of ITEMS) {
    const owned = ownedItems.includes(it.id);
    const worn = outfit[it.slot] === it.id;
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML =
      '<div class="item-emoji">' + it.emoji + '</div>' +
      '<div class="item-info"><div class="nm">' + it.name + '</div>' +
      '<div class="pr">' + (owned ? 'Comprado ✓' : '🍪 ' + it.price) + '</div></div>' +
      '<button class="btn-buy' + (worn ? ' worn' : '') + '" ' +
      (!owned && coins < it.price ? 'disabled' : '') +
      ' onclick="shopClick(\'' + it.id + '\')">' +
      (worn ? 'Quitar' : owned ? 'Poner' : 'Comprar') + '</button>';
    list.appendChild(row);
  }
}
function openShop() {
  if (!pet.name) return;
  shopOpen.v = true;
  renderShop();
  const el = document.getElementById('shop');
  el.classList.add('show');
  AudioSys.pop();
}
function closeShop() {
  shopOpen.v = false;
  document.getElementById('shop').classList.remove('show');
}

// ---- escenas ----
function updateSceneButtons() {
  document.querySelectorAll('[data-scene]').forEach(b => {
    b.classList.toggle('on', b.dataset.scene === gameScene);
  });
}
function setScene(s) {
  if (s === gameScene) return;
  gameScene = s;
  particles.length = 0;
  bubbles.length = 0;
  pet.x = clamp(pet.x, R + 30, W - R - 30);
  pet.target = null;
  if (pet.state === 'walk') setState('idle', 0);
  showToast(s === 'garden' ? '🌳 Jardín: afuera también hay caos.' : '🏠 De vuelta en la sala.');
  updateSceneButtons();
  save();
}

/* ================= persistence ================= */
const SAVE_KEY = 'mascotita.v2';
function load() {
  try {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) {}
    if (!s) {
      try { s = JSON.parse(localStorage.getItem('mascotita.v1')); if (s) s._mig = 1; } catch (e) {}
    }
    if (s && s.n) {
      const el = (Date.now() - s.ts) / 1000;
      pet.name = s.n; pet.born = s.born;
      pet.food = clamp(s.f - el * RATES.food * 0.3, 0, 100);
      pet.energy = clamp(s.e - el * RATES.energy * 0.3, 0, 100);
      pet.fun = clamp(s.u - el * RATES.fun * 0.3, 0, 100);
      pet.love = clamp(s.l - el * RATES.love * 0.3, 0, 100);
      day = Math.max(1, Math.floor((Date.now() - s.born) / 86400000) + 1);
      coins = (typeof s.c === 'number' && s.c >= 0) ? s.c : 10;
      ownedItems = Array.isArray(s.ow) ? s.ow.filter(id => ITEMS.some(t => t.id === id)) : [];
      outfit.head = s.hd && ITEMS.some(t => t.id === s.hd && t.slot === 'head') ? s.hd : null;
      outfit.face = s.fc && ITEMS.some(t => t.id === s.fc && t.slot === 'face') ? s.fc : null;
      gameScene = s.sc === 'garden' ? 'garden' : 'room';
      if (s._mig) save();
      return true;
    }
  } catch (e) {}
  return false;
}
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      n: pet.name, f: Math.round(pet.food), e: Math.round(pet.energy),
      u: Math.round(pet.fun), l: Math.round(pet.love), born: pet.born, ts: Date.now(),
      c: coins, ow: ownedItems, hd: outfit.head, fc: outfit.face, sc: gameScene
    }));
  } catch (e) {}
}
let saveT = 5;

/* ================= creature drawing ================= */
function drawEye(x, y) {
  const p = pet;
  const expr = p.expr;
  const open = p.blink > 0 ? 0.1 : 1;
  ctx.save();
  if (expr === 'happy' || expr === 'dance') {
    ctx.strokeStyle = '#4a2c17'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y + R * 0.08, R * 0.13, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.restore(); return;
  }
  if (expr === 'faint' || expr === 'dizzy') {
    // spiral eyes
    ctx.strokeStyle = '#4a2c17'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      for (let i = 0; i < 14; i++) {
        const a = i * 0.8, r = 1 + i * 0.8;
        const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.85;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore(); return;
  }
  // white
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(x, y, R * 0.2, R * 0.24 * open, 0, 0, TAU); ctx.fill();
  // lids
  if (expr === 'asleep' || expr === 'sleepy' || expr === 'stare' || expr === 'bored') {
    ctx.fillStyle = '#ffd9a3';
    ctx.beginPath(); ctx.ellipse(x, y - R * 0.08, R * 0.21, R * 0.17, 0, 0, TAU); ctx.fill();
  }
  if (expr !== 'asleep' && expr !== 'faint') {
    let px = x + p.look.x * R * 0.08, py = y + p.look.y * R * 0.08;
    if (expr === 'judge') px += p.face * R * 0.11;
    if (expr === 'stare') { px = x; py = y; }
    ctx.fillStyle = '#4a2c17';
    ctx.beginPath(); ctx.arc(px, py, expr === 'stare' ? R * 0.055 : R * 0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(px - R * 0.035, py - R * 0.045, R * 0.04, 0, TAU); ctx.fill();
  }
  // brows (judge)
  if (expr === 'judge') {
    ctx.strokeStyle = '#4a2c17'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + p.face * R * 0.1, y - R * 0.3);
    ctx.lineTo(x - p.face * R * 0.18, y - R * 0.22);
    ctx.stroke();
  }
  ctx.restore();
}
function drawMouth() {
  const p = pet, expr = p.expr;
  ctx.strokeStyle = '#7a3d2a'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  switch (expr) {
    case 'happy': case 'dance':
      ctx.fillStyle = '#7a3d2a';
      ctx.beginPath(); ctx.arc(0, R * 0.24, R * 0.16, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#ff8a80';
      ctx.beginPath(); ctx.ellipse(0, R * 0.32, R * 0.08, R * 0.05, 0, 0, TAU); ctx.fill();
      break;
    case 'sad':
      ctx.beginPath(); ctx.arc(0, R * 0.46, R * 0.12, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      break;
    case 'open':
      ctx.fillStyle = '#7a3d2a';
      ctx.beginPath(); ctx.ellipse(0, R * 0.3, R * 0.13, R * 0.2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff8a80';
      ctx.beginPath(); ctx.ellipse(0, R * 0.38, R * 0.07, R * 0.05, 0, 0, TAU); ctx.fill();
      break;
    case 'judge':
      ctx.beginPath(); ctx.moveTo(-R * 0.16, R * 0.3); ctx.quadraticCurveTo(0, R * 0.22, R * 0.16, R * 0.3); ctx.stroke();
      break;
    case 'asleep':
      ctx.beginPath(); ctx.moveTo(-R * 0.12, R * 0.32); ctx.quadraticCurveTo(0, R * 0.38, R * 0.12, R * 0.32); ctx.stroke();
      break;
    case 'bored':
      ctx.beginPath(); ctx.moveTo(-R * 0.14, R * 0.3); ctx.lineTo(R * 0.14, R * 0.3); ctx.stroke();
      break;
    default:
      ctx.beginPath(); ctx.arc(0, R * 0.26, R * 0.14, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  }
}
function drawEar(dir, twist) {
  ctx.save();
  ctx.translate(dir * R * 0.52, -R * 0.78);
  ctx.rotate(twist * dir);
  ctx.fillStyle = '#ffd9a3'; ctx.strokeStyle = '#e09a63'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, 0, R * 0.24, R * 0.3, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ff9e7d';
  ctx.beginPath(); ctx.ellipse(0, R * 0.04, R * 0.12, R * 0.15, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawPet() {
  const p = pet;
  const t = globalT;
  // shadow
  const lift = (floorY - R) - p.y;
  const shScale = clamp(1 - lift / R * 0.45, 0.45, 1);
  ctx.save();
  ctx.globalAlpha = 0.16 * shScale;
  ctx.fillStyle = '#5b3a1e';
  ctx.beginPath(); ctx.ellipse(p.x, floorY + 10, R * 0.95 * shScale, R * 0.22 * shScale, 0, 0, TAU); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(p.x + p.offX, p.y);
  if (p.state === 'belly') ctx.rotate(Math.PI);
  ctx.rotate(p.tilt);
  const sit = p.state === 'sit';
  if (sit) ctx.translate(0, R * 0.12);
  ctx.scale(p.sx * (sit ? 1.12 : 1), p.sy * (sit ? 0.84 : 1));

  // feet
  const walk = p.state === 'walk' || p.state === 'chase';
  const wf = walk ? Math.sin(p.walkT * 10) * 4 : 0;
  ctx.fillStyle = '#f6c48f'; ctx.strokeStyle = '#e09a63'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(-R * 0.38 + wf, R * 0.88, 15, 11, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(R * 0.38 - wf, R * 0.88, 15, 11, 0, 0, TAU); ctx.fill(); ctx.stroke();

  // ears
  const tw = p.state === 'judge' ? -0.22 : Math.sin(t * 2.3) * 0.04;
  drawEar(-1, tw); drawEar(1, 0);

  // tail
  ctx.save();
  ctx.translate(-R * 1.02, R * 0.22);
  const wag = (p.state === 'sit' || p.happy > 0.4 || p.state === 'dance' || p.state === 'happy') ? Math.sin(t * 9) * 0.45 : Math.sin(t * 3 + 1) * 0.22;
  ctx.rotate(wag);
  ctx.fillStyle = '#ffd9a3'; ctx.strokeStyle = '#e09a63'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, R * 0.15, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();

  // body
  const g = ctx.createRadialGradient(-R * 0.32, -R * 0.42, R * 0.15, 0, 0, R * 1.08);
  g.addColorStop(0, '#ffe8c2'); g.addColorStop(0.55, '#ffd9a3'); g.addColorStop(1, '#f6bd85');
  ctx.fillStyle = g; ctx.strokeStyle = '#e09a63'; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.ellipse(0, 0, R * 1.05, R * 0.98, 0, 0, TAU); ctx.fill(); ctx.stroke();

  // belly
  ctx.fillStyle = 'rgba(255,243,220,.95)';
  ctx.beginPath(); ctx.ellipse(0, R * 0.42, R * 0.5, R * 0.34, 0, 0, TAU); ctx.fill();

  // cheeks
  const blush = p.expr === 'happy' || p.expr === 'dance' ? 0.55 : 0.38;
  ctx.fillStyle = 'rgba(255,158,142,' + blush + ')';
  ctx.beginPath(); ctx.ellipse(-R * 0.6, R * 0.06, R * 0.12, R * 0.08, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(R * 0.6, R * 0.06, R * 0.12, R * 0.08, 0, 0, TAU); ctx.fill();

  // eyes + mouth
  drawEye(R * 0.34, -R * 0.14);
  drawEye(-R * 0.34, -R * 0.14);
  drawMouth();

  // sweat drop
  if (p.expr === 'sad') {
    ctx.fillStyle = '#7ec8f0';
    ctx.beginPath();
    ctx.moveTo(-R * 0.78, -R * 0.34);
    ctx.quadraticCurveTo(-R * 0.9, -R * 0.16, -R * 0.78, -R * 0.04);
    ctx.quadraticCurveTo(-R * 0.66, -R * 0.16, -R * 0.78, -R * 0.34);
    ctx.fill();
  }

  // outfit
  drawOutfit();
  ctx.restore();
}

/* ================= props ================= */
function drawBowl() {
  if (!bowl.active) return;
  const fade = Math.min(1, bowl.t / 0.3);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(bowl.x, bowl.y);
  ctx.fillStyle = 'rgba(90,55,25,.14)';
  ctx.beginPath(); ctx.ellipse(0, 8, 40, 9, 0, 0, TAU); ctx.fill();
  // food mound
  ctx.fillStyle = '#b07d4f';
  ctx.beginPath(); ctx.arc(-7, -8, 11, 0, TAU); ctx.arc(7, -8, 11, 0, TAU); ctx.arc(0, -13, 11, 0, TAU); ctx.fill();
  // bowl
  ctx.fillStyle = '#bfe6d0'; ctx.strokeStyle = '#8ec4a8'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, 0, 34, 13, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#a8d8be';
  ctx.beginPath(); ctx.moveTo(-34, 0); ctx.quadraticCurveTo(-34, 18, 0, 18); ctx.quadraticCurveTo(34, 18, 34, 0); ctx.fill();
  ctx.restore();
}
function drawBall() {
  if (!ball.active) return;
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.scale(1, ball.sy);
  ctx.fillStyle = 'rgba(90,55,25,.13)';
  ctx.beginPath(); ctx.ellipse(0, 6, 18, 5, 0, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(-4, -5, 2, 0, 0, 17);
  g.addColorStop(0, '#ff8d82'); g.addColorStop(1, '#f04e3e');
  ctx.fillStyle = g; ctx.strokeStyle = '#c93a2c'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, 15, -0.9, 0.7); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-5, -6, 3.4, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawGift() {
  if (!gift.active) return;
  ctx.save();
  ctx.translate(gift.x, gift.y);
  const bob = Math.sin(globalT * 4) * 2;
  ctx.translate(0, bob);
  if (gift.kind === 'sock') {
    ctx.rotate(0.35);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e3d9cc'; ctx.lineWidth = 2.5;
    rr(-16, -12, 34, 22, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffb3b3';
    ctx.beginPath(); ctx.ellipse(16, 0, 8, 10, 0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 4, 8, 6, 0, 0, TAU); ctx.fill();
  } else {
    ctx.rotate(-0.2);
    ctx.fillStyle = '#7cc97a'; ctx.strokeStyle = '#4f9e4f'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, 0, 17, 9, 0.3, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#4f9e4f'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(2, -22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(10, -6); ctx.stroke();
  }
  ctx.restore();
}
function drawBubbles() {
  for (const b of bubbles) {
    const a = clamp(b.ttl / 0.4, 0, 1);
    const pop = b.ttl > b.max - 0.18 ? easeOutCubic((b.max - b.ttl) / 0.18) : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = '500 14px Fredoka, sans-serif';
    const w = ctx.measureText(b.text).width + 20;
    const bw = clamp(w, 60, 240);
    const x = clamp(pet.x - bw / 2, 8, W - bw - 8), y = pet.y - R * 2.5;
    ctx.scale(pop, pop);
    ctx.fillStyle = 'rgba(255,252,245,.96)'; ctx.strokeStyle = 'rgba(224,154,99,.5)'; ctx.lineWidth = 2;
    rr(x, y, bw, 30, 15); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,252,245,.96)';
    ctx.beginPath(); ctx.moveTo(pet.x - 7, y + 30); ctx.lineTo(pet.x + 2, y + 46); ctx.lineTo(pet.x + 9, y + 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a2c17'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.text, pet.x, y + 16);
    ctx.restore();
  }
}

/* ================= expressions ================= */
function updateExpression() {
  const p = pet;
  p.expr = 'normal';
  if (p.state === 'sleep' || p.state === 'midair') p.expr = 'asleep';
  else if (p.state === 'faint') p.expr = 'faint';
  else if (p.state === 'judge') p.expr = 'judge';
  else if (p.state === 'stare') p.expr = 'stare';
  else if (p.state === 'zoomies') p.expr = p.zt > p.stateT - 0.9 ? 'dizzy' : 'happy';
  else if (p.state === 'dance' || p.state === 'happy' || p.state === 'belly') p.expr = 'happy';
  else if (p.state === 'eat' || p.state === 'yawn') p.expr = 'open';
  else if (p.state === 'sad') p.expr = 'sad';
  else if (p.food < 30 || p.love < 25) p.expr = 'sad';
  else if (p.energy < 30) p.expr = 'sleepy';
  else if (p.fun < 25) p.expr = 'bored';
  else if (p.happy > 0.15) p.expr = 'happy';
}

/* ================= update ================= */
function update(dt) {
  const p = pet;
  globalT += dt;

  // needs decay
  if (p.state === 'sleep') {
    p.energy += 1.25 * dt;
    p.food -= 0.05 * dt;
    if (p.energy >= 100) wakeUp(true);
  } else {
    p.food -= RATES.food * dt;
    p.energy -= RATES.energy * dt;
    p.fun -= RATES.fun * dt;
    p.love -= RATES.love * dt;
  }
  if (p.state === 'eat') p.food += 16 * dt;
  p.food = clamp(p.food, 0, 100); p.energy = clamp(p.energy, 0, 100);
  p.fun = clamp(p.fun, 0, 100); p.love = clamp(p.love, 0, 100);

  // crises
  if (p.food <= 0 && p.state !== 'faint' && p.state !== 'sleep') {
    setState('faint', 0);
    showToast('😵 ' + p.name + ' se desmayó de hambre. ¡Modo rescate!');
    AudioSys.faintS();
  }
  if (p.energy <= 0 && p.state !== 'sleep' && p.state !== 'faint') {
    setState('sleep', 0);
    showToast('😴 Se durmió de pie. Ni siquiera se dio cuenta.');
    AudioSys.sleepS();
  }

  p.happy = Math.max(0, p.happy - dt * 1.1);
  // spring back squash
  p.sx += (1 - p.sx) * 10 * dt;
  p.sy += (1 - p.sy) * 10 * dt;

  updateExpression();

  // ground physics (hops, landings)
  if (p.state !== 'fly' && p.state !== 'midair') {
    p.vy += 2200 * dt;
    p.y += p.vy * dt;
    const ground = floorY - R * p.sy;
    if (p.y >= ground) {
      p.y = ground;
      if (p.vy > 120) { squash(1.18, 0.84); dustPuff(p.x, floorY, 3); }
      p.vy = 0;
    }
  }

  // blink
  p.blinkT -= dt;
  if (p.blinkT <= 0) { p.blink = 0.13; p.blinkT = rand(2.2, 5); }
  p.blink = Math.max(0, p.blink - dt);

  // look toward pointer
  if (window._mx !== undefined && p.expr !== 'asleep') {
    p.look.x = clamp((window._mx - p.x) / 300, -1, 1);
    p.look.y = clamp((window._my - p.y) / 300, -1, 1);
  }

  // state machine
  switch (p.state) {
    case 'walk': {
      const tg = p.target;
      if (!tg) { setState('idle', 0); break; }
      const dx = tg.x - p.x, dy = tg.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 10) {
        p.x = tg.x; p.y = tg.y;
        dustPuff(p.x, p.y + R, 6);
        if (p._giftPending) {
          p._giftPending = false;
          setState('gift', 3.6);
          gift.active = true; gift.t = 0;
          gift.kind = pick(['sock', 'leaf']);
          gift.x = clamp(p.x + p.face * 70, 60, W - 60); gift.y = floorY - 8;
          setTimeout(() => showBubble(pick(EVENTS.find(e => e.id === 'gift').bubble)), 500);
        } else {
          setState('idle', 0);
        }
      } else {
        const sp = 250;
        p.x += dx / d * sp * dt; p.y += dy / d * sp * dt;
        p.face = dx > 0 ? 1 : -1;
        p.walkT += dt;
      }
      break;
    }
    case 'chase': {
      if (!ball.active) { setState('idle', 0); break; }
      if (ball.held) break;
      const dx = ball.x - p.x, dy = ball.y - p.y;
      const d = Math.hypot(dx, dy);
      if (Math.abs(dx) < 40 && d < 90) {
        // catch!
        ball.active = false;
        ball.catches++; p.catches++;
        p.fun = clamp(p.fun + 22, 0, 100);
        burstHearts(6);
        addCoin(1, p.x, p.y - R * 1.3);
        AudioSys.catchS();
        setState('catch', 1.5);
        p.throwT = 1.0;
        p.face = 1;
      } else {
        const sp = 340;
        p.x += dx / d * sp * dt; p.y += dy / d * sp * dt;
        p.face = dx > 0 ? 1 : -1;
        p.walkT += dt;
        // hop while chasing
        if (Math.random() < dt * 2) p.vy = -140;
      }
      break;
    }
    case 'catch': {
      p.throwT -= dt;
      if (p.throwT <= 0 && p.stateT > 0) {
        // throw ball
        ball.active = true;
        ball.x = p.x + p.face * 30; ball.y = p.y - 30;
        ball.vx = pick([-1, 1]) * rand(240, 380);
        ball.vy = -rand(300, 430);
        ball.held = false;
        ball.sy = 1;
        p.throwT = 99;
      }
      if (p.stateT <= 0) {
        if (ball.catches >= 3 || p.fun >= 100) {
          ball.active = false;
          showToast(pick(['Se cansó. Buena partida. 🎾', '¡Récord personal! Tres atrapadas.', 'El partido terminó 3 a 0. Ganó ella.']));
          confettiBurst(p.x, p.y, 16);
          p.fun = 100;
          setState('idle', 0);
        } else setState('chase', 0);
      }
      break;
    }
    case 'fly': {
      p.vy += 2200 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < R) { p.x = R; p.vx *= -0.6; }
      if (p.x > W - R) { p.x = W - R; p.vx *= -0.6; }
      const ground = floorY - R * p.sy;
      if (p.y >= ground) {
        p.y = ground;
        if (p.vy < -80) {
          p.vy *= -0.45;
          squash(1.3, 0.72);
          dustPuff(p.x, floorY, 8);
          AudioSys.boing();
        } else {
          p.vy = 0;
          if (Math.abs(p.vx) < 40) {
            p.vx = 0; p.vx = 0;
            p.fun = clamp(p.fun + 4, 0, 100);
            setState('idle', 0);
            dustPuff(p.x, floorY, 6);
          } else p.vx *= 0.94;
        }
      }
      break;
    }
    case 'gift': {
      if (p.stateT <= 0) { gift.active = false; setState('idle', 0); }
      break;
    }
    case 'zoomies': {
      if (!p.target || dist(p.x, p.y, p.target.x, p.target.y) < 26) {
        p.target = { x: rand(R * 1.5, W - R * 1.5), y: floorY - R };
      }
      const dx = p.target.x - p.x, dy = p.target.y - p.y;
      const d = Math.hypot(dx, dy);
      const sp = 950;
      p.x += dx / d * sp * dt; p.y += dy / d * sp * dt;
      p.face = dx > 0 ? 1 : -1;
      p.tilt = Math.sin(globalT * 20) * 0.14;
      spawn({ x: p.x - p.face * 40, y: p.y + rand(-20, 10), vx: -p.face * 200, size: 9, max: 0.3, color: 'rgba(255,255,255,.6)', type: 'dash' });
      if (Math.random() < dt * 6) dustPuff(p.x, floorY, 2);
      if (p.stateT <= 0) { p.tilt = 0; setState('idle', 0); }
      break;
    }
    case 'dance': {
      p.offX = Math.sin(globalT * 9) * 26;
      if (Math.random() < dt * 2.5) {
        spawn({ x: p.x + p.offX + rand(-10, 10), y: p.y - R - 10, vx: rand(-20, 20), vy: rand(-60, -20), size: rand(7, 10), max: 1, color: pick(['#ffc94d', '#ff6f91', '#6cc9ff']), type: 'note' });
      }
      if (p.stateT <= 0) { p.offX = 0; p.fun = clamp(p.fun + 15, 0, 100); setState('idle', 0); }
      break;
    }
    case 'judge': {
      if (p.phase === 0) { p.phase = 1; setTimeout(() => showBubble(pick(EVENTS.find(e => e.id === 'judge').bubble)), 500); }
      if (p.stateT <= 0) setState('idle', 0);
      break;
    }

    case 'sneeze': {
      p.offX = Math.sin(globalT * 60) * 5;
      if (p.phase === 0 && p.stateT < 1.1) {
        p.phase = 1;
        for (let k = 0; k < 5; k++) {
          spawn({ x: p.x, y: p.y - 30, vx: rand(-160, 160), vy: rand(-260, -120), size: rand(12, 20), max: rand(0.6, 1), type: 'rainbow' });
        }
        showBubble('¡ACHÍS!');
        AudioSys.eventS();
      }
      if (p.stateT <= 0) { p.offX = 0; setState('idle', 0); }
      break;
    }
    case 'stare': {
      if (p.phase === 0) { p.phase = 1; setTimeout(() => showBubble(pick(['…', '… 👁', 'estoy procesando'])), 900); }
      if (p.stateT <= 0) setState('idle', 0);
      break;
    }
    case 'belly': {
      if (p.phase === 0) { p.phase = 1; setTimeout(() => showBubble('rasca la pancita'), 700); }
      if (p.stateT <= 0) setState('idle', 0);
      break;
    }
    case 'yawn': {
      if (p.phase === 0) { p.phase = 1; p.sy = 1.12; spawnZzz(3); }
      if (p.stateT <= 0) { p.sy = 1; p.energy = clamp(p.energy + 4, 0, 100); setState('idle', 0); }
      break;
    }
    case 'midair': {
      p.vy += 2200 * dt;
      p.y += p.vy * dt;
      if (Math.random() < dt * 2) spawnZzz(1);
      const ground = floorY - R * p.sy;
      if (p.y >= ground) {
        p.y = ground; p.vy = 0;
        p.energy = clamp(p.energy + 5, 0, 100);
        setState('sleep', 0);
        AudioSys.sleepS();
      }
      break;
    }
    case 'eat': {
      p.walkT += dt;
      if (Math.random() < dt * 7) {
        spawn({ x: p.x + rand(-6, 6), y: p.y - 20, vx: rand(-40, 40), vy: rand(-140, -90), grav: 500, size: rand(3, 5), max: 0.8, color: '#b07d4f', type: 'crumb' });
      }
      if (p.stateT <= 0) {
        bowl.active = false;
        if (p.faintSaved) { p.faintSaved = false; showToast('❤️‍🩹 ¡Rescatado a tiempo!'); }
        setState('idle', 0);
      }
      break;
    }
    case 'sleep': {
      if (Math.random() < dt * 1.6) spawnZzz(1);
      break;
    }
    case 'faint': {
      if (Math.random() < dt * 1.2) {
        spawn({ x: p.x + rand(-46, 46), y: p.y - rand(0, 60), vx: rand(-15, 15), vy: rand(-30, -10), size: rand(5, 9), max: 1.2, color: '#ffc94d', type: 'star' });
      }
      break;
    }
    case 'catch':
    case 'idle': break;
    case 'sit':
      if (p.stateT <= 0) setState('idle', 0);
      break;
  }
  if (p.stateT > 0) p.stateT -= dt;

  // ball physics
  if (ball.active && !ball.held) {
    ball.vy += 1900 * dt;
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (ball.x < 16) { ball.x = 16; ball.vx *= -0.8; }
    if (ball.x > W - 16) { ball.x = W - 16; ball.vx *= -0.8; }
    if (ball.y >= floorY - 14) {
      ball.y = floorY - 14;
      if (ball.vy > 40) { ball.vy *= -0.55; ball.sy = 0.6; }
      else ball.vy = 0;
      ball.vx *= 0.99;
    }
    ball.sy += (1 - ball.sy) * 10 * dt;
    const ballMoving = Math.abs(ball.vx) > 30 || Math.abs(ball.vy) > 30;
    if ((p.state === 'idle' || p.state === 'walk' || p.state === 'sit') && pet.energy > 10 && (ballMoving || ball.y >= floorY - 15)) {
      setState('chase', 0);
    }
  }

  // bowl timer
  if (bowl.active) bowl.t += dt;

  // bubbles
  for (let i = bubbles.length - 1; i >= 0; i--) {
    bubbles[i].ttl -= dt;
    if (bubbles[i].ttl <= 0) bubbles.splice(i, 1);
  }

  // random event
  eventT -= dt;
  if (eventT <= 0) {
    eventT = rand(24, 46);
    fireEvent();
  }

  // micro actions + vida autónoma (no se queda quieto en el medio)
  if (p.state === 'idle') idleT += dt;
  microT -= dt;
  if (microT <= 0) {
    microT = rand(4, 9);
    if ((p.state === 'idle' || p.state === 'walk' || p.state === 'sit') && p.state !== 'faint' && !shopOpen.v && !drag) {
      const r = Math.random();
      if (r < 0.3 && p.energy > 25 && idleT > 3) { wander(); idleT = 0; }
      else if (r < 0.42) { p.vy = -270; } // hop
      else if (r < 0.55 && p.fun < 40) showBubble(pick(['estoy aburrido…', '¿jugamos?', 'mira… una mosca']));
      else if (r < 0.68) showBubble(pick(['sniff sniff', '¿qué hacés?', 'este lugar me gusta']));
      else if (r < 0.84 && p.energy < 45 && p.state === 'idle') setState('sit', rand(2.5, 5));
    }
  }

  // save + day cycle refresh
  saveT -= dt;
  if (saveT <= 0) { saveT = 5; save(); refreshDayCycle(); }

  updateHUD();
}
function spawnZzz(n) {
  for (let i = 0; i < n; i++) {
    spawn({
      x: pet.x + rand(-10, 10), y: pet.y - R - rand(0, 20),
      vx: rand(8, 20), vy: rand(-46, -26), grav: -6,
      size: rand(14, 20), max: rand(1.2, 1.8), color: 'rgba(90,80,140,.55)', type: 'zzz'
    });
  }
}
function fireEvent() {
  const p = pet;
  if (shopOpen.v) return;
  if (p.state === 'sleep' || p.state === 'faint' || p.state === 'eat') return;
  if (!(p.state === 'idle' || p.state === 'walk' || p.state === 'sit')) return;
  if (p._giftPending) return;
  if (p.food < 25 || p.energy < 25) return;
  let ev = null;
  for (let i = 0; i < 12; i++) {
    const c = pick(EVENTS);
    if (c.id !== lastEvent) { ev = c; break; }
  }
  if (!ev) return;
  lastEvent = ev.id;
  setState(ev.id, ev.dur);
  showToast(ev.toast + '  ·  +3 🍪');
  addCoin(3, p.x, p.y - R * 1.4);
  AudioSys.eventS();
  if (ev.id === 'gift') {
    // walk to center first
    p.phase = 0;
    p.target = { x: W / 2, y: floorY - R };
    setState('walk', 0);
    p._giftPending = true;
  }
  if (ev.id === 'sneeze') p.phase = 0;
}
function wakeUp(automatic) {
  if (pet.state !== 'sleep') return;
  setState('idle', 0);
  if (automatic) {
    showToast('🌞 ' + pet.name + ' se despertó sola, toda estirada y feliz.');
    AudioSys.wakeS();
    burstHearts(4);
  } else {
    showToast('¡Buen día, ' + pet.name + '! ☀️');
    AudioSys.wakeS();
    burstHearts(5);
  }
  pet.happy = 1;
}

/* ================= actions ================= */
function doFeed() {
  const p = pet;
  if (p.state === 'sleep') { showBubble('ahora no… estoy soñando con croquetas'); return; }
  const wasFaint = p.state === 'faint';
  if (p.food > 92 && !wasFaint) {
    showBubble('ya comí mucho 😌'); return;
  }
  if (wasFaint) p.faintSaved = true;
  bowl.active = true; bowl.t = 0;
  bowl.x = clamp(p.x + p.face * 80, 60, W - 60); bowl.y = floorY;
  setState('eat', 3.1);
  AudioSys.munch();
  setTimeout(() => AudioSys.munch(), 500);
  setTimeout(() => AudioSys.munch(), 1000);
}
function doPlay() {
  const p = pet;
  if (p.state === 'sleep') { showBubble('zzz… mañana jugamos'); return; }
  if (p.state === 'faint') { showBubble('primero… comida…'); return; }
  if (p.energy < 12) { showBubble('estoy agotado… dejame dormir un poco'); return; }
  if (ball.active) return;
  ball.active = true;
  ball.x = p.x + p.face * 60; ball.y = floorY - 20;
  ball.vx = p.face * rand(120, 200); ball.vy = -rand(260, 340);
  ball.held = false; ball.catches = 0; ball.sy = 1;
  AudioSys.pop();
}
function doSleep() {
  const p = pet;
  if (p.state === 'sleep') { wakeUp(false); return; }
  if (p.energy > 92) { showBubble('no tengo sueño 😌'); return; }
  if (p.state === 'faint') { showBubble('no puedo dormir… me desmayé, es distinto'); return; }
  if (p.state === 'eat') return;
  setState('sleep', 0);
  showToast('🌙 Buenas noches, ' + p.name + '. Que sueñes con croquetas gigantes.');
  AudioSys.sleepS();
}
function petPet() {
  const p = pet;
  if (p.state === 'sleep') { wakeUp(false); return; }
  if (p.state === 'belly') {
    p.love = clamp(p.love + 25, 0, 100);
    p.happy = 1;
    burstHearts(12);
    addCoin(3, p.x, p.y - R * 1.5);
    showToast('🎉 ¡La pancita! Objetivo cumplido. ' + p.name + ' está en el cielo.');
    AudioSys.catchS();
    setState('happy', 1.4);
    return;
  }
  if (p.state === 'faint') { showBubble('…no es cariño lo que necesito. Es comida.'); return; }
  p.love = clamp(p.love + 10, 0, 100);
  p.happy = 1;
  burstHearts(5);
  AudioSys.pet();
  if (p.love > 96) {
    const now = Date.now();
    if (now - lastPetReward > 25000) { lastPetReward = now; addCoin(1, p.x, p.y - R * 1.5); }
  }
  if (p.state === 'idle' || p.state === 'walk' || p.state === 'sit') p.expr = 'happy';
}

/* ================= input ================= */
let drag = null;
canvas.addEventListener('pointerdown', e => {
  AudioSys.ensure();
  if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
  const x = e.clientX, y = e.clientY;
  if (ball.active && !ball.held && dist(ball.x, ball.y, x, y) < 34) {
    drag = { type: 'ball', x, y, moved: false };
    ball.held = true;
    return;
  }
  if (dist(pet.x, pet.y, x, y) < R * 1.6) {
    drag = { type: 'pet', x, y, moved: false };
    return;
  }
  drag = null;
  // click floor → walk there
  if ((pet.state === 'idle' || pet.state === 'walk' || pet.state === 'sit') && pet.state !== 'faint') {
    pet.target = { x: clamp(x, R, W - R), y: floorY - R };
    setState('walk', 0);
    AudioSys.pop();
  }
});
canvas.addEventListener('pointermove', e => {
  window._mx = e.clientX; window._my = e.clientY;
  if (!drag) return;
  const x = e.clientX, y = e.clientY;
  if (dist(drag.x, drag.y, x, y) > 9) drag.moved = true;
  drag.x = x; drag.y = y;
  if (drag.type === 'ball') {
    ball.x = x; ball.y = clamp(y, 20, floorY - 14); ball.vx = 0; ball.vy = 0;
  } else if (drag.type === 'pet') {
    pet.x = x;
    pet.y = clamp(y, R, floorY - R);
    pet.vx = 0; pet.vy = 0;
  }
});
canvas.addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag;
  drag = null;
  const x = e.clientX, y = e.clientY;
  if (d.type === 'pet') {
    if (d.moved) {
      pet.vx = clamp((x - d.x) * 9, -950, 950);
      pet.vy = clamp((y - d.y) * 9, -950, 950);
      pet.state = 'fly';
      AudioSys.boing();
    } else {
      petPet();
    }
  } else if (d.type === 'ball') {
    ball.held = false;
    ball.vx = clamp((x - d.x) * 9, -900, 900);
    ball.vy = clamp((y - d.y) * 9, -900, 900);
    if (!d.moved) { ball.vx = 0; ball.vy = -300; }
    if (pet.state === 'idle' || pet.state === 'walk') setState('chase', 0);
  }
});

/* ================= HUD ================= */
const bars = {
  food: document.getElementById('bar-food'),
  energy: document.getElementById('bar-energy'),
  fun: document.getElementById('bar-fun'),
  love: document.getElementById('bar-love'),
};
const barState = {};
function setBar(key, val) {
  const el = bars[key];
  const cls = val > 55 ? '' : val > 30 ? 'mid' : val > 12 ? 'low' : 'crit';
  const w = Math.round(val);
  if (barState[key] !== w + cls) {
    barState[key] = w + cls;
    el.style.width = w + '%';
    el.className = cls;
  }
}
function updateHUD() {
  setBar('food', pet.food);
  setBar('energy', pet.energy);
  setBar('fun', pet.fun);
  setBar('love', pet.love);
  const lbl = document.getElementById('sleep-label');
  const want = pet.state === 'sleep' ? 'Despertar' : 'Dormir';
  if (lbl.textContent !== want) lbl.textContent = want;
}

/* ================= intro ================= */
const $ = id => document.getElementById(id);
const intro = $('intro');
const nameInput = $('pet-name');
const nameplate = $('nameplate');
const hud = $('hud');
const muteBtn = $('btn-mute');

const saved = load();
if (saved) {
  intro.style.display = 'none';
  nameplate.classList.remove('hidden');
  hud.classList.remove('hidden');
  $('np-name').textContent = pet.name;
  $('np-day').textContent = 'día ' + day;
  refreshCoinChip();
  updateSceneButtons();
  // welcome back
  const minAway = (Date.now() - (JSON.parse(localStorage.getItem(SAVE_KEY) || '{}').ts || Date.now())) / 60000;
  setTimeout(() => {
    if (minAway > 30) {
      showToast(pick([
        '👋 ' + pet.name + ' te extrañó ' + (minAway > 480 ? 'TANTO que intentó adoptar una paloma. La paloma no quiso.' : 'un poquito. Contó las horas. Se quedó en tres.'),
        '¡Volviste! ' + pet.name + ' simuló que no te estaba esperando. Te estaba esperando.'
      ]));
    }
    showHint(0);
  }, 1200);
} else {
  pet.x = W / 2; pet.y = floorY - R;
}
function showHint(i) {
  if (localStorage.getItem('mascotita.hints')) return;
  const hints = [
    '🖐 Tocá a ' + pet.name + ' para darle cariño',
    '🍖 Cuando tenga hambre, dale de comer',
    '🎾 Arrastrala para lanzarla. Rebota. Le encanta.',
  ];
  if (i < hints.length) {
    setTimeout(() => { showToast(hints[i]); showHint(i + 1); }, i === 0 ? 5000 : 14000);
  } else localStorage.setItem('mascotita.hints', '1');
}
$('btn-dice').addEventListener('click', () => {
  AudioSys.pop();
  nameInput.value = pick(NAMES);
  nameInput.focus();
});
function adopt() {
  const name = (nameInput.value.trim() || pick(NAMES)).slice(0, 14);
  pet.name = name;
  pet.born = Date.now();
  day = 1;
  coins = 10; ownedItems = []; outfit.head = null; outfit.face = null; gameScene = 'room';
  save();
  refreshCoinChip();
  updateSceneButtons();
  localStorage.setItem('mascotita.hints', '');
  intro.classList.add('fade');
  setTimeout(() => { intro.style.display = 'none'; }, 560);
  nameplate.classList.remove('hidden');
  hud.classList.remove('hidden');
  $('np-name').textContent = pet.name;
  $('np-day').textContent = 'día ' + day;
  AudioSys.fanfare();
  confettiBurst(W / 2, H * 0.4, 60);
  setTimeout(() => showToast('🐾 ¡' + name + ' llegó a casa!'), 700);
  setTimeout(() => showHint(0), 4000);
}
$('btn-adopt').addEventListener('click', adopt);
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') adopt(); });

muteBtn.addEventListener('click', () => {
  AudioSys.muted = !AudioSys.muted;
  $('ico-on').style.display = AudioSys.muted ? 'none' : '';
  $('ico-off').style.display = AudioSys.muted ? '' : 'none';
  if (!AudioSys.muted) AudioSys.pop();
});
$('btn-feed').addEventListener('click', doFeed);
$('btn-ball').addEventListener('click', doPlay);
$('btn-sleep').addEventListener('click', doSleep);
$('btn-shop').addEventListener('click', () => shopOpen.v ? closeShop() : openShop());
const shopOverlay = document.getElementById('shop');
if (shopOverlay) {
  document.getElementById('btn-shop-close').addEventListener('click', closeShop);
  shopOverlay.addEventListener('click', e => { if (e.target === shopOverlay) closeShop(); });
}
document.querySelectorAll('[data-scene]').forEach(b => b.addEventListener('click', () => setScene(b.dataset.scene)));

/* ================= loop ================= */
pet.x = pet.x || W * 0.42;
pet.y = pet.y || floorY - R;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  updateParticles(dt);  // ¡fix crítico: las partículas ahora se mueven y expiran!
  // draw
  ctx.clearRect(0, 0, W, H);
  drawScene();
  drawBowl();
  drawBall();
  drawGift();
  drawPet();
  drawParticles();
  drawBubbles();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// persist on exit
window.addEventListener('beforeunload', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });