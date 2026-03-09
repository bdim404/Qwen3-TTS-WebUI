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

    async def extract_characters(self, text: str) -> list[Dict]:
        system_prompt = (
            "你是一个专业的小说分析助手兼声音导演。请分析给定的小说文本，提取所有出现的角色（包括旁白narrator）。\n"
            "对每个角色，instruct字段必须是详细的声音导演说明，需覆盖以下六个维度，每个维度单独一句，用换行分隔：\n"
            "1. 音色信息：嗓音质感、音域、音量、气息特征（如：青年男性中低音，音色干净略带沙哑，音量偏小但稳定，情绪激动时呼吸明显）\n"
            "2. 身份背景：角色身份、职业、出身、所处时代背景对声音的影响\n"
            "3. 年龄设定：具体年龄段及其在声音上的体现\n"
            "4. 外貌特征：体型、面容、精神状态等可影响声音感知的特征\n"
            "5. 性格特质：核心性格、情绪模式、表达习惯\n"
            "6. 叙事风格：语速节奏、停顿习惯、语气色彩、整体叙述感\n\n"
            "只输出JSON，格式如下，不要有其他文字：\n"
            '{"characters": [{"name": "narrator", "description": "第三人称叙述者", "instruct": "音色信息：...\\n身份背景：...\\n年龄设定：...\\n外貌特征：...\\n性格特质：...\\n叙事风格：..."}, ...]}'
        )
        user_message = f"请分析以下小说文本并提取角色：\n\n{text[:30000]}"
        result = await self.chat_json(system_prompt, user_message)
        return result.get("characters", [])

    async def parse_chapter_segments(self, chapter_text: str, character_names: list[str]) -> list[Dict]:
        names_str = "、".join(character_names)
        system_prompt = (
            "你是一个专业的有声书制作助手。请将给定的章节文本解析为对话片段列表。"
            f"已知角色列表（必须从中选择）：{names_str}。"
            "所有非对话的叙述文字归属于narrator角色。"
            "只输出JSON数组，不要有其他文字，格式如下：\n"
            '[{"character": "narrator", "text": "叙述文字"}, {"character": "角色名", "text": "对话内容"}, ...]'
        )
        user_message = f"请解析以下章节文本：\n\n{chapter_text}"
        result = await self.chat_json(system_prompt, user_message)
        if isinstance(result, list):
            return result
        return []
