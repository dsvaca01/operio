from collections.abc import Generator

from openai import OpenAI

from app.config import settings
from app.services.search_service import search_documents


client = OpenAI(api_key=settings.openai_api_key)


def _build_context(search_results: list[dict]) -> str:
    return "\n\n".join(
        [
            (
                f"Source: {item['filename']} | "
                f"Document ID: {item['document_id']} | "
                f"Chunk: {item['chunk_index']}\n"
                f"{item['text']}"
            )
            for item in search_results
        ]
    )


def answer_question(
    query: str,
    document_id: str | None = None,
    organization_id: int | None = None,
    user_id: int | None = None,
) -> dict:
    search_results = search_documents(
        query=query,
        limit=settings.rag_search_limit,
        document_id=document_id,
        organization_id=organization_id,
        user_id=user_id,
    )

    context = _build_context(search_results)

    system_prompt = """
You are an internal company knowledge assistant.
Answer only from the provided context.
If the answer is not in the context, say that you do not know based on the available documents.
Be concise and practical.
Return the answer in Czech.
"""

    user_prompt = f"""
Question:
{query}

Context:
{context}
"""

    response = client.chat.completions.create(
        model=settings.openai_model_default,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=settings.openai_temperature,
    )

    answer = response.choices[0].message.content

    return {
        "query": query,
        "document_id": document_id,
        "answer": answer,
        "citations": [
            {
                "filename": item["filename"],
                "document_id": item["document_id"],
                "chunk_index": item["chunk_index"],
                "text": item["text"],
                "score": item.get("score"),
            }
            for item in search_results
        ],
    }


def stream_answer_question(
    query: str,
    document_id: str | None = None,
    organization_id: int | None = None,
    user_id: int | None = None,
) -> Generator[str, None, None]:
    search_results = search_documents(
        query=query,
        limit=settings.rag_search_limit,
        document_id=document_id,
        organization_id=organization_id,
        user_id=user_id,
    )

    context = _build_context(search_results)

    system_prompt = """
You are an internal company knowledge assistant.
Answer only from the provided context.
If the answer is not in the context, say that you do not know based on the available documents.
Be concise and practical.
Return the answer in Czech.
"""

    user_prompt = f"""
Question:
{query}

Context:
{context}
"""

    stream = client.chat.completions.create(
        model=settings.openai_model_default,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=settings.openai_temperature,
        stream=True,
    )

    for chunk in stream:
        content = chunk.choices[0].delta.content

        if content:
            yield content