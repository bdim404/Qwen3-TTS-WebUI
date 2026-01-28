#!/bin/bash

cleanup() {
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

cd qwen3-tts-backend
conda run -n qwen3-tts uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

cd ../qwen3-tts-frontend
npm run dev &
FRONTEND_PID=$!

echo "Backend: http://localhost:8000"
echo "Frontend: http://localhost:5173"

wait
