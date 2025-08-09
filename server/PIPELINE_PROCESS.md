# Pipeline Dubbing – Processus & Flux

## Vue d'ensemble
Chaîne de traitement asynchrone orchestrée via BullMQ (Redis) pour transformer une vidéo source en versions doublées multilingues puis produire une sortie finale.

Étapes (jobs) séquentielles :
1. TRANSCRIBE → Génère les segments de transcription (langue source)
2. TRANSLATE → Produit les segments traduits pour chaque langue cible
3. VOICE → Génère l'audio doublé par langue
4. (LIPSYNC) → Optionnel selon la feature flag `ENABLE_LIPSYNC`
5. MUX → Assemble (mux) les pistes et marque le projet terminé

## Tables principales
| Table | Rôle |
|-------|------|
| projects | Métadonnées projet + statut global (DRAFT → COMPLETED) |
| jobs | Suivi de chaque étape (status, progress, timestamps) |
| transcripts | Segments de transcription (langue source) |
| translations | Segments traduits (par langue) |
| media_assets | Actifs générés (DUB_AUDIO, FINAL_VIDEO, etc.) |

## États & Statuts
- Job.status : PENDING → RUNNING → DONE / ERROR
- Project.status : DRAFT → COMPLETED (à la fin du MUX) 

## Orchestrateur
`PipelineOrchestrator.start(projectId, targetLangs)` :
1. Pré-crée les lignes `jobs` (PENDING, progress=0) avec IDs déterministes `projectId:KIND`
2. Enfile chaque job dans l'ordre avec délais progressifs

## Workers & Persistance
| Worker | Actions Persistance |
|--------|---------------------|
| TRANSCRIBE | setRunning, progress, insert transcript (segments), setDone |
| TRANSLATE | setRunning, progress agrégé, insert translations (par langue), setDone |
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

## Test Manuel Rapide
1. Insérer un projet :
```sql
INSERT INTO projects (id, user_id, title, status) VALUES ('test123','user_1','Demo','DRAFT');
```
2. (Bypass ou fournir auth) Appeler :
```bash
curl -X POST http://localhost:3000/api/v1/projects/test123/start \
  -H 'Content-Type: application/json' \
  -d '{"targetLangs":["fr","es"]}'
```
3. Suivre l'évolution :
```bash
curl http://localhost:3000/api/v1/projects/test123/jobs | jq
```
4. WebSocket (ex: browser / wscat) :
```
wscat -c ws://localhost:3000/ws?projectId=test123
```
5. Vérifier BDD :
```sql
SELECT * FROM jobs WHERE project_id='test123';
SELECT * FROM transcripts WHERE project_id='test123';
SELECT * FROM translations WHERE project_id='test123';
SELECT * FROM media_assets WHERE project_id='test123';
```

## Idempotence & Sécurité
- IDs de jobs déterministes : ré-enfilement sans doublons (upsert ignore si existe).
- Progress DB + WebSocket décorrélés (échec d'émission n'interrompt pas persistance).

## Améliorations Futures (Roadmap interne)
- Retries configurables par type de job
- Journalisation structurée (pino) + métriques (Prometheus)
- Gestion fine des quotas / facturation par minute audio
- Alignement labiales réel (Wav2Lip) + segmentation adaptative
- Stockage objet (MinIO/S3) au lieu du chemin local stub

## Providers (Abstraction)
Interfaces génériques introduites:
- TranscriptionProvider (`transcription.provider.ts`)
- TTSProvider (`tts.provider.ts`)
- StorageProvider (`storage.provider.ts`)
- TranslationProvider (`translation.provider.ts`)

Implémentations actuelles: locales (whisper stub, xtts stub, fs local). Permet d'ajouter rapidement des backends externes (SaaS ou GPU) via nouvelle classe + changement d'import usine.

## Résumé
Le pipeline persiste chaque étape, émet les progressions en temps réel et expose un endpoint de consolidation. La structure actuelle permet d'itérer vers des implémentations ML réelles sans changer les contrats externes.

## Flux Création & Démarrage
1. Upload vidéo: `POST /api/v1/uploads/video` (multipart: file) → `{ url, key }`
2. Création projet: `POST /api/v1/projects { userId, title, sourceVideoUrl }` → projet DRAFT
3. Lancement pipeline: `POST /api/v1/projects/{id}/start { targetLangs: [...] }`
4. Suivi progress: WebSocket + `GET /api/v1/projects/{id}/jobs`
5. Récap global: `GET /api/v1/projects/{id}/summary`
6. Métriques globales pipeline: `GET /api/v1/metrics`

## Endpoint Upload Vidéo
- Route: `POST /api/v1/uploads/video`
- Form-data: `file` (obligatoire), `projectId` (optionnel)
- Stockage via `Providers.storage()` (local fs ou MinIO).
- Enregistre un media asset SOURCE_VIDEO si `projectId` fourni.
- Réponse 201: `{ success, key, url, size, projectId? }`

