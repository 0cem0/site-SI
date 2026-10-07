# Minirue — vidéo de présentation (motion design)

Vidéo de 49 s, 1920×1080, 30 i/s, entièrement animée en HTML/CSS/JS (GSAP) avec les VRAIS visuels du moteur du site
(le tapis, les maisons, les arbres et les trajets des voitures sont générés par `js/matgen.js`).

- `src/`      : la vidéo (index.html, style.css, helpers.js, scenes-a.js, scenes-b.js, main.js)
- `assets/`   : images générées par le moteur, polices, GSAP
- `tools/`    : make-assets.js (régénère les visuels), render.js (rendu image par image → MP4), audio.py (musique + bruitages), shots.js (images de contrôle)

Régénérer : `npm install` puis `node tools/make-assets.js` (change les maisons/arbres avec SEED=…),
`node tools/render.js --out out/silent.mp4`, `python3 tools/audio.py out/events.json`, puis mixer avec ffmpeg.
Pour voir l'animation dans un navigateur : ouvrir `src/index.html` et exécuter `__seek(12.5)` dans la console.

## Sur le site
La version web de la vidéo (MP4 + WebM + affiche) est dans `../media/` et lue par le lecteur de la page d'accueil
(`../index.html` section « Minirue en 49 secondes », `../css/video.css`, `../js/video.js`).
Pour remplacer la vidéo : ré-encoder avec ffmpeg et écraser `media/minirue-presentation.mp4` / `.webm` / `minirue-poster.jpg`.
