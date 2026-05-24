import base64
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from openai import OpenAI


SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

BASE_DIR = Path(__file__).resolve().parents[2]
CREDENTIALS_PATH = BASE_DIR / "credentials" / "gmail_credentials.json"
TOKEN_PATH = BASE_DIR / "credentials" / "gmail_token.json"

client = OpenAI()


def get_gmail_client():
    creds = None

    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(
            str(TOKEN_PATH),
            SCOPES,
        )

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                str(CREDENTIALS_PATH),
                SCOPES,
            )
            creds = flow.run_local_server(port=0)

        TOKEN_PATH.write_text(creds.to_json(), encoding="utf-8")

    return build("gmail", "v1", credentials=creds)


def _decode_base64(data: str) -> str:
    decoded = base64.urlsafe_b64decode(data + "===")
    return decoded.decode("utf-8", errors="ignore")


def _decode_body(payload: dict[str, Any]) -> str:
    parts = payload.get("parts", [])

    if "body" in payload and payload["body"].get("data"):
        return _decode_base64(payload["body"]["data"])

    for part in parts:
        mime_type = part.get("mimeType")

        if mime_type == "text/plain" and part.get("body", {}).get("data"):
            return _decode_base64(part["body"]["data"])

        if mime_type == "text/html" and part.get("body", {}).get("data"):
            html = _decode_base64(part["body"]["data"])
            return BeautifulSoup(html, "html.parser").get_text(" ", strip=True)

        nested = part.get("parts")
        if nested:
            text = _decode_body({"parts": nested})
            if text:
                return text

    return ""


def summarize_email(subject: str, sender: str, body: str) -> str:
    prompt = f"""
Shrň tento email česky.

Vrať:
- hlavní sdělení
- požadovanou akci
- deadline, pokud existuje
- riziko/problém, pokud existuje

From: {sender}
Subject: {subject}

Email:
{body[:6000]}
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "Jsi praktický firemní asistent pro třídění emailů.",
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        temperature=0.2,
    )

    return response.choices[0].message.content or ""


def get_unread_email_summaries(
    limit: int = 5,
    date_from: str | None = None,
    date_to: str | None = None,
):
    service = get_gmail_client()

    query_parts = ["is:unread", "in:inbox"]

    if date_from:
        query_parts.append(f"after:{date_from}")

    if date_to:
        query_parts.append(f"before:{date_to}")

    gmail_query = " ".join(query_parts)

    result = (
        service.users()
        .messages()
        .list(
            userId="me",
            q=gmail_query,
            maxResults=limit,
        )
        .execute()
    )

    messages = result.get("messages", [])
    output = []

    for item in messages:
        message = (
            service.users()
            .messages()
            .get(
                userId="me",
                id=item["id"],
                format="full",
            )
            .execute()
        )

        headers = message.get("payload", {}).get("headers", [])

        subject = next(
            (h["value"] for h in headers if h["name"].lower() == "subject"),
            "(bez předmětu)",
        )

        sender = next(
            (h["value"] for h in headers if h["name"].lower() == "from"),
            "(neznámý odesílatel)",
        )

        body = _decode_body(message.get("payload", {}))
        summary = summarize_email(subject, sender, body)

        output.append(
            {
                "id": message["id"],
                "from": sender,
                "subject": subject,
                "snippet": message.get("snippet", ""),
                "summary": summary,
            }
        )

    return output


def draft_email_reply(
    subject: str,
    sender: str,
    snippet: str,
    summary: str,
    instruction: str,
) -> str:
    prompt = f"""
Navrhni odpověď na email v češtině.

Styl:
- profesionální
- stručný
- přirozený
- nepřehánět omluvy
- neodesílat, pouze návrh odpovědi

Instrukce uživatele:
{instruction}

Původní email:
Od: {sender}
Předmět: {subject}
Snippet: {snippet}

AI summary:
{summary}
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "Jsi firemní asistent pro přípravu návrhů odpovědí na emaily.",
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        temperature=0.3,
    )

    return response.choices[0].message.content or ""

def create_email_overview(emails: list[dict]) -> str:
    email_text = "\n\n".join(
        [
            f"From: {email.get('from')}\nSubject: {email.get('subject')}\nSummary: {email.get('summary')}"
            for email in emails
        ]
    )

    prompt = f"""
Z těchto email summary vytvoř přehled.

Použij markdown formát.

## Hlavní sdělení
...

## Úkoly
- ...
- ...

## Termíny a rizika
- ...

## Může počkat
- ...

Buď stručný a praktický.

Email summaries:
{email_text}
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "Jsi praktický osobní a pracovní AI asistent.",
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        temperature=0.2,
    )

    return response.choices[0].message.content or ""