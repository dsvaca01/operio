from openai import OpenAI
from app.services.search_service import search_documents

client = OpenAI()

CHAT_MODEL = "gpt-4o-mini"


def answer_question(query: str, document_id: str | None = None) -> dict:
    search_results = search_documents(
        query=query,
        limit=5,
        document_id=document_id,
    )

    context = "\n\n".join(
        [
            f"Source: {item['filename']} | Document ID: {item['document_id']} | Chunk: {item['chunk_index']}\n{item['text']}"
            for item in search_results
        ]
    )

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
        model=CHAT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
    )

    answer = response.choices[0].message.content

    return {
        "query": query,
        "document_id": document_id,
        "answer": answer,
        "sources": search_results,
    }

def stream_answer_question(query: str, document_id: str | None = None):
    search_results = search_documents(
        query=query,
        limit=5,
        document_id=document_id,
    )

    context = "\n\n".join(
        [
            f"Source: {item['filename']} | Document ID: {item['document_id']} | Chunk: {item['chunk_index']}\n{item['text']}"
            for item in search_results
        ]
    )

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
        model=CHAT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
        stream=True,
    )

    for chunk in stream:
        content = chunk.choices[0].delta.content

        if content:
            yield content