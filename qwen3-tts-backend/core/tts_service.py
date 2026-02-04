import time
import logging
from abc import ABC, abstractmethod
from typing import Tuple, Optional
import websockets
import json
import base64

logger = logging.getLogger(__name__)


class TTSBackend(ABC):
    @abstractmethod
    async def generate_custom_voice(self, params: dict) -> Tuple[bytes, int]:
        pass

    @abstractmethod
    async def generate_voice_design(self, params: dict) -> Tuple[bytes, int]:
        pass

    @abstractmethod
    async def generate_voice_clone(self, params: dict, ref_audio_bytes: bytes) -> Tuple[bytes, int]:
        pass

    @abstractmethod
    async def health_check(self) -> dict:
        pass


class LocalTTSBackend(TTSBackend):
    def __init__(self):
        self.model_manager = None

    async def initialize(self):
        from core.model_manager import ModelManager
        self.model_manager = await ModelManager.get_instance()

    async def generate_custom_voice(self, params: dict) -> Tuple[bytes, int]:
        await self.model_manager.load_model("custom-voice")
        _, tts = await self.model_manager.get_current_model()

        result = tts.generate_custom_voice(
            text=params['text'],
            language=params['language'],
            speaker=params['speaker'],
            instruct=params.get('instruct', ''),
            max_new_tokens=params['max_new_tokens'],
            temperature=params['temperature'],
            top_k=params['top_k'],
            top_p=params['top_p'],
            repetition_penalty=params['repetition_penalty']
        )

        import numpy as np
        if isinstance(result, tuple):
            audio_data = result[0]
        else:
            audio_data = result

        if isinstance(audio_data, list):
            audio_data = np.array(audio_data)

        return self._numpy_to_bytes(audio_data), 24000

    async def generate_voice_design(self, params: dict) -> Tuple[bytes, int]:
        await self.model_manager.load_model("voice-design")
        _, tts = await self.model_manager.get_current_model()

        result = tts.generate_voice_design(
            text=params['text'],
            language=params['language'],
            instruct=params['instruct'],
            max_new_tokens=params['max_new_tokens'],
            temperature=params['temperature'],
            top_k=params['top_k'],
            top_p=params['top_p'],
            repetition_penalty=params['repetition_penalty']
        )

        import numpy as np
        audio_data = result[0] if isinstance(result, tuple) else result
        if isinstance(audio_data, list):
            audio_data = np.array(audio_data)
        return self._numpy_to_bytes(audio_data), 24000

    async def generate_voice_clone(self, params: dict, ref_audio_bytes: bytes) -> Tuple[bytes, int]:
        from utils.audio import process_ref_audio

        ref_audio_array, ref_sr = process_ref_audio(ref_audio_bytes)

        await self.model_manager.load_model("base")
        _, tts = await self.model_manager.get_current_model()

        x_vector = tts.create_voice_clone_prompt(
            ref_audio=(ref_audio_array, ref_sr),
            ref_text=params.get('ref_text', ''),
            x_vector_only_mode=False
        )

        wavs, sample_rate = tts.generate_voice_clone(
            text=params['text'],
            language=params['language'],
            voice_clone_prompt=x_vector,
            max_new_tokens=params['max_new_tokens'],
            temperature=params['temperature'],
            top_k=params['top_k'],
            top_p=params['top_p'],
            repetition_penalty=params['repetition_penalty']
        )

        import numpy as np
        audio_data = wavs[0] if isinstance(wavs, list) else wavs
        if isinstance(audio_data, list):
            audio_data = np.array(audio_data)
        return self._numpy_to_bytes(audio_data), sample_rate

    async def health_check(self) -> dict:
        return {
            "available": self.model_manager is not None,
            "current_model": self.model_manager.current_model_name if self.model_manager else None
        }

    @staticmethod
    def _numpy_to_bytes(audio_array) -> bytes:
        import numpy as np
        import io
        import wave

        if isinstance(audio_array, list):
            audio_array = np.array(audio_array)

        audio_array = np.clip(audio_array, -1.0, 1.0)
        audio_int16 = (audio_array * 32767).astype(np.int16)

        buffer = io.BytesIO()
        with wave.open(buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(24000)
            wav_file.writeframes(audio_int16.tobytes())

        buffer.seek(0)
        return buffer.read()


class AliyunTTSBackend(TTSBackend):
    def __init__(self, api_key: str, region: str):
        self.api_key = api_key
        self.region = region
        self.ws_url = self._get_ws_url(region)
        self.http_url = self._get_http_url(region)

    def _get_ws_url(self, region: str) -> str:
        if region == "beijing":
            return "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"
        else:
            return "wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime"

    def _get_http_url(self, region: str) -> str:
        if region == "beijing":
            return "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization"
        else:
            return "https://dashscope-intl.aliyuncs.com/api/v1/services/audio/tts/customization"

    async def generate_custom_voice(self, params: dict) -> Tuple[bytes, int]:
        from core.config import settings

        voice = self._map_speaker(params['speaker'])
        model = settings.ALIYUN_MODEL_FLASH

        return await self._generate_via_websocket(
            model=model,
            text=params['text'],
            voice=voice,
            language=params['language']
        )

    async def generate_voice_design(self, params: dict, saved_voice_id: Optional[str] = None) -> Tuple[bytes, int]:
        from core.config import settings

        if saved_voice_id:
            voice_id = saved_voice_id
            logger.info(f"Using saved Aliyun voice_id: {voice_id}")
        else:
            voice_id = await self._create_voice_design(
                instruct=params['instruct'],
                preview_text=params['text']
            )

        model = settings.ALIYUN_MODEL_VD

        return await self._generate_via_websocket(
            model=model,
            text=params['text'],
            voice=voice_id,
            language=params['language']
        )

    async def generate_voice_clone(self, params: dict, ref_audio_bytes: bytes) -> Tuple[bytes, int]:
        from core.config import settings

        voice_id = await self._create_voice_clone(ref_audio_bytes)

        model = settings.ALIYUN_MODEL_VC

        return await self._generate_via_websocket(
            model=model,
            text=params['text'],
            voice=voice_id,
            language=params['language']
        )

    async def _generate_via_websocket(
        self,
        model: str,
        text: str,
        voice: str,
        language: str
    ) -> Tuple[bytes, int]:
        audio_chunks = []

        url = f"{self.ws_url}?model={model}"
        headers = {"Authorization": f"Bearer {self.api_key}"}

        async with websockets.connect(url, additional_headers=headers) as ws:
            await ws.send(json.dumps({
                "type": "session.update",
                "session": {
                    "mode": "server_commit",
                    "voice": voice,
                    "language_type": language,
                    "response_format": "pcm",
                    "sample_rate": 24000
                }
            }))

            await ws.send(json.dumps({
                "type": "input_text_buffer.append",
                "text": text
            }))

            await ws.send(json.dumps({
                "type": "session.finish"
            }))

            async for message in ws:
                event = json.loads(message)
                event_type = event.get('type')

                if event_type == 'response.audio.delta':
                    audio_data = base64.b64decode(event['delta'])
                    audio_chunks.append(audio_data)
                elif event_type == 'session.finished':
                    break
                elif event_type == 'error':
                    raise RuntimeError(f"Aliyun API error: {event.get('error')}")

        pcm_data = b''.join(audio_chunks)
        wav_bytes = self._pcm_to_wav(pcm_data, 24000)
        return wav_bytes, 24000

    async def _create_voice_clone(self, ref_audio_bytes: bytes) -> str:
        from core.config import settings
        import httpx

        audio_b64 = base64.b64encode(ref_audio_bytes).decode()
        data_uri = f"data:audio/wav;base64,{audio_b64}"

        payload = {
            "model": "qwen-voice-enrollment",
            "input": {
                "action": "create",
                "target_model": settings.ALIYUN_MODEL_VC,
                "preferred_name": f"clone{int(time.time())}",
                "audio": {"data": data_uri}
            }
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        logger.info(f"Voice clone request payload (audio truncated): {{'model': '{payload['model']}', 'input': {{'action': '{payload['input']['action']}', 'target_model': '{payload['input']['target_model']}', 'preferred_name': '{payload['input']['preferred_name']}', 'audio': '<truncated>'}}}}")

        async with httpx.AsyncClient() as client:
            resp = await client.post(self.http_url, json=payload, headers=headers, timeout=60)

            if resp.status_code != 200:
                logger.error(f"Voice clone failed with status {resp.status_code}")
                logger.error(f"Response body: {resp.text}")

            resp.raise_for_status()
            result = resp.json()
            return result['output']['voice']

    async def _create_voice_design(self, instruct: str, preview_text: str) -> str:
        from core.config import settings
        import httpx

        payload = {
            "model": "qwen-voice-design",
            "input": {
                "action": "create",
                "target_model": settings.ALIYUN_MODEL_VD,
                "voice_prompt": instruct,
                "preview_text": preview_text,
                "preferred_name": f"design{int(time.time())}",
                "language": "zh"
            },
            "parameters": {
                "sample_rate": 24000,
                "response_format": "wav"
            }
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        logger.info(f"Voice design request payload: {payload}")

        async with httpx.AsyncClient() as client:
            resp = await client.post(self.http_url, json=payload, headers=headers, timeout=60)

            if resp.status_code != 200:
                logger.error(f"Voice design failed with status {resp.status_code}")
                logger.error(f"Response body: {resp.text}")

            resp.raise_for_status()
            result = resp.json()
            return result['output']['voice']

    async def health_check(self) -> dict:
        try:
            from core.config import settings
            url = f"{self.ws_url}?model={settings.ALIYUN_MODEL_FLASH}"
            headers = {"Authorization": f"Bearer {self.api_key}"}

            async with websockets.connect(url, additional_headers=headers, close_timeout=3) as ws:
                await ws.send(json.dumps({
                    "type": "session.update",
                    "session": {
                        "mode": "server_commit",
                        "voice": "Cherry",
                        "language_type": "zh",
                        "response_format": "pcm",
                        "sample_rate": 24000
                    }
                }))

                await ws.send(json.dumps({
                    "type": "input_text_buffer.append",
                    "text": "测试"
                }))

                await ws.send(json.dumps({
                    "type": "session.finish"
                }))

                async for message in ws:
                    event = json.loads(message)
                    event_type = event.get('type')

                    if event_type == 'error':
                        return {"available": False}
                    elif event_type in ['response.audio.delta', 'session.finished']:
                        return {"available": True}

            return {"available": True}
        except Exception as e:
            logger.warning(f"Aliyun health check failed: {e}")
            return {"available": False}

    @staticmethod
    def _pcm_to_wav(pcm_data: bytes, sample_rate: int) -> bytes:
        import io
        import wave

        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(pcm_data)

        wav_buffer.seek(0)
        return wav_buffer.read()

    @staticmethod
    def _map_speaker(local_speaker: str) -> str:
        mapping = {
            "Ono_Anna": "Ono Anna",
            "Female": "Cherry",
            "Male": "Ethan"
        }

        mapped = mapping.get(local_speaker)
        if mapped:
            return mapped

        return local_speaker


class TTSServiceFactory:
    _local_backend: Optional[LocalTTSBackend] = None
    _aliyun_backend: Optional[AliyunTTSBackend] = None
    _user_aliyun_backends: dict[str, AliyunTTSBackend] = {}

    @classmethod
    async def get_backend(cls, backend_type: str = None, user_api_key: Optional[str] = None) -> TTSBackend:
        from core.config import settings

        if backend_type is None:
            backend_type = settings.DEFAULT_BACKEND

        if backend_type == "local":
            if cls._local_backend is None:
                cls._local_backend = LocalTTSBackend()
                await cls._local_backend.initialize()
            return cls._local_backend

        elif backend_type == "aliyun":
            if not user_api_key:
                raise ValueError("Aliyun backend requires user API key. Please set your API key first.")

            if user_api_key not in cls._user_aliyun_backends:
                cls._user_aliyun_backends[user_api_key] = AliyunTTSBackend(
                    api_key=user_api_key,
                    region=settings.ALIYUN_REGION
                )
            return cls._user_aliyun_backends[user_api_key]

        else:
            raise ValueError(f"Unknown backend type: {backend_type}")
