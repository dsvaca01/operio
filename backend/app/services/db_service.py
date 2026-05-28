import json

import psycopg2
from sqlalchemy import create_engine, text

from app.config import settings


engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
)


def get_db_connection():
    return psycopg2.connect(settings.database_url)


def init_db():
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS organizations (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS organization_members (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                organization_id INTEGER NOT NULL REFERENCES organizations(id),
                role TEXT NOT NULL DEFAULT 'owner',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, organization_id)
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS documents (
                id SERIAL PRIMARY KEY,
                document_id TEXT UNIQUE NOT NULL,
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL,
                organization_id INTEGER REFERENCES organizations(id),
                uploaded_by_user_id INTEGER REFERENCES users(id),
                visibility TEXT NOT NULL DEFAULT 'organization',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS email_connections (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                organization_id INTEGER REFERENCES organizations(id),
                provider TEXT NOT NULL,
                email_address TEXT,
                imap_host TEXT,
                imap_port INTEGER,
                username TEXT,
                password_encrypted TEXT,
                access_token TEXT,
                refresh_token TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ai_usage_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                organization_id INTEGER NOT NULL REFERENCES organizations(id),
                feature TEXT NOT NULL,
                model TEXT,
                prompt_tokens INTEGER DEFAULT 0,
                completion_tokens INTEGER DEFAULT 0,
                total_tokens INTEGER DEFAULT 0,
                estimated_cost_usd NUMERIC(10,6) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS email_items (
                id SERIAL PRIMARY KEY,
                organization_id INTEGER NOT NULL REFERENCES organizations(id),
                user_id INTEGER NOT NULL REFERENCES users(id),
                email_id TEXT NOT NULL,
                sender TEXT,
                subject TEXT,
                snippet TEXT,
                summary TEXT,
                ai_insights JSONB,
                is_read BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(organization_id, user_id, email_id)
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS followup_items (
                id SERIAL PRIMARY KEY,
                organization_id INTEGER NOT NULL REFERENCES organizations(id),
                user_id INTEGER NOT NULL REFERENCES users(id),
                email_id TEXT NOT NULL,
                sender TEXT,
                subject TEXT,
                snippet TEXT,
                summary TEXT,
                status TEXT NOT NULL DEFAULT 'open',
                is_ignored BOOLEAN NOT NULL DEFAULT FALSE,
                shared_with_org BOOLEAN NOT NULL DEFAULT FALSE,
                due_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(organization_id, user_id, email_id)
            )
        """))

        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS global_role TEXT NOT NULL DEFAULT 'user'
        """))

        conn.execute(text("""
            ALTER TABLE documents
            ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id)
        """))

        conn.execute(text("""
            ALTER TABLE documents
            ADD COLUMN IF NOT EXISTS uploaded_by_user_id INTEGER REFERENCES users(id)
        """))

        conn.execute(text("""
            ALTER TABLE documents
            ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'organization'
        """))

        conn.execute(text("""
            ALTER TABLE email_connections
            ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id)
        """))

        conn.execute(text("""
            ALTER TABLE email_connections
            ADD COLUMN IF NOT EXISTS access_token TEXT
        """))

        conn.execute(text("""
            ALTER TABLE email_connections
            ADD COLUMN IF NOT EXISTS refresh_token TEXT
        """))

        conn.execute(text("""
            ALTER TABLE email_connections
            ADD COLUMN IF NOT EXISTS imap_host TEXT
        """))

        conn.execute(text("""
            ALTER TABLE email_connections
            ADD COLUMN IF NOT EXISTS imap_port INTEGER
        """))

        conn.execute(text("""
            ALTER TABLE email_connections
            ADD COLUMN IF NOT EXISTS username TEXT
        """))

        conn.execute(text("""
            ALTER TABLE email_connections
            ADD COLUMN IF NOT EXISTS password_encrypted TEXT
        """))

        conn.execute(text("""
            ALTER TABLE email_items
            ADD COLUMN IF NOT EXISTS ai_insights JSONB
        """))

        conn.execute(text("""
            ALTER TABLE email_items
            ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE
        """))

        conn.execute(text("""
            ALTER TABLE email_items
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        """))

        conn.execute(text("""
            ALTER TABLE followup_items
            ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'
        """))

        conn.execute(text("""
            ALTER TABLE followup_items
            ADD COLUMN IF NOT EXISTS is_ignored BOOLEAN NOT NULL DEFAULT FALSE
        """))

        conn.execute(text("""
            ALTER TABLE followup_items
            ADD COLUMN IF NOT EXISTS shared_with_org BOOLEAN NOT NULL DEFAULT FALSE
        """))

        conn.execute(text("""
            ALTER TABLE followup_items
            ADD COLUMN IF NOT EXISTS due_date DATE
        """))

        conn.execute(text("""
            ALTER TABLE followup_items
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        """))


def create_followup_item(
    organization_id: int,
    user_id: int,
    email_id: str,
    sender: str,
    subject: str,
    snippet: str,
    summary: str,
):
    with engine.begin() as conn:
        result = conn.execute(
            text("""
                INSERT INTO followup_items (
                    organization_id,
                    user_id,
                    email_id,
                    sender,
                    subject,
                    snippet,
                    summary
                )
                VALUES (
                    :organization_id,
                    :user_id,
                    :email_id,
                    :sender,
                    :subject,
                    :snippet,
                    :summary
                )
                ON CONFLICT (
                    organization_id,
                    user_id,
                    email_id
                )
                DO NOTHING
                RETURNING id
            """),
            {
                "organization_id": organization_id,
                "user_id": user_id,
                "email_id": email_id,
                "sender": sender,
                "subject": subject,
                "snippet": snippet,
                "summary": summary,
            },
        )

        row = result.fetchone()
        return row.id if row else None


def get_followup_items(
    organization_id: int,
    user_id: int,
):
    with engine.begin() as conn:
        result = conn.execute(
            text("""
                SELECT
                    id,
                    email_id,
                    sender,
                    subject,
                    snippet,
                    summary,
                    status,
                    is_ignored,
                    shared_with_org,
                    due_date,
                    created_at
                FROM followup_items
                WHERE organization_id = :organization_id
                AND (
                    user_id = :user_id
                    OR shared_with_org = TRUE
                )
                AND is_ignored = FALSE
                AND status = 'open'
                ORDER BY
                    due_date ASC NULLS LAST,
                    created_at DESC
            """),
            {
                "organization_id": organization_id,
                "user_id": user_id,
            },
        )

        return [dict(row._mapping) for row in result]


def ignore_followup_item(
    followup_id: int,
    organization_id: int,
):
    with engine.begin() as conn:
        conn.execute(
            text("""
                UPDATE followup_items
                SET
                    is_ignored = TRUE,
                    updated_at = NOW()
                WHERE id = :followup_id
                AND organization_id = :organization_id
            """),
            {
                "followup_id": followup_id,
                "organization_id": organization_id,
            },
        )


def mark_followup_done(
    followup_id: int,
    organization_id: int,
):
    with engine.begin() as conn:
        conn.execute(
            text("""
                UPDATE followup_items
                SET
                    status = 'done',
                    updated_at = NOW()
                WHERE id = :followup_id
                AND organization_id = :organization_id
            """),
            {
                "followup_id": followup_id,
                "organization_id": organization_id,
            },
        )


def update_followup_due_date(
    followup_id: int,
    organization_id: int,
    due_date: str | None,
):
    with engine.begin() as conn:
        conn.execute(
            text("""
                UPDATE followup_items
                SET
                    due_date = :due_date,
                    updated_at = NOW()
                WHERE id = :followup_id
                AND organization_id = :organization_id
            """),
            {
                "followup_id": followup_id,
                "organization_id": organization_id,
                "due_date": due_date,
            },
        )


def share_followup_with_org(
    followup_id: int,
    organization_id: int,
):
    with engine.begin() as conn:
        conn.execute(
            text("""
                UPDATE followup_items
                SET
                    shared_with_org = TRUE,
                    updated_at = NOW()
                WHERE id = :followup_id
                AND organization_id = :organization_id
            """),
            {
                "followup_id": followup_id,
                "organization_id": organization_id,
            },
        )


def mark_email_item_as_unread(
    organization_id: int,
    user_id: int,
    email_id: str,
):
    with engine.begin() as conn:
        conn.execute(
            text("""
                UPDATE email_items
                SET
                    is_read = FALSE,
                    updated_at = NOW()
                WHERE organization_id = :organization_id
                AND user_id = :user_id
                AND email_id = :email_id
            """),
            {
                "organization_id": organization_id,
                "user_id": user_id,
                "email_id": email_id,
            },
        )


def mark_email_item_as_read(
    organization_id: int,
    user_id: int,
    email_id: str,
):
    with engine.begin() as conn:
        conn.execute(
            text("""
                UPDATE email_items
                SET
                    is_read = TRUE,
                    updated_at = NOW()
                WHERE organization_id = :organization_id
                AND user_id = :user_id
                AND email_id = :email_id
            """),
            {
                "organization_id": organization_id,
                "user_id": user_id,
                "email_id": email_id,
            },
        )


def email_item_exists(
    organization_id: int,
    user_id: int,
    email_id: str,
) -> bool:
    with engine.begin() as conn:
        result = conn.execute(
            text("""
                SELECT id
                FROM email_items
                WHERE organization_id = :organization_id
                AND user_id = :user_id
                AND email_id = :email_id
                LIMIT 1
            """),
            {
                "organization_id": organization_id,
                "user_id": user_id,
                "email_id": email_id,
            },
        )

        return result.fetchone() is not None


def save_email_item(
    organization_id: int,
    user_id: int,
    email_id: str,
    sender: str,
    subject: str,
    snippet: str,
    summary: str,
    ai_insights: dict,
):
    with engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO email_items (
                    organization_id,
                    user_id,
                    email_id,
                    sender,
                    subject,
                    snippet,
                    summary,
                    ai_insights
                )
                VALUES (
                    :organization_id,
                    :user_id,
                    :email_id,
                    :sender,
                    :subject,
                    :snippet,
                    :summary,
                    :ai_insights
                )
                ON CONFLICT (organization_id, user_id, email_id)
                DO NOTHING
            """),
            {
                "organization_id": organization_id,
                "user_id": user_id,
                "email_id": email_id,
                "sender": sender,
                "subject": subject,
                "snippet": snippet,
                "summary": summary,
                "ai_insights": json.dumps(ai_insights),
            },
        )


def mark_missing_email_items_as_read(
    organization_id: int,
    user_id: int,
    unread_email_ids: list[str],
):
    with engine.begin() as conn:
        if unread_email_ids:
            conn.execute(
                text("""
                    UPDATE email_items
                    SET
                        is_read = TRUE,
                        updated_at = NOW()
                    WHERE organization_id = :organization_id
                    AND user_id = :user_id
                    AND email_id NOT IN :unread_email_ids
                """),
                {
                    "organization_id": organization_id,
                    "user_id": user_id,
                    "unread_email_ids": tuple(unread_email_ids),
                },
            )
        else:
            conn.execute(
                text("""
                    UPDATE email_items
                    SET
                        is_read = TRUE,
                        updated_at = NOW()
                    WHERE organization_id = :organization_id
                    AND user_id = :user_id
                """),
                {
                    "organization_id": organization_id,
                    "user_id": user_id,
                },
            )


def followup_exists(
    organization_id: int,
    user_id: int,
    email_id: str,
) -> bool:
    with engine.begin() as conn:
        result = conn.execute(
            text("""
                SELECT id
                FROM followup_items
                WHERE organization_id = :organization_id
                AND user_id = :user_id
                AND email_id = :email_id
                LIMIT 1
            """),
            {
                "organization_id": organization_id,
                "user_id": user_id,
                "email_id": email_id,
            },
        )

        return result.fetchone() is not None


def save_document(
    document_id: str,
    original_filename: str,
    stored_filename: str,
    organization_id: int,
    uploaded_by_user_id: int,
    visibility: str = "organization",
):
    with engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO documents (
                    document_id,
                    original_filename,
                    stored_filename,
                    organization_id,
                    uploaded_by_user_id,
                    visibility
                )
                VALUES (
                    :document_id,
                    :original_filename,
                    :stored_filename,
                    :organization_id,
                    :uploaded_by_user_id,
                    :visibility
                )
                ON CONFLICT (document_id) DO NOTHING
            """),
            {
                "document_id": document_id,
                "original_filename": original_filename,
                "stored_filename": stored_filename,
                "organization_id": organization_id,
                "uploaded_by_user_id": uploaded_by_user_id,
                "visibility": visibility,
            },
        )


