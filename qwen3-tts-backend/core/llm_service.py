import asyncio
import json
import logging
from typing import Any, Dict

import httpx

logger = logging.getLogger(__name__)


class LLMService:
    def __init__(self, base_url: str, api_key: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model

    async def stream_chat(self, system_prompt: str, user_message: str, on_token=None, max_tokens: int = 8192) -> str:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "temperature": 0.3,
            "max_tokens": max_tokens,
            "stream": True,
            "enable_thinking": False,
        }
        full_text = ""
        timeout = httpx.Timeout(connect=10.0, read=90.0, write=10.0, pool=5.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as resp:
                if resp.status_code != 200:
                    body = await resp.aread()
                    logger.error(f"LLM streaming error {resp.status_code}: {body}")
                    resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        delta = chunk["choices"][0]["delta"].get("content", "")
                        if delta:
                            full_text += delta
                            if on_token:
                                on_token(delta)
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue
        return full_text

    async def stream_chat_json(self, system_prompt: str, user_message: str, on_token=None, max_tokens: int = 8192):
        raw = await self.stream_chat(system_prompt, user_message, on_token, max_tokens=max_tokens)
        raw = raw.strip()
        if not raw:
            raise ValueError("LLM returned empty response")
        if raw.startswith("```"):
            lines = raw.split("\n")
            inner = lines[1:]
            if inner and inner[-1].strip().startswith("```"):
                inner = inner[:-1]
            raw = "\n".join(inner).strip()
        if not raw:
            raise ValueError("LLM returned empty JSON after stripping markdown")
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.error(f"JSON parse failed. Raw (first 500): {raw[:500]}")
            raise

    async def chat(self, system_prompt: str, user_message: str) -> str:
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "temperature": 0.3,
            "max_tokens": 8192,
            "enable_thinking": False,
        }

        timeout = httpx.Timeout(connect=10.0, read=90.0, write=10.0, pool=5.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code != 200:
                logger.error(f"LLM API error {resp.status_code}: {resp.text}")
                resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def chat_json(self, system_prompt: str, user_message: str) -> Any:
        raw = await self.chat(system_prompt, user_message)
        raw = raw.strip()
        if not raw:
            raise ValueError("LLM returned empty response")
        if raw.startswith("```"):
            lines = raw.split("\n")
            inner = lines[1:]
            if inner and inner[-1].strip().startswith("```"):
                inner = inner[:-1]
            raw = "\n".join(inner).strip()
        if not raw:
            raise ValueError("LLM returned empty JSON after stripping markdown")
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse failed. Raw response (first 500 chars): {raw[:500]}")
            raise

    async def extract_characters(self, text_samples: list[str], on_token=None, on_sample=None, turbo: bool = False) -> list[Dict]:
        system_prompt = (
            "你是一个专业的小说分析助手兼声音导演。请分析给定的小说文本，提取所有出现的角色（包括旁白narrator）。\n"
            "gender字段必须明确标注性别，只能取以下三个值之一：\"男\"、\"女\"、\"未知\"。\n"
            "narrator的gender固定为\"未知\"。\n"
            "对每个角色，instruct字段必须是详细的声音导演说明，需覆盖以下六个维度，每个维度单独一句，用换行分隔：\n"
            "1. 音色信息：嗓音质感、音域、音量、气息特征（例如，如果是女性角色，此处必须以'女性声音'开头，如：'女性声音，清脆悦耳的高音，嗓音纤细干净，带有一点点少女感'；男性角色则以'男性声音'开头）\n"
            "2. 身份背景：角色身份、职业、出身、所处时代背景对声音的影响\n"
            "3. 年龄设定：具体年龄段及其在声音上的体现\n"
            "4. 外貌特征：体型、面容、精神状态等可影响声音感知的特征\n"
            "5. 性格特质：核心性格、情绪模式、表达习惯\n"
            "6. 叙事风格：语速节奏、停顿习惯、语气色彩、整体叙述感\n\n"
            "注意：instruct 的第一行（音色信息）必须与 gender 字段保持一致。如果 gender 为女，第一行绝对不能出现'男性'字样。\n\n"
            "只输出JSON，格式如下，不要有其他文字：\n"
            '{"characters": [{"name": "narrator", "gender": "未知", "description": "第三人称叙述者", "instruct": "音色信息：...\\n身份背景：...\\n年龄设定：...\\n外貌特征：...\\n性格特质：...\\n叙事风格：..."}, ...]}'
        )
        if turbo and len(text_samples) > 1:
            logger.info(f"Extracting characters in turbo mode: {len(text_samples)} samples concurrent")

            async def _extract_one(i: int, sample: str) -> list[Dict]:
                user_message = f"请分析以下小说文本并提取角色：\n\n{sample}"
                result = await self.stream_chat_json(system_prompt, user_message, None)
                if on_sample:
                    on_sample(i, len(text_samples))
                return result.get("characters", [])

            results = await asyncio.gather(
                *[_extract_one(i, s) for i, s in enumerate(text_samples)],
                return_exceptions=True,
            )
            raw_all: list[Dict] = []
            for i, r in enumerate(results):
                if isinstance(r, Exception):
                    logger.warning(f"Character extraction failed for sample {i+1}: {r}")
                else:
                    raw_all.extend(r)
            return await self.merge_characters(raw_all)

        raw_all: list[Dict] = []
        for i, sample in enumerate(text_samples):
            logger.info(f"Extracting characters from sample {i+1}/{len(text_samples)}")
            user_message = f"请分析以下小说文本并提取角色：\n\n{sample}"
            try:
                result = await self.stream_chat_json(system_prompt, user_message, on_token)
                raw_all.extend(result.get("characters", []))
            except Exception as e:
                logger.warning(f"Character extraction failed for sample {i+1}: {e}")
            if on_sample:
                on_sample(i, len(text_samples))
        if len(text_samples) == 1:
            return raw_all
        return await self.merge_characters(raw_all)

    async def merge_characters(self, raw_characters: list[Dict]) -> list[Dict]:
        system_prompt = (
            "你是一个专业的小说角色整合助手。你收到的是从同一本书不同段落中提取的角色列表，其中可能存在重复。\n"
            "请完成以下任务：\n"
            "1. 识别并合并重复角色：通过名字完全相同或高度相似（全名与简称、不同译写）来判断。\n"
            "2. 合并时保留最完整、最详细的 description 和 instruct 字段，gender 字段以最明确的值为准（优先选\"男\"或\"女\"，而非\"未知\"）。\n"
            "3. narrator 角色只保留一个，其 gender 固定为\"未知\"。\n"
            "4. 去除无意义的占位角色（name 为空或仅含标点）。\n"
            "gender 字段只能取 \"男\"、\"女\"、\"未知\" 之一。\n"
            "只输出 JSON，不要有其他文字：\n"
            '{"characters": [{"name": "...", "gender": "男", "description": "...", "instruct": "..."}, ...]}'
        )
        user_message = f"请整合以下角色列表：\n\n{json.dumps(raw_characters, ensure_ascii=False, indent=2)}"
        try:
            result = await self.chat_json(system_prompt, user_message)
            return result.get("characters", [])
        except Exception as e:
            logger.warning(f"Character merge failed, falling back to name-dedup: {e}")
            seen: dict[str, Dict] = {}
            for c in raw_characters:
                name = c.get("name", "")
                if name and name not in seen:
                    seen[name] = c
            return list(seen.values())

    async def parse_chapter_segments(self, chapter_text: str, character_names: list[str], on_token=None) -> list[Dict]:
        names_str = "、".join(character_names)
        system_prompt = (
            "你是一个专业的有声书制作助手。请将给定的章节文本解析为对话片段列表。"
            f"已知角色列表（必须从中选择）：{names_str}。"
            "所有非对话的叙述文字归属于narrator角色。"
            "只输出JSON数组，不要有其他文字，格式如下：\n"
            '[{"character": "narrator", "text": "叙述文字"}, {"character": "角色名", "text": "对话内容"}, ...]'
        )
        user_message = f"请解析以下章节文本：\n\n{chapter_text}"
        result = await self.stream_chat_json(system_prompt, user_message, on_token, max_tokens=16384)
        if isinstance(result, list):
            return result
        return []
