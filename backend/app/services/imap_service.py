import email
import imaplib
from email.header import decode_header
from email.message import Message
from datetime import datetime

from app.services.gmail_service import summarize_email, analyze_email_insights


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

    payload = message.get_payload(decode=True)

    if payload:
        return payload.decode(
            message.get_content_charset() or "utf-8",
            errors="ignore",
        )

    return ""


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

    mailbox = imaplib.IMAP4_SSL(host, port)
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

        if status != "OK":
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
            "subject": subject or "(bez předmětu)",
            "snippet": body[:300],
            "summary": summary,
            "ai_insights": insights,
            "to": to_recipients,
            "cc": cc_recipients,
            "is_direct": is_direct,
            "is_cc": is_cc,
        })

    mailbox.logout()

    return output

def mark_imap_email_as_read(connection: dict, email_id: str):
    host = connection["imap_host"]
    port = connection["imap_port"]
    username = connection["username"]
    password = connection["password_encrypted"]

    mailbox = imaplib.IMAP4_SSL(host, port)
    mailbox.login(username, password)
    mailbox.select("INBOX")

    mailbox.store(email_id, "+FLAGS", "\\Seen")

    mailbox.logout()

    return True