def get_documents(organization_id: int, user_id: int):
    with engine.begin() as conn:
        result = conn.execute(
            text("""
                SELECT
                    document_id,
                    original_filename,
                    stored_filename,
                    created_at,
                    visibility
                FROM documents
                WHERE organization_id = :organization_id
                AND (
                    visibility = 'organization'
                    OR uploaded_by_user_id = :user_id
                )
                ORDER BY created_at DESC
            """),
            {
                "organization_id": organization_id,
                "user_id": user_id,
            },
        )

        return [
            {
                "document_id": row.document_id,
                "original_filename": row.original_filename,
                "stored_filename": row.stored_filename,
                "created_at": str(row.created_at),
                "visibility": row.visibility,
            }
            for row in result
        ]


def delete_document(document_id: str, organization_id: int, user_id: int):
    with engine.begin() as conn:
        conn.execute(
            text("""
                DELETE FROM documents
                WHERE document_id = :document_id
                AND organization_id = :organization_id
                AND (
                    visibility = 'organization'
                    OR uploaded_by_user_id = :user_id
                )
            """),
            {
                "document_id": document_id,
                "organization_id": organization_id,
                "user_id": user_id,
            },
        )


def get_organization_members(organization_id: int):
    with engine.begin() as conn:
        result = conn.execute(
            text("""
                SELECT
                    u.id AS user_id,
                    u.email,
                    u.full_name,
                    om.role
                FROM organization_members om
                JOIN users u ON u.id = om.user_id
                WHERE om.organization_id = :organization_id
                ORDER BY u.email
            """),
            {"organization_id": organization_id},
        )

        return [dict(row._mapping) for row in result]


