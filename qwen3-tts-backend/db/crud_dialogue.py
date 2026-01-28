from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_

from db.models_dialogue import (
    VoiceLibrary, Character, Dialogue, DialogueLine, DialogueGenerationJob
)

def create_voice_library(
    db: Session,
    user_id: int,
    name: str,
    voice_type: str,
    voice_data: Dict[str, Any],
    description: Optional[str] = None,
    tags: Optional[List[str]] = None,
    preview_audio_path: Optional[str] = None
) -> VoiceLibrary:
    voice_library = VoiceLibrary(
        user_id=user_id,
        name=name,
        description=description,
        voice_type=voice_type,
        voice_data=voice_data,
        tags=tags or [],
        preview_audio_path=preview_audio_path
    )
    db.add(voice_library)
    db.commit()
    db.refresh(voice_library)
    return voice_library

def get_voice_libraries(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 10,
    tags: Optional[List[str]] = None
) -> tuple[List[VoiceLibrary], int]:
    query = db.query(VoiceLibrary).filter(VoiceLibrary.user_id == user_id)

    if tags:
        for tag in tags:
            query = query.filter(VoiceLibrary.tags.contains([tag]))

    total = query.count()
    items = query.order_by(VoiceLibrary.created_at.desc()).offset(skip).limit(limit).all()
    return items, total

def get_voice_library(db: Session, voice_id: int, user_id: int) -> Optional[VoiceLibrary]:
    return db.query(VoiceLibrary).filter(
        VoiceLibrary.id == voice_id,
        VoiceLibrary.user_id == user_id
    ).first()

def update_voice_library(
    db: Session,
    voice_id: int,
    user_id: int,
    **kwargs
) -> Optional[VoiceLibrary]:
    voice_library = get_voice_library(db, voice_id, user_id)
    if not voice_library:
        return None

    for key, value in kwargs.items():
        if value is not None and hasattr(voice_library, key):
            setattr(voice_library, key, value)

    db.commit()
    db.refresh(voice_library)
    return voice_library

def delete_voice_library(db: Session, voice_id: int, user_id: int) -> bool:
    voice_library = get_voice_library(db, voice_id, user_id)
    if not voice_library:
        return False

    character_count = db.query(Character).filter(
        Character.voice_library_id == voice_id
    ).count()

    if character_count > 0:
        raise ValueError(f"该音色正在被 {character_count} 个角色使用，无法删除")

    db.delete(voice_library)
    db.commit()
    return True

def create_character(
    db: Session,
    user_id: int,
    name: str,
    voice_source_type: str,
    avatar_type: str,
    color: str,
    voice_library_id: Optional[int] = None,
    preset_speaker: Optional[str] = None,
    default_instruct: Optional[str] = None,
    avatar_data: Optional[str] = None,
    description: Optional[str] = None,
    tags: Optional[List[str]] = None,
    default_tts_params: Optional[Dict[str, Any]] = None
) -> Character:
    character = Character(
        user_id=user_id,
        name=name,
        description=description,
        voice_source_type=voice_source_type,
        voice_library_id=voice_library_id,
        preset_speaker=preset_speaker,
        default_instruct=default_instruct,
        avatar_type=avatar_type,
        avatar_data=avatar_data,
        color=color,
        tags=tags or [],
        default_tts_params=default_tts_params
    )
    db.add(character)
    db.commit()
    db.refresh(character)
    return character

def get_characters(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 10,
    tags: Optional[List[str]] = None
) -> tuple[List[Character], int]:
    query = db.query(Character).filter(Character.user_id == user_id)

    if tags:
        for tag in tags:
            query = query.filter(Character.tags.contains([tag]))

    total = query.count()
    items = query.order_by(Character.created_at.desc()).offset(skip).limit(limit).all()
    return items, total

def get_character(db: Session, character_id: int, user_id: int) -> Optional[Character]:
    return db.query(Character).filter(
        Character.id == character_id,
        Character.user_id == user_id
    ).first()

def update_character(
    db: Session,
    character_id: int,
    user_id: int,
    **kwargs
) -> Optional[Character]:
    character = get_character(db, character_id, user_id)
    if not character:
        return None

    for key, value in kwargs.items():
        if value is not None and hasattr(character, key):
            setattr(character, key, value)

    character.last_used_at = datetime.utcnow()
    db.commit()
    db.refresh(character)
    return character

def delete_character(db: Session, character_id: int, user_id: int) -> bool:
    character = get_character(db, character_id, user_id)
    if not character:
        return False

    line_count = db.query(DialogueLine).filter(
        DialogueLine.character_id == character_id
    ).count()

    if line_count > 0:
        raise ValueError(f"该角色正在被 {line_count} 个对话使用，无法删除")

    db.delete(character)
    db.commit()
    return True

