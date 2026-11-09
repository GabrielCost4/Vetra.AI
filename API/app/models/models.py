from datetime import datetime
from uuid import UUID, uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Face(Base):
    __tablename__ = "faces"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(150))
    embedding: Mapped[list[float]] = mapped_column(Vector(512))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
