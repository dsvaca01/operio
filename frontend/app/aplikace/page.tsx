"use client";

import { useEffect, useRef, useState } from "react";

type AssistantType = "knowledge" | "email";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type EmailSummary = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  summary: string;
  replyInstruction?: string;
  draftReply?: string;
};

type Source = {
  score: number;
  text: string;
  filename: string;
  document_id: string;
  chunk_index: number;
};

type DocumentItem = {
  document_id: string;
  original_filename: string;
};

export default function Home() {
  const [activeAssistant, setActiveAssistant] =
    useState<AssistantType>("knowledge");
  const [isPrivate, setIsPrivate] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");

  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sources, setSources] = useState<Source[]>([]);

  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [emailLoading, setEmailLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const today = new Date();
  const tomorrow = new Date();

  const [emailOverview, setEmailOverview] = useState("");

tomorrow.setDate(today.getDate() + 1);

const todayFormatted =
  today.toISOString().split("T")[0];

const tomorrowFormatted =
  tomorrow.toISOString().split("T")[0];

const [emailDateFrom, setEmailDateFrom] =
  useState(todayFormatted);

const [emailDateTo, setEmailDateTo] =
  useState(tomorrowFormatted);

const [emailLimit, setEmailLimit] = useState(5);

  const API_URL = "http://localhost:8000";

  const loadDocuments = async () => {
  try {
    const token = localStorage.getItem("access_token");

    const response = await fetch(`${API_URL}/documents`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Failed to load documents", data);
      setDocuments([]);
      return;
    }

    setDocuments(data.documents || []);
  } catch (error) {
    console.error("Failed to load documents", error);
  }
};

const loadUnreadEmails = async () => {
  try {
    setEmailLoading(true);
    const token = localStorage.getItem("access_token");

    const params = new URLSearchParams();
    params.set("limit", emailLimit.toString());

    if (emailDateFrom) {
      params.set("date_from", emailDateFrom);
    }

    if (emailDateTo) {
      params.set("date_to", emailDateTo);
    }
    const response = await fetch(
      `${API_URL}/emails/unread?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

setEmails(data.emails || []);



const overviewResponse = await fetch(`${API_URL}/emails/overview`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    emails: data.emails || [],
  }),
});

const overviewData = await overviewResponse.json();
setEmailOverview(overviewData.overview || "");
  } catch (error) {
    console.error("Failed to load emails", error);
    alert("Nepodařilo se načíst emaily.");
  } finally {
    setEmailLoading(false);
  }
};

const markEmailAsRead = async (emailId: string) => {
  const token = localStorage.getItem("access_token");

  const response = await fetch(`${API_URL}/emails/mark-read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      email_id: emailId,
    }),
  });

  if (!response.ok) {
    alert("Nepodařilo se označit email jako přečtený.");
    return;
  }

  setEmails((prev) =>
    prev.filter((email) => email.id !== emailId)
  );
};

const updateEmailInstruction = (
  emailId: string,
  instruction: string
) => {
  setEmails((prev) =>
    prev.map((email) =>
      email.id === emailId
        ? {
            ...email,
            replyInstruction: instruction,
          }
        : email
    )
  );
};

const generateDraftReply = async (email: EmailSummary) => {
  try {
    setEmailLoading(true);

    const response = await fetch(
      `${API_URL}/emails/draft-reply`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: email.subject,
          sender: email.from,
          snippet: email.snippet,
          summary: email.summary,
          instruction: email.replyInstruction || "",
        }),
      }
    );

    const data = await response.json();

    setEmails((prev) =>
      prev.map((item) =>
        item.id === email.id
          ? {
              ...item,
              draftReply: data.draft,
            }
          : item
      )
    );
  } catch (error) {
    console.error("Draft reply failed", error);
    alert("Nepodařilo se navrhnout odpověď.");
  } finally {
    setEmailLoading(false);
  }
};

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    alert("Zkopírováno do schránky.");
  } catch (error) {
    console.error("Copy failed", error);
    alert("Kopírování selhalo.");
  }
};

