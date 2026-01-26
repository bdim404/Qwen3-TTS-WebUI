# Qwen3-TTS WebUI

基于 Qwen3-TTS 的文本转语音 Web 应用，支持自定义语音、语音设计和语音克隆。

[English Documentation](./README.md)

## 功能特性

- 自定义语音：预定义说话人语音
- 语音设计：自然语言描述创建语音
- 语音克隆：上传音频克隆语音
- JWT 认证、异步任务、语音缓存、暗黑模式

## 技术栈

后端：FastAPI + SQLAlchemy + PyTorch + JWT
前端：React 19 + TypeScript + Vite + Tailwind + Shadcn/ui

## 快速开始

### 后端

```bash
cd qwen3-tts-backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 配置 MODEL_BASE_PATH 等
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 前端

```bash
cd qwen3-tts-frontend
npm install
cp .env.example .env
# 编辑 .env 配置 VITE_API_URL
npm run dev
```

访问 `http://localhost:5173`

## 配置

后端 `.env` 关键配置：

```env
SECRET_KEY=your-secret-key
MODEL_DEVICE=cuda:0
MODEL_BASE_PATH=../Qwen
DATABASE_URL=sqlite:///./qwen_tts.db
```

前端 `.env`：

```env
VITE_API_URL=http://localhost:8000
```

## API

```
POST /auth/register          - 注册
POST /auth/token             - 登录
POST /tts/custom-voice       - 自定义语音
POST /tts/voice-design       - 语音设计
POST /tts/voice-clone        - 语音克隆
GET  /jobs                   - 任务列表
GET  /jobs/{id}/download     - 下载结果
```

## 许可证

Apache-2.0 license 
