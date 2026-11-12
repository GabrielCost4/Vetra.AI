from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.schemas.face import FaceResponse, RecognizeFaceResponse, RegisterFaceResponse
from app.services.facial_service import facial_service

router = APIRouter(
    prefix="/api/faces",
    tags=["Faces"],
)


@router.post(
    "/register",
    response_model=RegisterFaceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar um novo rosto",
)
async def register_face(
    name: str = Form(..., min_length=1, max_length=150),
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    return await facial_service.register_face(name=name, image=image, db=db)


@router.post(
    "/recognize",
    response_model=RecognizeFaceResponse,
    status_code=status.HTTP_200_OK,
    summary="Reconhecer um rosto a partir da imagem",
)
async def recognize_face(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    return await facial_service.recognize_face(image=image, db=db)


@router.get(
    "",
    response_model=list[FaceResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar rostos cadastrados",
)
def list_faces(
    skip: int = Query(default=0, ge=0, description="Registros a ignorar."),
    limit: int = Query(default=100, ge=1, le=200, description="Máximo de registros retornados."),
    db: Session = Depends(get_db),
):
    return facial_service.list_faces(db=db, skip=skip, limit=limit)


@router.delete(
    "/{face_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir um rosto cadastrado",
)
def delete_face(
    face_id: UUID,
    db: Session = Depends(get_db),
):
    success = facial_service.delete_face(face_id=face_id, db=db)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rosto não encontrado.",
        )
    return None
