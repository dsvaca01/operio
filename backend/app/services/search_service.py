from qdrant_client.models import Filter, FieldCondition, MatchValue
from app.services.qdrant_service import client, COLLECTION_NAME
from app.services.embedding_service import create_embedding


def search_documents(query: str, limit: int = 5, document_id: str | None = None):
    query_vector = create_embedding(query)

    query_filter = None

    if document_id:
        query_filter = Filter(
            must=[
                FieldCondition(
                    key="document_id",
                    match=MatchValue(value=document_id),
                )
            ]
        )

    results = client.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        query_filter=query_filter,
        limit=limit,
    )

    return [
        {
            "score": result.score,
            "text": result.payload.get("text"),
            "filename": result.payload.get("original_filename"),
            "document_id": result.payload.get("document_id"),
            "chunk_index": result.payload.get("chunk_index"),
        }
        for result in results
    ]