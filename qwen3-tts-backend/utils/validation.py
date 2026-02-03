from typing import List, Dict

SUPPORTED_LANGUAGES = [
    "Chinese", "English", "Japanese", "Korean", "German",
    "French", "Russian", "Portuguese", "Spanish", "Italian",
    "Auto", "Cantonese"
]

SUPPORTED_SPEAKERS = [
    "Vivian", "Serena", "Uncle_Fu", "Dylan", "Eric",
    "Ryan", "Aiden", "Ono_Anna", "Sohee"
]

SPEAKER_DESCRIPTIONS = {
    "Vivian": "Female, professional and clear",
    "Serena": "Female, gentle and warm",
    "Uncle_Fu": "Male, mature and authoritative",
    "Dylan": "Male, young and energetic",
    "Eric": "Male, calm and steady",
    "Ryan": "Male, friendly and casual",
    "Aiden": "Male, deep and resonant",
    "Ono_Anna": "Female, cute and lively",
    "Sohee": "Female, soft and melodious"
}

ALIYUN_SPEAKERS = [
    "Vivian", "Serena", "Dylan", "Eric",
    "Ryan", "Aiden", "Ono_Anna", "Sohee"
]

ALIYUN_SPEAKER_DESCRIPTIONS = {
    "Vivian": "Female, cute and lively (十三 - 拽拽的、可爱的小暴躁)",
    "Serena": "Female, gentle and warm (苏瑶 - 温柔小姐姐)",
    "Dylan": "Male, young and energetic (北京-晓东 - 北京胡同里长大的少年)",
    "Eric": "Male, calm and steady (四川-程川 - 跳脱市井的四川成都男子)",
    "Ryan": "Male, friendly and dramatic (甜茶 - 节奏拉满,戏感炸裂)",
    "Aiden": "Male, deep and resonant (艾登 - 精通厨艺的美语大男孩)",
    "Ono_Anna": "Female, cute and playful (小野杏 - 鬼灵精怪的青梅竹马)",
    "Sohee": "Female, soft and melodious (素熙 - 温柔开朗的韩国欧尼)"
}

LOCAL_SPEAKERS = SUPPORTED_SPEAKERS.copy()

LOCAL_SPEAKER_DESCRIPTIONS = SPEAKER_DESCRIPTIONS.copy()


def validate_language(language: str) -> str:
    normalized = language.strip()

    for supported in SUPPORTED_LANGUAGES:
        if normalized.lower() == supported.lower():
            return supported

    raise ValueError(
        f"Unsupported language: {language}. "
        f"Supported languages: {', '.join(SUPPORTED_LANGUAGES)}"
    )


def validate_speaker(speaker: str, backend: str = "local") -> str:
    normalized = speaker.strip()

    if backend == "aliyun":
        speaker_list = ALIYUN_SPEAKERS
    else:
        speaker_list = LOCAL_SPEAKERS

    for supported in speaker_list:
        if normalized.lower() == supported.lower():
            return supported

    raise ValueError(
        f"Unsupported speaker: {speaker} for backend '{backend}'. "
        f"Supported speakers: {', '.join(speaker_list)}"
    )


def validate_text_length(text: str, max_length: int = 1000) -> str:
    if not text or not text.strip():
        raise ValueError("Text cannot be empty")

    if len(text) > max_length:
        raise ValueError(
            f"Text length ({len(text)}) exceeds maximum ({max_length})"
        )

    return text.strip()


def validate_generation_params(params: dict) -> dict:
    validated = {}

    validated['max_new_tokens'] = params.get('max_new_tokens', 2048)
    if not 128 <= validated['max_new_tokens'] <= 4096:
        raise ValueError("max_new_tokens must be between 128 and 4096")

    validated['temperature'] = params.get('temperature', 0.9)
    if not 0.1 <= validated['temperature'] <= 2.0:
        raise ValueError("temperature must be between 0.1 and 2.0")

    validated['top_k'] = params.get('top_k', 50)
    if not 1 <= validated['top_k'] <= 100:
        raise ValueError("top_k must be between 1 and 100")

    validated['top_p'] = params.get('top_p', 1.0)
    if not 0.0 <= validated['top_p'] <= 1.0:
        raise ValueError("top_p must be between 0.0 and 1.0")

    validated['repetition_penalty'] = params.get('repetition_penalty', 1.05)
    if not 1.0 <= validated['repetition_penalty'] <= 2.0:
        raise ValueError("repetition_penalty must be between 1.0 and 2.0")

    return validated


def get_supported_languages() -> List[str]:
    return SUPPORTED_LANGUAGES.copy()


def get_supported_speakers(backend: str = "local") -> List[dict]:
    if backend == "aliyun":
        speakers = ALIYUN_SPEAKERS
        descriptions = ALIYUN_SPEAKER_DESCRIPTIONS
    else:
        speakers = LOCAL_SPEAKERS
        descriptions = LOCAL_SPEAKER_DESCRIPTIONS

    return [
        {
            "name": speaker,
            "description": descriptions.get(speaker, "")
        }
        for speaker in speakers
    ]
