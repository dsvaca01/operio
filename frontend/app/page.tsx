"use client";

import { useEffect, useState } from "react";

type AuthMode = "login" | "register";

type AuthUser = {
  id: number;
  email: string;
  full_name: string;
};

const benefitCards = [
  {
    title: "Znalosti firmy na jednom místě",
    description:
      "Dokumenty, interní pravidla a provozní know-how nejsou schované v PDF, složkách a hlavách jednotlivců.",
  },
  {
    title: "Inbox jako akční přehled",
    description:
      "AI shrne nepřečtené emaily, vytáhne podstatné informace a pomůže připravit profesionální odpověď.",
  },
  {
    title: "Rychlejší operativa bez chaosu",
    description:
      "Operio propojuje dokumenty, emaily, uživatele a workflow do jednoho řízeného pracovního prostoru.",
  },
];

const modules = [
  {
    label: "01",
    title: "Knowledge Assistant",
    description:
      "Upload dokumentů, AI chat nad firemními podklady a rychlé odpovědi bez ručního hledání.",
    points: ["PDF / DOCX / TXT", "AI nad dokumenty", "Firemní knowledge base"],
  },
  {
    label: "02",
    title: "Email Assistant",
    description:
      "Načtení nepřečtených emailů, AI sumarizace a návrhy odpovědí podle instrukce uživatele.",
    points: ["Unread email overview", "AI draft reply", "IMAP-first MVP"],
  },
  {
    label: "03",
    title: "Follow-up Manager",
    description:
      "Kontrola komunikace, hlídání nevyřízených odpovědí a upozornění na rizikové prodlevy.",
    points: ["Čekající odpovědi", "Termíny", "Stav vyřešeno"],
  },
  {
    label: "04",
    title: "Admin & Security",
    description:
      "Organizace, role, superadmin a oddělení dat mezi firmami přes multi-tenant architekturu.",
    points: ["Workspace model", "Role management", "Organization isolation"],
  },
];

