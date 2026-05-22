from fastapi import FastAPI
import os

app = FastAPI(title="Operio API")

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "app": os.getenv("APP_NAME", "Operio"),
        "database_url_set": bool(os.getenv("DATABASE_URL")),
        "qdrant_url": os.getenv("QDRANT_URL")
    }