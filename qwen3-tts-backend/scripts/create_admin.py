import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.database import SessionLocal
from core.security import get_password_hash
from db.crud import get_user_by_username, create_user_by_admin

def create_admin():
    db = SessionLocal()
    try:
        existing_admin = get_user_by_username(db, username="admin")
        if existing_admin:
            print("Admin user already exists")
            if not existing_admin.is_superuser:
                existing_admin.is_superuser = True
                db.commit()
                print("Updated existing admin user to superuser")
            return

        hashed_password = get_password_hash("admin123456")
        admin_user = create_user_by_admin(
            db,
            username="admin",
            email="admin@example.com",
            hashed_password=hashed_password,
            is_superuser=True
        )
        print(f"Created admin user successfully: {admin_user.username}")
        print("Username: admin")
        print("Password: admin123456")
    except Exception as e:
        print(f"Error creating admin user: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()