def update_member_role(organization_id: int, user_id: int, role: str):
    with engine.begin() as conn:
        conn.execute(
            text("""
                UPDATE organization_members
                SET role = :role
                WHERE organization_id = :organization_id
                AND user_id = :user_id
            """),
            {
                "organization_id": organization_id,
                "user_id": user_id,
                "role": role,
            },
        )


def save_ai_usage(
    user_id: int,
    organization_id: int,
    feature: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    estimated_cost_usd: float = 0,
):
    conn = get_db_connection()

    try:
        with conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO ai_usage_logs (
                        user_id,
                        organization_id,
                        feature,
                        model,
                        prompt_tokens,
                        completion_tokens,
                        total_tokens,
                        estimated_cost_usd
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        user_id,
                        organization_id,
                        feature,
                        model,
                        prompt_tokens,
                        completion_tokens,
                        total_tokens,
                        estimated_cost_usd,
                    ),
                )
    finally:
        conn.close()


def get_all_users():
    with engine.begin() as conn:
        result = conn.execute(
            text("""
                SELECT
                    u.id AS user_id,
                    u.email,
                    u.full_name,
                    u.global_role,
                    o.name AS organization_name,
                    om.role AS organization_role
                FROM users u
                LEFT JOIN organization_members om
                    ON om.user_id = u.id
                LEFT JOIN organizations o
                    ON o.id = om.organization_id
                ORDER BY u.id
            """),
        )

        return [dict(row._mapping) for row in result]


