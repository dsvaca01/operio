import os
import uuid

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from qdrant_client.models import Filter, FieldCondition, MatchValue


QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
COLLECTION_NAME = "operio_documents"
VECTOR_SIZE = 1536

client = QdrantClient(url=QDRANT_URL)


def ensure_collection() -> None:
    collections = client.get_collections().collections
    collection_names = [collection.name for collection in collections]

    if COLLECTION_NAME not in collection_names:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(
                size=VECTOR_SIZE,
                distance=Distance.COSINE,
            ),
        )


def upsert_chunks(
    chunks: list[str],
    document_id: str,
    original_filename: str,
    organization_id: int,
    uploaded_by_user_id: int,
    visibility: str,
) -> int:
    ensure_collection()

    points = []

    for index, chunk in enumerate(chunks):
        from app.services.embedding_service import create_embedding

        vector = create_embedding(chunk)

        points.append(
            PointStruct(
                id=str(uuid.uuid4()),
                vector=vector,
                payload={
                    "document_id": document_id,
                    "original_filename": original_filename,
                    "chunk_index": index,
                    "text": chunk,
                    "organization_id": organization_id,
                    "uploaded_by_user_id": uploaded_by_user_id,
                    "visibility": visibility,
                },
            )
        )

    if points:
        client.upsert(
            collection_name=COLLECTION_NAME,
            points=points,
        )

    return len(points)

def delete_document_chunks(document_id: str):
    client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=Filter(
            must=[
                FieldCondition(
                    key="document_id",
                    match=MatchValue(value=document_id),
                )
            ]
        ),
    )