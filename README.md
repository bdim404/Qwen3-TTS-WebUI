# Qwen3-TTS WebUI

A text-to-speech web application based on Qwen3-TTS, supporting custom voice, voice design, and voice cloning.

[中文文档](./README.zh.md)

## Features

- Custom Voice: Predefined speaker voices
- Voice Design: Create voices from natural language descriptions
- Voice Cloning: Clone voices from uploaded audio
- JWT auth, async tasks, voice cache, dark mode

## Tech Stack

Backend: FastAPI + SQLAlchemy + PyTorch + JWT
Frontend: React 19 + TypeScript + Vite + Tailwind + Shadcn/ui

## Quick Start

### Backend

```bash
cd qwen3-tts-backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env to configure MODEL_BASE_PATH etc.
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd qwen3-tts-frontend
npm install
cp .env.example .env
# Edit .env to configure VITE_API_URL
npm run dev
```

Visit `http://localhost:5173`

**First Time Setup**: On first run, a default superuser account will be automatically created:
- Username: `admin`
- Password: `admin123456`
- **IMPORTANT**: Please change the password immediately after first login for security!

## Configuration

Backend `.env` key settings:

```env
SECRET_KEY=your-secret-key
MODEL_DEVICE=cuda:0
MODEL_BASE_PATH=../Qwen
DATABASE_URL=sqlite:///./qwen_tts.db
```

Frontend `.env`:

```env
VITE_API_URL=http://localhost:8000
```

## API

```
POST /auth/register          - Register
POST /auth/token             - Login
POST /tts/custom-voice       - Custom voice
POST /tts/voice-design       - Voice design
POST /tts/voice-clone        - Voice cloning
GET  /jobs                   - Job list
GET  /jobs/{id}/download     - Download result
```

## License

Apache-2.0 license 
