from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.faces import router as faces_router

app = FastAPI(
    title="Vetra.AI",
    description="API de Reconhecimento Facial com DeepFace + FaceNet512 e pgvector",
    version="1.0.0",
)

# Origens permitidas configuráveis por CORS_ORIGINS (separadas por vírgula)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(faces_router)


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "app": "Vetra.AI Facial Recognition API"}
