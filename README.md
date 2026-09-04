# Mascotita 🐾

Tu compañero de caos. Una mascota virtual que come, duerme, juzga tus decisiones y baila sin razón aparente.

**Jugá acá: https://rodri2102.github.io/mascotita/**

## Qué es

Una web autocontenida (un solo `index.html` con todo embebido) — sin servidores, sin dependencias, sin build. Se puede abrir en cualquier navegador, incluso sin internet, y compartir por WhatsApp.

## Cómo cuidarla

- **Tocá** a tu mascota para darle cariño 💖 (cuando está llena de amor te regala 🍪)
- **Arrastrala** para lanzarla (rebota, le encanta)
- **Comer** 🍖 — alimentala antes de que se desmaye
- **Jugar** 🎾 — atrapá la pelota: +1 🍪 por atrapada
- **Dormir** 🌙 — o se va a dormir de pie sola
- Las **necesidades** bajan con el tiempo real; volvé aunque cierres la pestaña
- Tu mascota **no se queda quieta**: pasea sola, se sienta, huele, salta y hace travesuras

## Economía y progresión

- Ganás **🍪 galletas**: atrapando la pelota, acariciando, en eventos especiales y por la pancita
- **🛍️ Tienda**: comprale accesorios a tu mascota (corona 👑, gorrito de fiesta 🎉, sombrero 👒, lentes 🕶️, moño 🎀) — lo que comprás se equipa y se dibuja sobre ella, y queda guardado
- **Escenas**: tu mascota vive en la **Sala** 🏠 y sale al **Jardín** 🌳 (de día y de noche: sol, luna, estrellas, nubes)

## Cosas que pueden pasar

Zoomies, estornudos con arcoíris, regalos (medias, hojas), juicios a tu historial, bailes aprendidos de tutoriales, siestas a mitad de salto… y mucho más.

## Sonido y arte

- **Efectos de sonido reales (CC0)**: pack *Kenney UI Audio* — [kenney.nl/assets/ui-audio](https://kenney.nl/assets/ui-audio), vía [github.com/Calinou/kenney-ui-audio](https://github.com/Calinou/kenney-ui-audio). CC0 = uso libre, incluso comercial.
- El resto (personaje, escenas, animaciones, tonos musicales) está dibujado en canvas a propósito: mantiene el archivo en ~180 KB, funciona 100% offline y no depende de red.

### Dónde encontrar más recursos gratis y con licencia clara

| Tipo | Fuente | Licencia |
|---|---|---|
| Sonido / música / sprites | [kenney.nl](https://kenney.nl/) | CC0 (dominio público) |
| Sprites, arte 2D, sonido | [opengameart.org](https://opengameart.org/) | Por archivo (filtrar CC0 / CC-BY) |
| Paquetes gratis de juegos | [itch.io](https://itch.io/game-assets/free) | Ver cada pack |
| Efectos de sonido | [freesound.org](https://freesound.org/) (filtrar CC0) | Por archivo |
| Música libre | [pixabay.com/music](https://pixabay.com/music/) | Licencia Pixabay (uso libre, sin atribución) |
| Modelos 3D low-poly | [quaternius.com](https://quaternius.com/) | CC0 |
| Texturas PBR / HDRI | [polyhaven.com](https://polyhaven.com/) | CC0 |
| Texturas | [ambientcg.com](https://ambientcg.com/) | CC0 |
| Repos con juegos/ejemplos | GitHub (filtrar por licencia MIT/CC0) | Según repo |

Regla de oro: siempre verificar la licencia de **cada** archivo antes de publicar.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | El juego completo, autocontenido (generado) |
| `index.src.html` | Estructura HTML fuente |
| `styles.css` | Estilos (HUD, intro, tienda, glassmorphism) |
| `core.js` | Motor: canvas, audio, partículas, escenas día/noche |
| `pet.js` | La criatura: estados, eventos, física, economía, tienda |
| `assets/sfx/*.wav` | Efectos CC0 (Kenney UI audio) |
| `build.js` | Une los fuentes + embebe los WAV en un solo `index.html` (`node build.js`) |

## Seguridad

- CSP estricta (`default-src 'none'`): sin red, sin eval, sin iframes; los sonidos viajan embebidos (base64), no se descargan de ningún servidor
- El único input del usuario (el nombre) se renderiza con `textContent`/canvas — sin inyección HTML posible
- `localStorage` guarda solo nombre + valores numéricos + accesorios comprados
- Sin secretos, sin dependencias externas (solo Google Fonts)

## Licencia

Código: MIT — usala, modificala, regalála.
Sonidos: CC0 (Kenney UI audio) — atribución voluntaria.
