from uuid import UUID

from pydantic import BaseModel


class RegisterFaceResponse(BaseModel):
    id: UUID
    name: str


class RecognizeFaceResponse(BaseModel):
    id: UUID | None = None
    name: str | None = None
