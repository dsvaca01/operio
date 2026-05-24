from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pathlib import Path
from pydantic import BaseModel
import os
import shutil
import uuid
import psycopg2
import imaplib

from app.services.pdf_service import extract_text_from_pdf
from app.services.chunk_service import chunk_text
from app.services.search_service import search_documents
from app.services.chat_service import answer_question, stream_answer_question
from pydantic import BaseModel
from fastapi import Depends
from app.services.imap_service import (
    get_unread_imap_emails,
    mark_imap_email_as_read,
)

from app.services.auth_service import (
    register_user,
    login_user,
    get_current_user,
)

from app.services.gmail_service import (
    get_unread_email_summaries,
    draft_email_reply,
    create_email_overview,
)

from app.services.db_service import (
    init_db,
    save_document,
    get_documents,
    delete_document,
    get_organization_members,
    update_member_role,
    get_all_users,
    get_email_connection,
    save_email_connection,
)

from app.services.qdrant_service import (
    upsert_chunks,
    delete_document_chunks,
)

from app.services.db_service import save_email_connection
from app.services.db_service import get_email_connection

from app.services.imap_service import (
    get_unread_imap_emails,
    mark_imap_email_as_read,
)

app = FastAPI(title="Operio API")
init_db()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


class ImapConnectionRequest(BaseModel):
    email_address: str
    imap_host: str
    imap_port: int
    username: str
    password: str

class ChatRequest(BaseModel):
    query: str
    document_id: str | None = None


class EmailDraftRequest(BaseModel):
    subject: str
    sender: str
    snippet: str
    summary: str
    instruction: str


class EmailOverviewRequest(BaseModel):
    emails: list[dict]


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    organization_name: str
    email_provider: str
    email_address: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class UpdateRoleRequest(BaseModel):
    user_id: int
    role: str

class MarkEmailReadRequest(BaseModel):
    email_id: str


def get_db_connection():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise HTTPException(
            status_code=500,
            detail="DATABASE_URL is not configured",
        )

    return psycopg2.connect(database_url)