## Endpoint Création Projet
- Route: `POST /api/v1/projects`
- Body: `{ userId: string, title: string, sourceVideoUrl?: string, id?: string }`
- Statut initial: `DRAFT`
- Réponse 201: `{ success, project }`

## Endpoint Summary
- Route: `GET /api/v1/projects/{id}/summary`
- Contenu: project, jobs, stats (counts + durées), languages (transcripts+translations), assets counts.
- Stats: `totalJobs, completed, errored, avgDurationMs, totalDurationMs`.

## Métriques Runtime
- Route: `GET /api/v1/metrics`
- Structure:
```json
{
  "generatedAt": "ISO",
  "aggregate": { "started":0, "completed":0, "errored":0, "totalDurationMs":0 },
  "perKind": [
    { "kind":"TRANSCRIBE", "started":1, "completed":1, "errored":0, "durations": { "count":1, "totalMs":1234, "minMs":1234, "maxMs":1234, "meanMs":1234 } }
  ]
}
```
- Collecte: instrumentation dans chaque worker (start/end, succès/erreur).

## Caching Transcription
- Table: `transcription_cache(hash PK, language, segments, duration, createdAt)`
- Hash: SHA-256 du fichier audio source (utilitaire `hashFile`).
- Si cache hit: insertion transcript directe + job marqué DONE sans recalcul.

## Providers & Stockage
- Abstraction via `Providers.*()` : transcription, translation, tts, storage.
- Storage:
  - Local FS (par défaut)
  - MinIO (si `STORAGE_PROVIDER=minio` + env MINIO_* présents)
- Ajout dynamique possible de nouveaux providers sans changer les workers.

## Variables d'Environnement (Nouvelles / Mise à jour)
| Variable | Rôle |
|----------|------|
| STORAGE_PROVIDER | `local` (par défaut) ou `minio` |
| MINIO_ENDPOINT | Host MinIO |
| MINIO_PORT | Port MinIO (ex: 9000) |
| MINIO_USE_SSL | `true/false` |
| MINIO_ACCESS_KEY | Clé accès |
| MINIO_SECRET_KEY | Clé secrète |
| MINIO_BUCKET | Bucket utilisé |
| MINIO_PUBLIC_BASE | Base URL publique (CDN/Reverse proxy) |
| ENABLE_LIPSYNC | Active job LIPSYNC |
| REDIS_URL | Redis BullMQ |
| DATABASE_URL | Postgres |

## Exemple .env (extrait)
```env
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/dubbing?search_path=public
REDIS_URL=redis://localhost:6379
STORAGE_PROVIDER=local
ENABLE_LIPSYNC=false
# MinIO (si STORAGE_PROVIDER=minio)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=dubbing-assets
MINIO_PUBLIC_BASE=http://localhost:9000
```

## Workflow Complet (Résumé)
1. Upload vidéo
2. Création projet (DRAFT)
3. Start pipeline (jobs pré-créés + enqueue)
4. TRANSCRIBE (cache si possible)
5. TRANSLATE (multi-lang)
6. VOICE (génère DUB_AUDIO)
7. (LIPSYNC optionnel)
8. MUX (FINAL_VIDEO + project COMPLETED)
9. Summary & Métriques consultables

## Exemple Séquence cURL
```bash
# 1. Upload
echo 'fake' > sample.mp4
curl -F file=@sample.mp4 http://localhost:3000/api/v1/uploads/video

# Suppose retour { "url":"/assets/source-videos/..mp4" }
VIDEO_URL="<copier>"

# 2. Create project
curl -X POST http://localhost:3000/api/v1/projects \
  -H 'Content-Type: application/json' \
  -d '{"userId":"user_1","title":"Demo","sourceVideoUrl":"'$VIDEO_URL'"}'
# -> récupérer project.id

# 3. Start pipeline
curl -X POST http://localhost:3000/api/v1/projects/<projectId>/start \
  -H 'Content-Type: application/json' \
  -d '{"targetLangs":["fr","es"]}'

# 4. Jobs state
curl http://localhost:3000/api/v1/projects/<projectId>/jobs | jq

# 5. Summary
curl http://localhost:3000/api/v1/projects/<projectId>/summary | jq

# 6. Metrics
defaultMetrics=$(curl http://localhost:3000/api/v1/metrics)
```

## Roadmap Mise à Jour
- [FAIT] Caching transcription
- [FAIT] Métriques in-memory
- [FAIT] Upload vidéo + création projet + summary
- [FAIT] MinIO provider optionnel
- [À FAIRE] Auth fine-grained sur uploads & metrics
- [À FAIRE] Tests unitaires providers & workers
- [À FAIRE] Stockage objet distant chiffré
- [À FAIRE] Retention & cleanup des assets orphelins
- [À FAIRE] Facturation/quotas (durée audio cumulée)
- [À FAIRE] Lip-sync réel (Wav2Lip) + MUX avancé (FFmpeg timeline)
