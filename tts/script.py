from TTS.api import TTS
import wave
import os

# Charger le modèle XTTS v2 (multilingue)
tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=False, gpu=False)

# Segments avec timing
segments_fr = [
{ "start": 6, "end": 16, "text": 'merci beaucoup' },
  { "start": 16, "end": 18, "text": 'beaucoup, je suis' },
  { "start": 18, "end": 22, "text": 'particulièrement fier et heureux de la' },
  { "start": 22, "end": 27, "text": 'jeunes réalisateurs, acteurs, chanteurs, écrivains' },
  { "start": 27, "end": 30, "text": 'producteurs qui arrivent' },
  { "start": 31, "end": 37, "text": 'derrière ma génération, en particulier Barry' },
  { "start": 37, "end": 39, "text": 'Jenkins. Les jeunes le comprennent' },
  { "start": 39, "end": 44, "text": 'ce jeune homme a réalisé 10, 15, 20 courts métrages' },
  { "start": 44, "end": 47, "text": 'avant d\'avoir l\'opportunité de faire' },
  { "start": 47, "end": 49, "text": 'Moonlight. Alors n\'abandonnez' },
  { "start": 49, "end": 51, "text": 'jamais sans' },
  { "start": 51, "end": 54, "text": 'engagement, vous ne commencerez jamais, mais surtout' },
  { "start": 54, "end": 56, "text": 'plus important, sans' },
  { "start": 56, "end": 60, "text": 'constance, vous ne finirez jamais. Ce n\'est pas' },
  { "start": 60, "end": 61, "text": 'facile' },
  { "start": 61, "end": 63, "text": 'si c\'était facile, il n\'y aurait pas de Kerry' },
  { "start": 63, "end": 66, "text": 'Washington. Si c\'était facile, il n\'y aurait pas de' },
  { "start": 66, "end": 68, "text": 'Taraji P. Henson' },
  { "start": 70, "end": 72, "text": 'Henson. Si c\'était facile, il n\'y aurait pas de' },
  { "start": 72, "end": 75, "text": 'Octavia Spencer, mais pas seulement. Si c\'était' },
  { "start": 75, "end": 77, "text": 'facile, il n\'y aurait pas de Viola Davis si' },
  { "start": 77, "end": 80, "text": 'c\'était facile, il n\'y aurait pas de Michael T' },
  { "start": 80, "end": 82, "text": 'Williamson, ni Stephen McKinley Henderson' },
  { "start": 82, "end": 86, "text": 'ni Russell Hornsby. Si c\'était facile, il y' },
  { "start": 86, "end": 88, "text": 'n\'aurait pas de Denzel Washington' },
  { "start": 88, "end": 91, "text": 'alors continuez à travailler' },
  { "start": 91, "end": 93, "text": 'persévérez, n\'abandonnez jamais, tombez' },
  { "start": 93, "end": 94, "text": 'sept fois, relevez-vous' },
  { "start": 97, "end": 99, "text": 'huit' },
  { "start": 99, "end": 104, "text": 'la facilité est une plus grande menace pour' },
  { "start": 104, "end": 108, "text": 'le progrès que' },
  { "start": 108, "end": 110, "text": 'l\'adversité. La facilité est une plus grande menace pour' },
  { "start": 110, "end": 114, "text": 'le progrès que l\'adversité. Alors continuez d\'avancer' },
  { "start": 114, "end": 116, "text": 'continuez de grandir, continuez d\'apprendre, on se voit au' },
  { "start": 116, "end": 118, "text": 'travail' }
]

# Dossier temporaire
temp_files = []

# Générer chaque segment
for i, seg in enumerate(segments_fr):
    temp_path = f"segment_{i}.wav"
    tts.tts_to_file(text=seg["text"], file_path=temp_path, speaker="female", language="fr")
    temp_files.append((seg["start"], seg["end"], temp_path))

# Fusionner avec silences selon la timeline
output_path = "discours_timeline.wav"
frame_rate = 24000  # fréquence XTTS
sample_width = 2
channels = 1

with wave.open(output_path, 'wb') as output:
    output.setnchannels(channels)
    output.setsampwidth(sample_width)
    output.setframerate(frame_rate)

    current_time = 0
    for start, end, file_path in temp_files:
        # Silence avant segment
        if start > current_time:
            silence_duration = start - current_time
            silence_frames = b'\x00' * int(frame_rate * silence_duration * sample_width)
            output.writeframes(silence_frames)
            current_time = start

        # Audio du segment
        with wave.open(file_path, 'rb') as seg_audio:
            frames = seg_audio.readframes(seg_audio.getnframes())
            output.writeframes(frames)
            current_time += seg_audio.getnframes() / frame_rate

        # Silence jusqu'au end prévu
        if current_time < end:
            silence_duration = end - current_time
            silence_frames = b'\x00' * int(frame_rate * silence_duration * sample_width)
            output.writeframes(silence_frames)
            current_time = end

# Nettoyer fichiers temporaires
for _, _, file_path in temp_files:
    os.remove(file_path)

print(f"Fichier final généré : {output_path}")
