from __future__ import annotations

import logging
from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.models.models import Face
from app.repositories.face_repository import face_repository
from app.schemas.face import RecognizeFaceResponse, RegisterFaceResponse

if TYPE_CHECKING:
    import numpy as np

logger = logging.getLogger(__name__)


class FacialService:
    def __init__(self):
        self.repository = face_repository

    def recortar_rosto(self, image_bytes: bytes) -> np.ndarray:
        import cv2
        import numpy as np
        from deepface import DeepFace

        try:
            image = cv2.imdecode(
                np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR
            )
        except cv2.error as exc:
            raise HTTPException(status_code=400, detail="Imagem inválida.") from exc
        if image is None:
            raise HTTPException(status_code=400, detail="Imagem inválida.")

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
            raise HTTPException(
                status_code=422, detail="Nenhum rosto detectado na imagem."
            ) from exc
        if len(faces) != 1:
            raise HTTPException(
                status_code=422, detail="Envie uma imagem com apenas um rosto."
            )
        return faces[0]["face"]

    def _process_image(self, image_bytes: bytes) -> list[float]:
        from app.services.embedding_service import EmbeddingService

        rosto = self.recortar_rosto(image_bytes)
        return EmbeddingService().gerar_embedding(rosto)

    async def register_face(
        self, name: str, image: UploadFile, db: Session, user_id: UUID
    ) -> RegisterFaceResponse:
        name_clean = name.strip()
        if not name_clean or len(name_clean) > 150:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Informe um nome com 1 a 150 caracteres.",
            )

        image_bytes = await self._read_image(image)
        embedding = await run_in_threadpool(self._process_image, image_bytes)

        face = self.repository.create(
            db=db, name=name_clean, embedding=embedding, user_id=user_id
        )
        return RegisterFaceResponse(
            id=face.id,
            user_id=face.user_id,
            name=face.name,
            created_at=face.created_at,
            message="Rosto cadastrado com sucesso no banco de dados!",
        )

    async def recognize_face(
        self, image: UploadFile, db: Session, user_id: UUID
    ) -> RecognizeFaceResponse:
        image_bytes = await self._read_image(image)
        embedding = await run_in_threadpool(self._process_image, image_bytes)

        face, distance = self.repository.search_most_similar(
            db=db, embedding=embedding, user_id=user_id
        )
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
        conf_val = (
            round(max(0.0, (1.0 - distance) * 100), 2) if distance is not None else None
        )
        return RecognizeFaceResponse(
            matched=False,
            id=None,
            name=None,
            distance=dist_val,
            confidence=conf_val,
            message="Nenhum rosto correspondente cadastrado encontrado.",
        )

    def list_faces(
        self, db: Session, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> list[Face]:
        return self.repository.find_all(db=db, user_id=user_id, skip=skip, limit=limit)

    def delete_face(self, face_id: UUID, db: Session, user_id: UUID) -> bool:
        return self.repository.delete(db=db, face_id=face_id, user_id=user_id)

    async def _read_image(self, image: UploadFile) -> bytes:
        if not image.content_type or not image.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Envie um arquivo de imagem válido (JPEG, PNG, etc).",
            )

        content = await image.read()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="O arquivo enviado está vazio.",
            )

        return content


facial_service = FacialService()
