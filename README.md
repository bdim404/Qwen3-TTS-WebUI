# Qwen3-TTS WebUI

A small, self-hosted web interface for [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS). One process, one port, no database: start it, open the browser, type some text.

[中文文档](./README.zh.md)

> Looking for audiobooks? Multi-character audiobook generation has moved to its own project, **[Canto](https://github.com/bdim404/Canto)**. This repository only keeps the core TTS features.

## Features

- **Custom Voice**: 9 built-in speakers, with optional natural-language style instructions ("very happy", "slow and gentle", …)
- **Voice Design**: describe a voice in plain words and the model creates it
- **Voice Clone**: clone from an uploaded file or a microphone recording, with or without a transcript
- **Saved voices**: save any generated result or reference clip as a voice and reuse it for cloning
- **History**: every result is kept on disk; play, download, reuse its settings or delete it
- Models download automatically on first use; CUDA, Apple Silicon (MPS) and CPU are detected automatically
- Optional password, light and dark themes, English / 简体中文 / 繁體中文 / 日本語 / 한국어

## Quick start

### Docker (NVIDIA GPU)

Requires Docker and the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html).

```bash
docker run -d --gpus all -p 8000:8000 -v ./data:/data --name qwen3-tts-webui bdim404/qwen3-tts-webui
```

Or with the bundled [compose.yaml](./compose.yaml):

```bash
docker compose up -d
```

Open http://localhost:8000. Models, history and saved voices all live in `./data`.

### Native

Requires Python 3.10+ (3.12 recommended), Node.js 20+ and, for GPU inference, an NVIDIA driver or an Apple Silicon Mac.

```bash
git clone https://github.com/bdim404/Qwen3-TTS-WebUI.git
cd Qwen3-TTS-WebUI

cd frontend && npm ci && npm run build && cd ..

cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python app.py
```

Open http://localhost:8000.

The first generation in each mode downloads its model from Hugging Face (about 4.5 GB for 1.7B, 2.5 GB for 0.6B) and can take a few minutes. The button shows download and loading progress. In mainland China, set `HF_ENDPOINT=https://hf-mirror.com`.

## Configuration

Set environment variables, or copy `backend/.env.example` to `backend/.env`.

| Variable | Default | Description |
| --- | --- | --- |
| `HOST` | `127.0.0.1` (`0.0.0.0` in Docker) | Listen address |
| `PORT` | `8000` | Listen port |
| `WEBUI_PASSWORD` | empty | Require this password to use the UI. Set it whenever the UI is reachable from other machines |
| `DATA_DIR` | `backend/data` (`/data` in Docker) | History, saved voices, models and the session key |
| `MODEL_DIR` | `$DATA_DIR/models` | Where models are downloaded |
| `DEVICE` | `auto` | `auto`, `cuda:0`, `mps` or `cpu` |
| `MODEL_SIZE` | `1.7B` | `1.7B` or `0.6B` for Custom Voice and Voice Clone. Voice Design is only available as 1.7B |
| `MAX_LOADED_MODELS` | `1` | How many models stay in memory. Raise to `3` with enough VRAM (~16 GB) to switch modes instantly |
| `MAX_TEXT_LENGTH` | `2000` | Maximum characters per request |
| `HF_ENDPOINT` | Hugging Face | Hugging Face mirror |

To use models you already downloaded, put them in `MODEL_DIR` under their original names and create an empty `.complete` file in each folder:

```
data/models/
├── Qwen3-TTS-12Hz-1.7B-CustomVoice/
├── Qwen3-TTS-12Hz-1.7B-VoiceDesign/
└── Qwen3-TTS-12Hz-1.7B-Base/
```

## API

The UI is a thin client over a JSON API, documented at http://localhost:8000/api/docs. For example:

```bash
curl -X POST http://localhost:8000/api/tts/custom-voice \
  -H 'Content-Type: application/json' \
  -d '{"text": "Hello world", "language": "English", "speaker": "Ryan"}'
```

The response describes the new history item; fetch the audio from `/api/history/<id>/audio`.

## Acknowledgments

Built on [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS) by the Qwen team at Alibaba Cloud. This is an unofficial project.

## License

Apache-2.0
