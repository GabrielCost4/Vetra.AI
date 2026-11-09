import numpy as np
from deepface import DeepFace


class EmbeddingService:
    def gerar_embedding(self, rosto: np.ndarray) -> list[float]:
        results = DeepFace.represent(
            img_path=rosto,
            model_name="Facenet512",
            detector_backend="skip",
            enforce_detection=False,
            normalization="Facenet2018",
        )
        embedding = np.asarray(results[0]["embedding"], dtype=float)
        if embedding.shape != (512,) or not np.isfinite(embedding).all():
            raise RuntimeError("O modelo retornou um embedding inválido.")
        return embedding.tolist()
