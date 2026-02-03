import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "qwen_tts.db")

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT user_preferences FROM users LIMIT 1")
        print("Column user_preferences already exists, skipping migration")
    except sqlite3.OperationalError:
        print("Adding user_preferences column to users table...")
        cursor.execute("""
            ALTER TABLE users
            ADD COLUMN user_preferences TEXT DEFAULT NULL
        """)

        cursor.execute("SELECT id FROM users")
        user_ids = cursor.fetchall()

        default_prefs = json.dumps({"default_backend": "local", "onboarding_completed": False})
        for (user_id,) in user_ids:
            cursor.execute(
                "UPDATE users SET user_preferences = ? WHERE id = ?",
                (default_prefs, user_id)
            )

        conn.commit()
        print(f"Migration completed: Added user_preferences column and initialized {len(user_ids)} users")

    conn.close()

if __name__ == "__main__":
    migrate()
