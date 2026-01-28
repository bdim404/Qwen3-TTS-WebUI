import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from db.database import Base, engine
from db.models import User, Job, VoiceCache
from db.models_dialogue import (
    VoiceLibrary, Character, Dialogue, DialogueLine, DialogueGenerationJob
)

def init_dialogue_tables():
    print("Creating dialogue-related tables...")

    Base.metadata.create_all(bind=engine)

    print("✓ Tables created successfully!")
    print("\nCreated tables:")
    print("  - voice_libraries")
    print("  - characters")
    print("  - dialogues")
    print("  - dialogue_lines")
    print("  - dialogue_generation_jobs")

if __name__ == "__main__":
    init_dialogue_tables()
