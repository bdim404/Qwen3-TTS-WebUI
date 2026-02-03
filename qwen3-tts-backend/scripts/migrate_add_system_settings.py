from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent.parent))

from config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def upgrade():
    db = SessionLocal()
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS system_settings (
                id INTEGER PRIMARY KEY,
                key VARCHAR(100) UNIQUE NOT NULL,
                value JSON NOT NULL,
                updated_at DATETIME NOT NULL
            )
        """))

        db.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_system_settings_key ON system_settings (key)
        """))

        result = db.execute(text(
            "SELECT COUNT(*) as count FROM system_settings WHERE key = 'local_model_enabled'"
        ))
        count = result.fetchone()[0]

        if count == 0:
            db.execute(text(
                "INSERT INTO system_settings (key, value, updated_at) VALUES "
                "('local_model_enabled', '{\"enabled\": false}', :now)"
            ), {"now": datetime.utcnow()})

        db.execute(text("""
            UPDATE users
            SET user_preferences = json_set(
                COALESCE(user_preferences, '{}'),
                '$.default_backend',
                'aliyun'
            )
            WHERE json_extract(user_preferences, '$.default_backend') IS NULL
               OR json_extract(user_preferences, '$.default_backend') = 'local'
        """))

        db.commit()
        print("Migration completed successfully!")
        print("- Created system_settings table")
        print("- Added local_model_enabled setting (default: false)")
        print("- Updated user preferences to use aliyun backend by default")

    except Exception as e:
        db.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    upgrade()
