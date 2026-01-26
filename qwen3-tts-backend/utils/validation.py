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


def validate_language(language: str) -> str:
    normalized = language.strip()

    for supported in SUPPORTED_LANGUAGES:
        if normalized.lower() == supported.lower():
            return supported

    raise ValueError(
        f"Unsupported language: {language}. "
        f"Supported languages: {', '.join(SUPPORTED_LANGUAGES)}"
    )


def validate_speaker(speaker: str) -> str:
    normalized = speaker.strip()

    for supported in SUPPORTED_SPEAKERS:
        if normalized.lower() == supported.lower():
            return supported

    raise ValueError(
        f"Unsupported speaker: {speaker}. "
        f"Supported speakers: {', '.join(SUPPORTED_SPEAKERS)}"
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


def get_supported_speakers() -> List[dict]:
    return [
        {
            "name": speaker,
            "description": SPEAKER_DESCRIPTIONS.get(speaker, "")
        }
        for speaker in SUPPORTED_SPEAKERS
    ]
