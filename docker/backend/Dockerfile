FROM pytorch/pytorch:2.5.1-cuda12.1-cudnn9-runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY qwen3-tts-backend/requirements.txt .
COPY docker/backend/requirements.qwen_tts.txt .
RUN pip install --no-cache-dir -r requirements.txt -r requirements.qwen_tts.txt

COPY qwen_tts ./qwen_tts
COPY qwen3-tts-backend .

RUN mkdir -p /app/Qwen /app/data /app/voice_cache /app/outputs

ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
