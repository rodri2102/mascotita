'use strict';
const fs = require('fs');
const path = require('path');

const dir = __dirname;

// 1) Generate sfx.js: base64-encoded WAV samples (assets/sfx/*.wav) as SFX_DATA
const sfxDir = path.join(dir, 'assets', 'sfx');
const map = {};
let sfxFiles = [];
try { sfxFiles = fs.readdirSync(sfxDir).filter(f => f.endsWith('.wav')).sort(); } catch (e) {}
for (const f of sfxFiles) {
  map[f.replace(/\.wav$/, '')] = fs.readFileSync(path.join(sfxDir, f)).toString('base64');
}
const sfxJs = '/* SFX: Kenney UI audio pack (CC0) - kenney.nl/assets/ui-audio */\nconst SFX_DATA = ' + JSON.stringify(map) + ';\n';
fs.writeFileSync(path.join(dir, 'sfx.js'), sfxJs);
console.log('sfx.js: ' + sfxFiles.length + ' samples (' + (sfxJs.length / 1024).toFixed(0) + ' KB)');

// 2) Build single-file index.html
let html = fs.readFileSync(path.join(dir, 'index.src.html'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');
const core = fs.readFileSync(path.join(dir, 'core.js'), 'utf8');
const pet = fs.readFileSync(path.join(dir, 'pet.js'), 'utf8');
const fam = fs.readFileSync(path.join(dir, 'family.js'), 'utf8');

html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>' + css + '</style>');
html = html.replace('<script src="sfx.js"></script>', '<script>' + sfxJs + '</script>');
html = html.replace('<script src="core.js"></script>', '<script>' + core + '</script>');
html = html.replace('<script src="pet.js"></script>', '<script>' + pet + '</script>');
html = html.replace('<script src="family.js"></script>', '<script>' + fam + '</script>');
fs.writeFileSync(path.join(dir, 'index.html'), html);
console.log('built mascota/index.html (' + (html.length / 1024).toFixed(0) + ' KB)');
