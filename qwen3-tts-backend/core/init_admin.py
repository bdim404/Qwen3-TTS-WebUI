import logging
from core.database import SessionLocal
from core.security import get_password_hash
from db.crud import count_users, create_user_by_admin

logger = logging.getLogger(__name__)

def init_superuser():
    db = SessionLocal()
    try:
        user_count = count_users(db)

        if user_count > 0:
            logger.info(f"Database already has {user_count} user(s), skipping admin initialization")
            return

        logger.info("No users found in database, initializing default superuser")

        hashed_password = get_password_hash("admin123456")
        admin_user = create_user_by_admin(
            db,
            username="admin",
            email="admin@example.com",
            hashed_password=hashed_password,
            is_superuser=True
        )

        logger.info(f"Default superuser created successfully: {admin_user.username}")
        logger.warning("SECURITY WARNING: Default admin credentials are in use!")
        logger.warning("  Username: admin")
        logger.warning("  Password: admin123456")
        logger.warning("  Please change the password immediately after first login!")

    except Exception as e:
        logger.error(f"Failed to initialize superuser: {e}")
        raise
    finally:
        db.close()
