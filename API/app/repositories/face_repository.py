from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.models import Face


class FaceRepository:
    def create(self, db: Session, name: str, embedding: list[float]) -> Face:
        face = Face(name=name, embedding=embedding)
        db.add(face)
        db.commit()
        db.refresh(face)
        return face

    def find_all(self, db: Session, skip: int = 0, limit: int = 100) -> list[Face]:
        stmt = (
            select(Face)
            .order_by(Face.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(db.scalars(stmt).all())

    def find_by_id(self, db: Session, face_id: UUID) -> Face | None:
        return db.get(Face, face_id)

    def delete(self, db: Session, face_id: UUID) -> bool:
        face = self.find_by_id(db, face_id)
        if face:
            db.delete(face)
            db.commit()
            return True
        return False

    def search_most_similar(
        self,
        db: Session,
        embedding: list[float],
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
