from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(max_length=254)
    password: str = Field(min_length=1, max_length=20, repr=False)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value) > 20:
            raise ValueError("A senha deve ter no máximo 20 caracteres.")
        if len(value.encode("utf-8")) > 72:
            raise ValueError("A senha ultrapassa o limite de bytes do bcrypt.")
        return value


class RegisterRequest(LoginRequest):
    name: str = Field(min_length=2, max_length=150)
    password: str = Field(min_length=8, max_length=20, repr=False)

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        return " ".join(value.split()) if isinstance(value, str) else value

    @field_validator("password")
    @classmethod
    def validate_password_content(cls, value: str) -> str:
        if value.isspace():
            raise ValueError("A senha não pode conter apenas espaços.")
        return value


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: str
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
