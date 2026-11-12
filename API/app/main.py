from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.faces import router as faces_router

app = FastAPI(
    title="Vetra.AI",
    description="API de Reconhecimento Facial com DeepFace + FaceNet512 e pgvector",
    version="1.0.0",
)

# Habilitar CORS para permitir comunicação com o frontend Angular
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://vetra-ai-olive.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(faces_router)


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "app": "Vetra.AI Facial Recognition API"}
