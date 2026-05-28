import email
import imaplib
from datetime import datetime
from email.header import decode_header
from email.message import Message
from email.utils import parseaddr, parsedate_to_datetime
import re

from app.services.gmail_service import summarize_email, analyze_email_insights
from app.config import settings


PERSONAL_EMAIL_DOMAINS = {
    "gmail.com",
    "googlemail.com",
    "seznam.cz",
    "email.cz",
    "post.cz",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "icloud.com",
    "me.com",
    "yahoo.com",
    "centrum.cz",
    "volny.cz",
}

SENT_MAILBOX_CANDIDATES = [
    "Sent",
    "Sent Mail",
    "Sent Items",
    "Odeslané",
    "Odeslaná pošta",
    "INBOX.Sent",
    "INBOX/Sent",
    "[Gmail]/Sent Mail",
]


def _decode_header_value(value: str | None) -> str:
    if not value:
        return ""

    decoded_parts = decode_header(value)
    result = ""

    for part, encoding in decoded_parts:
        if isinstance(part, bytes):
            result += part.decode(encoding or "utf-8", errors="ignore")
        else:
            result += part

    return result


def _extract_body(message: Message) -> str:
    if message.is_multipart():
        for part in message.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))

            if content_type == "text/plain" and "attachment" not in content_disposition:
                payload = part.get_payload(decode=True)

                if payload:
                    return payload.decode(
                        part.get_content_charset() or "utf-8",
                        errors="ignore",
                    )

        for part in message.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))

            if content_type == "text/html" and "attachment" not in content_disposition:
                payload = part.get_payload(decode=True)

                if payload:
                    return payload.decode(
                        part.get_content_charset() or "utf-8",
                        errors="ignore",
                    )

    payload = message.get_payload(decode=True)

    if payload:
        return payload.decode(
            message.get_content_charset() or "utf-8",
            errors="ignore",
        )

    return ""


def _extract_email_address(value: str | None) -> str:
    if not value:
        return ""

    _, address = parseaddr(value)
    return address.lower().strip()


def _extract_domain(value: str | None) -> str:
    address = _extract_email_address(value)

    if "@" not in address:
        return ""

    return address.split("@", 1)[1].lower().strip()


def _format_message_date(value: str | None) -> str:
    if not value:
        return ""

    try:
        return parsedate_to_datetime(value).isoformat()
    except Exception:
        return value


def _parse_message_datetime(value: str | None):
    if not value:
        return None

    try:
        return parsedate_to_datetime(value)
    except Exception:
        return None


def _clean_domain(value: str | None) -> str:
    if not value:
        return ""

    cleaned = value.lower().strip()
    cleaned = cleaned.replace("mailto:", "")
    cleaned = cleaned.replace("@", "")
    cleaned = cleaned.split("/", 1)[0]
    return cleaned


def _header_text_matches_scope(
    message: Message,
    scope: str,
    search_email: str,
    search_domain: str,
) -> bool:
    searchable_headers = " ".join(
        [
            _decode_header_value(message.get("From")),
            _decode_header_value(message.get("To")),
            _decode_header_value(message.get("Cc")),
            _decode_header_value(message.get("Bcc")),
            _decode_header_value(message.get("Reply-To")),
        ]
    ).lower()

    if scope == "email":
        return search_email in searchable_headers

    return f"@{search_domain}" in searchable_headers or search_domain in searchable_headers


def _detect_direction(
    message: Message,
    username: str,
    mailbox_name: str,
) -> str:
    sender = _decode_header_value(message.get("From"))
    sender_email = _extract_email_address(sender)
    own_email = username.lower().strip()
    mailbox_lower = mailbox_name.lower()

    if sender_email and sender_email == own_email:
        return "OUTBOUND"

    if "sent" in mailbox_lower or "odeslan" in mailbox_lower:
        return "OUTBOUND"

    return "INBOUND"


def _select_mailbox(mailbox: imaplib.IMAP4_SSL, mailbox_name: str) -> bool:
    try:
        status, _ = mailbox.select(f'"{mailbox_name}"', readonly=True)
        if status == "OK":
            return True
    except Exception:
        pass

    try:
        status, _ = mailbox.select(mailbox_name, readonly=True)
        return status == "OK"
    except Exception:
        return False


def _list_mailboxes(mailbox: imaplib.IMAP4_SSL) -> list[str]:
    status, data = mailbox.list()

    if status != "OK" or not data:
        return []

    names = []

    for raw_item in data:
        if not raw_item:
            continue

        item = raw_item.decode("utf-8", errors="ignore") if isinstance(raw_item, bytes) else str(raw_item)

        if '"' in item:
            candidate = item.split('"')[-2]
        else:
            candidate = item.split(" ")[-1]

        candidate = candidate.strip().strip('"')

        if candidate:
            names.append(candidate)

    return names


