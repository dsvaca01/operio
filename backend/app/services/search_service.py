from qdrant_client.models import FieldCondition, Filter, MatchAny, MatchValue

from app.services.embedding_service import create_embedding
from app.services.qdrant_service import COLLECTION_NAME, client


def search_documents(
    query: str,
    limit: int = 5,
    document_id: str | None = None,
    organization_id: int | None = None,
    user_id: int | None = None,
):
    if organization_id is None:
        raise ValueError("organization_id is required for document search")

    query_vector = create_embedding(query)

    must_conditions = [
        FieldCondition(
            key="organization_id",
            match=MatchValue(value=organization_id),
        )
    ]

    if document_id:
        must_conditions.append(
            FieldCondition(
                key="document_id",
                match=MatchValue(value=document_id),
            )
        )

    should_conditions = [
        FieldCondition(
            key="visibility",
            match=MatchValue(value="organization"),
        )
    ]

    if user_id is not None:
        should_conditions.append(
            FieldCondition(
                key="uploaded_by_user_id",
                match=MatchValue(value=user_id),
            )
        )

    query_filter = Filter(
        must=must_conditions,
        should=should_conditions,
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
            "visibility": result.payload.get("visibility"),
            "organization_id": result.payload.get("organization_id"),
            "uploaded_by_user_id": result.payload.get("uploaded_by_user_id"),
        }
        for result in results
    ]