from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool

from config import settings

_is_sqlite = "sqlite" in settings.DATABASE_URL

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    poolclass=NullPool if _is_sqlite else None,
)

if _is_sqlite:
    @event.listens_for(engine, "connect")
    def _set_wal(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA journal_mode=WAL")
        dbapi_conn.execute("PRAGMA synchronous=NORMAL")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
    if "sqlite" in str(engine.url):
        with engine.connect() as conn:
            try:
                conn.execute(__import__("sqlalchemy").text(
                    "ALTER TABLE audiobook_characters ADD COLUMN gender VARCHAR(20)"
                ))
                conn.commit()
            except Exception:
                pass