const workflowSteps = [
  "Připoj email nebo nahraj dokumenty",
  "AI vytvoří pracovní kontext",
  "Uživatel se ptá nebo řeší email",
  "Operio připraví odpověď, přehled nebo další krok",
];

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
    <main className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-1/2 top-[-240px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute right-[-180px] top-48 h-[420px] w-[420px] rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-[-220px] left-[-160px] h-[460px] w-[460px] rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-lg font-black text-white shadow-[0_0_40px_rgba(16,185,129,0.25)]">
              O
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight">Operio</p>
              <p className="text-xs text-slate-500">AI Workplace Assistant</p>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
            <a href="#benefits" className="hover:text-white">
              Benefity
            </a>
            <a href="#modules" className="hover:text-white">
              Moduly
            </a>
            <a href="#workflow" className="hover:text-white">
              Workflow
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
                  className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 hover:bg-emerald-400"
                >
                  Otevřít aplikaci
                </a>

                <button
                  onClick={logout}
                  className="hidden rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-900 sm:block"
                >
                  Odhlásit
                </button>
              </>
            ) : (
              <a
                href="#login"
                className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 hover:bg-emerald-400"
              >
                Přihlásit se
              </a>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-6 pb-16 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-24 lg:pt-24">
        <div>
          <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            AI workspace pro malé a střední firmy
          </div>

          <h1 className="max-w-4xl text-5xl font-black leading-[1.02] tracking-tight md:text-7xl">
            Firemní AI workspace pro dokumenty, emaily a komunikaci.
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
            Operio propojuje dokumenty, emaily a AI do jednoho pracovního prostoru.
            Zaměstnanci najdou odpovědi během sekund, AI připraví návrhy odpovědí
            a důležité informace nezůstávají schované v inboxech a PDF.
          </p>

          <div className="mt-9 flex flex-col gap-4 sm:flex-row">
            <a
              href={accessToken ? "/aplikace" : "#login"}
              className="rounded-2xl bg-emerald-500 px-7 py-4 text-center text-sm font-bold text-white shadow-[0_0_50px_rgba(16,185,129,0.22)] hover:bg-emerald-400"
            >
              {accessToken ? "Otevřít workspace" : "Začít přihlášením"}
            </a>

            <a
              href="#modules"
              className="rounded-2xl border border-slate-700 bg-slate-900/70 px-7 py-4 text-center text-sm font-bold text-slate-200 hover:bg-slate-900"
            >
              Ukázat moduly
            </a>
          </div>

          <div className="mt-10 grid gap-3 text-sm text-slate-400 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              ✓ Multi-tenant architektura
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              ✓ AI nad firemními dokumenty
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              ✓ Email assistant pro operativu
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              ✓ Role, organizace a workspace
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="relative overflow-hidden rounded-[32px] border border-slate-800 bg-slate-900/90 p-4 shadow-2xl shadow-black/40">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />

            <div className="rounded-[24px] border border-slate-800 bg-slate-950 p-4">
              <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <p className="text-sm font-semibold text-slate-200">Operio Workspace</p>
                  <p className="text-xs text-slate-500">Documents • Email • Follow-ups</p>
                </div>
                <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  Live context
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="space-y-3">
                  <div className="rounded-2xl bg-slate-900 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Documents
                    </p>
                    <div className="mt-3 space-y-2">
                      <div className="rounded-xl bg-slate-800 px-3 py-2 text-xs text-slate-300">
                        Onboarding_manual.pdf
                      </div>
                      <div className="rounded-xl bg-slate-800 px-3 py-2 text-xs text-slate-300">
                        Pricing_policy.docx
                      </div>
                      <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                        Contract_terms.pdf
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-900 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Email overview
                    </p>
                    <p className="mt-3 text-sm text-slate-300">
                      8 unread emails
                    </p>
                    <p className="mt-1 text-xs text-emerald-300">
                      3 require response
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-900 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    AI assistant
                  </p>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                      Jaké jsou podmínky pro změnu smlouvy u klienta?
                    </div>
                    <div className="rounded-2xl bg-emerald-500/10 p-4 text-sm leading-6 text-slate-200">
                      Na základě firemních dokumentů musí být změna schválena odpovědnou osobou,
                      evidována v systému a komunikována klientovi před účinností změny.
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
                        <p className="text-xs text-slate-500">Draft reply</p>
                        <p className="mt-1 text-sm text-slate-300">Připraveno</p>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
                        <p className="text-xs text-slate-500">Follow-up</p>
                        <p className="mt-1 text-sm text-emerald-300">Hlídá se</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            id="login"
            className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30"
          >
            {accessToken ? (
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-400">
                  Přihlášeno
                </p>

                <h2 className="mt-3 text-3xl font-bold">Vítej zpět.</h2>

                <p className="mt-3 text-slate-400">
                  Jsi přihlášený jako <span className="text-slate-100">{authUser?.email}</span>.
                  Můžeš pokračovat do aplikace.
                </p>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <a
                    href="/aplikace"
                    className="rounded-2xl bg-emerald-500 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-400"
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
                <div className="mb-5 inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  Early access
                </div>

                <h2 className="text-3xl font-bold">Přístup do Operio</h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Přihlas se nebo vytvoř účet pro firemní workspace. Data jsou oddělena
                  na úrovni organizace a uživatelských rolí.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-950 p-1">
                  <button
                    onClick={() => setAuthMode("login")}
                    className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                      authMode === "login"
                        ? "bg-emerald-500 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Přihlášení
                  </button>

                  <button
                    onClick={() => setAuthMode("register")}
                    className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                      authMode === "register"
                        ? "bg-emerald-500 text-white"
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
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-500"
                  />

                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Heslo"
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-500"
                  />

                  {authMode === "register" && (
                    <>
                      <input
                        value={authFullName}
                        onChange={(e) => setAuthFullName(e.target.value)}
                        placeholder="Jméno a příjmení"
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-500"
                      />

                      <input
                        value={authOrganizationName}
                        onChange={(e) => setAuthOrganizationName(e.target.value)}
                        placeholder="Název firmy"
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-500"
                      />

                      <select
                        value={authEmailProvider}
                        onChange={(e) => setAuthEmailProvider(e.target.value)}
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-white outline-none focus:border-emerald-500"
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
                  className="mt-6 w-full rounded-2xl bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {authLoading
                    ? "Zpracovávám..."
                    : authMode === "login"
                      ? "Přihlásit"
                      : "Vytvořit účet"}
                </button>

                <p className="mt-4 text-xs leading-5 text-slate-500">
                  Doporučený pilot: jeden tým, jedna sada dokumentů, jeden emailový proces.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="benefits" className="border-y border-slate-800 bg-slate-900/40">
        <div className="mx-auto max-w-7xl px-6 py-18 md:py-20">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-400">
              Jasný business přínos
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
              Ne další chatbot. AI workspace napojený na reálnou firemní operativu.
            </h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {benefitCards.map((card) => (
              <div
                key={card.title}
                className="rounded-[28px] border border-slate-800 bg-slate-950 p-6 shadow-xl shadow-black/20"
              >
                <div className="mb-5 h-12 w-12 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20" />
                <h3 className="text-xl font-bold">{card.title}</h3>
                <p className="mt-4 leading-7 text-slate-400">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="modules" className="mx-auto max-w-7xl px-6 py-20">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-400">
              Produktové moduly
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-tight md:text-5xl">
              Jeden workspace pro znalosti, emaily a follow-upy.
            </h2>
          </div>
          <p className="max-w-md leading-7 text-slate-400">
            Začni malým pilotem. Architektura ale už míří na širší platformu pro AI + documents + email + workflow.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {modules.map((module) => (
            <div
              key={module.title}
              className="group rounded-[32px] border border-slate-800 bg-slate-900/70 p-7 transition hover:border-emerald-500/40 hover:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-sm font-black text-emerald-400">{module.label}</p>
                  <h3 className="mt-3 text-2xl font-bold">{module.title}</h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-slate-950 ring-1 ring-slate-800 group-hover:ring-emerald-500/30" />
              </div>

              <p className="mt-5 leading-7 text-slate-400">{module.description}</p>

              <div className="mt-6 flex flex-wrap gap-2">
                {module.points.map((point) => (
                  <span
                    key={point}
                    className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-semibold text-slate-300"
                  >
                    {point}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="workflow" className="border-y border-slate-800 bg-slate-900/40">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-400">
                Jak to funguje
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
                AI pomáhá, ale člověk drží kontrolu.
              </h2>
              <p className="mt-5 leading-8 text-slate-400">
                Operio není náhrada rozhodování. Je to pracovní vrstva, která vytáhne kontext,
                zrychlí přípravu a sníží ruční hledání. Finální akce zůstává na uživateli.
              </p>
            </div>

            <div className="grid gap-4">
              {workflowSteps.map((step, index) => (
                <div
                  key={step}
                  className="flex gap-5 rounded-[28px] border border-slate-800 bg-slate-950 p-5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-sm font-black text-emerald-300 ring-1 ring-emerald-500/20">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100">{step}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Každý krok je navržený tak, aby šel postupně rozšiřovat z MVP na firemní platformu.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pilot" className="mx-auto max-w-7xl px-6 py-20">
        <div className="relative overflow-hidden rounded-[36px] border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-8 shadow-2xl shadow-black/30 md:p-12">
          <div className="absolute right-[-120px] top-[-120px] h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative grid gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-400">
                Pilotní nasazení
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
                Začni jedním konkrétním problémem. Ne velkou transformací.
              </h2>

              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                Vyber jeden tým, jednu skupinu dokumentů nebo jeden emailový proces.
                Operio ukáže přínos na reálných datech a teprve potom má smysl škálovat.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <a
                  href={accessToken ? "/aplikace" : "#login"}
                  className="rounded-2xl bg-emerald-500 px-7 py-4 text-center text-sm font-bold text-white hover:bg-emerald-400"
                >
                  {accessToken ? "Otevřít aplikaci" : "Vytvořit účet"}
                </a>
                <a
                  href="#modules"
                  className="rounded-2xl border border-slate-700 px-7 py-4 text-center text-sm font-bold text-slate-200 hover:bg-slate-800"
                >
                  Projít moduly
                </a>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-800 bg-slate-950 p-6">
              <h3 className="text-xl font-bold">Ideální první use-case</h3>
              <div className="mt-5 space-y-4 text-sm text-slate-400">
                <p>✓ Často opakované dotazy do dokumentů</p>
                <p>✓ Inbox, který zahlcuje majitele nebo backoffice</p>
                <p>✓ Odpovědi, které se píšou pořád dokola</p>
                <p>✓ Follow-upy, které dnes hlídá člověk ručně</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800 px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-sm text-slate-500 md:flex-row md:items-center">
          <p>© Operio. AI workplace assistant platform.</p>
          <p>Documents • Email • Workflow • Organization management</p>
        </div>
      </footer>
    </main>
  );
}
