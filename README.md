# Mascotita 🐾

Tu compañero de caos. Una mascota virtual que come, duerme, juzga tus decisiones y baila sin razón aparente.

**Jugá acá: https://rodri2102.github.io/mascotita/**

## Qué es

Una web autocontenida (un solo `index.html` con todo embebido) — sin servidores, sin dependencias, sin build. Se puede abrir en cualquier navegador, incluso sin internet, y compartir por WhatsApp.

## Cómo cuidarla

- **Tocá** a tu mascota para darle cariño 💖
- **Arrastrala** para lanzarla (rebota, le encanta)
- **Comer** 🍖 — alimentala antes de que se desmaye
- **Jugar** 🎾 — lanzale la pelota y atrapala vos también
- **Dormir** 🌙 — o se va a dormir de pie sola
- Los **necesidades** bajan con el tiempo real; volvé a cuidarla aunque cierres la pestaña

## Cosas que pueden pasar

Zoomies, estornudos con arcoíris, regalos (medias, hojas), juicios a tu historial, bailes aprendidos de tutoriales, siestas a mitad de salto… y mucho más.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | El juego completo, autocontenido (generado) |
| `index.src.html` | Estructura HTML fuente |
| `styles.css` | Estilos (HUD, intro, glassmorphism) |
| `core.js` | Motor: canvas, audio, partículas, escena día/noche |
| `pet.js` | La criatura: estados, eventos, física, HUD |
| `build.js` | Une los fuentes en un solo `index.html` (`node build.js`) |

## Seguridad

- CSP estricta (`default-src 'none'`): sin red, sin eval, sin iframes
- El único input del usuario (el nombre) se renderiza con `textContent`/canvas — sin inyección HTML posible
- `localStorage` guarda solo nombre + valores numéricos
- Sin secretos, sin dependencias externas (solo Google Fonts)

## Licencia

MIT — usala, modificala, regalála.