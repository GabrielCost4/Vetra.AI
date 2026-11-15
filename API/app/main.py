from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers.auth import router as auth_router
from app.routers.faces import router as faces_router
from app.services.auth_service import get_jwt_secret

# Fail before serving requests if token signing is not configured.
get_jwt_secret()

app = FastAPI(
    title="Vetra.AI",
    description="API de Reconhecimento Facial com DeepFace + FaceNet512 e pgvector",
    version="1.0.0",
)

# Habilitar CORS para permitir comunicação com o frontend Angular
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "https://vetra-aii.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(faces_router)
app.include_router(auth_router)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    # Never echo submitted passwords or tokens in validation responses.
    return JSONResponse(
        status_code=422,
        content={
            "detail": [
                {"loc": error["loc"], "msg": error["msg"], "type": error["type"]}
                for error in exc.errors()
            ]
        },
    )


@app.middleware("http")
async def prevent_private_response_caching(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "app": "Vetra.AI Facial Recognition API"}
