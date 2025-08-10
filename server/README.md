# Server (Hono + Bun)

## Prérequis
- Bun
- Postgres
- Redis
- FFmpeg (recommandé) ou variable `FFMPEG_BIN` pointant vers le binaire

Sans FFmpeg, le step MUX peut activer un fallback placeholder avec `MUX_FALLBACK_PLACEHOLDER=1`.

## Installation
```sh
bun install
```

## Démarrer en dev
```sh
bun run dev
```

Par défaut: http://localhost:3000

## Variables d'environnement

- `PORT` (default: 3000)
- `REDIS_URL` (ex: redis://localhost:6379)
- `FFMPEG_BIN` (ex: /usr/bin/ffmpeg). Si absent, on tente `ffmpeg` dans le PATH
- `MUX_FALLBACK_PLACEHOLDER` ("1" pour activer le fallback si FFmpeg indisponible)
- `ASSETS_BASE_DIR` (default: /tmp/dubbing-assets) répertoire des fichiers persistés localement
- `ASSETS_PUBLIC_PREFIX` (default: /assets) préfixe d'URL publique pour servir les assets

## Stockage des assets
- Les fichiers sont écrits sous `ASSETS_BASE_DIR` et exposés via `ASSETS_PUBLIC_PREFIX`.
- Exemple: key `dub-audio/123/fr/abc.wav` => chemin local `${ASSETS_BASE_DIR}/dub-audio/123/fr/abc.wav` et URL `/assets/dub-audio/123/fr/abc.wav`.
- Le serveur expose `/assets/*` en statique.

## Pipeline: Step MUX
- Entrées:
  - SOURCE_VIDEO (asset de type `SOURCE_VIDEO`)
  - DUB_AUDIO par langue (assets de type `DUB_AUDIO`)
- Traitement (FFmpeg):
  - `ffmpeg -y -i <video> -i <audio> -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest -movflags +faststart out.mp4`
- Sorties:
  - FINAL_VIDEO par langue sous `final-videos/<projectId>/<lang>/<uuid>.mp4`
- Échecs:
  - Pas de SOURCE_VIDEO => erreur
  - Pas de DUB_AUDIO => erreur (Option B)
  - FFmpeg indisponible =>
    - si `MUX_FALLBACK_PLACEHOLDER=1`, écrit un placeholder
    - sinon, erreur

## TTS (mock)
- Génère un WAV silencieux PCM 16-bit 16kHz dont la durée est la somme des segments, stocké sous `dub-audio/<projectId>/<lang>/<uuid>.wav`.

## Endpoints liés
- Upload vidéo: `POST /v1/uploads/video` (stocke via provider, retourne url)
- Projets: `POST /v1/projects` (JSON ou multipart pour créer et uploader), `POST /v1/projects/:id/start`, `GET /v1/projects/:id/jobs`, `GET /v1/projects/:id/summary`
- Assets statiques: `GET /assets/*`

## Dépannage
- FFmpeg introuvable: définir `FFMPEG_BIN` ou installer ffmpeg. Sinon activer `MUX_FALLBACK_PLACEHOLDER=1` pour ne pas bloquer.
- Vérifier `ASSETS_BASE_DIR` et droits d’écriture.
