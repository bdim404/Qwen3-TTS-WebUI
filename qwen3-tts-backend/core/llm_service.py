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

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code != 200:
                logger.error(f"LLM API error {resp.status_code}: {resp.text}")
                resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def chat_json(self, system_prompt: str, user_message: str) -> Any:
        raw = await self.chat(system_prompt, user_message)
        raw = raw.strip()
        if raw.startswith("```"):
            lines = raw.split("\n")
            raw = "\n".join(lines[1:-1]) if len(lines) > 2 else raw
        return json.loads(raw)

    async def extract_characters(self, text: str) -> list[Dict]:
        system_prompt = (
            "你是一个专业的小说分析助手。请分析给定的小说文本，提取所有出现的角色（包括旁白narrator）。"
            "只输出JSON，格式如下，不要有其他文字：\n"
            '{"characters": [{"name": "narrator", "description": "第三人称叙述者", "instruct": "中年男声，语速平稳"}, ...]}'
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
