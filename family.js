'use strict';
/* ============================================================
   Mascotita · Familia & Arcade extra  (v3)
   - Adoptá hasta 2 hermanos + 1 pareja: viven en la escena,
     pasean, juegan con tu mascota y tienen momentos juntos.
   - Minijuegos nuevos: Topos 🐹 y Peces voladores 🐟.
   Todo se dibuja en canvas, con el mismo estilo de la mascota.
   ============================================================ */

/* ---------------- especies adoptables ---------------- */
const SPECIES = {
  perro:  { emoji: '🐶', label: 'Perrito',  price: 25, g1: '#f4cda6', g2: '#daa068', ln: '#b07d4f', be: '#fff1de', ears: 'floppy', tail: 'wag',  nose: 'round', nm: ['Tobi', 'Rocky', 'Chispa', 'Canela', 'Bodoque'] },
  michi:  { emoji: '🐱', label: 'Gatito',   price: 30, g1: '#d6ccea', g2: '#ac9ad7', ln: '#8a78c1', be: '#f2ecfc', ears: 'point', tail: 'curl', nose: 'cat',   nm: ['Luna', 'Bigotes', 'Moka', 'Chispita', 'Garfielda'] },
  conejo: { emoji: '🐰', label: 'Conejín',  price: 20, g1: '#f5dbe7', g2: '#dca8c9', ln: '#bd8fae', be: '#fdf1f6', ears: 'long',  tail: 'puff', nose: 'bunny', nm: ['Tambor', 'Copito', 'Nube', 'Zanahoria'] },
  pato:   { emoji: '🦆', label: 'Patito',   price: 18, g1: '#ffe189', g2: '#f6c945', ln: '#d6a63b', be: '#fff4cc', ears: 'tuft',  tail: 'duck', nose: 'beak',  nm: ['Cuak', 'Pomelo', 'Chirrido', 'Alitas'] },
  dino:   { emoji: '🦖', label: 'Dino',     price: 28, g1: '#bbe8c1', g2: '#81d095', ln: '#60ad76', be: '#eaf9e7', ears: 'plate', tail: 'spike', nose: 'snout', nm: ['Rex', 'Ñam', 'Feroz', 'Triceratito'] },
};
const PAREJA_NAMES = ['Corazón', 'Amorcito', 'Media naranja', 'Estrellita', 'Coco'];
const MAX_SIB = 2;
const COMP_SCALE = 0.6; // radio relativo al R de la mascota

const family = [];       // miembros vivos: {id, sp, role, nm, ...runtime}
const arcade = { on: false, kind: null, t: 0, score: 0, arr: [], spawnT: 0 };

let famSocT = rand(35, 60);   // cooldown: jugar entre hermanos
let famLoveT = rand(45, 80);  // cooldown: momento pareja

/* ---------------- persistencia (usa window.__fam) ---------------- */
function syncFam() {
  window.__fam = family.map(c => ({ id: c.id, sp: c.sp, role: c.role, nm: c.nm }));
}
function makeComp(m) {
  const sp = SPECIES[m.sp];
  const c = {
    id: (m && m.id) || ('f' + Date.now() + Math.floor(Math.random() * 999)),
    sp: m.sp, role: m.role || 'hermano',
    nm: (m && m.nm) || pick(sp.nm),
    x: rand(140, W - 140), dir: Math.random() < 0.5 ? 1 : -1,
    t: rand(0, 9), walkT: 0, blinkT: rand(1, 4.5), blink: 0,
    mood: 'walk', targetX: null, restT: rand(1, 3), playT: 0,
    sx: 1, sy: 1, bounce: 0,
  };
  return c;
}
function famInit() {
  const raw = Array.isArray(window.__fam) ? window.__fam : [];
  for (const m of raw) {
    if (!m || !SPECIES[m.sp]) continue;
    if (m.role !== 'hermano' && m.role !== 'pareja') continue;
    family.push(makeComp(m));
  }
  syncFam();
}
function releaseComp(c) {
  const i = family.indexOf(c);
  if (i >= 0) family.splice(i, 1);
  syncFam();
  save();
}

