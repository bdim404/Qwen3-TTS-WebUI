from sqlalchemy import create_engine, text
from core.config import settings

def migrate():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN can_use_local_model BOOLEAN DEFAULT 0 NOT NULL"
        ))
        conn.execute(text(
            "UPDATE users SET can_use_local_model = 1 WHERE is_superuser = 1"
        ))
        conn.commit()
    print("Migration completed: Added can_use_local_model column")

if __name__ == "__main__":
    migrate()
