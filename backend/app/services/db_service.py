import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)


def init_db():
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS documents (
                id SERIAL PRIMARY KEY,
                document_id TEXT UNIQUE NOT NULL,
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

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
            CREATE TABLE IF NOT EXISTS email_connections (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                provider TEXT NOT NULL,
                email_address TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS global_role TEXT NOT NULL DEFAULT 'user'
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
            }
        )

def get_documents(organization_id: int, user_id: int):
    with engine.begin() as conn:
        result = conn.execute(text("""
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
        """), {
            "organization_id": organization_id,
            "user_id": user_id,
        })

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
            """),
            {
                "document_id": document_id,
                "organization_id": organization_id,
            }
        )

def get_organization_members(organization_id: int):
    with engine.begin() as conn:
        result = conn.execute(text("""
            SELECT
                u.id AS user_id,
                u.email,
                u.full_name,
                om.role
            FROM organization_members om
            JOIN users u ON u.id = om.user_id
            WHERE om.organization_id = :organization_id
            ORDER BY u.email
        """), {"organization_id": organization_id})

        return [dict(row._mapping) for row in result]


def update_member_role(organization_id: int, user_id: int, role: str):
    with engine.begin() as conn:
        conn.execute(text("""
            UPDATE organization_members
            SET role = :role
            WHERE organization_id = :organization_id
              AND user_id = :user_id
        """), {
            "organization_id": organization_id,
            "user_id": user_id,
            "role": role,
        })

def get_all_users():
    with engine.begin() as conn:
        result = conn.execute(text("""
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
        """))

        return [dict(row._mapping) for row in result]

def get_email_connection(user_id: int):
    with engine.begin() as conn:
        result = conn.execute(text("""
            SELECT *
            FROM email_connections
            WHERE user_id = :user_id
            LIMIT 1
        """), {
            "user_id": user_id
        })

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
        conn.execute(text("""
            INSERT INTO email_connections (
                user_id,
                organization_id,
                provider,
                email_address,
                imap_host,
                imap_port,
                username,
                password_encrypted
            )
            VALUES (
                :user_id,
                :organization_id,
                :provider,
                :email_address,
                :imap_host,
                :imap_port,
                :username,
                :password_encrypted
            )
        """), {
            "user_id": user_id,
            "organization_id": organization_id,
            "provider": provider,
            "email_address": email_address,
            "imap_host": imap_host,
            "imap_port": imap_port,
            "username": username,
            "password_encrypted": password_encrypted,
        })

def get_email_connection(user_id: int):
    with engine.begin() as conn:
        result = conn.execute(text("""
            SELECT *
            FROM email_connections
            WHERE user_id = :user_id
            ORDER BY created_at DESC
            LIMIT 1
        """), {
            "user_id": user_id,
        })

        row = result.fetchone()

        if not row:
            return None

        return dict(row._mapping)