/* ---------------- helpers ---------------- */
function compCenterY() { return floorY - R * COMP_SCALE * 1.05; }
function esc(s) { return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
function compHearts(c, n) {
  const cy = compCenterY();
  for (let i = 0; i < n; i++) {
    spawn({
      x: c.x + rand(-18, 18), y: cy - R * 0.4 - rand(0, 20),
      vx: rand(-35, 35), vy: rand(-120, -60), grav: 40,
      size: rand(6, 11), max: rand(0.9, 1.5), color: pick(['#ff6f91', '#ff9e7d', '#ffc94d']), type: 'heart'
    });
  }
}
function moveToward(c, tx, dt, speed) {
  const dx = tx - c.x;
  if (Math.abs(dx) < 8) { c.x = tx; c.mood = 'rest'; c.restT = rand(1.5, 4); return true; }
  c.dir = dx > 0 ? 1 : -1;
  c.x += dx / Math.abs(dx) * speed * dt;
  c.walkT += dt;
  c.mood = 'walk';
  return false;
}
function pickTargetX(c) {
  // evita pisar a la mascota ni a otros miembros
  let x = rand(130, Math.max(131, W - 130));
  for (let k = 0; k < 6; k++) {
    if (Math.abs(x - pet.x) < 120) x = x < pet.x ? rand(130, pet.x - 60) : rand(pet.x + 60, Math.max(pet.x + 61, W - 130));
    let clash = false;
    for (const o of family) {
      if (o !== c && Math.abs(o.x - x) < 70) { clash = true; break; }
    }
    if (!clash) break;
    x = rand(130, Math.max(131, W - 130));
  }
  return clamp(x, 130, Math.max(131, W - 130));
}
function wanderComp(c, dt) {
  if (c.mood === 'rest' || c.mood === 'sit') {
    c.restT -= dt;
    if (c.restT <= 0) { c.targetX = pickTargetX(c); c.mood = 'walk'; }
    return;
  }
  if (c.mood === 'walk' && c.targetX != null) {
    if (moveToward(c, c.targetX, dt, 105)) { c.restT = rand(1.5, 4); }
  } else {
    c.targetX = pickTargetX(c);
  }
}

/* ---------------- update por miembro ---------------- */
function famOne(c, dt) {
  const cy = compCenterY();
  const asleep = pet.state === 'sleep' || pet.state === 'faint';
  c.t += dt;
  c.blinkT -= dt;
  if (c.blinkT <= 0) { c.blink = 0.13; c.blinkT = rand(2.2, 5.5); }
  c.blink = Math.max(0, c.blink - dt);
  c.sx += (1 - c.sx) * 8 * dt;
  c.sy += (1 - c.sy) * 8 * dt;

  // momento especial (jugar con la mascota / abrazo de pareja)
  if (c.playT > 0) {
    c.playT -= dt;
    c.mood = 'play';
    const orbit = c.role === 'pareja';
    if (orbit) {
      // se arrima y se queda pegadito
      const tx = pet.x + (c.id % 2 ? 1 : -1) * 62;
      moveToward(c, tx, dt, 90);
      c.mood = 'sit';
      if (Math.random() < dt * 7) { compHearts(c, 1); if (Math.random() < 0.5) pet.happy = 1; }
      if (Math.random() < dt * 2) { c.sx = 1.14; c.sy = 0.88; }
      if (c.playT <= 0) { c.restT = 2; }
    } else {
      c.x = pet.x + Math.cos(c.t * 5.4) * 96;
      c.dir = Math.sin(c.t * 5.4) < 0 ? 1 : -1;
      c.y = cy;
      if (Math.random() < dt * 6) dustPuff(c.x, floorY, 1);
      if (Math.random() < dt * 3) { spawn({ x: c.x + rand(-12, 12), y: cy - R * 0.5, vx: rand(-15, 15), vy: rand(-50, -20), size: rand(6, 9), max: 0.8, color: pick(['#ffc94d', '#ff6f91', '#6cc9ff']), type: 'note' }); }
      if (c.playT <= 0) { c.restT = 2; }
    }
    return;
  }

  if (asleep) {
    // todos duermen cerca de la mascota (cada uno en su lado)
    const idx = family.indexOf(c);
    const side = (idx % 2 === 0) ? 1 : -1;
    const off = c.role === 'pareja' ? 70 : rand(120, 175);
    const tx = clamp(pet.x + side * off, 130, Math.max(131, W - 130));
    if (!moveToward(c, tx, dt, 55)) return;
    c.mood = 'sit';
    if (Math.random() < dt * 1.6) {
      spawn({ x: c.x + rand(-8, 8), y: cy - R * 0.7, vx: rand(4, 10), vy: rand(-22, -12), grav: -3, size: rand(8, 12), max: rand(1, 1.6), color: 'rgba(90,80,140,.5)', type: 'zzz' });
    }
    return;
  }

  if (c.role === 'pareja') {
    // la pareja suele estar cerca del amor de su vida
    const distP = Math.abs(c.x - pet.x);
    if (!petBusy() && distP > 150 && distP < 700 && Math.random() < dt * 1.2) {
      c.targetX = clamp(pet.x + (Math.random() < 0.5 ? 1 : -1) * rand(105, 150), 130, Math.max(131, W - 130));
      c.mood = 'walk';
    }
    if (distP < 130 && Math.random() < dt * 2.2) compHearts(c, 1);
  }
  wanderComp(c, dt);
}

/* ---------------- momentos sociales (hermanos / pareja) ---------------- */
function famMoments(dt) {
  if (!pet.name || petBusy() || gameBusy() || friend.active || drag) return;

  // hermanos: jugar juntos
  famSocT -= dt;
  if (famSocT <= 0) {
    famSocT = rand(70, 120);
    const sibs = family.filter(x => x.role === 'hermano');
    if (sibs.length && (pet.state === 'idle' || pet.state === 'walk' || pet.state === 'sit')) {
      const sib = pick(sibs);
      if (Math.abs(sib.x - pet.x) < 320) {
        sib.playT = 3.6; sib.targetX = null; sib.restT = 0;
        if (pet.energy > 15) setState('dance', 3.2);
        pet.fun = clamp(pet.fun + 12, 0, 100);
        pet.happy = 1;
        burstHearts(7);
        confettiBurst(pet.x, pet.y - R, 10);
        if (Math.random() < 0.6) addCoin(2, pet.x, pet.y - R * 1.5);
        showToast(pick([
          '🎉 ' + pet.name + ' y ' + sib.nm + ' corrieron 30 vueltas. Nadie sabe por qué.',
          '🤸 ' + sib.nm + ' y ' + pet.name + ' hicieron un baile sincronizado. Impecable.',
          '🐾 ¡' + pet.name + ' y ' + sib.nm + ' se persiguieron hasta marearse!'
        ]));
        AudioSys.catchS();
        save();
      }
    }
  }

  // pareja: momento romántico
  const pareja = family.find(x => x.role === 'pareja');
  if (pareja) {
    famLoveT -= dt;
    if (famLoveT <= 0) {
      famLoveT = rand(90, 150);
      if ((pet.state === 'idle' || pet.state === 'walk' || pet.state === 'sit' || pet.state === 'happy') && Math.abs(pareja.x - pet.x) < 280) {
        pareja.playT = 4.4; pareja.targetX = null; pareja.restT = 0;
        setState('happy', 3);
        pet.love = clamp(pet.love + 6, 0, 100);
        pet.happy = 1;
        compHearts(pareja, 8);
        burstHearts(5);
        showToast(pick([
          '💞 ' + pet.name + ' y ' + pareja.nm + ' se quedaron mirándose. Hay música, seguro.',
          '💘 ' + pareja.nm + ' le trajo a ' + pet.name + ' una flor. La comió. Igual es amor.',
          '🥰 Momento romántico: ' + pareja.nm + ' y ' + pet.name + ' en su propio mundo.'
        ]));
        AudioSys.eventS();
        save();
      }
    }
  }
}

/* ---------------- dibujo de un miembro ---------------- */
function compRound(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}
function drawCompEyes(c, ex, ey, u, happy) {
  const open = c.blink > 0 ? 0.12 : 1;
  if (happy || c.playT > 0) {
    ctx.strokeStyle = '#4a2c17'; ctx.lineWidth = u * 0.14; ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.arc(ex + s * u * 0.3, ey + u * 0.16, u * 0.16, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    }
    return;
  }
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(ex + s * u * 0.3, ey, u * 0.17, u * 0.21 * open, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4a2c17';
    ctx.beginPath(); ctx.arc(ex + s * u * 0.3, ey + u * 0.02, u * 0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex + s * u * 0.3 - u * 0.04, ey - u * 0.05, u * 0.035, 0, TAU); ctx.fill();
  }
}
function drawCompEar(c, u, ear) {
  const sp = SPECIES[c.sp];
  ctx.save();
  if (ear === 'point') {
    ctx.fillStyle = sp.g2; ctx.strokeStyle = sp.ln; ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * u * 0.55, -u * 0.55);
      ctx.lineTo(s * u * 0.85, -u * 1.45);
      ctx.lineTo(s * u * 0.16, -u * 0.85);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffb3c1';
      ctx.beginPath();
      ctx.moveTo(s * u * 0.52, -u * 0.66);
      ctx.lineTo(s * u * 0.7, -u * 1.18);
      ctx.lineTo(s * u * 0.32, -u * 0.84);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = sp.g2;
    }
  } else if (ear === 'floppy') {
    ctx.fillStyle = sp.g2; ctx.strokeStyle = sp.ln; ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * u * 0.62, -u * 0.66);
      ctx.rotate(s * 0.45);
      ctx.beginPath(); ctx.ellipse(0, u * 0.32, u * 0.24, u * 0.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  } else if (ear === 'long') {
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * u * 0.3, -u * 0.8);
      ctx.rotate(s * 0.14);
      ctx.fillStyle = sp.g2; ctx.strokeStyle = sp.ln; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -u * 0.45, u * 0.19, u * 0.85, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffc0cf';
      ctx.beginPath(); ctx.ellipse(0, -u * 0.35, u * 0.1, u * 0.5, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  } else if (ear === 'plate') {
    ctx.fillStyle = '#58b06f'; ctx.strokeStyle = '#3f8a55'; ctx.lineWidth = 1.6;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(k * u * 0.2, -u * 0.72);
      ctx.lineTo(k * u * 0.2 + u * 0.13, -u * 1.12);
      ctx.lineTo(k * u * 0.2 + u * 0.26, -u * 0.7);
      ctx.closePath(); ctx.fill();
    }
  } else if (ear === 'tuft') {
    ctx.fillStyle = '#f0b64a';
    ctx.beginPath(); ctx.arc(0, -u * 0.95, u * 0.13, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function drawCompTail(c, u) {
  const sp = SPECIES[c.sp];
  const wag = (c.mood === 'walk' || c.playT > 0) ? Math.sin(c.t * 9) * 0.5 : Math.sin(c.t * 2.5) * 0.2;
  ctx.save();
  ctx.translate(-u * 1.02, u * 0.12);
  if (sp.tail === 'wag') {
    ctx.rotate(-0.5 + wag);
    ctx.fillStyle = sp.g2; ctx.strokeStyle = sp.ln; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, u * 0.16, 0, TAU); ctx.fill(); ctx.stroke();
  } else if (sp.tail === 'curl') {
    ctx.rotate(-0.7);
    ctx.strokeStyle = sp.g2; ctx.lineWidth = u * 0.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, -u * 0.55, u * 0.32, 0.4, 2.6); ctx.stroke();
  } else if (sp.tail === 'puff') {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, -u * 0.1, u * 0.18, 0, TAU); ctx.fill();
  } else if (sp.tail === 'duck') {
    ctx.fillStyle = '#f0b64a';
    ctx.beginPath(); ctx.arc(-u * 0.1, u * 0.05, u * 0.09, 0, TAU); ctx.fill();
  } else if (sp.tail === 'spike') {
    ctx.fillStyle = '#58b06f'; ctx.strokeStyle = '#3f8a55'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-u * 0.45, -u * 0.05);
    ctx.lineTo(-u * 0.1, u * 0.28);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function drawCompFace(c, u) {
  const sp = SPECIES[c.sp];
  const n = sp.nose;
  if (n === 'beak') {
    ctx.fillStyle = '#ff9040'; ctx.strokeStyle = '#e07020'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -u * 0.02);
    ctx.lineTo(u * 0.42, u * 0.16);
    ctx.lineTo(0, u * 0.3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (n === 'snout') {
    ctx.fillStyle = '#c9f2c2';
    ctx.beginPath(); ctx.ellipse(0, u * 0.34, u * 0.26, u * 0.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3f8a55';
    ctx.beginPath(); ctx.ellipse(0, u * 0.3, u * 0.1, u * 0.08, 0, 0, TAU); ctx.fill();
  } else {
    if (n === 'cat' || n === 'bunny') {
      ctx.fillStyle = '#ff8fb1';
      ctx.beginPath();
      ctx.moveTo(-u * 0.09, u * 0.08);
      ctx.lineTo(u * 0.09, u * 0.08);
      ctx.lineTo(0, u * 0.24);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = '#6b4326';
      ctx.beginPath(); ctx.ellipse(0, u * 0.12, u * 0.11, u * 0.09, 0, 0, TAU); ctx.fill();
    }
  }
  // boca
  ctx.strokeStyle = '#7a3d2a'; ctx.lineWidth = Math.max(1.6, u * 0.08); ctx.lineCap = 'round';
  if (c.playT > 0 || c.mood === 'play') {
    ctx.beginPath(); ctx.arc(0, u * 0.2, u * 0.13, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-u * 0.1, u * 0.34); ctx.quadraticCurveTo(0, u * 0.44, u * 0.1, u * 0.34); ctx.stroke();
  }
}
function drawComp(c) {
  if (!c || !SPECIES[c.sp]) return;
  const sp = SPECIES[c.sp];
  const u = R * COMP_SCALE;
  const cy = compCenterY();
  const t = globalT;

  // sombra
  const bobAmt = (c.mood === 'walk' || c.playT > 0) ? Math.sin(c.t * 9) * 3 : Math.sin(c.t * 2.4 + c.id * 2) * 1.8;
  const sh = 1 - Math.abs(bobAmt) / 90;
  ctx.save();
  ctx.globalAlpha = 0.13 * sh;
  ctx.fillStyle = '#5b3a1e';
  ctx.beginPath(); ctx.ellipse(c.x, floorY + 8, u * 0.9, u * 0.2 * sh, 0, 0, TAU); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(c.x, cy + bobAmt);
  ctx.scale(c.dir, 1);
  const sit = c.mood === 'sit';
  if (sit) ctx.scale(1.1, 0.86);
  ctx.scale(c.sx, c.sy);
  ctx.translate(0, sit ? u * 0.14 : 0);

  // patitas
  const wf = (c.mood === 'walk') ? Math.sin(c.walkT * 10) * 2.5 : 0;
  ctx.fillStyle = sp.g2; ctx.strokeStyle = sp.ln; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(-u * 0.36 + wf, u * 0.9, u * 0.3, u * 0.2, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(u * 0.36 - wf, u * 0.9, u * 0.3, u * 0.2, 0, 0, TAU); ctx.fill(); ctx.stroke();

  // orejas y cola (detrás del cuerpo)
  drawCompEar(c, u, sp.ears);
  drawCompTail(c, u);

  // cuerpo
  const g = ctx.createRadialGradient(-u * 0.3, -u * 0.4, u * 0.12, 0, 0, u * 1.05);
  g.addColorStop(0, sp.g1); g.addColorStop(0.6, sp.g1); g.addColorStop(1, sp.g2);
  ctx.fillStyle = g; ctx.strokeStyle = sp.ln; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.ellipse(0, 0, u * 1.0, u * 0.95, 0, 0, TAU); ctx.fill(); ctx.stroke();

  // panza
  ctx.fillStyle = sp.be;
  ctx.beginPath(); ctx.ellipse(0, u * 0.42, u * 0.52, u * 0.34, 0, 0, TAU); ctx.fill();

  // cachetes
  ctx.fillStyle = 'rgba(255,150,140,.5)';
  ctx.beginPath(); ctx.ellipse(-u * 0.58, u * 0.1, u * 0.13, u * 0.09, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(u * 0.58, u * 0.1, u * 0.13, u * 0.09, 0, 0, TAU); ctx.fill();

  // ojos + cara
  const eyeY = c.playT > 0 ? -u * 0.05 : -u * 0.22;
  drawCompEyes(c, 0, eyeY, u, c.playT > 0 || c.mood === 'play');
  drawCompFace(c, u);
  ctx.restore();

  // insignia de pareja
  if (c.role === 'pareja') {
    ctx.save();
    const hy = cy - u * 1.75 + Math.sin(t * 3) * 3;
    heartPath(c.x, hy, u * 0.34);
    ctx.fillStyle = 'rgba(255,111,145,.92)';
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
}
function drawFamilyFrame() {
  for (const c of family) drawComp(c);
}

/* ---------------- tocar a un miembro ---------------- */
function pokeComp(c) {
  c.sx = 1.16; c.sy = 0.86;
  compHearts(c, 5);
  AudioSys.pet();
  if (Math.random() < 0.25) addCoin(1, c.x, compCenterY() - R * 0.5);
  if (c.role === 'hermano') {
    spawn({ type: 'text', txt: '¡' + c.nm + '!', x: c.x, y: compCenterY() - R * 1.4, vx: 0, vy: -50, size: 14, max: 1.2, color: '#8a78c1' });
  } else {
    spawn({ type: 'text', txt: 'mi amor 💘', x: c.x, y: compCenterY() - R * 1.6, vx: 0, vy: -50, size: 14, max: 1.2, color: '#e0527a' });
  }
}

/* ================= overlay Familia ================= */
function famOpen() {
  if (!pet.name) return;
  renderFamilia();
  const el = document.getElementById('familia');
  el.classList.add('show');
  AudioSys.pop();
}
function famClose() {
  document.getElementById('familia').classList.remove('show');
}
function renderFamilia() {
  const list = document.getElementById('fam-list');
  const adopt = document.getElementById('fam-adopt');
  const bal = document.getElementById('fam-balance');
  if (!list || !adopt) return;
  if (bal) bal.textContent = coins;
  list.innerHTML = '';
  adopt.innerHTML = '';

  // miembros actuales
  const hero = document.createElement('div');
  hero.className = 'item-row';
  hero.innerHTML = '<div class="item-emoji">🐾</div><div class="item-info"><div class="nm">' + esc(pet.name) + ' <small style="font-weight:500">(vos)</small></div><div class="pr">La jefa del caos</div></div><span class="role-badge main">Mascota</span>';
  list.appendChild(hero);
  for (const c of family) {
    const sp = SPECIES[c.sp];
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = '<div class="item-emoji">' + sp.emoji + '</div>' +
      '<div class="item-info"><div class="nm">' + esc(c.nm) + '</div><div class="pr">' + sp.label + ' · día ' + day + ' con la familia</div></div>' +
      '<span class="role-badge ' + (c.role === 'pareja' ? 'love' : 'sib') + '">' + (c.role === 'pareja' ? '💘 Pareja' : '🐾 Hermano/a') + '</span>' +
      '<button class="btn-x2" data-rel="' + c.id + '" title="Despedir">✕</button>';
    list.appendChild(row);
  }
  if (!family.length) {
    const empty = document.createElement('div');
    empty.className = 'fam-empty';
    empty.textContent = 'Estás solita con tu mascota… ¿le conseguimos compañía?';
    list.appendChild(empty);
  }

  // adoptables: hermanos
  const sibs = family.filter(x => x.role === 'hermano');
  if (sibs.length < MAX_SIB) {
    for (const id in SPECIES) {
      if (sibs.some(x => x.sp === id)) continue;
      const sp = SPECIES[id];
      const card = document.createElement('div');
      card.className = 'item-row fam-card';
      const can = coins >= sp.price;
      card.innerHTML = '<div class="item-emoji">' + sp.emoji + '</div>' +
        '<div class="item-info"><div class="nm">Adoptar ' + sp.label.toLowerCase() + '</div><div class="pr">Un hermano/a para ' + esc(pet.name) + '</div></div>' +
        '<button class="btn-buy" data-adopt="hermano:' + id + '"' + (can ? '' : ' disabled') + '>🍪 ' + sp.price + '</button>';
      adopt.appendChild(card);
    }
  }
  // pareja
  const pareja = family.find(x => x.role === 'pareja');
  if (!pareja) {
    const used = new Set(family.map(x => x.sp));
    const freeIds = Object.keys(SPECIES).filter(id => !used.has(id));
    const pId = freeIds.length ? pick(freeIds) : 'perro';
    const canLove = coins >= 55 && day >= 2 && pet.love >= 55;
    let why = '';
    if (!canLove) {
      if (day < 2) why = 'Necesitás llegar al día 2.';
      else if (pet.love < 55) why = 'Tu mascota necesita más amor (♥ ' + Math.round(pet.love) + '/55).';
      else why = 'Te faltan galletas.';
    }
    const card = document.createElement('div');
    card.className = 'item-row fam-card love-card';
    card.innerHTML = '<div class="item-emoji">💘</div>' +
      '<div class="item-info"><div class="nm">Buscar pareja para ' + esc(pet.name) + '</div><div class="pr">' + (why || 'El amor es lindo. Y rinde 🍪.') + '</div></div>' +
      '<button class="btn-buy worn" data-adopt="pareja:' + pId + '"' + (canLove ? '' : ' disabled') + '>🍪 55</button>';
    adopt.appendChild(card);
  }
  // liberar cupo de hermanos si está lleno
  if (sibs.length >= MAX_SIB && !family.some(x => x.role === 'pareja')) {
    const tip = document.createElement('div');
    tip.className = 'fam-empty';
    tip.textContent = 'Casa llena de hermanos (2 máx). Si querés más, despedí a uno con la ✕.';
    adopt.appendChild(tip);
  }
}
function famAdopt(role, spId) {
  if (!pet.name) return;
  if (!SPECIES[spId]) return;
  const sp = SPECIES[spId];
  const price = role === 'pareja' ? 55 : sp.price;
  if (coins < price) { showBubble('me faltan galletitas 🍪'); return; }
  if (role === 'hermano') {
    const sibs = family.filter(x => x.role === 'hermano');
    if (sibs.length >= MAX_SIB) return;
    if (sibs.some(x => x.sp === spId)) return;
  } else {
    if (family.some(x => x.role === 'pareja')) return;
    if (day < 2 || pet.love < 55) { showBubble('el amor no se compra… bueno, casi. Todavía no.'); return; }
  }
  coins -= price;
  refreshCoinChip();
  const m = { id: null, sp: spId, role: role, nm: role === 'pareja' ? pick(PAREJA_NAMES) : null };
  const c = makeComp(m);
  family.push(c);
  syncFam();
  renderFamilia();
  AudioSys.buy();
  confettiBurst(pet.x, pet.y - R, 14);
  pet.happy = 1;
  if (role === 'pareja') {
    pet.love = clamp(pet.love + 4, 0, 100);
    showToast('💘 ' + c.nm + ' y ' + pet.name + ' ahora son pareja oficial. Felicitaciones (algo nerviosas).');
    AudioSys.fanfare();
  } else {
    showToast('🐾 ¡' + sp.label + ' ' + c.nm + ' llegó a casa para quedarse!');
    AudioSys.fanfare();
  }
  save();
}
function famRelease(id) {
  const c = family.find(x => x.id === id);
  if (!c) return;
  showToast('🐾 ' + c.nm + ' se fue a recorrer el mundo. Te va a escribir, seguro.');
  releaseComp(c);
  renderFamilia();
}

/* ================= extraTick (llamado desde pet.js update) ================= */
function extraTick(dt) {
  if (arcade.on) { arcadeTick(dt); return; }
  if (!pet.name) return;
  for (const c of family) famOne(c, dt);
  famMoments(dt);
}

/* ================= extraDraw (llamado desde pet.js frame) ================= */
function extraDraw() {
  if (arcade.on) drawArcade();
  drawFamilyFrame();
}

/* ================= pointer (llamado primero en canvas pointerdown) ================= */
function extraPointerDown(e) {
  const x = e.clientX, y = e.clientY;
  // mientras corre un arcade, todo toque va al arcade
  if (arcade.on) {
    arcadeTap(x, y);
    return true;
  }
  if (!pet.name) return false;
  // prioridad: la mascota (que lo maneje pet.js)
  if (dist(pet.x, pet.y, x, y) < R * 1.6) return false;
  // tocar a un miembro de la familia
  for (const c of family) {
    const cy = compCenterY();
    if (dist(c.x, cy, x, y) < R * COMP_SCALE * 1.9) {
      pokeComp(c);
      return true;
    }
  }
  return false;
}

/* ============================================================
   ARCADE: topos 🐹 y peces voladores 🐟
   ============================================================ */
function arcadeActive() { return arcade.on; }

function startArcade(kind) {
  if (typeof cancelArcade === 'function' && arcade.on) cancelArcade(true);
  if (bubbleGame.on) endBubbles();
  if (ball.active) { ball.active = false; if (pet.state === 'chase' || pet.state === 'catch') setState('idle', 0); }
  closeOverlay('juegos');
  arcade.on = true;
  arcade.kind = kind;
  arcade.t = kind === 'mole' ? 22 : 24;
  arcade.score = 0;
  arcade.arr = [];
  arcade.spawnT = 0.35;
  stats.games++;
  pet.fun = clamp(pet.fun + 10, 0, 100);
  const bar = document.getElementById('gamebar');
  if (bar) bar.classList.remove('hidden');
  AudioSys.eventS();
}
function cancelArcade(grant) {
  if (!arcade.on) return false;
  endArcade();
  return true;
}
function endArcade() {
  if (!arcade.on) return;
  const kind = arcade.kind;
  const sc = arcade.score;
  arcade.on = false;
  arcade.arr = [];
  if (kind === 'mole') { if (sc > stats.bestMole) stats.bestMole = sc; }
  else if (kind === 'fish') { if (sc > stats.bestFish) stats.bestFish = sc; }
  const base = kind === 'mole' ? 3 : 2;
  const won = Math.min(25, base + Math.floor(sc / 3));
  addCoin(won, pet.x, pet.y - R * 1.4);
  pet.fun = clamp(pet.fun + 12, 0, 100);
  confettiBurst(pet.x, pet.y - R, 12);
  showToast(kind === 'mole' ? ('🐹 ¡' + sc + ' topos derrotados! Ganaste ' + won + ' 🍪') : ('🐟 ¡' + sc + ' peces pescados! Ganaste ' + won + ' 🍪'));
  const bar = document.getElementById('gamebar');
  if (bar) bar.classList.add('hidden');
  save();
}

/* -------- mole -------- */
function arcadeTick(dt) {
  arcade.t -= dt;
  arcade.spawnT -= dt;
  if (arcade.t <= 0) { endArcade(); return; }
  if (arcade.kind === 'mole') moleTick(dt); else fishTick(dt);
  const bar = document.getElementById('gamebar');
  if (bar) {
    const nm = arcade.kind === 'mole' ? '🐹 Topos' : '🐟 Peces voladores';
    bar.innerHTML = nm + ' · quedan <b>' + Math.max(0, Math.ceil(arcade.t)) + '</b>s · 🎯 <b>' + arcade.score + '</b>';
  }
  if (arcade.arr.length && (pet.state === 'idle' || pet.state === 'walk' || pet.state === 'sit')) {
    const tgt = arcade.arr[0];
    pet.look.x = clamp((tgt.x - pet.x) / 300, -1, 1);
    pet.look.y = clamp(((arcade.kind === 'mole' ? floorY - 60 : tgt.y) - pet.y) / 300, -1, 1);
  }
}
function moleTick(dt) {
  const arr = arcade.arr;
  // aparecer topos en huecos libres
  if (arcade.spawnT <= 0) {
    arcade.spawnT = rand(0.5, 0.95);
    const activeHoles = new Set(arr.map(m => m.hole));
    const holeW = (W - 200) / 6;
    const free = [];
    for (let i = 0; i < 6; i++) {
      const hx = 130 + i * holeW;
      if (hx < 150 || hx > W - 150) continue;
      if (!activeHoles.has(i)) free.push(i);
    }
    if (free.length) {
      const i = pick(free);
      arr.push({
        hole: i, x: 130 + i * holeW, t: rand(0.7, 1.25),
        golden: Math.random() < 0.12
      });
    }
  }
  for (let i = arr.length - 1; i >= 0; i--) {
    arr[i].t -= dt;
    if (arr[i].t <= 0) arr.splice(i, 1);
  }
}
function drawArcade() {
  if (arcade.kind === 'mole') drawMoles(); else drawFish();
}
function drawMoles() {
  const holeW = (W - 200) / 6;
  // huecos (fondo)
  for (let i = 0; i < 6; i++) {
    const hx = 130 + i * holeW;
    if (hx < 150 || hx > W - 150) continue;
    ctx.save();
    ctx.fillStyle = 'rgba(80,50,20,.3)';
    ctx.beginPath(); ctx.ellipse(hx, floorY + 4, 34, 10, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(60,35,15,.45)';
    ctx.beginPath(); ctx.ellipse(hx, floorY + 4, 24, 7, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  for (const m of arcade.arr) {
    const pop = clamp(m.t > 1 ? 1 : m.t, 0, 1); // aparece y desaparece
    if (pop <= 0.02) continue;
    const h = 62 * pop;
    ctx.save();
    ctx.translate(m.x, floorY - h);
    ctx.scale(pop < 1 ? (0.6 + 0.4 * pop) : 1, pop);
    // cuerpo
    const g = ctx.createRadialGradient(-8, -20, 6, 0, -24, 40);
    g.addColorStop(0, m.golden ? '#ffd166' : '#a97a52');
    g.addColorStop(1, m.golden ? '#e6a93c' : '#8a5f3d');
    ctx.fillStyle = g; ctx.strokeStyle = m.golden ? '#c98f2e' : '#6e4628'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, -14, 28, 30, 0, 0, TAU); ctx.fill(); ctx.stroke();
    // panza clara
    ctx.fillStyle = 'rgba(255,230,190,.8)';
    ctx.beginPath(); ctx.ellipse(0, 2, 16, 15, 0, 0, TAU); ctx.fill();
    // hocico rosado
    ctx.fillStyle = '#ff9dab';
    ctx.beginPath(); ctx.ellipse(0, 6, 9, 6, 0, 0, TAU); ctx.fill();
    // ojos
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-9, -26, 7, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(9, -26, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2a18';
    ctx.beginPath(); ctx.arc(-9, -25, 3.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(9, -25, 3.6, 0, TAU); ctx.fill();
    // bigotes
    ctx.strokeStyle = 'rgba(90,60,30,.7)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-18, -8); ctx.lineTo(-30, -12); ctx.moveTo(-18, -4); ctx.lineTo(-30, -2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18, -8); ctx.lineTo(30, -12); ctx.moveTo(18, -4); ctx.lineTo(30, -2); ctx.stroke();
    ctx.restore();
    // etiqueta dorada
    if (m.golden) {
      ctx.save();
      ctx.fillStyle = '#c98f2e';
      ctx.font = 'bold 12px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★ ×3', m.x, floorY - h - 14);
      ctx.restore();
    }
  }
}
function arcadeTap(x, y) {
  if (!arcade.on) return;
  if (arcade.kind === 'mole') {
    let best = null, bd = 1e9;
    for (const m of arcade.arr) {
      const h = 62;
      const mx = m.x, my = floorY - h + 6;
      const d = dist(mx, my, x, y);
      if (d < 52 && d < bd) { best = m; bd = d; }
    }
    if (best) {
      best.t = -1; // se va
      arcade.arr.splice(arcade.arr.indexOf(best), 1);
      arcade.score += best.golden ? 3 : 1;
      AudioSys.pop();
      const gx = best.x, gy = floorY - 52;
      spawn({ x: gx, y: gy, vx: rand(-20, 20), vy: rand(-90, -50), size: 5, max: 0.6, color: 'rgba(255,230,170,.9)', type: 'star' });
      spawn({ type: 'text', txt: best.golden ? '+3' : '+1', x: gx, y: gy - 10, vx: 0, vy: -60, size: 16, max: 0.9, color: best.golden ? '#d99a1e' : '#8a5f3d' });
      dustPuff(gx, floorY, 4);
      pet.happy = 1;
    }
    return;
  }
  // fish
  let best = null, bd = 1e9;
  for (let i = arcade.arr.length - 1; i >= 0; i--) {
    const f = arcade.arr[i];
    const d = dist(f.x, f.y, x, y);
    if (d < f.r + 12 && d < bd) { best = f; bd = d; }
  }
  if (best) {
    arcade.arr.splice(arcade.arr.indexOf(best), 1);
    if (best.bad) {
      arcade.score = Math.max(0, arcade.score - 1);
      AudioSys.faintS();
      spawn({ type: 'text', txt: '¡eso es basura! -1', x: best.x, y: best.y - 14, vx: 0, vy: -60, size: 13, max: 1.1, color: '#8a8a8a' });
      for (let i = 0; i < 5; i++) {
        spawn({ x: best.x + rand(-12, 12), y: best.y + rand(-8, 8), vx: rand(-60, 60), vy: rand(-80, -20), grav: 300, size: rand(3, 5), max: 0.6, color: '#8a8a8a', type: 'crumb' });
      }
    } else {
      arcade.score += best.golden ? 3 : 1;
      AudioSys.catchS();
      spawn({ type: 'text', txt: best.golden ? '+3' : '+1', x: best.x, y: best.y - 14, vx: 0, vy: -60, size: 16, max: 0.9, color: best.golden ? '#d99a1e' : '#3f9ff0' });
      for (let i = 0; i < 6; i++) {
        spawn({ x: best.x + rand(-14, 14), y: best.y + rand(-10, 10), vx: rand(-40, 40), vy: rand(-90, -40), grav: 240, size: rand(3, 6), max: rand(0.4, 0.7), color: pick(['#9ed9ff', '#6cc9ff', '#fff']), type: 'drop' });
      }
      pet.happy = 1;
    }
  }
}
/* -------- fish -------- */
const FISH_PAL = [
  { body: '#ff8d82', fin: '#f04e3e' },
  { body: '#6cc9ff', fin: '#3f9ff0' },
  { body: '#ffd166', fin: '#e6a93c' },
  { body: '#8fd977', fin: '#4fae63' },
  { body: '#9a8cff', fin: '#6d5ae8' },
];
function fishTick(dt) {
  const arr = arcade.arr;
  if (arcade.spawnT <= 0 && arr.length < 12) {
    arcade.spawnT = rand(0.42, 0.8);
    const fromLeft = Math.random() < 0.5;
    const golden = Math.random() < 0.08;
    const bad = !golden && Math.random() < 0.17;
    const pal = bad ? null : pick(FISH_PAL);
    arr.push({
      x: fromLeft ? -40 : W + 40,
      y: rand(90, Math.max(100, floorY - 90)),
      vx: (fromLeft ? 1 : -1) * rand(170, 300),
      r: bad ? 24 : golden ? 22 : rand(17, 24),
      ph: rand(0, TAU),
      bad: bad, golden: golden, pal: pal
    });
  }
  for (let i = arr.length - 1; i >= 0; i--) {
    const f = arr[i];
    f.x += f.vx * dt;
    f.y += Math.sin(f.x * 0.02 + f.ph) * 40 * dt;
    if (f.x < -70 || f.x > W + 70) arr.splice(i, 1);
  }
}
function drawFish() {
  for (const f of arcade.arr) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.vx > 0 ? 1 : -1, 1);
    if (f.bad) {
      // zapatilla perdida (no tocar)
      ctx.rotate(-0.25 + Math.sin(f.x * 0.03) * 0.2);
      ctx.fillStyle = '#9aa0ad'; ctx.strokeStyle = '#6d737d'; ctx.lineWidth = 2.5;
      rr(-18, -10, 36, 14, 6); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-4, 4, 16, 8, -0.15, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c9cdd4';
      ctx.beginPath(); ctx.arc(4, -10, 5, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-16, -10); ctx.lineTo(-4, -10); ctx.moveTo(10, -10); ctx.lineTo(18, -10); ctx.stroke();
    } else {
      // cuerpo de pez
      const col = f.golden ? { body: '#ffe27a', fin: '#f5c93c' } : f.pal;
      const g = ctx.createRadialGradient(-f.r * 0.3, -f.r * 0.35, 2, 0, 0, f.r);
      g.addColorStop(0, '#fff6');
      g.addColorStop(0.3, col.body);
      g.addColorStop(1, col.fin);
      ctx.fillStyle = g; ctx.strokeStyle = col.fin; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, f.r, f.r * 0.55, 0, 0, TAU); ctx.fill(); ctx.stroke();
      // cola
      ctx.fillStyle = col.fin;
      ctx.beginPath();
      ctx.moveTo(-f.r * 0.7, 0);
      ctx.lineTo(-f.r * 1.35, -f.r * 0.5);
      ctx.lineTo(-f.r * 1.35, f.r * 0.5);
      ctx.closePath(); ctx.fill();
      // aleta
      ctx.beginPath();
      ctx.moveTo(0, f.r * 0.4);
      ctx.lineTo(f.r * 0.2, f.r * 0.95);
      ctx.lineTo(-f.r * 0.2, f.r * 0.55);
      ctx.closePath(); ctx.fill();
      // ojo
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(f.r * 0.42, -f.r * 0.08, f.r * 0.22, 0, TAU); ctx.fill();
      ctx.fillStyle = '#23262b';
      ctx.beginPath(); ctx.arc(f.r * 0.47, -f.r * 0.08, f.r * 0.11, 0, TAU); ctx.fill();
      if (f.golden) {
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(f.r * 0.05, 0, f.r * 0.5, -0.9, 0.4); ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/* ================= wiring UI ================= */
famInit();
const btnFamilia = document.getElementById('btn-familia');
if (btnFamilia) btnFamilia.addEventListener('click', famOpen);
document.getElementById('fam-list') && (document.getElementById('fam-list').addEventListener('click', ev => {
  const b = ev.target.closest('[data-rel]');
  if (!b) return;
  if (b._armed) {
    clearTimeout(b._t);
    famRelease(b.dataset.rel);
    return;
  }
  b._armed = true;
  b.textContent = '¿Seguro?';
  b.classList.add('armed');
  AudioSys.faintS();
  b._t = setTimeout(() => { b._armed = false; b.textContent = '✕'; b.classList.remove('armed'); }, 3500);
}));
document.getElementById('fam-adopt') && (document.getElementById('fam-adopt').addEventListener('click', ev => {
  const b = ev.target.closest('[data-adopt]');
  if (!b) return;
  const [role, spId] = b.dataset.adopt.split(':');
  famAdopt(role, spId);
}));
// nueva mascota desde el menú → la familia se queda en la casa (pero se borra con "Reiniciar todo")
document.querySelectorAll('[data-game2]').forEach(b => b.addEventListener('click', () => startArcade(b.dataset.game2)));
['familia'].forEach(id => {
  const ov = document.getElementById(id);
  if (ov) ov.addEventListener('click', ev => { if (ev.target.id === id) famClose(); });
});
const famX = document.querySelector('#familia .x');
if (famX) famX.addEventListener('click', famClose);
