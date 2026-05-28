from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    # App
    app_name: str = Field(default="Operio", alias="APP_NAME")
    app_env: str = Field(default="local", alias="APP_ENV")
    debug: bool = Field(default=True, alias="DEBUG")

    # Database
    database_url: str = Field(alias="DATABASE_URL")

    # Qdrant
    qdrant_url: str = Field(default="http://qdrant:6333", alias="QDRANT_URL")
    qdrant_collection: str = Field(default="operio_documents", alias="QDRANT_COLLECTION")
    qdrant_vector_size: int = Field(default=1536, alias="QDRANT_VECTOR_SIZE")

    # OpenAI
    openai_api_key: str = Field(alias="OPENAI_API_KEY")
    openai_model_default: str = Field(default="gpt-4o-mini", alias="OPENAI_MODEL_DEFAULT")
    openai_model_json: str = Field(default="gpt-4.1-mini", alias="OPENAI_MODEL_JSON")
    openai_embedding_model: str = Field(default="text-embedding-3-small", alias="OPENAI_EMBEDDING_MODEL")
    openai_temperature: float = Field(default=0.2, alias="OPENAI_TEMPERATURE")

    # JWT
    jwt_secret_key: str = Field(alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_expire_minutes: int = Field(default=1440, alias="JWT_EXPIRE_MINUTES")

    # CORS
    cors_origins: str = Field(default="http://localhost:3000", alias="CORS_ORIGINS")

    # Files
    upload_dir: Path = Field(default=Path("uploads"), alias="UPLOAD_DIR")
    max_upload_mb: int = Field(default=20, alias="MAX_UPLOAD_MB")

    # RAG
    rag_search_limit: int = Field(default=5, alias="RAG_SEARCH_LIMIT")

    # Email / IMAP
    email_fetch_limit: int = Field(default=50, alias="EMAIL_FETCH_LIMIT")
    email_connection_timeout: int = Field(default=30, alias="EMAIL_CONNECTION_TIMEOUT")
    client_context_max_limit: int = Field(default=10, alias="CLIENT_CONTEXT_MAX_LIMIT")

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()