def superadmin_update_organization_role(user_id: int, role: str):
    """
    Superadmin mění organization role uživatele v tabulce organization_members.

    Poznámka:
    Teď UI neposílá organization_id, takže se role změní ve všech organizacích,
    kde je daný user_id členem. Pro MVP je to použitelné.
    Později je lepší posílat i organization_id a měnit roli jen v konkrétní organizaci.
    """
    conn = get_db_connection()

    try:
        with conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE organization_members
                    SET role = %s
                    WHERE user_id = %s
                    RETURNING id
                    """,
                    (role, user_id),
                )

                updated_rows = cursor.fetchall()

                if not updated_rows:
                    raise HTTPException(
                        status_code=404,
                        detail="User is not member of any organization",
                    )

                return len(updated_rows)

    finally:
        conn.close()


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "app": os.getenv("APP_NAME", "Operio"),
        "database_url_set": bool(os.getenv("DATABASE_URL")),
        "qdrant_url": os.getenv("QDRANT_URL"),
    }


@app.post("/documents/upload")
def upload_document(
    file: UploadFile = File(...),
    visibility: str = Form("organization"),
    current_user: dict = Depends(get_current_user),
):
    allowed_extensions = {".pdf", ".txt", ".docx"}

    if visibility not in {"organization", "private"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid visibility. Allowed values: organization, private",
        )

    original_filename = file.filename or "unknown"
    extension = Path(original_filename).suffix.lower()

    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {extension}. Allowed: PDF, TXT, DOCX",
        )

    safe_filename = f"{uuid.uuid4()}{extension}"
    file_path = UPLOAD_DIR / safe_filename

    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size = file_path.stat().st_size

    extracted_text = None

    if extension == ".pdf":
        extracted_text = extract_text_from_pdf(str(file_path))

    chunks = []

    if extracted_text:
        chunks = chunk_text(extracted_text)

    stored_chunks = 0

    if chunks:
        stored_chunks = upsert_chunks(
            chunks=chunks,
            document_id=safe_filename,
            original_filename=original_filename,
            organization_id=current_user["organization_id"],
            uploaded_by_user_id=current_user["user_id"],
            visibility=visibility,
        )

    save_document(
        document_id=safe_filename,
        original_filename=original_filename,
        stored_filename=safe_filename,
        organization_id=current_user["organization_id"],
        uploaded_by_user_id=current_user["user_id"],
        visibility=visibility,
    )

    return {
        "status": "uploaded",
        "original_filename": original_filename,
        "stored_filename": safe_filename,
        "visibility": visibility,
        "content_type": file.content_type,
        "size_bytes": file_size,
        "path": str(file_path),
        "extracted_preview": extracted_text[:1000] if extracted_text else None,
        "chunks_count": len(chunks),
        "stored_chunks": stored_chunks,
        "first_chunk_preview": chunks[0][:500] if chunks else None,
    }

@app.get("/search")
def search(query: str):
    results = search_documents(query)

    return {
        "query": query,
        "results": results,
    }


@app.post("/chat")
def chat(request: ChatRequest):
    result = answer_question(
        query=request.query,
        document_id=request.document_id,
    )

    return result


@app.post("/chat/stream")
def chat_stream(request: ChatRequest):
    return StreamingResponse(
        stream_answer_question(
            query=request.query,
            document_id=request.document_id,
        ),
        media_type="text/plain",
    )


@app.get("/documents")
def documents(current_user: dict = Depends(get_current_user)):
    return {
        "documents": get_documents(
            current_user["organization_id"],
            current_user["user_id"],
        ),
    }

@app.delete("/documents/{document_id}")
def delete_document_endpoint(
    document_id: str,
    current_user: dict = Depends(get_current_user),
):
    delete_document(
        document_id=document_id,
        organization_id=current_user["organization_id"],
        user_id=current_user["user_id"],
    )

    delete_document_chunks(document_id)

    file_path = UPLOAD_DIR / document_id

    if file_path.exists():
        file_path.unlink()

    return {
        "status": "deleted",
        "document_id": document_id,
    }

@app.get("/emails/unread")
def unread_emails(
    limit: int = 5,
    date_from: str | None = None,
    date_to: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    connection = get_email_connection(current_user["user_id"])

    if not connection:
        raise HTTPException(
            status_code=404,
            detail="Email connection is not configured",
        )

    provider = connection.get("provider")

    if provider == "imap":
        return {
            "emails": get_unread_imap_emails(
                connection=connection,
                limit=limit,
                date_from=date_from,
            )
        }

    if provider == "gmail":
        return {
            "emails": get_unread_email_summaries(
                limit=limit,
                date_from=date_from,
                date_to=date_to,
            )
        }

    raise HTTPException(
        status_code=400,
        detail=f"Unsupported email provider: {provider}",
    )


@app.post("/emails/draft-reply")
def email_draft_reply(request: EmailDraftRequest):
    draft = draft_email_reply(
        subject=request.subject,
        sender=request.sender,
        snippet=request.snippet,
        summary=request.summary,
        instruction=request.instruction,
    )

    return {
        "draft": draft,
    }


@app.post("/emails/overview")
def email_overview(request: EmailOverviewRequest):
    return {
        "overview": create_email_overview(request.emails),
    }


@app.post("/auth/register")
def auth_register(request: RegisterRequest):
    try:
        return register_user(
            email=request.email,
            password=request.password,
            full_name=request.full_name,
            organization_name=request.organization_name,
            email_provider=request.email_provider,
            email_address=request.email_address,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


@app.post("/auth/login")
def auth_login(request: LoginRequest):
    try:
        return login_user(
            email=request.email,
            password=request.password,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=401,
            detail=str(error),
        )


@app.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return current_user


@app.get("/admin/members")
def admin_members(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    return {
        "members": get_organization_members(current_user["organization_id"])
    }


@app.post("/admin/members/role")
def admin_update_role(
    request: UpdateRoleRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only owner can change roles")

    if request.role not in ["owner", "admin", "member"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    update_member_role(
        organization_id=current_user["organization_id"],
        user_id=request.user_id,
        role=request.role,
    )

    return {
        "status": "updated",
    }


@app.get("/superadmin/users")
def superadmin_users(current_user: dict = Depends(get_current_user)):
    if current_user.get("global_role") != "superadmin":
        raise HTTPException(status_code=403, detail="Superadmin only")

    return {
        "users": get_all_users(),
    }


@app.post("/superadmin/users/role")
def superadmin_update_user_role(
    request: UpdateRoleRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user.get("global_role") != "superadmin":
        raise HTTPException(status_code=403, detail="Only superadmin can change roles")

    if request.role not in ["owner", "admin", "member"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    conn = get_db_connection()

    try:
        with conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE organization_members
                    SET role = %s
                    WHERE user_id = %s
                    """,
                    (request.role, request.user_id),
                )

                if cursor.rowcount == 0:
                    raise HTTPException(status_code=404, detail="User membership not found")

        return {
            "status": "updated",
            "updated_rows": cursor.rowcount,
        }

    finally:
        conn.close()

@app.post("/email-connections/imap")
def create_imap_connection(
    request: ImapConnectionRequest,
    current_user: dict = Depends(get_current_user),
):
    save_email_connection(
        user_id=current_user["user_id"],
        organization_id=current_user["organization_id"],
        provider="imap",
        email_address=request.email_address,
        imap_host=request.imap_host,
        imap_port=request.imap_port,
        username=request.username,
        password_encrypted=request.password,
    )

    return {
        "status": "saved"
    }

@app.post("/emails/mark-read")
def mark_email_read(
    request: MarkEmailReadRequest,
    current_user: dict = Depends(get_current_user),
):
    connection = get_email_connection(current_user["user_id"])

    if not connection:
        raise HTTPException(
            status_code=404,
            detail="Email connection is not configured",
        )

    provider = connection.get("provider")

    if provider == "imap":
        mark_imap_email_as_read(
            connection=connection,
            email_id=request.email_id,
        )

        return {"status": "marked_as_read"}

    raise HTTPException(
        status_code=400,
        detail=f"Mark as read not supported for provider: {provider}",
    )