from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class FaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    created_at: datetime


class RegisterFaceResponse(BaseModel):
    id: UUID
    name: str
    created_at: datetime
    message: str


class RecognizeFaceResponse(BaseModel):
    matched: bool
    id: UUID | None = None
    name: str | None = None
    distance: float | None = None
    confidence: float | None = None
    message: str
