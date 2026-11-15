from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.models import Face


class FaceRepository:
    def create(
        self, db: Session, name: str, embedding: list[float], user_id: UUID
    ) -> Face:
        face = Face(name=name, embedding=embedding, user_id=user_id)
        db.add(face)
        db.commit()
        db.refresh(face)
        return face

    def find_all(
        self, db: Session, user_id: UUID, skip: int = 0, limit: int = 100
    ) -> list[Face]:
        stmt = (
            select(Face)
            .where(Face.user_id == user_id)
            .order_by(Face.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(db.scalars(stmt).all())

    def find_by_id(self, db: Session, face_id: UUID, user_id: UUID) -> Face | None:
        return db.scalar(
            select(Face).where(Face.id == face_id, Face.user_id == user_id)
        )

    def delete(self, db: Session, face_id: UUID, user_id: UUID) -> bool:
        face = self.find_by_id(db, face_id, user_id)
        if face:
            db.delete(face)
            db.commit()
            return True
        return False

    def search_most_similar(
        self,
        db: Session,
        embedding: list[float],
        user_id: UUID,
        threshold: float = 0.40,
    ) -> tuple[Face | None, float | None]:
        """
        Busca o rosto mais similar usando distância de cosseno do pgvector.
        Retorna (Face, distance) se a distância for menor ou igual ao threshold;
        caso contrário retorna (None, distance).
        """
        distance_col = Face.embedding.cosine_distance(embedding).label("distance")
        stmt = (
            select(Face, distance_col)
            .where(Face.user_id == user_id)
            .order_by(distance_col)
            .limit(1)
        )
        result = db.execute(stmt).first()
        if not result:
            return None, None

        face, dist = result[0], float(result[1])
        if dist <= threshold:
            return face, dist
        return None, dist


face_repository = FaceRepository()
