"use client";

import { useEffect, useState } from "react";

type AuthMode = "login" | "register";

type AuthUser = {
  id: number;
  email: string;
  full_name: string;
};

export default function ProductPage() {
  const API_URL = "http://localhost:8000";

  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [accessToken, setAccessToken] = useState("");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFullName, setAuthFullName] = useState("");
  const [authOrganizationName, setAuthOrganizationName] = useState("");
  const [authEmailProvider, setAuthEmailProvider] = useState("gmail");
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const user = localStorage.getItem("auth_user");

    if (token) {
      setAccessToken(token);
    }

    if (user) {
      setAuthUser(JSON.parse(user));
    }
  }, []);

  const handleAuth = async () => {
    const endpoint = authMode === "login" ? "/auth/login" : "/auth/register";

    const body =
      authMode === "login"
        ? {
            email: authEmail,
            password: authPassword,
          }
        : {
            email: authEmail,
            password: authPassword,
            full_name: authFullName,
            organization_name: authOrganizationName,
            email_provider: authEmailProvider,
            email_address: authEmail,
          };

    try {
      setAuthLoading(true);

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.detail || "Přihlášení selhalo.");
        return;
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));

      setAccessToken(data.access_token);
      setAuthUser(data.user);
    } catch (error) {
      console.error("Auth failed", error);
      alert("Nepodařilo se přihlásit. Zkontroluj backend.");
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("auth_user");

    setAccessToken("");
    setAuthUser(null);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <a href="/" className="text-2xl font-bold tracking-tight">
            Operio
          </a>

          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="#problem" className="hover:text-white">
              Problém
            </a>
            <a href="#use-cases" className="hover:text-white">
              Asistenti
            </a>
            <a href="#pilot" className="hover:text-white">
              Pilot
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {accessToken ? (
              <>
                <div className="hidden text-right text-sm sm:block">
                  <p className="font-medium text-slate-100">
                    {authUser?.full_name || authUser?.email || "Přihlášený uživatel"}
                  </p>
                  <p className="text-slate-500">{authUser?.email}</p>
                </div>

                <a
                  href="/aplikace"
                  className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
                >
                  Otevřít aplikaci
                </a>

                <button
                  onClick={logout}
                  className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-900"
                >
                  Odhlásit
                </button>
              </>
            ) : (
              <a
                href="#login"
                className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
              >
                Přihlásit se
              </a>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-emerald-400">
            AI workspace pro malé a střední firmy
          </p>

          <h1 className="text-5xl font-bold leading-tight md:text-6xl">
            AI asistenti pro dokumenty, emaily a firemní operativu.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Operio pomáhá firmám rychle najít odpovědi v dokumentech,
            shrnout nepřečtené emaily a připravit návrhy odpovědí bez
            zbytečného hledání v inboxu, PDF a hlavách zaměstnanců.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            {accessToken ? (
              <a
                href="/aplikace"
                className="rounded-2xl bg-emerald-500 px-6 py-3 text-center font-semibold text-white hover:bg-emerald-400"
              >
                Otevřít workspace
              </a>
            ) : (
              <a
                href="#login"
                className="rounded-2xl bg-emerald-500 px-6 py-3 text-center font-semibold text-white hover:bg-emerald-400"
              >
                Začít přihlášením
              </a>
            )}

            <a
              href="#use-cases"
              className="rounded-2xl border border-slate-700 px-6 py-3 text-center font-semibold text-slate-200 hover:bg-slate-900"
            >
              Jak to funguje
            </a>
          </div>
        </div>

        <div
          id="login"
          className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
        >
          {accessToken ? (
            <div>
              <p className="text-sm uppercase tracking-wide text-emerald-400">
                Přihlášeno
              </p>

              <h2 className="mt-3 text-3xl font-bold">
                Vítej zpět.
              </h2>

              <p className="mt-3 text-slate-400">
                Jsi přihlášený jako{" "}
                <span className="text-slate-100">
                  {authUser?.email}
                </span>
                . Můžeš pokračovat do aplikace.
              </p>

              <div className="mt-6 flex gap-3">
                <a
                  href="/aplikace"
                  className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
                >
                  Otevřít aplikaci
                </a>

                <button
                  onClick={logout}
                  className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Odhlásit
                </button>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-3xl font-bold">Přístup do Operio</h2>

              <p className="mt-2 text-sm text-slate-400">
                Přihlas se nebo vytvoř účet pro firemní workspace.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-950 p-1">
                <button
                  onClick={() => setAuthMode("login")}
                  className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                    authMode === "login"
                      ? "bg-indigo-500 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Přihlášení
                </button>

                <button
                  onClick={() => setAuthMode("register")}
                  className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                    authMode === "register"
                      ? "bg-indigo-500 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  Registrace
                </button>
              </div>

              <div className="mt-6 space-y-3">
                <input
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm outline-none focus:border-emerald-500"
                />

                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Heslo"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm outline-none focus:border-emerald-500"
                />

                {authMode === "register" && (
                  <>
                    <input
                      value={authFullName}
                      onChange={(e) => setAuthFullName(e.target.value)}
                      placeholder="Jméno a příjmení"
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm outline-none focus:border-emerald-500"
                    />

                    <input
                      value={authOrganizationName}
                      onChange={(e) => setAuthOrganizationName(e.target.value)}
                      placeholder="Název firmy"
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm outline-none focus:border-emerald-500"
                    />

                    <select
                      value={authEmailProvider}
                      onChange={(e) => setAuthEmailProvider(e.target.value)}
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm outline-none focus:border-emerald-500"
                    >
                      <option value="gmail">Gmail</option>
                      <option value="microsoft">Microsoft 365</option>
                      <option value="imap">IMAP / jiný poskytovatel</option>
                      <option value="forwarding">Přeposílání emailů</option>
                      <option value="none">Zatím nepřipojit</option>
                    </select>
                  </>
                )}
              </div>

              <button
                onClick={handleAuth}
                disabled={authLoading || !authEmail || !authPassword}
                className="mt-6 w-full rounded-2xl bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
              >
                {authLoading
                  ? "Zpracovávám..."
                  : authMode === "login"
                    ? "Přihlásit"
                    : "Vytvořit účet"}
              </button>
            </div>
          )}
        </div>
      </section>

      <section id="problem" className="border-y border-slate-800 bg-slate-900/60">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-16 md:grid-cols-3">
          <div className="rounded-3xl bg-slate-950 p-6">
            <h3 className="text-xl font-semibold">Méně hledání</h3>
            <p className="mt-3 text-slate-400">
              Zaměstnanci se zeptají přirozeným jazykem a AI najde odpověď
              v dostupných firemních dokumentech.
            </p>
          </div>

          <div className="rounded-3xl bg-slate-950 p-6">
            <h3 className="text-xl font-semibold">Rychlejší emaily</h3>
            <p className="mt-3 text-slate-400">
              Nepřečtené emaily se shrnou do jasného přehledu a AI připraví
              návrh odpovědi podle instrukce uživatele.
            </p>
          </div>

          <div className="rounded-3xl bg-slate-950 p-6">
            <h3 className="text-xl font-semibold">Firemní znalosti</h3>
            <p className="mt-3 text-slate-400">
              Know-how nezůstává jen v hlavách jednotlivců, ale je dostupné
              přes řízený firemní workspace.
            </p>
          </div>
        </div>
      </section>

      <section id="use-cases" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-bold">Co platforma umí</h2>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="text-2xl font-semibold">Knowledge Assistant</h3>
            <p className="mt-4 text-slate-400">
              Nahrajete PDF, DOCX nebo TXT dokumenty. Uživatel se ptá
              přirozeným jazykem a AI odpovídá z firemních podkladů.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="text-2xl font-semibold">Email Assistant</h3>
            <p className="mt-4 text-slate-400">
              Načte emaily, vytvoří denní přehled, zvýrazní úkoly a podle
              instrukce připraví návrh odpovědi.
            </p>
          </div>
        </div>
      </section>

      <section id="pilot" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <h2 className="text-3xl font-bold">
            Začněte jednoduchým pilotem.
          </h2>

          <p className="mt-4 max-w-2xl text-lg text-slate-300">
            Vybereme jeden konkrétní problém ve firmě, napojíme dokumenty
            nebo emaily a ukážeme měřitelný přínos na reálných datech.
          </p>

          <a
            href={accessToken ? "/aplikace" : "#login"}
            className="mt-6 inline-block rounded-2xl bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-400"
          >
            {accessToken ? "Otevřít aplikaci" : "Vytvořit účet"}
          </a>
        </div>
      </section>
    </main>
  );
}
