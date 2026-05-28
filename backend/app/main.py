from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pathlib import Path
from pydantic import BaseModel

import os
import shutil
import uuid
import psycopg2

from app.services.auth_service import (
    get_current_user,
    login_user,
    register_user,
)
from app.services.chat_service import answer_question, stream_answer_question
from app.services.chunk_service import chunk_text
from app.services.db_service import (
    create_followup_item,
    delete_document,
    email_item_exists,
    followup_exists,
    get_all_users,
    get_documents,
    get_email_connection,
    get_email_items,
    get_followup_items,
    get_organization_members,
    ignore_followup_item,
    init_db,
    mark_email_item_as_read,
    mark_email_item_as_unread,
    mark_followup_done,
    mark_missing_email_items_as_read,
    save_document,
    save_email_connection,
    save_email_item,
    share_followup_with_org,
    update_followup_due_date,
    update_member_role,
)
from app.services.gmail_service import (
    analyze_email_insights,
    create_client_context_briefing,
    create_email_overview,
    draft_email_reply,
    draft_email_reply_with_context,
    summarize_email,
)
from app.services.imap_service import (
    get_client_imap_conversation_emails,
    get_unread_imap_emails,
    mark_imap_email_as_read,
)
from app.services.pdf_service import extract_text_from_pdf
from app.services.qdrant_service import (
    delete_document_chunks,
    upsert_chunks,
)
from app.services.search_service import search_documents


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


# =========================
# Request models
# =========================

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


class EmailSyncRequest(BaseModel):
    date_from: str | None = None


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


class DraftReplyWithDocumentsRequest(BaseModel):
    subject: str
    email_body: str
    document_id: str


class FollowupGenerateRequest(BaseModel):
    days_back: int = 7


class FollowupDueDateRequest(BaseModel):
    due_date: str | None = None


class ClientContextPreviewRequest(BaseModel):
    client_email: str | None = None
    client_domain: str | None = None
    scope: str = "email"  # email | domain
    limit: int = 10


# =========================
# Internal helpers
# =========================

def get_db_connection():
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise HTTPException(
            status_code=500,
            detail="DATABASE_URL is not configured",
        )

    return psycopg2.connect(database_url)


def sync_unread_emails_to_db(
    current_user: dict,
    date_from: str | None = None,
    limit: int = 50,
    use_ai_for_imap: bool = False,
):
    """
    Source of truth je IMAP.

    Flow:
    1. Načte aktuální UNSEEN e-maily z IMAP INBOXu.
    2. Nové e-maily uloží do DB cache.
    3. Existující e-maily, které jsou znovu UNSEEN v IMAPu, obnoví v DB na is_read = FALSE.
    4. E-maily, které už v IMAPu nejsou UNSEEN, označí v DB jako is_read = TRUE.

    date_from:
    - None = všechny UNSEEN e-maily
    - YYYY-MM-DD = IMAP SINCE filtr včetně zadaného dne
    """
    connection = get_email_connection(current_user["user_id"])

    if not connection:
        raise HTTPException(
            status_code=404,
            detail="Email connection is not configured",
        )

    emails = get_unread_imap_emails(
        connection=connection,
        limit=limit,
        date_from=date_from,
        use_ai=use_ai_for_imap,
    )

    unread_email_ids = [email_item["id"] for email_item in emails]
    synced = []

    for email_item in emails:
        email_id = email_item["id"]

        if email_item_exists(
            organization_id=current_user["organization_id"],
            user_id=current_user["user_id"],
            email_id=email_id,
        ):
            mark_email_item_as_unread(
                organization_id=current_user["organization_id"],
                user_id=current_user["user_id"],
                email_id=email_id,
            )

            synced.append({
                **email_item,
                "sync_status": "restored_unread",
            })
            continue

        summary = summarize_email(
            email_item.get("subject", ""),
            email_item.get("from", ""),
            email_item.get("snippet", ""),
        )

        insights = analyze_email_insights(
            email_item.get("subject", ""),
            email_item.get("from", ""),
            email_item.get("snippet", ""),
        )

        save_email_item(
            organization_id=current_user["organization_id"],
            user_id=current_user["user_id"],
            email_id=email_id,
            sender=email_item.get("from", ""),
            subject=email_item.get("subject", ""),
            snippet=email_item.get("snippet", ""),
            summary=summary,
            ai_insights=insights,
        )

        synced.append({
            **email_item,
            "summary": summary,
            "ai_insights": insights,
            "sync_status": "created",
        })

    mark_missing_email_items_as_read(
        organization_id=current_user["organization_id"],
        user_id=current_user["user_id"],
        unread_email_ids=unread_email_ids,
    )

    return synced


# =========================
# Health
# =========================

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "app": os.getenv("APP_NAME", "Operio"),
        "database_url_set": bool(os.getenv("DATABASE_URL")),
        "qdrant_url": os.getenv("QDRANT_URL"),
    }