def create_dialogue(
    db: Session,
    user_id: int,
    title: str,
    merge_config: Optional[Dict[str, Any]] = None
) -> Dialogue:
    dialogue = Dialogue(
        user_id=user_id,
        title=title,
        merge_config=merge_config or {
            "mode": "intelligent",
            "base_interval": 0.5,
            "short_text_adjust": -0.2,
            "long_text_adjust": 0.3,
            "same_character_adjust": -0.1,
            "different_character_adjust": 0.1,
            "min_interval": 0.3,
            "max_interval": 2.0
        }
    )
    db.add(dialogue)
    db.commit()
    db.refresh(dialogue)
    return dialogue

def get_dialogues(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None
) -> tuple[List[Dialogue], int]:
    query = db.query(Dialogue).filter(Dialogue.user_id == user_id)

    if status:
        query = query.filter(Dialogue.status == status)

    total = query.count()
    items = query.order_by(Dialogue.created_at.desc()).offset(skip).limit(limit).all()
    return items, total

def get_dialogue(db: Session, dialogue_id: int, user_id: int) -> Optional[Dialogue]:
    return db.query(Dialogue).filter(
        Dialogue.id == dialogue_id,
        Dialogue.user_id == user_id
    ).first()

def update_dialogue(
    db: Session,
    dialogue_id: int,
    user_id: int,
    **kwargs
) -> Optional[Dialogue]:
    dialogue = get_dialogue(db, dialogue_id, user_id)
    if not dialogue:
        return None

    for key, value in kwargs.items():
        if value is not None and hasattr(dialogue, key):
            setattr(dialogue, key, value)

    dialogue.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(dialogue)
    return dialogue

def delete_dialogue(db: Session, dialogue_id: int, user_id: int) -> bool:
    dialogue = get_dialogue(db, dialogue_id, user_id)
    if not dialogue:
        return False

    db.delete(dialogue)
    db.commit()
    return True

def create_dialogue_line(
    db: Session,
    dialogue_id: int,
    character_id: int,
    text: str,
    order: Optional[int] = None,
    instruct_override: Optional[str] = None,
    tts_params_override: Optional[Dict[str, Any]] = None
) -> Optional[DialogueLine]:
    dialogue = db.query(Dialogue).filter(Dialogue.id == dialogue_id).first()
    if not dialogue:
        return None

    if order is None:
        max_order = db.query(DialogueLine).filter(
            DialogueLine.dialogue_id == dialogue_id
        ).count()
        order = max_order

    if dialogue.total_lines >= 200:
        raise ValueError("对话行数已达到上限 200 条")

    line = DialogueLine(
        dialogue_id=dialogue_id,
        character_id=character_id,
        order=order,
        text=text,
        instruct_override=instruct_override,
        tts_params_override=tts_params_override
    )
    db.add(line)

    dialogue.total_lines += 1
    dialogue.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(line)
    return line

def get_dialogue_lines(db: Session, dialogue_id: int) -> List[DialogueLine]:
    return db.query(DialogueLine).filter(
        DialogueLine.dialogue_id == dialogue_id
    ).order_by(DialogueLine.order).all()

def get_dialogue_line(db: Session, line_id: int) -> Optional[DialogueLine]:
    return db.query(DialogueLine).filter(DialogueLine.id == line_id).first()

def update_dialogue_line(
    db: Session,
    line_id: int,
    **kwargs
) -> Optional[DialogueLine]:
    line = get_dialogue_line(db, line_id)
    if not line:
        return None

    for key, value in kwargs.items():
        if key != 'id' and key != 'dialogue_id' and hasattr(line, key):
            setattr(line, key, value)

    line.updated_at = datetime.utcnow()

    if line.status == "completed" and any(k in kwargs for k in ['text', 'character_id', 'instruct_override', 'tts_params_override']):
        line.status = "pending"

    db.commit()
    db.refresh(line)
    return line

def delete_dialogue_line(db: Session, line_id: int) -> bool:
    line = get_dialogue_line(db, line_id)
    if not line:
        return False

    dialogue_id = line.dialogue_id
    order = line.order

    db.delete(line)

    remaining_lines = db.query(DialogueLine).filter(
        DialogueLine.dialogue_id == dialogue_id,
        DialogueLine.order > order
    ).all()

    for remaining_line in remaining_lines:
        remaining_line.order -= 1

    dialogue = db.query(Dialogue).filter(Dialogue.id == dialogue_id).first()
    if dialogue:
        dialogue.total_lines -= 1
        dialogue.updated_at = datetime.utcnow()

    db.commit()
    return True

def reorder_dialogue_lines(db: Session, dialogue_id: int, line_ids: List[int]) -> bool:
    lines = db.query(DialogueLine).filter(
        DialogueLine.dialogue_id == dialogue_id,
        DialogueLine.id.in_(line_ids)
    ).all()

    if len(lines) != len(line_ids):
        return False

    line_map = {line.id: line for line in lines}

    for new_order, line_id in enumerate(line_ids):
        if line_id in line_map:
            line_map[line_id].order = new_order

    dialogue = db.query(Dialogue).filter(Dialogue.id == dialogue_id).first()
    if dialogue:
        dialogue.updated_at = datetime.utcnow()

    db.commit()
    return True
