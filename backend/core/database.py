import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from .config import get_settings

settings = get_settings()

# Railway/Heroku provide DATABASE_URL starting with postgres:// but SQLAlchemy 1.4+
# requires postgresql://. Fix the scheme if needed.
_db_url = settings.database_url
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql://", 1)

# SQLite doesn't support pool_size / max_overflow
if _db_url.startswith("sqlite"):
    engine = create_engine(_db_url)
else:
    engine = create_engine(
        _db_url,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
