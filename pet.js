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
  { id: 'gorro',   slot: 'head', name: 'Gorro de lana',     price: 30, emoji: '🧶' },
  { id: 'antena',  slot: 'head', name: 'Antena alien',      price: 22, emoji: '📡' },
  { id: 'bigote',  slot: 'face', name: 'Bigote falso',      price: 18, emoji: '👨🏻' },
];

/* ================= lugares / amigos / minijuegos / logros ================= */
const HOME_SCENES = ['room', 'garden'];
const PLACE_INFO = {
  plaza: { emoji: '🏛️', name: 'La Plaza', desc: 'Fuente, palomas y cotilleo de barrio.' },
  bosque: { emoji: '🌲', name: 'El Bosque', desc: 'Hongos, luciérnagas y un búho sabio.' },
  playa: { emoji: '🏖️', name: 'La Playa', desc: 'Arena, olas y gaviotas con actitud.' },
};

// contadores de logros (persistidos)
const stats = { feed: 0, catch: 0, pet: 0, events: 0, friends: 0, games: 0, bestBub: 0, bestMemo: 0, coinsEarned: 0 };
let unlockedLogros = [];
let visitedScenes = ['room'];
let streak = 0, lastDaySeen = 0;

const LOGROS = [
  { id: 'l1', icon: '🍖', name: 'Primer bocado', desc: 'Alimentala 1 vez', cond: () => stats.feed >= 1, rew: 3 },
  { id: 'l2', icon: '🎾', name: 'Atrapadora', desc: 'Atrapa la pelota 10 veces', cond: () => stats.catch >= 10, rew: 6 },
  { id: 'l3', icon: '💖', name: 'Manos mágicas', desc: 'Acariciala 50 veces', cond: () => stats.pet >= 50, rew: 4 },
  { id: 'l4', icon: '🐱', name: 'Vida social', desc: 'Recibí la visita de un amigo', cond: () => stats.friends >= 1, rew: 6 },
  { id: 'l5', icon: '🕹️', name: 'Vicio sano', desc: 'Jugá un minijuego', cond: () => stats.games >= 1, rew: 3 },
  { id: 'l6', icon: '🍪', name: 'Colectora', desc: 'Acumulá 50 galletas', cond: () => stats.coinsEarned >= 50, rew: 8 },
  { id: 'l7', icon: '🧭', name: 'Exploradora', desc: 'Visitá 3 lugares distintos', cond: () => visitedScenes.length >= 3, rew: 8 },
  { id: 'l8', icon: '🔥', name: 'Racha', desc: 'Volvé 3 días seguidos', cond: () => streak >= 3, rew: 10 },
  { id: 'l9', icon: '🫧', name: 'Burbuja maestra', desc: '15 burbujas en un juego', cond: () => stats.bestBub >= 15, rew: 7 },
  { id: 'l10', icon: '🎵', name: 'Memoria de oro', desc: '6 rondas en Memorión', cond: () => stats.bestMemo >= 6, rew: 9 },
];

// amigo visitante
const friend = { active: false, kind: null, x: 0, y: 0, t: 0, dir: 1, phase: 'enter', playT: 0, cx: 0 };
let friendT = rand(40, 70);

// minijuegos
const bubbleGame = { on: false, t: 0, score: 0, spawnT: 0, arr: [] };
const memoGame = { on: false, seq: [], pos: 0, playing: false, lives: 3, round: 0, timer: null };

// etapas de crecimiento por día
const stageScale = () => (day <= 1 ? 0.92 : day <= 4 ? 1 : 1.12);
let stageNotified = null;

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
  { id: 'caja', dur: 5, toast: 'Se metió en una caja. Es su momento. No quiere salir.', bubble: ['estoy en mi caja. estoy en paz', 'no me saques, acá estoy cómoda'] },
  { id: 'cola', dur: 3.2, toast: 'Persiguió su propia cola. Perdió. Igual ganó.', bubble: ['casi la atrapo…', 'esa cola me tiene re podrida'] },
  { id: 'phone', dur: 4, toast: 'Le escribió a tu mamá: “no come verduras”. Tu mamá: “ya sé”.', bubble: ['le conté todo a tu mamá', 'te quiero, pero informo'] },
  { id: 'selfie', dur: 2.6, toast: 'Se sacó una selfie. Salió perfecta. No la vas a ver.', bubble: ['mirá qué linda salí', 'no se la muestro a nadie'] },
];
let lastEvent = null, eventT = rand(16, 26), microT = rand(4, 8);
const IDLE_LINES = [
  'sniff sniff', '¿qué hacés?', 'este lugar me gusta', 'hoy me siento esponjosa',
  'creo que vi un fantasma 👻', 'estoy pensando en croquetas', 'si me hablás te hago caso, pero después',
  'estoy aburrida… ¿jugamos?', 'mira… una mosca', 'esto del caos no se hace solo',
  'te quiero, pero no lo digas mucho', 'plan para hoy: nada, y a full',
];