def get_email_connection(user_id: int):
    with engine.begin() as conn:
        result = conn.execute(
            text("""
                SELECT *
                FROM email_connections
                WHERE user_id = :user_id
                ORDER BY created_at DESC
                LIMIT 1
            """),
            {
                "user_id": user_id,
            },
        )

        row = result.fetchone()

        if not row:
            return None

        return dict(row._mapping)


def save_email_connection(
    user_id: int,
    organization_id: int,
    provider: str,
    email_address: str,
    imap_host: str,
    imap_port: int,
    username: str,
    password_encrypted: str,
):
    with engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO email_connections (
                    user_id,
                    organization_id,
                    provider,
                    email_address,
                    imap_host,
                    imap_port,
                    username,
                    password_encrypted,
                    status
                )
                VALUES (
                    :user_id,
                    :organization_id,
                    :provider,
                    :email_address,
                    :imap_host,
                    :imap_port,
                    :username,
                    :password_encrypted,
                    'active'
                )
            """),
            {
                "user_id": user_id,
                "organization_id": organization_id,
                "provider": provider,
                "email_address": email_address,
                "imap_host": imap_host,
                "imap_port": imap_port,
                "username": username,
                "password_encrypted": password_encrypted,
            },
        )


def get_email_items(
    organization_id: int,
    user_id: int,
):
    with engine.begin() as conn:
        result = conn.execute(
            text("""
                SELECT
                    email_id AS id,
                    sender AS "from",
                    subject,
                    snippet,
                    summary,
                    ai_insights,
                    is_read,
                    created_at
                FROM email_items
                WHERE organization_id = :organization_id
                AND user_id = :user_id
                AND is_read = FALSE
                ORDER BY created_at DESC
            """),
            {
                "organization_id": organization_id,
                "user_id": user_id,
            },
        )

        return [dict(row._mapping) for row in result]