# =========================
# Documents / Knowledge Assistant
# =========================

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

    chunks = chunk_text(extracted_text) if extracted_text else []
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


@app.get("/search")
def search(query: str):
    return {
        "query": query,
        "results": search_documents(query),
    }


@app.post("/chat")
def chat(request: ChatRequest):
    return answer_question(
        query=request.query,
        document_id=request.document_id,
    )


@app.post("/chat/stream")
def chat_stream(request: ChatRequest):
    return StreamingResponse(
        stream_answer_question(
            query=request.query,
            document_id=request.document_id,
        ),
        media_type="text/plain",
    )




# =========================
# Clients / Client Context Briefing
# =========================

@app.post("/clients/context/preview")
def client_context_preview(
    request: ClientContextPreviewRequest,
    current_user: dict = Depends(get_current_user),
):
    connection = get_email_connection(current_user["user_id"])

    if not connection:
        raise HTTPException(
            status_code=404,
            detail="Email connection is not configured",
        )

    provider = connection.get("provider")

    if provider != "imap":
        raise HTTPException(
            status_code=400,
            detail=f"Client context preview is not supported for provider: {provider}",
        )

    scope = (request.scope or "email").lower().strip()

    if scope not in {"email", "domain"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid scope. Allowed values: email, domain",
        )

    limit = max(1, min(request.limit or 10, 10))

    if scope == "email" and not request.client_email:
        raise HTTPException(
            status_code=400,
            detail="client_email is required for email scope",
        )

    if scope == "domain" and not request.client_domain:
        raise HTTPException(
            status_code=400,
            detail="client_domain is required for domain scope",
        )

    try:
        emails = get_client_imap_conversation_emails(
            connection=connection,
            client_email=request.client_email,
            client_domain=request.client_domain,
            scope=scope,
            limit=limit,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    client_label = request.client_email if scope == "email" else request.client_domain

    briefing = create_client_context_briefing(
        emails=emails,
        client_label=client_label or "",
        scope=scope,
        user_id=current_user["user_id"],
        organization_id=current_user["organization_id"],
    )

    return {
        "scope": scope,
        "client_email": request.client_email,
        "client_domain": request.client_domain,
        "limit": limit,
        "messages_count": len(emails),
        "emails_count": len(emails),
        "emails": emails,
        "briefing": briefing,
    }


# =========================
# Email Assistant
# =========================

@app.get("/emails/unread")
def unread_emails(
    date_from: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    sync_unread_emails_to_db(
        current_user=current_user,
        date_from=date_from,
        limit=50,
        use_ai_for_imap=False,
    )

    return {
        "emails": get_email_items(
            organization_id=current_user["organization_id"],
            user_id=current_user["user_id"],
        )
    }


@app.post("/emails/sync")
def sync_emails(
    request: EmailSyncRequest | None = None,
    current_user: dict = Depends(get_current_user),
):
    date_from = request.date_from if request else None

    synced = sync_unread_emails_to_db(
        current_user=current_user,
        date_from=date_from,
        limit=50,
        use_ai_for_imap=False,
    )

    return {
        "synced_count": len(synced),
        "emails": synced,
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

    if provider != "imap":
        raise HTTPException(
            status_code=400,
            detail=f"Mark as read not supported for provider: {provider}",
        )

    mark_imap_email_as_read(
        connection=connection,
        email_id=request.email_id,
    )

    mark_email_item_as_read(
        organization_id=current_user["organization_id"],
        user_id=current_user["user_id"],
        email_id=request.email_id,
    )

    return {"status": "marked_as_read"}


@app.post("/emails/draft-reply")
def email_draft_reply(
    request: EmailDraftRequest,
    current_user: dict = Depends(get_current_user),
):
    draft = draft_email_reply(
        subject=request.subject,
        sender=request.sender,
        snippet=request.snippet,
        summary=request.summary,
        instruction=request.instruction,
        user_id=current_user["user_id"],
        organization_id=current_user["organization_id"],
    )

    return {"draft": draft}


@app.post("/emails/overview")
def email_overview(
    request: EmailOverviewRequest,
    current_user: dict = Depends(get_current_user),
):
    return {
        "overview": create_email_overview(request.emails),
    }


@app.post("/emails/draft-reply-with-documents")
def draft_reply_with_documents(
    request: DraftReplyWithDocumentsRequest,
    current_user: dict = Depends(get_current_user),
):
    if not request.document_id:
        raise HTTPException(
            status_code=400,
            detail="Document must be selected",
        )

    relevant_chunks = search_documents(
        query=request.email_body,
        document_id=request.document_id,
    )

    draft = draft_email_reply_with_context(
        email_subject=request.subject,
        email_body=request.email_body,
        context_chunks=relevant_chunks,
        user_id=current_user["user_id"],
        organization_id=current_user["organization_id"],
    )

    return {
        "draft": draft,
        "context_chunks": relevant_chunks,
    }


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

    return {"status": "saved"}


# =========================
# Auth / User
# =========================

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


# =========================
# Admin / Superadmin
# =========================

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

    return {"status": "updated"}


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

                updated_rows = cursor.rowcount

                if updated_rows == 0:
                    raise HTTPException(
                        status_code=404,
                        detail="User membership not found",
                    )

        return {
            "status": "updated",
            "updated_rows": updated_rows,
        }

    finally:
        conn.close()


@app.get("/superadmin/token-usage")
def superadmin_token_usage(current_user: dict = Depends(get_current_user)):
    if current_user.get("global_role") != "superadmin":
        raise HTTPException(
            status_code=403,
            detail="Only superadmin can view token usage",
        )

    conn = get_db_connection()

    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    u.id AS user_id,
                    u.email,
                    u.full_name,
                    COALESCE(SUM(a.total_tokens), 0) AS total_tokens,
                    COALESCE(SUM(a.prompt_tokens), 0) AS prompt_tokens,
                    COALESCE(SUM(a.completion_tokens), 0) AS completion_tokens,
                    COALESCE(SUM(a.estimated_cost_usd), 0) AS estimated_cost_usd
                FROM users u
                LEFT JOIN ai_usage_logs a ON a.user_id = u.id
                GROUP BY u.id, u.email, u.full_name
                ORDER BY total_tokens DESC
                """
            )

            rows = cursor.fetchall()

        return [
            {
                "user_id": row[0],
                "email": row[1],
                "full_name": row[2],
                "total_tokens": row[3],
                "prompt_tokens": row[4],
                "completion_tokens": row[5],
                "estimated_cost_usd": float(row[6]),
            }
            for row in rows
        ]

    finally:
        conn.close()


# =========================
# Follow-up Manager
# =========================

@app.post("/followups/generate")
def generate_followups(
    request: FollowupGenerateRequest,
    current_user: dict = Depends(get_current_user),
):
    connection = get_email_connection(current_user["user_id"])

    if not connection:
        raise HTTPException(
            status_code=404,
            detail="Email connection is not configured",
        )

    emails = get_unread_imap_emails(
        connection=connection,
        limit=50,
        date_from=None,
        use_ai=False,
    )

    created = []

    for email_item in emails:
        if followup_exists(
            organization_id=current_user["organization_id"],
            user_id=current_user["user_id"],
            email_id=email_item["id"],
        ):
            continue

        is_direct = email_item.get("is_direct")
        is_cc = email_item.get("is_cc")

        if not is_direct:
            continue

        if is_cc and not is_direct:
            continue

        summary = summarize_email(
            email_item.get("subject", ""),
            email_item.get("from", ""),
            email_item.get("snippet", ""),
            user_id=current_user["user_id"],
            organization_id=current_user["organization_id"],
        )

        insights = analyze_email_insights(
            email_item.get("subject", ""),
            email_item.get("from", ""),
            email_item.get("snippet", ""),
        )

        followup_id = create_followup_item(
            organization_id=current_user["organization_id"],
            user_id=current_user["user_id"],
            email_id=email_item["id"],
            sender=email_item.get("from", ""),
            subject=email_item.get("subject", ""),
            snippet=email_item.get("snippet", ""),
            summary=summary,
        )

        if not followup_id:
            continue

        created.append({
            "id": followup_id,
            **email_item,
            "summary": summary,
            "ai_insights": insights,
        })

    return {
        "created_count": len(created),
        "followups": created,
    }


@app.get("/followups")
def list_followups(
    current_user: dict = Depends(get_current_user),
):
    return {
        "followups": get_followup_items(
            organization_id=current_user["organization_id"],
            user_id=current_user["user_id"],
        )
    }


@app.post("/followups/{followup_id}/ignore")
def ignore_followup(
    followup_id: int,
    current_user: dict = Depends(get_current_user),
):
    ignore_followup_item(
        followup_id=followup_id,
        organization_id=current_user["organization_id"],
    )

    return {"success": True}


@app.post("/followups/{followup_id}/due-date")
def set_followup_due_date(
    followup_id: int,
    request: FollowupDueDateRequest,
    current_user: dict = Depends(get_current_user),
):
    update_followup_due_date(
        followup_id=followup_id,
        organization_id=current_user["organization_id"],
        due_date=request.due_date,
    )

    return {"success": True}


@app.post("/followups/{followup_id}/share")
def share_followup(
    followup_id: int,
    current_user: dict = Depends(get_current_user),
):
    share_followup_with_org(
        followup_id=followup_id,
        organization_id=current_user["organization_id"],
    )

    return {"success": True}


@app.post("/followups/{followup_id}/done")
def done_followup(
    followup_id: int,
    current_user: dict = Depends(get_current_user),
):
    mark_followup_done(
        followup_id=followup_id,
        organization_id=current_user["organization_id"],
    )

    return {"success": True}
