FROM python:3.10-slim

# Installer dépendances système
RUN apt-get update && apt-get install -y \
    git \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Installer Coqui TTS
RUN pip install --no-cache-dir TTS

# Dossier de travail
WORKDIR /app

# Copier ton script
COPY script.py /app/script.py

# Commande par défaut
CMD ["python", "script.py"]