def _discover_sent_mailboxes(mailbox: imaplib.IMAP4_SSL) -> list[str]:
    available = _list_mailboxes(mailbox)
    found = []

    for name in available:
        lower = name.lower()

        if "sent" in lower or "odeslan" in lower:
            found.append(name)

    for candidate in SENT_MAILBOX_CANDIDATES:
        if candidate not in found:
            found.append(candidate)

    return found


def _fetch_recent_messages_from_mailbox(
    mailbox: imaplib.IMAP4_SSL,
    mailbox_name: str,
    username: str,
    scope: str,
    search_email: str,
    search_domain: str,
    max_scan: int,
) -> list[dict]:
    if not _select_mailbox(mailbox, mailbox_name):
        return []

    status, data = mailbox.search(None, "ALL")

    if status != "OK" or not data:
        return []

    email_ids = data[0].split()
    email_ids = email_ids[-max_scan:]
    output = []

    for email_id in reversed(email_ids):
        status, msg_data = mailbox.fetch(email_id, "(BODY.PEEK[])")

        if status != "OK" or not msg_data or not msg_data[0]:
            continue

        raw_email = msg_data[0][1]
        message = email.message_from_bytes(raw_email)

        if not _header_text_matches_scope(
            message=message,
            scope=scope,
            search_email=search_email,
            search_domain=search_domain,
        ):
            continue

        subject = _decode_header_value(message.get("Subject"))
        sender = _decode_header_value(message.get("From"))
        to_recipients = _decode_header_value(message.get("To"))
        cc_recipients = _decode_header_value(message.get("Cc"))
        body = _extract_body(message)
        clean_body = _clean_email_body(
            body,
            max_chars=2000,
        )
        direction = _detect_direction(message, username, mailbox_name)
        message_id = _decode_header_value(message.get("Message-ID")) or f"{mailbox_name}:{email_id.decode()}"
        parsed_date = _parse_message_datetime(message.get("Date"))

        output.append({
            "id": email_id.decode(),
            "message_id": message_id,
            "mailbox": mailbox_name,
            "direction": direction,
            "from": sender,
            "from_email": _extract_email_address(sender),
            "from_domain": _extract_domain(sender),
            "to": to_recipients,
            "cc": cc_recipients,
            "subject": subject or "(bez předmětu)",
            "snippet": body[:1200],
            "date": _format_message_date(message.get("Date")),
            "_sort_date": parsed_date,
            "snippet": clean_body[:300],
            "body": clean_body,
        })

    return output


def get_unread_imap_emails(
    connection: dict,
    limit: int = 5,
    date_from: str | None = None,
    use_ai: bool = True,
):
    host = connection["imap_host"]
    port = connection["imap_port"]
    username = connection["username"]
    password = connection["password_encrypted"]

    mailbox = imaplib.IMAP4_SSL(
    host,
    port,
    timeout=settings.email_connection_timeout,
)
    mailbox.login(username, password)
    mailbox.select("INBOX")

    search_criteria = ["UNSEEN"]

    if date_from:
        formatted_date = (
            datetime.strptime(date_from, "%Y-%m-%d")
            .strftime("%d-%b-%Y")
        )
        search_criteria.extend(["SINCE", formatted_date])

    status, data = mailbox.search(None, *search_criteria)

    if status != "OK":
        mailbox.logout()
        return []

    email_ids = data[0].split()
    email_ids = email_ids[-limit:]

    output = []

    for email_id in reversed(email_ids):
        status, msg_data = mailbox.fetch(email_id, "(BODY.PEEK[])")

        if status != "OK" or not msg_data or not msg_data[0]:
            continue

        raw_email = msg_data[0][1]
        message = email.message_from_bytes(raw_email)

        subject = _decode_header_value(message.get("Subject"))
        sender = _decode_header_value(message.get("From"))
        to_recipients = _decode_header_value(message.get("To"))
        cc_recipients = _decode_header_value(message.get("Cc"))
        body = _extract_body(message)

        is_direct = username.lower() in (to_recipients or "").lower()
        is_cc = username.lower() in (cc_recipients or "").lower()

        summary = ""
        insights = {}

        if use_ai:
            summary = summarize_email(subject, sender, body)
            insights = analyze_email_insights(subject, sender, body)

        output.append({
            "id": email_id.decode(),
            "from": sender,
            "from_email": _extract_email_address(sender),
            "from_domain": _extract_domain(sender),
            "subject": subject or "(bez předmětu)",
            "snippet": body[:300],
            "summary": summary,
            "ai_insights": insights,
            "to": to_recipients,
            "cc": cc_recipients,
            "is_direct": is_direct,
            "is_cc": is_cc,
            "date": _format_message_date(message.get("Date")),
        })

    mailbox.logout()

    return output


