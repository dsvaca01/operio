"use client";

import { useEffect, useRef, useState } from "react";

type AssistantType = "knowledge" | "email" | "followup";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type EmailSummary = {
  id: string;
  from: string;
  to?: string;
  cc?: string;
  is_direct?: boolean;
  is_cc?: boolean;
  subject: string;
  snippet: string;
  summary: string;
  replyInstruction?: string;
  draftReply?: string;
  body?: string;
  ai_insights?: {
    priority: "LOW" | "MEDIUM" | "HIGH";
    labels: string[];
    suggested_action: string;
    risk_level: "low" | "medium" | "high";
  };
};

type FollowupItem = {
  id: number;
  email_id: string;
  sender: string;
  subject: string;
  snippet: string;
  summary: string;
  status: string;
  is_ignored: boolean;
  shared_with_org: boolean;
  due_date?: string | null;
  created_at: string;
  draftReply?: string;
  replyInstruction?: string;
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
  visibility: "private" | "organization";
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
  const [usedContext, setUsedContext] = useState<any[]>([]);
  const [emailLoading, setEmailLoading] = useState(false);

  const [followups, setFollowups] = useState<FollowupItem[]>([]);
  const [followupDaysBack, setFollowupDaysBack] = useState(7);
  const [followupLoading, setFollowupLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const todayFormatted = today.toISOString().split("T")[0];
  const tomorrowFormatted = tomorrow.toISOString().split("T")[0];

  const [emailDateFrom, setEmailDateFrom] = useState(todayFormatted);
  const [emailDateTo, setEmailDateTo] = useState(tomorrowFormatted);
  const [emailLimit, setEmailLimit] = useState(5);
  const [emailOverview, setEmailOverview] = useState("");

  const [dueDateModalFollowup, setDueDateModalFollowup] =
  useState<FollowupItem | null>(null);

  const [selectedDueDate, setSelectedDueDate] = useState("");

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

      if (!response.ok) {
        console.error("Failed to load emails", data);
        alert("Nepodařilo se načíst emaily.");
        return;
      }

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

  const generateFollowups = async () => {
    try {
      setFollowupLoading(true);

      const token = localStorage.getItem("access_token");

      const response = await fetch(`${API_URL}/followups/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          days_back: followupDaysBack,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Generate followups failed", data);
        alert("Generování follow-upů selhalo.");
        return;
      }

      await loadFollowups();
    } catch (error) {
      console.error("Generate followups failed", error);
      alert("Generování follow-upů selhalo.");
    } finally {
      setFollowupLoading(false);
    }
  };

  const loadFollowups = async () => {
    try {
      setFollowupLoading(true);

      const token = localStorage.getItem("access_token");

      const response = await fetch(`${API_URL}/followups`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Failed to load followups", data);
        alert("Nepodařilo se načíst follow-upy.");
        return;
      }

      setFollowups(data.followups || []);
    } catch (error) {
      console.error("Failed to load followups", error);
      alert("Nepodařilo se načíst follow-upy.");
    } finally {
      setFollowupLoading(false);
    }
  };

  const generateFollowupDraft = async (followup: FollowupItem) => {
    try {
      setFollowupLoading(true);

      const token = localStorage.getItem("access_token");

      const response = await fetch(`${API_URL}/emails/draft-reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: followup.subject,
          sender: followup.sender,
          snippet: followup.snippet,
          summary: followup.summary,
          instruction: followup.replyInstruction || "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Followup draft failed", data);
        alert("Nepodařilo se navrhnout odpověď.");
        return;
      }

      setFollowups((prev) =>
        prev.map((item) =>
          item.id === followup.id
            ? {
                ...item,
                draftReply: data.draft || "",
              }
            : item
        )
      );
    } catch (error) {
      console.error("Followup draft failed", error);
      alert("Nepodařilo se navrhnout odpověď.");
    } finally {
      setFollowupLoading(false);
    }
  };

  const ignoreFollowup = async (followupId: number) => {
  try {
    const token = localStorage.getItem("access_token");

    const response = await fetch(
      `${API_URL}/followups/${followupId}/ignore`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      alert("Nepodařilo se označit follow-up.");
      return;
    }

    setFollowups((prev) =>
      prev.filter((item) => item.id !== followupId)
    );
  } catch (error) {
    console.error(error);
    alert("Nepodařilo se označit follow-up.");
  }
};

const markFollowupDone = async (followupId: number) => {
  try {
    const token = localStorage.getItem("access_token");

    const response = await fetch(
      `${API_URL}/followups/${followupId}/done`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      alert("Nepodařilo se označit jako vyřešené.");
      return;
    }

    setFollowups((prev) =>
      prev.filter((item) => item.id !== followupId)
    );
  } catch (error) {
    console.error(error);
    alert("Nepodařilo se označit jako vyřešené.");
  }
};

const shareFollowup = async (followupId: number) => {
  try {
    const token = localStorage.getItem("access_token");

    const response = await fetch(
      `${API_URL}/followups/${followupId}/share`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      alert("Nepodařilo se sdílet follow-up.");
      return;
    }

    setFollowups((prev) =>
      prev.map((item) =>
        item.id === followupId
          ? {
              ...item,
              shared_with_org: true,
            }
          : item
      )
    );
  } catch (error) {
    console.error(error);
    alert("Nepodařilo se sdílet follow-up.");
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

    setEmails((prev) => prev.filter((email) => email.id !== emailId));
  };

  const updateEmailInstruction = (emailId: string, instruction: string) => {
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

  const updateFollowupInstruction = (followupId: number, instruction: string) => {
    setFollowups((prev) =>
      prev.map((followup) =>
        followup.id === followupId
          ? {
              ...followup,
              replyInstruction: instruction,
            }
          : followup
      )
    );
  };

  const generateDraftReply = async (email: EmailSummary) => {
    try {
      setEmailLoading(true);

      const token = localStorage.getItem("access_token");

      const response = await fetch(`${API_URL}/emails/draft-reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: email.subject,
          sender: email.from,
          snippet: email.snippet,
          summary: email.summary,
          instruction: email.replyInstruction || "",
        }),
      });

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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Zkopírováno do schránky.");
    } catch (error) {
      console.error("Copy failed", error);
      alert("Kopírování selhalo.");
    }
  };

  const generateDraftReplyWithDocuments = async (email: EmailSummary) => {
    if (!selectedDocumentId) {
      alert("Nejprve vyber dokument, podle kterého mám odpověď připravit.");
      return;
    }

    try {
      setEmailLoading(true);

      const token = localStorage.getItem("access_token");

      const response = await fetch(`${API_URL}/emails/draft-reply-with-documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: email.subject,
          email_body: email.body || email.snippet || "",
          document_id: selectedDocumentId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(data);
        alert("Generování odpovědi podle dokumentů selhalo.");
        return;
      }

      setUsedContext(data.context_chunks || []);

      setEmails((prev) =>
        prev.map((item) =>
          item.id === email.id
            ? {
                ...item,
                draftReply: data.draft || "",
              }
            : item
        )
      );
    } catch (error) {
      console.error("Draft reply with documents failed", error);
      alert("Nepodařilo se navrhnout odpověď podle dokumentů.");
    } finally {
      setEmailLoading(false);
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

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    if (activeAssistant === "followup") {
      loadFollowups();
    }
  }, [activeAssistant]);

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
                Shrnutí nepřečtených emailů
              </p>
            </button>

            <button
              onClick={() => setActiveAssistant("followup")}
              className={`w-full rounded-2xl px-4 py-4 text-left transition ${
                activeAssistant === "followup"
                  ? "bg-rose-500 text-white"
                  : "bg-slate-950 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <p className="font-semibold">Follow-up Manager</p>

              <p className="mt-1 text-xs opacity-70">
                Čekající odpovědi a úkoly
              </p>
            </button>
          </div>

          {(activeAssistant === "knowledge" || activeAssistant === "email") && (
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

          <a
            href="/admin"
            className="mt-6 block w-full rounded-2xl bg-amber-700 px-4 py-4 text-left text-white transition hover:bg-amber-600"
          >
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
                          className={`flex items-center justify-between gap-3 rounded-xl p-3 text-sm ${
                            selectedDocumentId === doc.document_id
                              ? "bg-indigo-500 text-white"
                              : "bg-slate-950 text-slate-300"
                          }`}
                        >
                          <button
                            onClick={() => setSelectedDocumentId(doc.document_id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex w-full items-center justify-between gap-2">
                              <span className="truncate">
                                {doc.original_filename}
                              </span>

                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  doc.visibility === "private"
                                    ? "bg-slate-700 text-slate-100"
                                    : "bg-emerald-500/20 text-emerald-300"
                                }`}
                              >
                                {doc.visibility === "private"
                                  ? "Private"
                                  : "Organization"}
                              </span>
                            </div>
                          </button>

                          <button
                            onClick={() => deleteDocument(doc.document_id)}
                            className="shrink-0 rounded-lg px-2 py-1 text-xs hover:bg-red-500 hover:text-white"
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

                    {selectedDocumentId && (
                      <p className="mt-2 text-sm text-emerald-400">
                        Aktivní dokument: {selectedDocumentId}
                      </p>
                    )}

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
                    Načte nepřečtené emaily a vytvoří krátké AI shrnutí.
                  </p>
                </div>

                <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">
                        Nepřečtené emaily
                      </h3>

                      <p className="mt-2 text-sm text-slate-400">
                        Read-only integrace. Pro demo pouze summary, bez odesílání odpovědí.
                      </p>
                    </div>

                    <button
                      onClick={loadUnreadEmails}
                      disabled={emailLoading}
                      className="rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
                    >
                      {emailLoading ? "Načítám emaily..." : "Načíst nepřečtené emaily"}
                    </button>
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
                        onChange={(e) => setEmailLimit(Number(e.target.value))}
                        className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm outline-none focus:border-emerald-500"
                      />
                    </div>
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
                        className="rounded-3xl border border-slate-800 bg-slate-800 p-5"
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

                        {email.ai_insights && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {email.ai_insights.priority === "HIGH" && (
                              <span className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
                                VYSOKÁ PRIORITA
                              </span>
                            )}

                            {email.ai_insights.labels?.map((label) => (
                              <span
                                key={label}
                                className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300"
                              >
                                {label}
                              </span>
                            ))}

                            {email.ai_insights.suggested_action && (
                              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                                Doporučená akce: {email.ai_insights.suggested_action}
                              </span>
                            )}
                          </div>
                        )}

                        {email.is_cc && !email.is_direct && (
                          <div className="mt-3">
                            <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300">
                              Pouze v kopii
                            </span>
                          </div>
                        )}

                        <textarea
                          value={email.replyInstruction || ""}
                          onChange={(e) =>
                            updateEmailInstruction(email.id, e.target.value)
                          }
                          placeholder="Např. potvrdit registraci, poděkovat a poslat další kroky..."
                          className="mt-4 h-24 w-full resize-none rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm outline-none focus:border-emerald-500"
                        />

                        <div className="mt-3 flex flex-wrap gap-4">
                          <button
                            onClick={() => generateDraftReply(email)}
                            disabled={emailLoading}
                            className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200 disabled:opacity-50"
                          >
                            Navrhnout odpověď
                          </button>

                          <button
                            onClick={() => generateDraftReplyWithDocuments(email)}
                            disabled={emailLoading || !selectedDocumentId}
                            className="rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
                          >
                            {selectedDocumentId
                              ? "Odpovědět podle dokumentu"
                              : "Vyber dokument pro odpověď"}
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

            {activeAssistant === "followup" && (
              <div className="space-y-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-wide text-rose-300">
                      Follow-up Manager
                    </p>

                    <h2 className="mt-2 text-4xl font-bold">
                      Čeká na odpověď
                    </h2>

                    <p className="mt-3 max-w-2xl text-slate-400">
                      Dashboard pro kontrolu emailů, na které ještě nemuselo být odpovězeno.
                      Cílem je snížit riziko zapomenutých klientů, deadlinů a ztracených příležitostí.
                    </p>
                  </div>

                  <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
                    <label className="text-xs uppercase tracking-wide text-slate-500">
                      Kontrolované období
                    </label>

                    <div className="mt-3 flex flex-wrap gap-3">
                      {[7, 14, 30].map((days) => (
                        <button
                          key={days}
                          onClick={() => setFollowupDaysBack(days)}
                          className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
                            followupDaysBack === days
                              ? "bg-rose-500 text-white"
                              : "bg-slate-950 text-slate-300 hover:bg-slate-800"
                          }`}
                        >
                          {days} dní
                        </button>
                      ))}

                      <button
                        onClick={generateFollowups}
                        disabled={followupLoading}
                        className="rounded-2xl bg-white px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200 disabled:opacity-50"
                      >
                        {followupLoading ? "Načítám..." : "Načíst follow-upy"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                    <p className="text-sm text-slate-400">Otevřené follow-upy</p>
                    <p className="mt-3 text-4xl font-bold text-slate-100">
                      {followups.filter((item) => item.status !== "done").length}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                    <p className="text-sm text-slate-400">Sdílené v organizaci</p>
                    <p className="mt-3 text-4xl font-bold text-indigo-300">
                      {followups.filter((item) => item.shared_with_org).length}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                    <p className="text-sm text-slate-400">S termínem</p>
                    <p className="mt-3 text-4xl font-bold text-amber-300">
                      {followups.filter((item) => item.due_date).length}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
                    <p className="text-sm text-slate-400">Období</p>
                    <p className="mt-3 text-4xl font-bold text-rose-300">
                      {followupDaysBack}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">dní zpět</p>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold">
                        Kandidáti na follow-up
                      </h3>

                      <p className="mt-2 text-sm text-slate-400">
                        Zobrazeny jsou uložené follow-up položky z databáze.
                      </p>
                    </div>

                    <button
                      onClick={loadFollowups}
                      disabled={followupLoading}
                      className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                    >
                      Obnovit
                    </button>
                  </div>

                  <div className="mt-6 space-y-4">
                    {followups.length === 0 && !followupLoading && (
                      <p className="rounded-2xl bg-slate-950 p-5 text-sm text-slate-500">
                        Zatím nejsou vytvořené žádné follow-upy. Vyber období a klikni na
                        „Načíst follow-upy“.
                      </p>
                    )}

                    {followups.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-3xl border border-slate-800 bg-slate-950 p-5"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-sm text-slate-500">
                              {item.sender}
                            </p>

                            <h4 className="mt-1 text-lg font-semibold text-slate-100">
                              {item.subject || "(bez předmětu)"}
                            </h4>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300">
                              Čeká na odpověď
                            </span>

                            {item.shared_with_org && (
                              <span className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300">
                                Sdíleno s týmem
                              </span>
                            )}

                            {item.due_date && (
                              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                                Termín: {item.due_date}
                              </span>
                            )}
                          </div>
                        </div>

                        {item.snippet && (
                          <p className="mt-4 text-sm text-slate-500">
                            {item.snippet}
                          </p>
                        )}

                        <div className="mt-4 rounded-2xl bg-slate-900 p-4 text-sm leading-7 text-slate-300">
                          {item.summary || "Bez AI shrnutí."}
                        </div>


                        <textarea
                          value={item.replyInstruction || ""}
                          onChange={(e) =>
                            updateFollowupInstruction(item.id, e.target.value)
                          }
                          placeholder="Např. odpověz stručně, potvrď příjem, nabídni termín nebo se zeptej na chybějící informace..."
                          className="mt-4 h-24 w-full resize-none rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-rose-500"
                        />

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            onClick={() => generateFollowupDraft(item)}
                            disabled={followupLoading}
                            className="rounded-2xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-50"
                          >
                            Navrhnout odpověď
                          </button>

                          <button
                            onClick={() => ignoreFollowup(item.id)}
                            className="rounded-2xl bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700"
                          >
                            Nepodstatné
                          </button>

                          <button
                            onClick={() => shareFollowup(item.id)}
                            disabled={item.shared_with_org}
                            className={`rounded-2xl px-5 py-3 text-sm font-semibold ${
                              item.shared_with_org
                                ? "bg-indigo-500 text-slate-950"
                                : "bg-indigo-600 text-slate-200 hover:bg-indigo-800"
                            }`}
                          >
                            {item.shared_with_org
                              ? "Sdíleno"
                              : "Sdílet týmu"}
                          </button>

                          <button
                            onClick={() => {
                              setDueDateModalFollowup(item);
                              setSelectedDueDate(item.due_date || "");
                            }}
                            className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-amber-600"
                          >
                            Nastavit termín
                          </button>

                            <button
                          onClick={() => markFollowupDone(item.id)}
                          className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
                        >
                          Vyřešeno
                        </button>

                        </div>

                        

                        {item.draftReply && (
                          <div className="mt-4 rounded-2xl border border-rose-700 bg-rose-950/30 p-4">
                            <p className="mb-2 text-xs uppercase tracking-wide text-rose-300">
                              Návrh odpovědi
                            </p>

                            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-100">
                              {item.draftReply}
                            </p>

                            <button
                              onClick={() => copyToClipboard(item.draftReply || "")}
                              className="mt-4 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200"
                            >
                              Kopírovat
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
                  <h3 className="text-xl font-semibold">
                    Úkoly podle termínu
                  </h3>

                  <p className="mt-2 text-sm text-slate-400">
                    Tato sekce bude plně funkční po doplnění endpointů pro termíny,
                    sdílení a stav úkolu.
                  </p>

                  <div className="mt-6 space-y-3">
                    {followups
                      .filter((item) => item.due_date)
                      .sort((a, b) =>
                        String(a.due_date).localeCompare(String(b.due_date))
                      )
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col gap-2 rounded-2xl bg-slate-950 p-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <p className="font-medium text-slate-100">
                              {item.subject}
                            </p>
                            <p className="text-sm text-slate-500">
                              {item.sender}
                            </p>
                          </div>

                          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                            {item.due_date}
                          </span>
                        </div>
                      ))}

                    {followups.filter((item) => item.due_date).length === 0 && (
                      <p className="rounded-2xl bg-slate-950 p-4 text-sm text-slate-500">
                        Zatím žádné úkoly s termínem.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {dueDateModalFollowup && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
    <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
      <h3 className="text-xl font-bold text-slate-100">
        Nastavit termín
      </h3>

      <p className="mt-2 text-sm text-slate-400">
        {dueDateModalFollowup.subject}
      </p>

      <input
        type="date"
        value={selectedDueDate}
        onChange={(e) => setSelectedDueDate(e.target.value)}
        className="mt-5 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-emerald-500"
      />

      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={() => {
            setDueDateModalFollowup(null);
            setSelectedDueDate("");
          }}
          className="rounded-2xl bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700"
        >
          Zrušit
        </button>

        <button
          onClick={async () => {
            const token = localStorage.getItem("access_token");

            const response = await fetch(
              `${API_URL}/followups/${dueDateModalFollowup.id}/due-date`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  due_date: selectedDueDate || null,
                }),
              }
            );

            if (!response.ok) {
              alert("Nepodařilo se uložit termín.");
              return;
            }

            setFollowups((prev) =>
              prev.map((item) =>
                item.id === dueDateModalFollowup.id
                  ? { ...item, due_date: selectedDueDate || null }
                  : item
              )
            );

            setDueDateModalFollowup(null);
            setSelectedDueDate("");
          }}
          className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
        >
          Uložit termín
        </button>
      </div>
    </div>
  </div>
)}

    </main>
  );
}
