import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

# Carrega variáveis do arquivo infra/.env ou .env se existirem.
_ENV_PATHS = (
    Path(__file__).resolve().parent.parent / "infra" / ".env",
    Path(__file__).resolve().parent.parent / ".env",
)

DEFAULT_CORS_ORIGINS = (
    "https://vetra-ai-olive.vercel.app",
    "http://localhost:4200",
    "http://127.0.0.1:4200",
)


def load_env() -> None:
    for env_path in _ENV_PATHS:
        if env_path.exists():
            load_dotenv(dotenv_path=env_path)
            return


def _env_list(name: str, default: tuple[str, ...]) -> tuple[str, ...]:
    raw = os.getenv(name)
    if not raw:
        return default
    values = tuple(value.strip() for value in raw.split(",") if value.strip())
    return values or default


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} deve ser um número inteiro.") from exc
    if value <= 0:
        raise RuntimeError(f"{name} deve ser maior que zero.")
    return value


@dataclass(frozen=True)
class Settings:
    database_url: str | None = field(
        default_factory=lambda: (os.getenv("DATABASE_URL") or "").strip() or None
    )
    cors_origins: tuple[str, ...] = field(
        default_factory=lambda: _env_list("CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    )
    max_upload_bytes: int = field(
        default_factory=lambda: _env_int("MAX_UPLOAD_BYTES", 5 * 1024 * 1024)
    )
    max_image_pixels: int = field(
        default_factory=lambda: _env_int("MAX_IMAGE_PIXELS", 25_000_000)
    )


load_env()
settings = Settings()
