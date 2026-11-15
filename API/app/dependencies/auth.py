from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.models import User
from app.repositories.user_repository import user_repository
from app.services.auth_service import auth_service, unauthorized

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized()
    user_id = auth_service.get_token_user_id(credentials.credentials)
    user = user_repository.find_by_id(db, user_id)
    if user is None:
        raise unauthorized()
    return user


def get_face_owner(
    user: Annotated[User, Depends(get_current_user)],
    user_id: Annotated[UUID, Header(alias="X-User-Id")],
) -> UUID:
    if user_id != user.id:
        raise HTTPException(
            status_code=403, detail="O usuário informado não pertence à sessão."
        )
    return user.id