def get_client_imap_conversation_emails(
    connection: dict,
    client_email: str | None = None,
    client_domain: str | None = None,
    scope: str = "email",
    limit: int = 10,
):
    """
    Načte poslední komunikaci s klientem z INBOXu i odeslané pošty.

    scope:
    - email  = komunikace s jednou konkrétní adresou
    - domain = komunikace s celou firmou/doménou

    Výstup je timeline se směrem:
    - INBOUND  = klient psal nám
    - OUTBOUND = my jsme psali klientovi

    Bezpečnost:
    - Používá BODY.PEEK[], takže emaily neoznačí jako přečtené.
    - Limit je omezený na 20 finálních zpráv.
    """
    safe_limit = max(1, min(limit, 20))
    safe_scope = (scope or "email").lower().strip()

    if safe_scope not in {"email", "domain"}:
        raise ValueError("Invalid scope. Allowed values: email, domain")

    search_email = ""
    search_domain = ""

    if safe_scope == "email":
        if not client_email:
            raise ValueError("client_email is required for email scope")

        search_email = _extract_email_address(client_email) or client_email.lower().strip()

        if "@" not in search_email:
            raise ValueError("client_email must be a valid email address")

        search_domain = search_email.split("@", 1)[1]

    if safe_scope == "domain":
        if not client_domain:
            raise ValueError("client_domain is required for domain scope")

        search_domain = _clean_domain(client_domain)

        if not search_domain or "." not in search_domain:
            raise ValueError("client_domain must be a valid domain, for example firma.cz")

        if search_domain in PERSONAL_EMAIL_DOMAINS:
            raise ValueError("Personal email domains are not suitable for company domain briefing")

    host = connection["imap_host"]
    port = connection["imap_port"]
    username = connection["username"]
    password = connection["password_encrypted"]

    max_scan_per_mailbox = max(50, safe_limit * 10)

    mailbox = imaplib.IMAP4_SSL(
    host,
    port,
    timeout=settings.email_connection_timeout,
)
    mailbox.login(username, password)

    mailboxes_to_scan = ["INBOX"]

    for sent_mailbox in _discover_sent_mailboxes(mailbox):
        if sent_mailbox not in mailboxes_to_scan:
            mailboxes_to_scan.append(sent_mailbox)

    collected = []
    selected_mailboxes = set()

    for mailbox_name in mailboxes_to_scan:
        if mailbox_name in selected_mailboxes:
            continue

        selected_mailboxes.add(mailbox_name)

        collected.extend(
            _fetch_recent_messages_from_mailbox(
                mailbox=mailbox,
                mailbox_name=mailbox_name,
                username=username,
                scope=safe_scope,
                search_email=search_email,
                search_domain=search_domain,
                max_scan=max_scan_per_mailbox,
            )
        )

    mailbox.logout()

    unique_by_message_id = {}

    for item in collected:
        message_id = item.get("message_id") or f"{item.get('mailbox')}:{item.get('id')}"
        unique_by_message_id[message_id] = item

    output = list(unique_by_message_id.values())
    output.sort(
        key=lambda item: item.get("_sort_date") or datetime.min,
        reverse=True,
    )

    output = output[:safe_limit]

    for item in output:
        item.pop("_sort_date", None)

    return output


# Backward compatibility pro starší importy / předchozí frontend testy.
def get_client_imap_emails(
    connection: dict,
    client_email: str | None = None,
    client_domain: str | None = None,
    scope: str = "email",
    limit: int = 10,
):
    return get_client_imap_conversation_emails(
        connection=connection,
        client_email=client_email,
        client_domain=client_domain,
        scope=scope,
        limit=limit,
    )


def mark_imap_email_as_read(connection: dict, email_id: str):
    host = connection["imap_host"]
    port = connection["imap_port"]
    username = connection["username"]
    password = connection["password_encrypted"]

    mailbox = imaplib.IMAP4_SSL(
    host,
    port,
    timeout=settings.email_connection_timeout,
)
    mailbox.login(username, password)
    mailbox.select("INBOX")

    mailbox.store(email_id, "+FLAGS", "\\Seen")

    mailbox.logout()

    return True


def _clean_email_body(body: str, max_chars: int = 2000) -> str:
    if not body:
        return ""

    text = body.replace("\r\n", "\n").replace("\r", "\n")

    cut_patterns = [
        r"\nOn .* wrote:",
        r"\nDne .* napsal\(a\):",
        r"\nFrom: .*",
        r"\nSent: .*",
        r"\nTo: .*",
        r"\nSubject: .*",
        r"\n-----Original Message-----",
        r"\n----- Forwarded message -----",
        r"\nPůvodní zpráva",
        r"\nOriginal Message",
        r"\n________________________________",
    ]

    for pattern in cut_patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            text = text[:match.start()]
            break

    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)

    return text.strip()[:max_chars]