/* ================= helpers ================= */
function setState(s, dur) {
  pet.state = s; pet.stateT = dur; pet.phase = 0;
  if (s !== 'walk') pet._giftPending = false;
  if (s === 'zoomies') { pet.zt = 0; pet.face = pick([-1, 1]); }
  if (s === 'sneeze') pet.face = 1;
  if (s === 'judge') pet.face = -1;
  if (s === 'dance') pet.face = 1;
  if (s === 'midair') pet.vy = -620;
  if (s === 'cola') { pet._cx = pet.x; pet._cy = pet.y; pet._ca = rand(0, TAU); }
  if (s === 'caja') { AudioSys.boing(); dustPuff(pet.x, pet.y + R, 4); }
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
  if (n > 0) stats.coinsEarned += n;
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
  const m = gameScene === 'room' ? 165 : 95;
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
  if (!SCENE_META[s]) s = 'room';
  if (s === gameScene) return;
  gameScene = s;
  particles.length = 0;
  bubbles.length = 0;
  friend.active = false;
  if (pet.state === 'caja' || pet.state === 'cola') setState('idle', 0);
  pet.x = clamp(pet.x, R + 40, W - R - 40);
  pet.target = null;
  if (pet.state === 'walk') setState('idle', 0);
  if (!visitedScenes.includes(s)) visitedScenes.push(s);
  showToast(SCENE_META[s].welcome);
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
      streak = (typeof s.str === 'number') ? s.str : 0;
      lastDaySeen = (typeof s.lst === 'number') ? s.lst : day;
      unlockedLogros = Array.isArray(s.unl) ? s.unl.filter(id => LOGROS.some(l => l.id === id)) : [];
      visitedScenes = (Array.isArray(s.vs) && s.vs.length) ? s.vs.filter(v => SCENE_META[v]) : ['room'];
      if (s.stt) { for (const k in s.stt) { if (k in stats && typeof s.stt[k] === 'number') stats[k] = s.stt[k]; } }
      stageNotified = stageName();
      gameScene = HOME_SCENES.includes(s.sc) ? s.sc : 'room';
      if (s._mig) save();
      return true;
    }
  } catch (e) {}
  return false;
}
function save() {
  if (resetFlag) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      n: pet.name, f: Math.round(pet.food), e: Math.round(pet.energy),
      u: Math.round(pet.fun), l: Math.round(pet.love), born: pet.born, ts: Date.now(),
      c: coins, ow: ownedItems, hd: outfit.head, fc: outfit.face, sc: gameScene,
      str: streak, lst: lastDaySeen, stt: stats, unl: unlockedLogros, vs: visitedScenes
    }));
  } catch (e) {}
}
let saveT = 5;
let resetFlag = false;

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
  else if (p.state === 'cola') p.expr = p.stateT < 0.5 ? 'dizzy' : 'happy';
  else if (p.state === 'caja' || p.state === 'phone' || p.state === 'selfie') p.expr = 'happy';
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
        ball.catches++; p.catches++; stats.catch++;
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
    case 'caja': {
      if (p.phase === 0) { p.phase = 1; setTimeout(() => showBubble(pick(EVENTS.find(e => e.id === 'caja').bubble)), 900); }
      if (p.stateT <= 0) { setState('idle', 0); }
      break;
    }
    case 'cola': {
      p._ca += dt * 11;
      p.x = clamp(p._cx + Math.cos(p._ca) * 34, R + 24, W - R - 24);
      p.y = floorY - R;
      p.face = Math.cos(p._ca) > 0 ? 1 : -1;
      if (Math.random() < dt * 8) {
        spawn({ x: p.x - p.face * 34, y: p.y + rand(-20, 10), vx: -p.face * 170, size: 7, max: 0.24, color: 'rgba(255,255,255,.5)', type: 'dash' });
      }
      if (p.stateT <= 0) { squash(1.22, 0.8); dustPuff(p.x, floorY, 6); setState('idle', 0); }
      break;
    }
    case 'phone': {
      if (p.phase === 0) { p.phase = 1; setTimeout(() => showBubble(pick(EVENTS.find(e => e.id === 'phone').bubble)), 800); }
      if (p.stateT <= 0) setState('idle', 0);
      break;
    }
    case 'selfie': {
      if (p.phase === 0) { p.phase = 1; flashOnce(); setTimeout(() => showBubble(pick(EVENTS.find(e => e.id === 'selfie').bubble)), 450); }
      if (p.stateT <= 0) setState('idle', 0);
      break;
    }
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

  // amigo visitante
  if (!friend.active && !gameBusy() && !petBusy()) {
    friendT -= dt;
    if (friendT <= 0) { friendT = rand(55, 95); tryVisitFriend(); }
  }
  if (friend.active) updateFriend(dt);

  // minijuegos activos
  if (bubbleGame.on) updateBubbleGame(dt);

  // logros / día / crecimiento (cada 1,2 s)
  logroT -= dt;
  if (logroT <= 0) { logroT = 1.2; checkDayAndLogros(); }

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
    if ((p.state === 'idle' || p.state === 'walk' || p.state === 'sit') && p.state !== 'faint' && !gameBusy() && !friend.active && !drag) {
      const r = Math.random();
      if (r < 0.3 && p.energy > 25 && idleT > 3) { wander(); idleT = 0; }
      else if (r < 0.42) { p.vy = -270; } // hop
      else if (r < 0.55 && p.fun < 40) showBubble(pick(['estoy aburrida…', '¿jugamos?', 'mira… una mosca']));
      else if (r < 0.68) showBubble(pick(IDLE_LINES));
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
  if (shopOpen.v || memoGame.on || bubbleGame.on || friend.active) return;
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
  stats.events++;
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

/* ================= amigos / minijuegos / paseo / logros ================= */
let logroT = 1.2;
const SCENE_META = {
  room: { name: 'Sala', welcome: '🏠 De vuelta en casa.' },
  garden: { name: 'Jardín', welcome: '🌳 Jardín: afuera también hay caos.' },
  plaza: Object.assign({}, PLACE_INFO.plaza, { welcome: '🏛️ Llegaron a la Plaza. Las palomas ya saben tu nombre.' }),
  bosque: Object.assign({}, PLACE_INFO.bosque, { welcome: '🌲 En el Bosque. Hay un búho que te mira. No te asustes.' }),
  playa: Object.assign({}, PLACE_INFO.playa, { welcome: '🏖️ En la Playa. La marea trae secretos. El cangrejo también.' }),
};
function gameBusy() { return bubbleGame.on || memoGame.on || shopOpen.v; }
function petBusy() { return pet.state === 'sleep' || pet.state === 'faint' || pet.state === 'eat'; }

// ---- amigos visitantes ----
function tryVisitFriend() {
  const p = pet;
  if (petBusy() || gameBusy() || friend.active || !p.name) return;
  const kinds = ['michi', 'pio'];
  if (gameScene === 'plaza') kinds.push('michi', 'michi', 'pio');
  friend.active = true;
  friend.kind = pick(kinds);
  friend.dir = Math.random() < 0.5 ? 1 : -1;
  friend.phase = 'enter';
  friend.x = friend.dir === 1 ? -80 : W + 80;
  friend.y = friend.kind === 'pio' ? floorY - R * 3.4 : floorY - R * 0.9;
  friend.t = 0; friend.playT = 0;
  const nm = friend.kind === 'michi' ? 'Michi' : 'Pío';
  showToast(friend.kind === 'michi' ? '🐱 ¡Michi vino a jugar con ' + p.name + '!' : '🐦 ¡Pío se coló a jugar!');
  AudioSys.eventS();
}
function updateFriend(dt) {
  const p = pet, f = friend;
  f.t += dt;
  if (f.phase === 'enter') {
    const targetX = p.x + (friend.dir === 1 ? -95 : 95);
    if (Math.abs(f.x - targetX) < 10) {
      f.phase = 'play'; f.playT = 0;
      if (friend.kind === 'pio') showBubble('hola hola hola');
      else showBubble('te traje caos. compartido.');
      p.happy = 1;
      if (!petBusy() && p.state === 'idle') setState('dance', 2.5);
    } else {
      f.x += (targetX - f.x) * 3.2 * dt;
    }
    return;
  }
  if (f.phase === 'play') {
    f.playT += dt;
    if (friend.kind === 'michi') {
      const off = Math.cos(f.t * 4.2) * 85;
      f.x = p.x + off;
      f.dir = Math.cos(f.t * 4.2 + 1) > 0 ? 1 : -1;
      if (Math.random() < dt * 0.8) { burstHearts(1); p.happy = 1; }
    } else {
      f.x = p.x + Math.sin(f.t * 3) * 75;
      f.y = floorY - R * 3.4 + Math.sin(f.t * 6) * 14;
    }
    if (f.playT > 7) f.phase = 'leave';
    return;
  }
  if (f.phase === 'leave') {
    const dirSign = friend.dir === 1 ? 1 : -1;
    f.x += dirSign * 260 * dt;
    if (f.x < -100 || f.x > W + 100) {
      friend.active = false;
      stats.friends++;
      p.fun = clamp(p.fun + 18, 0, 100);
      const bonus = friend.kind === 'michi' ? 5 : 3;
      addCoin(bonus, p.x, p.y - R * 1.4);
      confettiBurst(p.x, p.y - R, 12);
      showToast('💕 ¡Qué linda visita! +' + bonus + ' 🍪');
      if (p.state === 'dance' || p.state === 'happy') setState('idle', 0);
      save();
    }
  }
}
function drawFriend() {
  const f = friend;
  if (!f.active) return;
  ctx.save();
  if (f.kind === 'michi') {
    ctx.translate(f.x, f.y);
    ctx.scale(f.dir, 1);
    ctx.strokeStyle = '#9aa0b0'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-R * 0.4, -R * 0.1); ctx.quadraticCurveTo(-R * 1.15, -R * 0.3, -R * 0.95, -R * 0.95); ctx.stroke();
    ctx.fillStyle = '#b9becb'; ctx.strokeStyle = '#8d93a5'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.85, R * 0.8, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-R * 0.55, -R * 0.55); ctx.lineTo(-R * 0.7, -R * 1.15); ctx.lineTo(-R * 0.22, -R * 0.72); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R * 0.55, -R * 0.55); ctx.lineTo(R * 0.7, -R * 1.15); ctx.lineTo(R * 0.22, -R * 0.72); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffb3c1';
    ctx.beginPath(); ctx.arc(-R * 0.42, -R * 0.88, R * 0.08, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(R * 0.42, -R * 0.88, R * 0.08, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e3e6ee';
    ctx.beginPath(); ctx.ellipse(0, R * 0.35, R * 0.42, R * 0.36, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(R * 0.3, -R * 0.2, R * 0.14, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-R * 0.3, -R * 0.2, R * 0.14, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2c20';
    ctx.beginPath(); ctx.arc(R * 0.33, -R * 0.19, R * 0.065, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-R * 0.27, -R * 0.19, R * 0.065, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff9db0';
    ctx.beginPath(); ctx.moveTo(-4, -R * 0.04); ctx.lineTo(4, -R * 0.04); ctx.lineTo(0, R * 0.04); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8d93a5'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, R * 0.1, 6, 0.15, Math.PI - 0.15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-R * 0.08, 0); ctx.lineTo(-R * 0.5, -R * 0.08); ctx.moveTo(-R * 0.08, R * 0.08); ctx.lineTo(-R * 0.5, R * 0.12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R * 0.08, 0); ctx.lineTo(R * 0.5, -R * 0.08); ctx.moveTo(R * 0.08, R * 0.08); ctx.lineTo(R * 0.5, R * 0.12); ctx.stroke();
  } else {
    ctx.translate(f.x, f.y);
    ctx.scale(f.dir, 1);
    const flap = Math.sin(f.t * 13) * 0.55;
    ctx.save();
    ctx.rotate(-flap);
    ctx.fillStyle = '#9ecbff';
    ctx.beginPath(); ctx.ellipse(-R * 0.2, -R * 0.15, R * 0.48, R * 0.2, 0.3, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#7ec8f0'; ctx.strokeStyle = '#4f9fd6'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.4, R * 0.36, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9ecbff';
    ctx.beginPath(); ctx.ellipse(R * 0.25, R * 0.08, R * 0.28, R * 0.15, -0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff8f6b';
    ctx.beginPath(); ctx.arc(-R * 0.1, -R * 0.55, R * 0.13, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-R * 0.14, -R * 0.14, R * 0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(-R * 0.11, -R * 0.14, R * 0.05, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.moveTo(-R * 0.02, -R * 0.08); ctx.lineTo(R * 0.5, -R * 0.02); ctx.lineTo(-R * 0.02, R * 0.06); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ---- caja (evento) ----
function drawCajaBox() {
  if (pet.state !== 'caja') return;
  const x = pet.x, w = R * 2.5;
  const top = floorY - R * 1.02, bot = floorY + 28;
  ctx.save();
  ctx.fillStyle = '#d9a066';
  rr(x - w / 2, top, w, bot - top, 10); ctx.fill();
  ctx.strokeStyle = '#a96f3d'; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(x - w / 2 + 16, top + 12); ctx.lineTo(x + w / 2 - 16, top + 12); ctx.stroke();
  ctx.fillStyle = '#f6c48f';
  ctx.beginPath(); ctx.ellipse(x - 26, top - 3, 15, 9, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 26, top - 3, 15, 9, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- minijuego: burbujas ----
function startBubbles() {
  closeOverlay('juegos');
  bubbleGame.on = true; bubbleGame.t = 20; bubbleGame.score = 0; bubbleGame.spawnT = 0; bubbleGame.arr = [];
  stats.games++;
  pet.fun = clamp(pet.fun + 10, 0, 100);
  const bar = document.getElementById('gamebar');
  bar.classList.remove('hidden');
  AudioSys.eventS();
}
function updateBubbleGame(dt) {
  const g = bubbleGame;
  g.t -= dt;
  g.spawnT -= dt;
  if (g.spawnT <= 0 && g.arr.length < 14) { g.spawnT = 0.32; g.arr.push({ baseX: rand(70, W - 70), x: 0, y: floorY - 12, vy: rand(75, 120), r: rand(13, 26), ph: rand(0, TAU), wob: rand(0.6, 1.5) }); }
  for (let i = g.arr.length - 1; i >= 0; i--) {
    const b = g.arr[i];
    b.y -= b.vy * dt;
    b.ph += dt * 3.4 * b.wob;
    if (b.y < 34) { g.arr.splice(i, 1); }
  }
  const bar = document.getElementById('gamebar');
  if (bar) bar.innerHTML = '🫧 Burbujas · quedan <b>' + Math.max(0, Math.ceil(g.t)) + '</b>s · 🎯 <b>' + g.score + '</b>';
  if (g.arr.length && (pet.state === 'idle' || pet.state === 'walk')) {
    const b0 = g.arr[0];
    pet.look.x = clamp((b0.x - pet.x) / 250, -1, 1);
    pet.look.y = clamp((b0.y - pet.y) / 300, -1, 1);
  }
  if (g.t <= 0) endBubbles();
}
function popBubbleAt(x, y) {
  for (let i = bubbleGame.arr.length - 1; i >= 0; i--) {
    const b = bubbleGame.arr[i];
    if (dist(x, y, b.x, b.y) < b.r + 16) {
      bubbleGame.arr.splice(i, 1);
      bubbleGame.score++;
      AudioSys.pop();
      spawn({ x: b.x, y: b.y, vx: rand(-30, 30), vy: rand(-70, -30), size: 6, max: 0.5, color: 'rgba(160,210,255,.9)', type: 'sparkle' });
      pet.happy = 1;
      if (bubbleGame.score % 5 === 0) showBubble(pick(['¡plop!', '¡otra!', 'yo solo miro, no exploto nada']));
      return;
    }
  }
}
function endBubbles() {
  const g = bubbleGame;
  g.on = false; g.arr = [];
  if (g.score > stats.bestBub) stats.bestBub = g.score;
  const won = Math.min(20, 2 + Math.floor(g.score / 4));
  addCoin(won, pet.x, pet.y - R * 1.4);
  pet.fun = clamp(pet.fun + 15, 0, 100);
  confettiBurst(pet.x, pet.y - R, 14);
  showToast('🫧 ¡' + g.score + ' burbujas! Ganaste ' + won + ' 🍪');
  const bar = document.getElementById('gamebar');
  if (bar) bar.classList.add('hidden');
  save();
}
function drawBubbleGame() {
  if (!bubbleGame.on) return;
  for (const b of bubbleGame.arr) {
    b.x = b.baseX + Math.sin(b.ph) * 26;
    ctx.save();
    const gr = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.1, b.x, b.y, b.r);
    gr.addColorStop(0, 'rgba(255,255,255,.95)');
    gr.addColorStop(0.55, 'rgba(160,215,255,.55)');
    gr.addColorStop(1, 'rgba(90,170,240,.25)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

// ---- minijuego: memorión (simon) ----
const MEMO_TONES = [392, 523, 659, 784];
const MEMO_COLORS = ['#ff6f91', '#6cc9ff', '#8fd977', '#ffd166'];
function updateMemoGame() {}
function memoLight(i, on) {
  const pads = document.querySelectorAll('.pad');
  if (pads[i]) pads[i].classList.toggle('lit', !!on);
}
function playPad(i) {
  AudioSys.tone(MEMO_TONES[i], MEMO_TONES[i], 0.2, 'sine', 0.16);
  memoLight(i, true);
  setTimeout(() => memoLight(i, false), 230);
}
function memoStatus() {
  document.getElementById('memo-status').textContent = memoGame.playing ? '👀 Mirá y memorizá…' : '🎵 Repetí la secuencia';
  document.getElementById('memo-round').textContent = 'Ronda ' + memoGame.round + ' · ' + '❤️'.repeat(memoGame.lives) + '🖤'.repeat(3 - memoGame.lives);
}
function memoStepSeq(repeatRound) {
  memoGame.playing = true;
  memoGame.pos = 0;
  memoStatus();
  let i = 0;
  const step = () => {
    if (!memoGame.on) return;
    if (i < memoGame.seq.length) { playPad(memoGame.seq[i]); i++; setTimeout(step, 500); }
    else { memoGame.playing = false; memoStatus(); }
  };
  setTimeout(step, 650);
}
function startMemo() {
  closeOverlay('juegos');
  memoGame.on = true;
  memoGame.seq = [];
  memoGame.round = 0;
  memoGame.lives = 3;
  memoGame.playing = false;
  stats.games++;
  pet.fun = clamp(pet.fun + 10, 0, 100);
  memoGame.seq.push(Math.floor(Math.random() * 4));
  memoGame.round = 1;
  document.getElementById('memo').classList.add('show');
  memoStatus();
  memoStepSeq();
}
function padClick(i) {
  if (!memoGame.on || memoGame.playing) return;
  playPad(i);
  if (i === memoGame.seq[memoGame.pos]) {
    memoGame.pos++;
    if (memoGame.pos >= memoGame.seq.length) {
      pet.happy = 1;
      if (pet.state === 'idle' || pet.state === 'sit') setState('dance', 1.4);
      if (memoGame.round >= 8) { endMemo(true); return; }
      memoGame.round++;
      memoGame.seq.push(Math.floor(Math.random() * 4));
      memoStatus();
      memoStepSeq();
    }
  } else {
    memoGame.lives--;
    pet.expr = 'sad';
    AudioSys.faintS();
    memoStatus();
    if (memoGame.lives <= 0) { endMemo(false); return; }
    memoStepSeq();
  }
}
function endMemo(won) {
  memoGame.on = false;
  const round = memoGame.round;
  if (round > stats.bestMemo) stats.bestMemo = round;
  document.getElementById('memo').classList.remove('show');
  const wonCoins = Math.min(20, (won ? 10 : 4) + round);
  addCoin(wonCoins, pet.x, pet.y - R * 1.4);
  pet.fun = clamp(pet.fun + 15, 0, 100);
  confettiBurst(pet.x, pet.y - R, 14);
  showToast('🎵 Memorión: ronda ' + round + ' — +' + wonCoins + ' 🍪');
  save();
}

// ---- paseo: ir de paseo a un lugar ----
function goToPlace(p) {
  closeOverlay('paseo');
  setScene(p);
}

// ---- logros / día / crecimiento ----
function stageName() { return day <= 1 ? 'bebe' : day <= 4 ? 'joven' : 'grande'; }
function renderLogros() {
  const list = document.getElementById('logros-list');
  if (!list) return;
  list.innerHTML = '';
  for (const L of LOGROS) {
    const un = unlockedLogros.includes(L.id);
    const row = document.createElement('div');
    row.className = 'logro-row' + (un ? ' un' : '');
    row.innerHTML = '<span class="lg-ic">' + L.icon + '</span>' +
      '<div class="item-info"><div class="nm">' + L.name + '</div><div class="pr">' + L.desc + '</div></div>' +
      '<span class="lg-st">' + (un ? '✓ +' + L.rew : '🔒') + '</span>';
    list.appendChild(row);
  }
  const cnt = document.getElementById('logros-count');
  if (cnt) cnt.textContent = unlockedLogros.length + '/' + LOGROS.length;
}
function checkDayAndLogros() {
  // racha diaria
  if (lastDaySeen && day > lastDaySeen) {
    streak = (day === lastDaySeen + 1) ? streak + 1 : 1;
    if (streak > 1) {
      const bonus = Math.min(15, 4 + (streak - 1) * 2);
      addCoin(bonus, pet.x, pet.y - R * 1.6);
      showToast('🔥 ' + streak + ' días seguidos con ' + pet.name + '. +' + bonus + ' 🍪');
    }
  }
  lastDaySeen = day;
  const st = stageName();
  const msgs = {
    bebe: '🍼 ' + pet.name + ' es una bebé chiquita y perfecta.',
    joven: '✨ ' + pet.name + ' creció: ahora es joven.',
    grande: '🌟 ¡' + pet.name + ' ya es grande! Todo un caos de experiencia.'
  };
  if (stageNotified !== st) {
    stageNotified = st;
    if (day > 1) { showToast(msgs[st]); confettiBurst(pet.x, pet.y - R, 14); }
  }
  for (const L of LOGROS) {
    if (!unlockedLogros.includes(L.id) && L.cond()) {
      unlockedLogros.push(L.id);
      addCoin(L.rew, pet.x, pet.y - R * 1.6);
      confettiBurst(pet.x, pet.y - R, 16);
      showToast('🏆 ¡Logro: ' + L.icon + ' ' + L.name + '! +' + L.rew + ' 🍪');
    }
  }
}
function flashOnce() {
  const el = document.getElementById('flash');
  if (!el) return;
  el.classList.remove('go');
  void el.offsetWidth;
  el.classList.add('go');
}

// ---- overlays ----
function openOverlay(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (id === 'logros') renderLogros();
  el.classList.add('show');
  AudioSys.pop();
}
function closeOverlay(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('show');
  if (id === 'memo') memoGame.on = false;
  if (id === 'juegos') { const b = document.getElementById('gamebar'); if (b) b.classList.add('hidden'); }
}
function overlayBackdrop(id, ev) {
  if (ev.target.id === id) closeOverlay(id);
}

/* ================= actions ================= */
function doFeed() {
  const p = pet;
  if (gameBusy()) { showBubble('un segundito, estoy en algo'); return; }
  if (p.state === 'caja') { showBubble('estoy en mi caja. no se come en la caja.'); return; }
  if (p.state === 'sleep') { showBubble('ahora no… estoy soñando con croquetas'); return; }
  const wasFaint = p.state === 'faint';
  if (p.food > 92 && !wasFaint) {
    showBubble('ya comí mucho 😌'); return;
  }
  if (wasFaint) p.faintSaved = true;
  stats.feed++;
  bowl.active = true; bowl.t = 0;
  bowl.x = clamp(p.x + p.face * 80, 60, W - 60); bowl.y = floorY;
  setState('eat', 3.1);
  AudioSys.munch();
  setTimeout(() => AudioSys.munch(), 500);
  setTimeout(() => AudioSys.munch(), 1000);
}
function doPlay() {
  const p = pet;
  if (gameBusy()) { showBubble('ahora no, estoy en otra cosa'); return; }
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
  if (gameBusy()) return;
  if (p.state === 'caja') { showBubble('dormir en la caja es la única vida que conozco'); setState('sleep', 0); return; }
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
  if (gameBusy()) return;
  if (p.state === 'sleep') { wakeUp(false); return; }
  if (p.state === 'belly') {
    p.love = clamp(p.love + 25, 0, 100);
    p.happy = 1;
    stats.pet++;
    burstHearts(12);
    addCoin(3, p.x, p.y - R * 1.5);
    showToast('🎉 ¡La pancita! Objetivo cumplido. ' + p.name + ' está en el cielo.');
    AudioSys.catchS();
    setState('happy', 1.4);
    return;
  }
  if (p.state === 'faint') { showBubble('…no es cariño lo que necesito. Es comida.'); return; }
  if (p.state === 'caja') { showBubble('acá no se llega. es mi fortaleza.'); return; }
  p.love = clamp(p.love + 10, 0, 100);
  stats.pet++;
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
  if (bubbleGame.on) { popBubbleAt(e.clientX, e.clientY); return; }
  if (memoGame.on || shopOpen.v) return;
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
  $('btn-menu').classList.remove('hidden');
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
  $('btn-menu').classList.remove('hidden');
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
document.querySelectorAll('[data-scene]').forEach(b => b.addEventListener('click', () => setScene(b.dataset.scene)));
// overlays (paseo, juegos, logros, memo, shop) y sus tarjetas
const btnPaseo = document.getElementById('btn-paseo');
const btnGames = document.getElementById('btn-games');
const btnLogros = document.getElementById('btn-logros');
if (btnPaseo) btnPaseo.addEventListener('click', () => openOverlay('paseo'));
if (btnGames) btnGames.addEventListener('click', () => openOverlay('juegos'));
if (btnLogros) btnLogros.addEventListener('click', () => openOverlay('logros'));
const btnShare = document.getElementById('btn-share');
if (btnShare) btnShare.addEventListener('click', async () => {
  const url = 'https://rodri2102.github.io/mascotita/';
  const text = '🐾 ¡Adopté a ' + pet.name + ' en Mascotita! Adoptá la tuya y criá un caos adorable 😄';
  const has = !!pet.name;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Mascotita', text, url });
      return;
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try {
    await navigator.clipboard.writeText(url);
    showToast(has ? '📋 ¡Link copiado! Mandalo por WhatsApp 📲' : '📋 ¡Link copiado! Compartilo con tus amigos');
  } catch (e) {
    showToast('📤 Compartí el juego: ' + url);
  }
});
document.querySelectorAll('[data-place]').forEach(b => b.addEventListener('click', () => goToPlace(b.dataset.place)));
document.querySelectorAll('[data-game]').forEach(b => b.addEventListener('click', () => { if (b.dataset.game === 'burbujas') startBubbles(); else startMemo(); }));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeOverlay(b.dataset.close)));
['shop', 'paseo', 'juegos', 'logros', 'memo', 'menu'].forEach(id => {
  const ov = document.getElementById(id);
  if (ov) ov.addEventListener('click', ev => overlayBackdrop(id, ev));
});

// ---- menú: nueva mascota / reiniciar ----
const btnMenu = $('btn-menu');
if (btnMenu) btnMenu.addEventListener('click', () => openOverlay('menu'));
function renderMenuMeta() {
  const meta = document.getElementById('menu-meta');
  if (meta) meta.textContent = (pet.name || '—') + ' · día ' + day + ' · 🍪 ' + coins;
  const sub = document.getElementById('mn-new-sub');
  if (sub) sub.textContent = 'Despedite de ' + pet.name + ' y adoptá otra desde el día 1.';
}
// enganchamos renderMenuMeta dentro de openOverlay sin tocarla:
const _openOverlay = openOverlay;
openOverlay = function (id) {
  if (id === 'menu') renderMenuMeta();
  _openOverlay(id);
};
function setupArmed(id, fire) {
  const b = document.getElementById(id);
  if (!b) return;
  const title = b.querySelector('b');
  const sub = b.querySelector('small');
  const old = { t: title.textContent, s: sub.textContent };
  b.addEventListener('click', () => {
    if (b._armed) {
      clearTimeout(b._t);
      b._armed = false; b.classList.remove('armed');
      title.textContent = old.t; sub.textContent = old.s;
      fire();
    } else {
      b._armed = true; b.classList.add('armed');
      title.textContent = '¿Seguro? ¡Tocá de nuevo!';
      sub.textContent = b.id === 'mn-reset' ? 'Se borra TODO: galletas, logros, días y accesorios.' : 'Se pierde todo el progreso actual de ' + pet.name + '.';
      AudioSys.faintS();
      b._t = setTimeout(() => {
        b._armed = false; b.classList.remove('armed');
        title.textContent = old.t; sub.textContent = old.s;
      }, 6000);
    }
  });
}
function resetGame(msg) {
  resetFlag = true;
  closeOverlay('menu');
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem('mascotita.v1');
    localStorage.removeItem('mascotita.hints');
  } catch (e) {}
  showToast(msg);
  setTimeout(() => location.reload(), 1100);
}
setupArmed('mn-new', () => resetGame('🐾 ' + pet.name + ' se despidió con un baile final. ¡Adoptá otra!'));
setupArmed('mn-reset', () => resetGame('🗑️ Todo borrado. Empezamos de cero.'));
document.querySelectorAll('.pad').forEach((el, i) => el.addEventListener('click', () => padClick(i)));

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
  drawCajaBox();
  drawFriend();
  drawBubbleGame();
  drawParticles();
  drawBubbles();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// persist on exit
window.addEventListener('beforeunload', () => { if (!resetFlag) save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && !resetFlag) save(); });