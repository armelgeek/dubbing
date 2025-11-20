# Subtitle Generation Feature

This feature allows you to generate subtitles from transcribed and translated video content without requiring text-to-speech (TTS) audio generation.

## Overview

The dubbing pipeline now supports two modes:

1. **Full Dubbing Mode** (default): Generates both subtitles and dubbed audio
2. **Subtitle-Only Mode**: Generates only subtitles, skipping TTS audio generation

## Workflow

### Full Dubbing Mode (Default)
```
TRANSCRIBE → TRANSLATE → SUBTITLE → VOICE → (LIPSYNC) → MUX
```

### Subtitle-Only Mode (skipVoice=true)
```
TRANSCRIBE → TRANSLATE → SUBTITLE → MUX
```

## API Usage

### Start Pipeline with Subtitles Only

```bash
curl -X POST http://localhost:3000/api/v1/projects/{projectId}/start \
  -H 'Content-Type: application/json' \
  -d '{
    "targetLangs": ["fr", "es", "de"],
    "skipVoice": true
  }'
```

### Start Pipeline with Both Subtitles and Voice Dubbing

```bash
curl -X POST http://localhost:3000/api/v1/projects/{projectId}/start \
  -H 'Content-Type: application/json' \
  -d '{
    "targetLangs": ["fr", "es", "de"]
  }'
```

## Generated Assets

For each target language, the pipeline generates:

- **SUBTITLE_SRT**: SubRip (.srt) subtitle file
- **SUBTITLE_VTT**: WebVTT (.vtt) subtitle file
- **FINAL_VIDEO**: MP4 video with embedded subtitles (and optionally dubbed audio)

### Example Media Assets Response

```json
{
  "success": true,
  "mediaAssets": [
    {
      "id": "...",
      "projectId": "...",
      "type": "SUBTITLE_SRT",
      "url": "/assets/subtitles/project-123/fr/abc123.srt",
      "meta": {
        "lang": "fr",
        "format": "srt",
        "segmentCount": 42
      }
    },
    {
      "id": "...",
      "projectId": "...",
      "type": "SUBTITLE_VTT",
      "url": "/assets/subtitles/project-123/fr/def456.vtt",
      "meta": {
        "lang": "fr",
        "format": "vtt",
        "segmentCount": 42
      }
    },
    {
      "id": "...",
      "projectId": "...",
      "type": "FINAL_VIDEO",
      "url": "/assets/final-videos/project-123/fr/ghi789.mp4",
      "meta": {
        "lang": "fr",
        "source": "...",
        "subtitle": "/assets/subtitles/project-123/fr/abc123.srt",
        "subtitleOnly": true
      }
    }
  ]
}
```

## Subtitle Formats

### SRT (SubRip)
- Industry standard format
- Supported by most video players
- Time format: HH:MM:SS,mmm
- File extension: .srt

Example:
```
1
00:00:00,000 --> 00:00:02,500
Hello world

2
00:00:02,500 --> 00:00:05,000
This is a test
```

### VTT (WebVTT)
- Web standard for HTML5 video
- Modern format with extended features
- Time format: HH:MM:SS.mmm
- File extension: .vtt

Example:
```
WEBVTT

00:00:00.000 --> 00:00:02.500
Hello world

00:00:02.500 --> 00:00:05.000
This is a test
```

## FFmpeg Integration

The final video includes embedded subtitles when available. FFmpeg handles the muxing with:

- Video stream: Original video (copy codec)
- Audio stream: Original audio or dubbed audio (AAC)
- Subtitle stream: Embedded SRT subtitles (mov_text codec)

## Environment Variables

- `ASSETS_BASE_DIR`: Directory for storing generated assets (default: `/tmp/dubbing-assets`)
- `ASSETS_PUBLIC_PREFIX`: URL prefix for accessing assets (default: `/assets`)
- `SKIP_VOICE`: Set to `true` to always skip voice generation (can be overridden per request)

## Use Cases

1. **Quick Preview**: Generate subtitles only to review translations before committing to audio dubbing
2. **Cost Optimization**: Skip expensive TTS API calls when only subtitles are needed
3. **Accessibility**: Provide subtitles for users who prefer reading over dubbed audio
4. **Multi-format Output**: Get both SRT and VTT formats for maximum compatibility

## Monitoring

Track subtitle generation progress through:

- WebSocket events: `JobKind.SUBTITLE` progress updates
- Job status endpoint: `GET /api/v1/projects/{id}/jobs`
- Summary endpoint: `GET /api/v1/projects/{id}/summary`

## Error Handling

If subtitle generation fails for a specific language:
- The worker logs a warning
- Processing continues for other languages
- Check job status for error details
