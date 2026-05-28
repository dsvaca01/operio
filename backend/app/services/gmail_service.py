import base64
import json
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from openai import OpenAI

from app.services.db_service import save_ai_usage


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


def _track_openai_usage(
    response,
    user_id: int | None,
    organization_id: int | None,
    feature: str,
    model: str,
):
    """
    Uloží token usage po OpenAI callu.

    Poznámka:
    - Pokud user_id nebo organization_id není předané, tracking se přeskočí.
    - To chrání starší volání funkcí, ale pro reálné měření musí endpointy
      posílat current_user["user_id"] a current_user["organization_id"].
    """
    if user_id is None or organization_id is None:
        return

    usage = getattr(response, "usage", None)

    if usage is None:
        return

    save_ai_usage(
        user_id=user_id,
        organization_id=organization_id,
        feature=feature,
        model=model,
        prompt_tokens=getattr(usage, "prompt_tokens", 0) or 0,
        completion_tokens=getattr(usage, "completion_tokens", 0) or 0,
        total_tokens=getattr(usage, "total_tokens", 0) or 0,
    )


def summarize_email(
    subject: str,
    sender: str,
    body: str,
    user_id: int | None = None,
    organization_id: int | None = None,
) -> str:
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

    model = "gpt-4o-mini"

    response = client.chat.completions.create(
        model=model,
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

    _track_openai_usage(
        response=response,
        user_id=user_id,
        organization_id=organization_id,
        feature="email_summary",
        model=model,
    )

    return response.choices[0].message.content or ""


def get_unread_email_summaries(
    limit: int = 5,
    date_from: str | None = None,
    date_to: str | None = None,
    user_id: int | None = None,
    organization_id: int | None = None,
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
        summary = summarize_email(
            subject=subject,
            sender=sender,
            body=body,
            user_id=user_id,
            organization_id=organization_id,
        )

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


def analyze_email_insights(
    subject: str,
    sender: str,
    body: str,
    user_id: int | None = None,
    organization_id: int | None = None,
):
    safe_subject = subject or ""
    safe_sender = sender or ""
    safe_body = body or ""

    prompt = f"""
Jsi AI asistent pro prioritizaci emailů.

Analyzuj email a vrať POUZE validní JSON.
Nevracej markdown.
Nevracej vysvětlení.

Všechny hodnoty vrať v českém jazyce.

Odesílatel:
{safe_sender}

Předmět:
{safe_subject}

Obsah emailu:
{safe_body[:2000]}

Vrať přesně tuto JSON strukturu:
{{
  "priority": "LOW",
  "labels": [],
  "suggested_action": "",
  "risk_level": "low"
}}

Povolené hodnoty priority:
LOW, MEDIUM, HIGH

Povolené hodnoty risk_level:
low, medium, high

Pravidla:
- Maximálně 3 labels
- Labels musí být krátké
- Labels musí být v češtině
- suggested_action musí být v češtině
- suggested_action maximálně 4 slova

Pokud email vyžaduje odpověď použij:
"Čeká na vaši odpověď"

Pokud je klient nespokojený nebo hrozí eskalace použij:
"Riziko eskalace klienta"

Pokud email obsahuje termín použij:
"Blížící se termín"

Pokud není potřeba žádná akce:
suggested_action nastav na:
"Bez akce"

Příklady suggested_action:
- Odpovědět dnes
- Zkontrolovat smlouvu
- Poslat fakturu
- Zavolat klientovi
"""

    try:
        model = "gpt-4.1-mini"

        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Jsi AI asistent pro prioritizaci a třídění firemních emailů."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            temperature=0,
        )

        _track_openai_usage(
            response=response,
            user_id=user_id,
            organization_id=organization_id,
            feature="email_insights",
            model=model,
        )

        content = response.choices[0].message.content or ""
        result = json.loads(content)

        return {
            "priority": result.get("priority", "LOW"),
            "labels": result.get("labels", []),
            "suggested_action": result.get("suggested_action", ""),
            "risk_level": result.get("risk_level", "low"),
        }

    except Exception as error:
        print("analyze_email_insights failed:", error)

        return {
            "priority": "LOW",
            "labels": [],
            "suggested_action": "",
            "risk_level": "low",
        }


def draft_email_reply(
    subject: str,
    sender: str,
    snippet: str,
    summary: str,
    instruction: str,
    user_id: int | None = None,
    organization_id: int | None = None,
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

    model = "gpt-4o-mini"

    response = client.chat.completions.create(
        model=model,
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

    _track_openai_usage(
        response=response,
        user_id=user_id,
        organization_id=organization_id,
        feature="email_draft_reply",
        model=model,
    )

    return response.choices[0].message.content or ""


def create_email_overview(
    emails: list[dict],
    user_id: int | None = None,
    organization_id: int | None = None,
) -> str:
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

    model = "gpt-4o-mini"

    response = client.chat.completions.create(
        model=model,
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

    _track_openai_usage(
        response=response,
        user_id=user_id,
        organization_id=organization_id,
        feature="email_overview",
        model=model,
    )

    return response.choices[0].message.content or ""


def draft_email_reply_with_context(
    email_subject: str,
    email_body: str,
    context_chunks: list,
    user_id: int | None = None,
    organization_id: int | None = None,
):
    context = "\n\n".join([chunk["text"] for chunk in context_chunks])

    prompt = f"""
Jsi AI asistent pro pracovní emailovou komunikaci.

Tvým úkolem je vytvořit profesionální odpověď na email na základě poskytnutého kontextu z dokumentů.

PRAVIDLA:
- Používej pouze informace z poskytnutého kontextu dokumentů.
- Pokud informace v dokumentech chybí, napiš, že je potřeba informaci ověřit.
- Nevymýšlej si fakta.
- Odpovídej profesionálně, stručně a jasně.
- Odpověď generuj vždy v češtině.
- Zachovej formální business komunikaci.
- Pokud email obsahuje dotazy, odpověz na všechny dostupné body.
- Nevkládej žádné informace mimo dodaný kontext.

PŘEDMĚT EMAILU:
{email_subject}

OBSAH EMAILU:
{email_body}

KONTEXT Z DOKUMENTŮ:
{context}
"""

    model = "gpt-4.1-mini"

    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "Jsi AI asistent pro firemní emailovou komunikaci. "
                    "Generuješ přesné a profesionální odpovědi v češtině "
                    "na základě dokumentového kontextu."
                ),
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        temperature=0.2,
    )

    _track_openai_usage(
        response=response,
        user_id=user_id,
        organization_id=organization_id,
        feature="email_draft_reply_with_documents",
        model=model,
    )

    return response.choices[0].message.content or ""


def create_client_context_briefing(
    emails: list[dict],
    client_label: str,
    scope: str,
    user_id: int | None = None,
    organization_id: int | None = None,
) -> str:
    """
    Vytvoří meeting/client briefing z poslední obousměrné komunikace s klientem.

    Vstup očekává list emailů ve tvaru:
    - date
    - direction: INBOUND / OUTBOUND
    - mailbox
    - from
    - to
    - cc
    - subject
    - snippet
    """
    if not emails:
        return "Pro zadaného klienta nebyla nalezena žádná komunikace."

    email_text = "\n\n".join(
        [
            (
                f"Datum: {email.get('date', '')}\n"
                f"Směr: {email.get('direction', '')}\n"
                f"Mailbox: {email.get('mailbox', '')}\n"
                f"Od: {email.get('from', '')}\n"
                f"Komu: {email.get('to', '')}\n"
                f"Kopie: {email.get('cc', '')}\n"
                f"Předmět: {email.get('subject', '')}\n"
                f"Obsah / snippet: {email.get('snippet', '')}"
            )
            for email in emails
        ]
    )

    prompt = f"""
Jsi seniorní AI asistent pro account management a přípravu na schůzky.

Vytvoř praktický klientský briefing v češtině z obousměrné emailové komunikace.

Klient / scope:
{client_label}

Typ rozsahu:
{scope}

DŮLEŽITÉ:
- INBOUND = klient / firma psala nám.
- OUTBOUND = my jsme psali klientovi / firmě.
- Sleduj hlavně, kdo je aktuálně na tahu.
- Rozliš, co klient požadoval a co už jsme odpověděli nebo slíbili.
- Nepředpokládej, že otevřený bod stále trvá, pokud je v OUTBOUND odpovědi zjevně vyřešený.
- Použij pouze informace z dodaných emailů.
- Nevymýšlej fakta.
- Pokud něco není jasné, napiš, že to není z emailů zřejmé.

Vrať markdown v této struktuře:

## Aktuální stav klienta
Stručně popiš, v jaké fázi komunikace/spolupráce jsme.

## Kdo je aktuálně na tahu
- Napiš jasně, zda čekáme na klienta, nebo klient čeká na nás.
- Pokud to není zřejmé, napiš to.

## Co se momentálně řeší
- ...

## Co už jsme odpověděli / slíbili
- ...

## Otevřené body
- ...

## Rizika / blokery
- ...

## Poslední důležitá komunikace
- ...

## Doporučené next steps
- ...

## Příprava na schůzku
- Na co se zeptat
- Co si připravit
- Na co si dát pozor

Email timeline:
{email_text[:16000]}
"""

    model = "gpt-4o-mini"

    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "Jsi praktický firemní AI asistent pro klientský kontext, "
                    "meeting preparation a account management. Umíš číst obousměrnou "
                    "emailovou timeline a určit, kdo je na tahu."
                ),
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
        temperature=0.2,
    )

    _track_openai_usage(
        response=response,
        user_id=user_id,
        organization_id=organization_id,
        feature="client_context_briefing",
        model=model,
    )

    return response.choices[0].message.content or ""
