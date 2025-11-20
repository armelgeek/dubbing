# Pipeline Dubbing – Processus & Flux

## Vue d'ensemble
Chaîne de traitement asynchrone orchestrée via BullMQ (Redis) pour transformer une vidéo source en versions doublées multilingues puis produire une sortie finale.

Étapes (jobs) séquentielles :
1. TRANSCRIBE → Génère les segments de transcription (langue source)
2. TRANSLATE → Produit les segments traduits pour chaque langue cible
3. SUBTITLE → Génère les fichiers de sous-titres (SRT/VTT) pour chaque langue
4. VOICE → Génère l'audio doublé par langue (optionnel si skipVoice=true)
5. (LIPSYNC) → Optionnel selon la feature flag `ENABLE_LIPSYNC`
6. MUX → Assemble (mux) les pistes et marque le projet terminé

## Mode Subtitle-Only
Lorsque `skipVoice=true` est passé au démarrage du pipeline :
- Les étapes VOICE et LIPSYNC sont ignorées
- Seuls les sous-titres sont générés et intégrés dans la vidéo finale
- Le MUX crée des vidéos avec sous-titres intégrés mais sans doublage audio

## Tables principales
| Table | Rôle |
|-------|------|
| projects | Métadonnées projet + statut global (DRAFT → COMPLETED) |
| jobs | Suivi de chaque étape (status, progress, timestamps) |
| transcripts | Segments de transcription (langue source) |
| translations | Segments traduits (par langue) |
| media_assets | Actifs générés (DUB_AUDIO, SUBTITLE_SRT, SUBTITLE_VTT, FINAL_VIDEO, etc.) |

## États & Statuts
- Job.status : PENDING → RUNNING → DONE / ERROR
- Project.status : DRAFT → COMPLETED (à la fin du MUX)

## Orchestrateur
`PipelineOrchestrator.start(projectId, targetLangs, { skipVoice? })` :
1. Pré-crée les lignes `jobs` (PENDING, progress=0) avec IDs déterministes `projectId:KIND`
2. Enfile chaque job dans l'ordre avec délais progressifs
3. Si skipVoice=true, ignore VOICE et LIPSYNC

## Workers & Persistance
| Worker | Actions Persistance |
|--------|---------------------|
| TRANSCRIBE | setRunning, progress, insert transcript (segments), setDone |
| TRANSLATE | setRunning, progress agrégé, insert translations (par langue), setDone |
| SUBTITLE | setRunning, progress agrégé, insert media_assets (SUBTITLE_SRT, SUBTITLE_VTT + meta.lang), setDone |
| VOICE | setRunning, progress agrégé, insert media_assets (DUB_AUDIO + meta.lang), setDone |
| LIPSYNC | (skipped si flag off) sinon setRunning → setDone |
| MUX | setRunning, insert FINAL_VIDEO media_assets, update project COMPLETED, setDone |

En cas d'erreur : setError(jobId, message) + émission évènement WebSocket.

## Évènements Temps Réel
`emitJobProgress` diffuse (WebSocket) un objet :
```
{
  projectId,
  kind,        // JobKind
  status,      // JobStatus
  progress,    // 0-100
  error?       // string si échec
}
```
Canal identifié par `?projectId=...` lors de la connexion WS.

## Endpoints Exposés
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/v1/uploads/video` | Upload vidéo source (multipart, retourne url/key) |
| POST | `/api/v1/projects` | Création d'un projet (status=DRAFT) |
| POST | `/api/v1/projects/{id}/start` | Démarre le pipeline (auth requise) |
| GET | `/api/v1/projects/{id}/jobs` | État détaillé des jobs & artefacts |
| GET | `/api/v1/projects/{id}/summary` | Vue agrégée (stats, langues, assets) |
| GET | `/api/v1/metrics` | Métriques runtime in-memory |

## Format GET jobs
```json
{
  "success": true,
  "jobs": [...],
  "transcripts": [...],
  "translations": [...],
  "mediaAssets": [...]
}
```

## Flags & Config
| Variable | Effet |
|----------|-------|
| ENABLE_LIPSYNC=true | Ajoute le job LIPSYNC dans la chaîne |
| REDIS_URL | Connexion BullMQ |
| DATABASE_URL | Postgres (Drizzle) |
| FFMPEG_BIN | Chemin du binaire ffmpeg, sinon `ffmpeg` dans le PATH |
| MUX_FALLBACK_PLACEHOLDER=1 | En cas d'absence de ffmpeg, stocke un placeholder au lieu d'échouer |
| ASSETS_BASE_DIR | Répertoire local pour les assets (default `/tmp/dubbing-assets`) |
| ASSETS_PUBLIC_PREFIX | Préfixe d'URL publique pour servir les assets (default `/assets`) |

## Step MUX – Détails
- Entrées :
  - `SOURCE_VIDEO` (media_assets.type = SOURCE_VIDEO)
  - `DUB_AUDIO` par langue (media_assets.type = DUB_AUDIO, meta.lang)
- Préconditions :
  - SOURCE_VIDEO obligatoire
  - Au moins un DUB_AUDIO sinon échec (Option B)
- Commande FFmpeg :
  - `ffmpeg -y -i <video> -i <audio> -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest -movflags +faststart out.mp4`
- Résolution chemins :
  - URL `/assets/...` → chemin local `${ASSETS_BASE_DIR}/...`
  - Autres URLs HTTP/HTTPS → téléchargement en tmp
- Sortie :
  - `FINAL_VIDEO` par langue sous `final-videos/<projectId>/<lang>/<uuid>.mp4`
- Fallback :
  - Si FFmpeg indisponible et `MUX_FALLBACK_PLACEHOLDER=1` → upload d'un placeholder
  - Sinon échec avec message explicite

## TTS – Détails
- Le client TTS mock génère un **WAV silencieux** PCM 16-bit à 16kHz.
- La durée = somme des segments (end - start), pour éviter les mux invalides.
- Stockage : `dub-audio/<projectId>/<lang>/<uuid>.wav`

## Idempotence & Sécurité
- IDs de jobs déterministes : upserts/idempotence
- Progress DB ≠ WS (best effort)
- Permissions uploads/metrics : à renforcer (TODO)

## Améliorations Futures
- Retries/backoff par worker
- Prometheus + logs structurés
- S3/MinIO par défaut, cleanup des orphelins
- MUX avancé (multi-pistes, timelines), lip-sync réel
- Tests unitaires workers/providers

## Exemple Séquence cURL (rappel)
```bash
# Upload
echo 'fake' > sample.mp4
curl -F file=@sample.mp4 http://localhost:3000/api/v1/uploads/video

# Create project (utiliser l'URL retournée)
VIDEO_URL="<copier depuis l'upload>"
curl -X POST http://localhost:3000/api/v1/projects \
  -H 'Content-Type: application/json' \
  -d '{"userId":"user_1","title":"Demo","sourceVideoUrl":"'$VIDEO_URL'"}'

# Start avec doublage audio
authHeader="-H 'Authorization: Bearer <token>'" # selon config
curl -X POST http://localhost:3000/api/v1/projects/<projectId>/start \
  -H 'Content-Type: application/json' \
  -d '{"targetLangs":["fr","es"]}'

# Start en mode subtitle-only (sans TTS)
curl -X POST http://localhost:3000/api/v1/projects/<projectId>/start \
  -H 'Content-Type: application/json' \
  -d '{"targetLangs":["fr","es"],"skipVoice":true}'

# Jobs
curl http://localhost:3000/api/v1/projects/<projectId>/jobs | jq

# Summary
curl http://localhost:3000/api/v1/projects/<projectId>/summary | jq
```
