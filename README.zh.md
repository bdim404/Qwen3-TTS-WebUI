# Qwen3-TTS WebUI

一个轻量的 [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS) 自托管网页界面。一个进程、一个端口、不需要数据库：启动后打开浏览器，输入文字即可。

[English](./README.md)

> 想做有声书？多角色有声书生成已经独立为 **[Canto](https://github.com/bdim404/Canto)** 项目。本仓库只保留核心 TTS 功能。

## 功能

- **预置音色**：9 个内置发音人，可用自然语言指定情感和风格（"非常开心"、"温柔、语速平缓"……）
- **音色设计**：用文字描述想要的声音，模型据此生成
- **音色克隆**：上传音频或用麦克风录音克隆声音，参考文本可填可不填
- **保存音色**：任何生成结果或参考音频都能保存为音色，克隆时直接复用
- **历史记录**：所有结果保存在磁盘上，可播放、下载、复用参数或删除
- 模型首次使用时自动下载；自动识别 CUDA、Apple Silicon（MPS）和 CPU
- 可选访问密码，深色/浅色主题，English / 简体中文 / 繁體中文 / 日本語 / 한국어

## 快速开始

### Docker（NVIDIA GPU）

需要 Docker 和 [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)。

```bash
docker run -d --gpus all -p 8000:8000 -v ./data:/data -e HF_ENDPOINT=https://hf-mirror.com --name qwen3-tts-webui bdim404/qwen3-tts-webui
```

或使用仓库里的 [compose.yaml](./compose.yaml)：

```bash
docker compose up -d
```

打开 http://localhost:8000 。模型、历史记录和保存的音色都在 `./data` 目录中。

### 本地安装

需要 Python 3.10+（推荐 3.12）、Node.js 20+；GPU 推理需要 NVIDIA 驱动或 Apple Silicon Mac。

```bash
git clone https://github.com/bdim404/Qwen3-TTS-WebUI.git
cd Qwen3-TTS-WebUI

cd frontend && npm ci && npm run build && cd ..

cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
HF_ENDPOINT=https://hf-mirror.com .venv/bin/python app.py
```

打开 http://localhost:8000 。

每种模式第一次生成时会从 Hugging Face 下载对应模型（1.7B 约 4.5 GB，0.6B 约 2.5 GB），需要几分钟，按钮上会显示下载和加载进度。中国大陆用户建议设置 `HF_ENDPOINT=https://hf-mirror.com`。

## 配置

通过环境变量配置，或把 `backend/.env.example` 复制为 `backend/.env`。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `HOST` | `127.0.0.1`（Docker 中为 `0.0.0.0`） | 监听地址 |
| `PORT` | `8000` | 监听端口 |
| `WEBUI_PASSWORD` | 空 | 设置后需要输入密码才能使用。只要界面能被其他机器访问就应该设置 |
| `DATA_DIR` | `backend/data`（Docker 中为 `/data`） | 历史记录、音色、模型和会话密钥 |
| `MODEL_DIR` | `$DATA_DIR/models` | 模型下载目录 |
| `DEVICE` | `auto` | `auto`、`cuda:0`、`mps` 或 `cpu` |
| `MODEL_SIZE` | `1.7B` | 预置音色和音色克隆使用的模型：`1.7B` 或 `0.6B`。音色设计只有 1.7B |
| `MAX_LOADED_MODELS` | `1` | 同时驻留内存的模型数。显存充足（约 16 GB）时设为 `3`，切换模式无需重新加载 |
| `MAX_TEXT_LENGTH` | `2000` | 单次请求的最大字符数 |
| `HF_ENDPOINT` | Hugging Face | Hugging Face 镜像地址 |

如果已经下载过模型，按原名放进 `MODEL_DIR`，并在每个模型目录里创建一个空的 `.complete` 文件：

```
data/models/
├── Qwen3-TTS-12Hz-1.7B-CustomVoice/
├── Qwen3-TTS-12Hz-1.7B-VoiceDesign/
└── Qwen3-TTS-12Hz-1.7B-Base/
```

## API

网页只是 JSON API 的一层薄客户端，接口文档见 http://localhost:8000/api/docs 。例如：

```bash
curl -X POST http://localhost:8000/api/tts/custom-voice \
  -H 'Content-Type: application/json' \
  -d '{"text": "你好，世界", "language": "Chinese", "speaker": "Vivian"}'
```

返回新的历史记录条目，音频通过 `/api/history/<id>/audio` 获取。

## 致谢

基于阿里云通义千问团队的 [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)。本项目为非官方项目。

## 许可证

Apache-2.0