const uploadFile = async () => {
  if (!file) return;

  try {
    setLoading(true);
    setUploadStatus("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("visibility", isPrivate ? "private" : "organization");

    const token = localStorage.getItem("access_token");

    const response = await fetch(`${API_URL}/documents/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      setUploadStatus(`Upload selhal: ${data.detail || response.status}`);
      return;
    }

    setUploadStatus(
      `Dokument nahrán. Uloženo chunků: ${data.stored_chunks}`
    );

    await loadDocuments();

    setSelectedDocumentId(data.stored_filename);

    setFile(null);
    setIsPrivate(false);
  } catch (error) {
    console.error("Upload failed", error);
    setUploadStatus("Upload selhal. Zkontroluj backend.");
  } finally {
    setLoading(false);
  }
};

  const deleteDocument = async (documentId: string) => {
  const confirmed = confirm("Opravdu chceš dokument smazat?");

  if (!confirmed) return;

  try {
    setLoading(true);

    const token = localStorage.getItem("access_token");

    const response = await fetch(`${API_URL}/documents/${documentId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Delete failed:", errorText);
      alert("Mazání selhalo.");
      return;
    }

    if (selectedDocumentId === documentId) {
      setSelectedDocumentId("");
    }

    await loadDocuments();
  } catch (error) {
    console.error("Delete failed", error);
    alert("Mazání selhalo. Zkontroluj backend.");
  } finally {
    setLoading(false);
  }
};



  const askQuestion = async () => {
    if (!query.trim()) return;

    const userQuestion = query;

    try {
      setLoading(true);
      setSources([]);
      setQuery("");

      setMessages((prev) => [
        { role: "assistant", content: "" },
        { role: "user", content: userQuestion },
        ...prev,
      ]);

      const response = await fetch(`${API_URL}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: userQuestion,
          document_id: selectedDocumentId || null,
        }),
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value);

        setMessages((prev) => {
          const updated = [...prev];

          updated[0] = {
            ...updated[0],
            content: updated[0].content + chunk,
          };

          return updated;
        });
      }
    } catch (error) {
      console.error("Streaming failed", error);

      setMessages((prev) => [
        {
          role: "assistant",
          content: "Odpověď se nepodařilo načíst.",
        },
        ...prev,
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[300px_1fr]">
        <aside className="border-r border-slate-800 bg-slate-900/70 p-6">
          <h1 className="text-3xl font-bold">Operio</h1>

          <p className="mt-2 text-sm text-slate-400">
            AI enterprise assistants
          </p>

          <div className="mt-10 space-y-3">
            <button
              onClick={() => setActiveAssistant("knowledge")}
              className={`w-full rounded-2xl px-4 py-4 text-left transition ${
                activeAssistant === "knowledge"
                  ? "bg-indigo-500 text-white"
                  : "bg-slate-950 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <p className="font-semibold">Knowledge Assistant</p>

              <p className="mt-1 text-xs opacity-70">
                Chat nad firemními dokumenty
              </p>
            </button>

            <button
              onClick={() => setActiveAssistant("email")}
              className={`w-full rounded-2xl px-4 py-4 text-left transition ${
                activeAssistant === "email"
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-950 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <p className="font-semibold">Email Assistant</p>

              <p className="mt-1 text-xs opacity-70">
                Shrnutí nepřečtených Gmailů
              </p>
            </button>
          </div>

          

          {activeAssistant === "knowledge" && (
            <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Kontext dokumentů
              </p>

              <select
                value={selectedDocumentId}
                onChange={(e) => setSelectedDocumentId(e.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm"
              >
                <option value="">Všechny dokumenty</option>

                {documents.map((doc) => (
                  <option key={doc.document_id} value={doc.document_id}>
                    {doc.original_filename}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Status
            </p>

            <p className="mt-2 text-sm text-emerald-400">
              Backend připojen
            </p>
          </div>

          <a href="/admin" className="mt-6 block w-full rounded-2xl bg-amber-700 px-4 py-4 text-left text-white transition hover:bg-amber-600">
            <p className="font-semibold">Admin</p>
            <p className="mt-1 text-xs opacity-80">
              Správa uživatelů a rolí
            </p>
          </a>

        </aside>

        <section className="p-6 lg:p-10">
          <div className="mx-auto max-w-6xl">
            {activeAssistant === "knowledge" && (
              <>
                <div>
                  <h2 className="text-4xl font-bold">
                    Knowledge Assistant
                  </h2>

                  <p className="mt-3 text-slate-400">
                    Nahraj dokumenty a ptej se buď nad všemi, nebo nad jedním vybraným.
                  </p>
                </div>

                <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
                  <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
                    <h3 className="text-xl font-semibold">Dokumenty</h3>

                    <p className="mt-2 text-sm text-slate-400">
                      Podporované formáty: PDF, TXT, DOCX.
                    </p>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.txt,.docx"
                      className="hidden"
                      onChange={(e) => {
                        const selectedFile = e.target.files?.[0];

                        if (selectedFile) {
                          setFile(selectedFile);
                        }
                      }}
                    />

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-6 w-full rounded-2xl border border-slate-700 px-5 py-3 text-sm font-medium hover:bg-slate-800"
                    >
                      Vybrat dokument
                    </button>

                    <label className="mt-4 flex items-center gap-3 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                      />

                      Privátní dokument
                    </label>

                    {file && (
                      <div className="mt-4 rounded-2xl bg-slate-950 p-4">
                        <p className="text-sm text-slate-300">{file.name}</p>

                        <button
                          onClick={uploadFile}
                          disabled={loading}
                          className="mt-4 w-full rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
                        >
                          {loading ? "Nahrávám..." : "Nahrát dokument"}
                        </button>
                      </div>
                    )}

                    {uploadStatus && (
                      <p className="mt-4 rounded-xl bg-slate-950 p-3 text-sm text-emerald-400">
                        {uploadStatus}
                      </p>
                    )}

                    <div className="mt-6">
                      <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">
                        Nahrané dokumenty
                      </p>

                      <div className="space-y-2">
                        {documents.length === 0 && (
                          <p className="rounded-xl bg-slate-950 p-3 text-sm text-slate-500">
                            Zatím nejsou nahrané žádné dokumenty.
                          </p>
                        )}

                        {documents.map((doc) => (
                          <div
                            key={doc.document_id}
                            className={`flex items-center justify-between gap-2 rounded-xl p-3 text-sm ${
                              selectedDocumentId === doc.document_id
                                ? "bg-indigo-500 text-white"
                                : "bg-slate-950 text-slate-300"
                            }`}
                          >
                            <button
                              onClick={() => setSelectedDocumentId(doc.document_id)}
                              className="flex-1 text-left"
                            >
                              {doc.original_filename}
                            </button>

                            <button
                              onClick={() => deleteDocument(doc.document_id)}
                              className="rounded-lg px-2 py-1 text-xs hover:bg-red-500 hover:text-white"
                              title="Smazat dokument"
                            >
                              Smazat
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
                    <h3 className="text-xl font-semibold">Chat</h3>

                    <textarea
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          askQuestion();
                        }
                      }}
                      placeholder="Zeptej se na vybraný dokument..."
                      className="mt-4 h-28 w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm outline-none focus:border-indigo-500"
                    />

                    <button
                      onClick={askQuestion}
                      disabled={loading || !query.trim()}
                      className="mt-4 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200 disabled:opacity-50"
                    >
                      {loading ? "Přemýšlím..." : "Zeptat se"}
                    </button>

                    <div className="mt-6 min-h-[260px] rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      {messages.length === 0 && !loading && (
                        <p className="text-sm text-slate-500">
                          Odpověď se zobrazí zde.
                        </p>
                      )}

                      <div className="space-y-4">
                        {messages.map((message, index) => (
                          <div
                            key={index}
                            className={`flex ${
                              message.role === "user"
                                ? "justify-end"
                                : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-5 py-4 ${
                                message.role === "user"
                                  ? "bg-indigo-500 text-white"
                                  : "border border-slate-800 bg-slate-900"
                              }`}
                            >
                              {message.content}
                            </div>
                          </div>
                        ))}

                        {loading && (
                          <div className="flex justify-start">
                            <div className="rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4 text-slate-400">
                              Přemýšlím...
                            </div>
                          </div>
                        )}

                        <div ref={messagesEndRef} />
                      </div>
                    </div>

                    {sources.length > 0 && (
                      <div className="mt-6">
                        <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">
                          Zdroje
                        </p>

                        <div className="space-y-3">
                          {sources.map((source, index) => (
                            <div
                              key={index}
                              className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
                            >
                              <div className="flex justify-between gap-4 text-sm">
                                <span className="font-medium text-slate-200">
                                  {source.filename}
                                </span>

                                <span className="text-slate-500">
                                  score {source.score.toFixed(2)}
                                </span>
                              </div>

                              <p className="mt-2 line-clamp-3 text-sm text-slate-400">
                                {source.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeAssistant === "email" && (
              <div className="max-w-5xl">
                <div>
                  <h2 className="text-4xl font-bold">
                    Email Assistant
                  </h2>

                  <p className="mt-3 text-slate-400">
                    Načte nepřečtené emaily z Gmailu a vytvoří krátké AI shrnutí.
                  </p>
                </div>

                <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">
                        Nepřečtené emaily
                      </h3>

                      <p className="mt-2 text-sm text-slate-400">
                        Read-only Gmail integrace. Pro demo pouze summary, bez odesílání odpovědí.
                      </p>
                    </div>
                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
  <div>
    <label className="text-xs uppercase tracking-wide text-slate-500">
      Datum od
    </label>

    <input
      type="date"
      value={emailDateFrom}
      onChange={(e) => setEmailDateFrom(e.target.value)}
      className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm outline-none focus:border-emerald-500"
    />

  </div>
  <div>
    <label className="text-xs uppercase tracking-wide text-slate-500">
      Datum do
    </label>

    <input
      type="date"
      value={emailDateTo}
      onChange={(e) => setEmailDateTo(e.target.value)}
      className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm outline-none focus:border-emerald-500"
    />
  </div>

    <div>
  <label className="text-xs uppercase tracking-wide text-slate-500">
    Počet emailů
  </label>

  <input
    type="number"
    min={1}
    max={50}
    value={emailLimit}
    onChange={(e) =>
      setEmailLimit(Number(e.target.value))
    }
    className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm outline-none focus:border-emerald-500"
  />
</div>

</div>
                    <button
                      onClick={loadUnreadEmails}
                      disabled={emailLoading}
                      className="rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
                    >
                      {emailLoading
                        ? "Načítám emaily..."
                        : "Načíst nepřečtené emaily"}
                    </button>
                  </div>
                        {emailOverview && (
  <div className="mt-8 rounded-2xl border border-emerald-800 bg-emerald-950/30 p-5">
    <p className="mb-3 text-xs uppercase tracking-wide text-emerald-400">
      Denní přehled
    </p>

    <div className="whitespace-pre-wrap text-sm leading-7 text-slate-100">
      {emailOverview
        .replace("HLAVNÍ SDĚLENÍ:", "\n\n🔥 HLAVNÍ SDĚLENÍ\n")
        .replace("ÚKOLY:", "\n\n✅ ÚKOLY\n")
        .replace("TERMÍNY A RIZIKA:", "\n\n⚠️ TERMÍNY A RIZIKA\n")
        .replace("MŮŽE POČKAT:", "\n\n🕓 MŮŽE POČKAT\n")}
    </div>
  </div>
)}
                  <div className="mt-8 space-y-4">
                    {emails.length === 0 && !emailLoading && (
                      <p className="rounded-2xl bg-slate-950 p-4 text-sm text-slate-500">
                        Zatím nejsou načtené žádné emaily.
                      </p>
                    )}

                    {emails.map((email) => (
                      <div
                        key={email.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-semibold text-slate-100">
                              {email.subject}
                            </h3>

                            <p className="mt-1 text-sm text-slate-500">
                              {email.from}
                            </p>
                          </div>
                        </div>

                        {email.snippet && (
                          <p className="mt-4 text-sm text-slate-500">
                            {email.snippet}
                          </p>
                        )}

                        <div className="mt-4 rounded-2xl bg-slate-900 p-4 text-sm leading-7 text-slate-300">
                          {email.summary}
                        </div>
                        <textarea
  value={email.replyInstruction || ""}
  onChange={(e) =>
    updateEmailInstruction(email.id, e.target.value)
  }
  placeholder="Např. potvrdit registraci, poděkovat a poslat další kroky..."
  className="mt-4 h-24 w-full resize-none rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm outline-none focus:border-emerald-500"
/>

<div className="mt-3 flex gap-4">

  <button
    onClick={() => generateDraftReply(email)}
    disabled={emailLoading}
    className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200 disabled:opacity-50"
  >
    Navrhnout odpověď
  </button>

  <button
    onClick={() => markEmailAsRead(email.id)}
    className="rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
  >
    Označit jako přečtené
  </button>

</div>

{email.draftReply && (
  <div className="mt-4 rounded-2xl border border-emerald-700 bg-emerald-950/40 p-4">
    <p className="mb-2 text-xs uppercase tracking-wide text-emerald-400">
      Návrh odpovědi
    </p>

    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-100">
      {email.draftReply}
    </p>
    <div className="mt-4 flex gap-3">
  <button
    onClick={() => copyToClipboard(email.draftReply || "")}
    className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200"
  >
    Kopírovat
  </button>
</div>
  </div>
  
)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
