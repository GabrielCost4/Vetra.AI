from fastapi import FastAPI
from app.routers.faces import router as faces_router

app = FastAPI(
    title="Vetra.AI",
    version="1.0.0"
)

app.include_router(faces_router)