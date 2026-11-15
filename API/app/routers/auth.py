from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.dependencies.auth import get_current_user
from app.models.models import User
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserResponse
from app.services.auth_service import auth_service

router = APIRouter(prefix="/api/auth", tags=["Autenticação"])


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(
    data: RegisterRequest, response: Response, db: Annotated[Session, Depends(get_db)]
):
    response.headers["Cache-Control"] = "no-store"
    return auth_service.register(db, data)


@router.post("/login", response_model=AuthResponse)
def login(
    data: LoginRequest, response: Response, db: Annotated[Session, Depends(get_db)]
):
    response.headers["Cache-Control"] = "no-store"
    return auth_service.login(db, str(data.email), data.password)


@router.get("/me", response_model=UserResponse)
def me(response: Response, user: Annotated[User, Depends(get_current_user)]):
    response.headers["Cache-Control"] = "no-store"
    return user
