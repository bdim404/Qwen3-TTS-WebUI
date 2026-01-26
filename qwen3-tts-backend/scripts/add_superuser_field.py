import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from core.database import engine

def add_superuser_field():
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_superuser BOOLEAN NOT NULL DEFAULT 0"))
            conn.commit()
            print("Successfully added is_superuser field to users table")
    except Exception as e:
        if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
            print("is_superuser field already exists, skipping")
        else:
            print(f"Error adding is_superuser field: {e}")
            raise

if __name__ == "__main__":
    add_superuser_field()
