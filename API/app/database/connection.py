from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings

DATABASE_URL = settings.database_url
if not DATABASE_URL:
    raise RuntimeError(
        "Configure DATABASE_URL no ambiente ou no arquivo infra/.env antes de iniciar a API."
    )

engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
