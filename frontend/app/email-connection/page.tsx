"use client";

import { useState } from "react";
import { config } from "@/app/config";

export default function EmailConnectionsPage() {
  const API_URL = config.apiUrl;

  const [provider, setProvider] = useState("imap");
  const [emailAddress, setEmailAddress] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState(993);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  const saveImapConnection = async () => {
    const token = localStorage.getItem("access_token");

    const response = await fetch(`${API_URL}/email-connections/imap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email_address: emailAddress,
        imap_host: imapHost,
        imap_port: imapPort,
        username,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus(data.detail || "Uložení selhalo.");
      return;
    }

    setStatus("IMAP připojení bylo uloženo.");
  };

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <a href="/aplikace" className="text-sm text-slate-400 hover:text-white">
          ← Zpět do aplikace
        </a>

        <h1 className="mt-6 text-4xl font-bold">Email connections</h1>

        <p className="mt-3 text-slate-400">
          Nastavení emailového připojení pro aktuálního uživatele.
        </p>

        <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <label className="text-sm text-slate-400">Provider</label>

          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 p-3"
          >
            <option value="imap">IMAP</option>
            <option value="gmail">Gmail OAuth — později</option>
            <option value="microsoft">Microsoft 365 OAuth — později</option>
          </select>

          {provider === "imap" && (
            <div className="mt-6 space-y-4">
              <input
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="Email address"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-3"
              />

              <input
                value={imapHost}
                onChange={(e) => setImapHost(e.target.value)}
                placeholder="IMAP host, např. imap.gmail.com"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-3"
              />

              <input
                type="number"
                value={imapPort}
                onChange={(e) => setImapPort(Number(e.target.value))}
                placeholder="IMAP port"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-3"
              />

              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-3"
              />

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password / app password"
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 p-3"
              />

              <button
                onClick={saveImapConnection}
                className="w-full rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-500"
              >
                Uložit IMAP připojení
              </button>
            </div>
          )}

          {status && (
            <p className="mt-4 rounded-2xl bg-slate-950 p-4 text-sm text-emerald-400">
              {status}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}