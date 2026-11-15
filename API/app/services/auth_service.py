import os
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from uuid import UUID

import bcrypt
import jwt
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.models import User
from app.repositories.user_repository import user_repository
from app.schemas.auth import AuthResponse, RegisterRequest, UserResponse

TOKEN_LIFETIME_SECONDS = 3600
TOKEN_ISSUER = "vetra-api"
TOKEN_AUDIENCE = "vetra-web"
# A valid bcrypt hash ensures unknown emails follow the password-check path too.
DUMMY_PASSWORD_HASH = b"$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxJXW0X6I9mqfnCDgGvpgQFZrQO"


@lru_cache
def get_jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET_KEY", "")
    if len(secret.encode("utf-8")) < 32:
        raise RuntimeError(
            "Configure JWT_SECRET_KEY com pelo menos 32 bytes aleatórios."
        )
    return secret


def unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sessão inválida ou expirada. Entre novamente.",
        headers={"WWW-Authenticate": "Bearer"},
    )


class AuthService:
    def register(self, db: Session, data: RegisterRequest) -> AuthResponse:
        if user_repository.find_by_email(db, str(data.email)):
            raise HTTPException(
                status_code=409, detail="Este email já está cadastrado."
            )
        password_hash = bcrypt.hashpw(
            data.password.encode("utf-8"), bcrypt.gensalt()
        ).decode("ascii")
        try:
            user = user_repository.create(db, data.name, str(data.email), password_hash)
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=409, detail="Este email já está cadastrado."
            ) from exc
        return self.create_session(user)

    def login(self, db: Session, email: str, password: str) -> AuthResponse:
        user = user_repository.find_by_email(db, email)
        stored_hash = (
            user.password_hash.encode("ascii") if user else DUMMY_PASSWORD_HASH
        )
        valid_password = bcrypt.checkpw(password.encode("utf-8"), stored_hash)
        if not user or not valid_password:
            raise HTTPException(
                status_code=401,
                detail="Email ou senha incorretos.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return self.create_session(user)

    def create_session(self, user: User) -> AuthResponse:
        now = datetime.now(timezone.utc)
        token = jwt.encode(
            {
                "sub": str(user.id),
                "iat": now,
                "exp": now + timedelta(seconds=TOKEN_LIFETIME_SECONDS),
                "iss": TOKEN_ISSUER,
                "aud": TOKEN_AUDIENCE,
            },
            get_jwt_secret(),
            algorithm="HS256",
        )
        return AuthResponse(
            access_token=token,
            expires_in=TOKEN_LIFETIME_SECONDS,
            user=UserResponse.model_validate(user),
        )

    def get_token_user_id(self, token: str) -> UUID:
        try:
            claims = jwt.decode(
                token,
                get_jwt_secret(),
                algorithms=["HS256"],
                issuer=TOKEN_ISSUER,
                audience=TOKEN_AUDIENCE,
                options={"require": ["sub", "exp", "iat", "iss", "aud"]},
            )
            return UUID(claims["sub"])
        except (jwt.InvalidTokenError, ValueError, TypeError) as exc:
            raise unauthorized() from exc


auth_service = AuthService()
