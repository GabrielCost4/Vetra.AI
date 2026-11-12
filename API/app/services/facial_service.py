import logging

import cv2
import numpy as np
from deepface import DeepFace
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from uuid import UUID

from app.config import settings
from app.models.models import Face
from app.repositories.face_repository import face_repository
from app.schemas.face import RecognizeFaceResponse, RegisterFaceResponse
from app.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)


class FacialService:
    def __init__(self):
        self.embedding_service = EmbeddingService()
        self.repository = face_repository

    def recortar_rosto(self, image_bytes: bytes) -> np.ndarray:
        try:
            image = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
        except cv2.error as exc:
            raise HTTPException(status_code=400, detail="Imagem inválida.") from exc
        if image is None:
            raise HTTPException(status_code=400, detail="Imagem inválida.")

        height, width = image.shape[:2]
        if height * width > settings.max_image_pixels:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Imagem com resolução muito alta. "
                    f"Envie uma imagem com até {settings.max_image_pixels // 1_000_000} megapixels."
                ),
            )

        try:
            faces = DeepFace.extract_faces(
                img_path=image,
                detector_backend="opencv",
                enforce_detection=True,
                align=True,
                color_face="bgr",
                normalize_face=False,
            )
        except ValueError as exc:
            logger.exception("DeepFace falhou ao detectar rosto na imagem enviada.")
            raise HTTPException(status_code=422, detail="Nenhum rosto detectado na imagem.") from exc
        if len(faces) != 1:
            raise HTTPException(status_code=422, detail="Envie uma imagem com apenas um rosto.")
        return faces[0]["face"]

    def _process_image(self, image_bytes: bytes) -> list[float]:
        rosto = self.recortar_rosto(image_bytes)
        return self.embedding_service.gerar_embedding(rosto)

    async def register_face(self, name: str, image: UploadFile, db: Session) -> RegisterFaceResponse:
        name_clean = name.strip()
        if not name_clean:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O nome não pode ser vazio.",
            )

        image_bytes = await self._read_image(image)
        embedding = await run_in_threadpool(self._process_image, image_bytes)

        face = self.repository.create(db=db, name=name_clean, embedding=embedding)
        return RegisterFaceResponse(
            id=face.id,
            name=face.name,
            created_at=face.created_at,
            message="Rosto cadastrado com sucesso no banco de dados!",
        )

    async def recognize_face(self, image: UploadFile, db: Session) -> RecognizeFaceResponse:
        image_bytes = await self._read_image(image)
        embedding = await run_in_threadpool(self._process_image, image_bytes)

        face, distance = self.repository.search_most_similar(db=db, embedding=embedding)
        if face:
            confidence = round(max(0.0, (1.0 - distance) * 100), 2)
            return RecognizeFaceResponse(
                matched=True,
                id=face.id,
                name=face.name,
                distance=round(distance, 4),
                confidence=confidence,
                message=f"Rosto reconhecido com sucesso: {face.name}!",
            )

        dist_val = round(distance, 4) if distance is not None else None
        conf_val = round(max(0.0, (1.0 - distance) * 100), 2) if distance is not None else None
        return RecognizeFaceResponse(
            matched=False,
            id=None,
            name=None,
            distance=dist_val,
            confidence=conf_val,
            message="Nenhum rosto correspondente cadastrado encontrado.",
        )

    def list_faces(self, db: Session, skip: int = 0, limit: int = 100) -> list[Face]:
        return self.repository.find_all(db=db, skip=skip, limit=limit)

    def delete_face(self, face_id: UUID, db: Session) -> bool:
        return self.repository.delete(db=db, face_id=face_id)

    async def _read_image(self, image: UploadFile) -> bytes:
        if not image.content_type or not image.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Envie um arquivo de imagem válido (JPEG, PNG, etc).",
            )

        max_mb = settings.max_upload_bytes // (1024 * 1024)
        if image.size is not None and image.size > settings.max_upload_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"A imagem deve ter no máximo {max_mb} MB.",
            )

        content = await image.read()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O arquivo enviado está vazio.",
            )
        if len(content) > settings.max_upload_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"A imagem deve ter no máximo {max_mb} MB.",
            )

        return content


facial_service = FacialService()
