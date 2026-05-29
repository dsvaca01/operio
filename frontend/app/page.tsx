"use client";

import { useEffect, useState } from "react";
import NeuralNetworkBackground from "@/components/NeuralNetworkBackground";
import { config } from "@/app/config";

type AuthMode = "login" | "register";

type AuthUser = {
  id: number;
  email: string;
  full_name: string;
};

type ModuleKey = "documents" | "email" | "followups";

const API_URL = config.apiUrl;

const benefits = [
  {
    title: "Rychlejší práce s firemními znalostmi",
    description:
      "Uživatel se ptá nad dokumenty místo ručního hledání v PDF, složkách a starých přílohách.",
  },
  {
    title: "Méně ztracených emailů",
    description:
      "AI shrne důležité zprávy, připraví návrh odpovědi a pomůže udržet přehled nad komunikací.",
  },
  {
    title: "Kontrola nad týmem a daty",
    description:
      "Organizace, role, multi-tenant oddělení dat a základ pro auditovatelný B2B SaaS produkt.",
  },
];

const modules: Record<
  ModuleKey,
  {
    label: string;
    title: string;
    description: string;
    bullets: string[];
    previewTitle: string;
    previewLines: string[];
  }
> = {
  documents: {
    label: "Knowledge Assistant",
    title: "AI nad dokumenty",
    description:
      "Nahraj firemní dokumenty a ptej se nad nimi. Vhodné pro interní pravidla, onboarding, smlouvy, ceníky a provozní know-how.",
    bullets: ["Upload dokumentů", "Vector search", "AI odpovědi nad firemním kontextem"],
    previewTitle: "Dotaz nad dokumenty",
    previewLines: [
      "Jaké jsou podmínky pro změnu smlouvy?",
      "AI našla odpověď v Contract_terms.pdf a připravila stručné shrnutí.",
      "Doporučený další krok: ověřit odpovědnou osobu a termín účinnosti.",
    ],
  },
  email: {
    label: "Email Assistant",
    title: "Inbox jako pracovní přehled",
    description:
      "Načti nepřečtené emaily, získej AI shrnutí a nech si připravit odpověď podle vlastní instrukce.",
    bullets: ["IMAP-first MVP", "AI summary", "Draft reply"],
    previewTitle: "Email overview",
    previewLines: [
      "8 nepřečtených emailů",
      "3 vyžadují odpověď, 2 obsahují termín, 1 obsahuje přílohu.",
      "AI připravila návrh profesionální odpovědi podle kontextu klienta.",
    ],
  },
  followups: {
    label: "Follow-up Manager",
    title: "Hlídání otevřené komunikace",
    description:
      "Systém sleduje nevyřízené odpovědi, termíny a rizikové prodlevy. Důležité věci nezůstávají v hlavě nebo ve vlákně emailu.",
    bullets: ["Termíny", "Stav vyřešeno", "Kontrola čekajících odpovědí"],
    previewTitle: "Follow-up queue",
    previewLines: [
      "Klient čeká na odpověď 4 dny",
      "Termín: pátek 14:00",
      "Doporučení: poslat stručný status update ještě dnes.",
    ],
  },
};

export default function Page() {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [activeModule, setActiveModule] = useState<ModuleKey>("documents");
  const [accessToken, setAccessToken] = useState("");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authFullName, setAuthFullName] = useState("");
  const [authOrganizationName, setAuthOrganizationName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const user = localStorage.getItem("auth_user");

    if (token) setAccessToken(token);

    if (user) {
      try {
        setAuthUser(JSON.parse(user));
      } catch {
        localStorage.removeItem("auth_user");
      }
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
            email_provider: "imap",
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

  const module = modules[activeModule];

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <NeuralNetworkBackground />

      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-1/2 top-[-260px] h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute right-[-240px] top-40 h-[520px] w-[520px] rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute bottom-[-260px] left-[-220px] h-[560px] w-[560px] rounded-full bg-emerald-400/10 blur-3xl" />
      </div>

      <div className="relative z-10">
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
              <a href="#product" className="hover:text-white">Produkt</a>
              <a href="#modules" className="hover:text-white">Moduly</a>
              <a href="#security" className="hover:text-white">Bezpečnost</a>
              <a href="#login" className="hover:text-white">Přístup</a>
            </nav>

            <div className="flex items-center gap-3">
              {accessToken ? (
                <>
                  <a
                    href="/aplikace"
                    className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
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
                  className="rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
                >
                  Přihlásit se
                </a>
              )}
            </div>
          </div>
        </header>

        <section className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              AI workspace pro dokumenty, emaily a follow-upy
            </div>

            <h1 className="max-w-4xl text-5xl font-black leading-[1.02] tracking-tight md:text-7xl">
              AI assistant, který pracuje s reálným firemním kontextem.
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
              Operio propojuje dokumenty, emaily a workflow do jednoho pracovního prostoru.
              Cíl není další chatbot. Cíl je snížit ruční hledání, zrychlit odpovědi a udržet kontrolu nad komunikací.
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
                Ukázat produkt
              </a>
            </div>

            <div className="mt-10 grid gap-3 text-sm text-slate-400 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">Multi-tenant SaaS architektura</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">AI nad dokumenty a emaily</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">Role, organizace, superadmin</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">Připraveno pro workflow vrstvu</div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[34px] border border-slate-800 bg-slate-900/90 p-4 shadow-2xl shadow-black/40">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />

            <div className="rounded-[26px] border border-slate-800 bg-slate-950 p-4">
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
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Knowledge base</p>
                    <div className="mt-3 space-y-2">
                      <div className="rounded-xl bg-slate-800 px-3 py-2 text-xs text-slate-300">Onboarding_manual.pdf</div>
                      <div className="rounded-xl bg-slate-800 px-3 py-2 text-xs text-slate-300">Pricing_policy.docx</div>
                      <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">Contract_terms.pdf</div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-900 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inbox</p>
                    <p className="mt-3 text-sm text-slate-300">8 unread emails</p>
                    <p className="mt-1 text-xs text-emerald-300">3 require response</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-900 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI assistant</p>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                      Jaké jsou podmínky pro změnu smlouvy u klienta?
                    </div>
                    <div className="rounded-2xl bg-emerald-500/10 p-4 text-sm leading-6 text-slate-200">
                      Změna musí být schválena odpovědnou osobou, evidována v systému a komunikována klientovi před účinností.
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
        </section>

        <section id="product" className="border-y border-slate-800 bg-slate-900/40">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-400">Business přínos</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
                Produkt musí ukázat hodnotu do pěti sekund.
              </h2>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {benefits.map((benefit) => (
                <div key={benefit.title} className="rounded-[28px] border border-slate-800 bg-slate-950 p-6 shadow-xl shadow-black/20">
                  <div className="mb-5 h-12 w-12 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20" />
                  <h3 className="text-xl font-bold">{benefit.title}</h3>
                  <p className="mt-4 leading-7 text-slate-400">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="modules" className="mx-auto max-w-7xl px-6 py-20">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-400">Moduly</p>
              <h2 className="mt-4 max-w-3xl text-3xl font-black tracking-tight md:text-5xl">
                Jeden workspace pro znalosti, emaily a otevřenou komunikaci.
              </h2>
            </div>
            <p className="max-w-md leading-7 text-slate-400">
              Nejdřív pilot. Potom škálování. Tohle je praktičtější než stavět velkou AI platformu bez ověření přínosu.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="grid gap-4">
              {(Object.keys(modules) as ModuleKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveModule(key)}
                  className={`rounded-[28px] border p-6 text-left transition ${
                    activeModule === key
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900"
                  }`}
                >
                  <p className="text-sm font-bold text-emerald-400">{modules[key].label}</p>
                  <h3 className="mt-2 text-2xl font-bold text-white">{modules[key].title}</h3>
                  <p className="mt-3 leading-7 text-slate-400">{modules[key].description}</p>
                </button>
              ))}
            </div>

            <div className="rounded-[32px] border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
              <div className="rounded-[24px] border border-slate-800 bg-slate-950 p-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
                    <h3 className="mt-1 text-2xl font-bold">{module.previewTitle}</h3>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">AI ready</span>
                </div>

                <div className="mt-5 space-y-3">
                  {module.previewLines.map((line, index) => (
                    <div
                      key={line}
                      className={`rounded-2xl p-4 text-sm leading-6 ${
                        index === 0
                          ? "border border-slate-800 bg-slate-900 text-slate-300"
                          : "bg-emerald-500/10 text-slate-200"
                      }`}
                    >
                      {line}
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  {module.bullets.map((bullet) => (
                    <span key={bullet} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300">
                      {bullet}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="security" className="border-y border-slate-800 bg-slate-900/40">
          <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-400">Security layer</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
                B2B produkt nestojí na efektu. Stojí na důvěře.
              </h2>
              <p className="mt-5 leading-8 text-slate-400">
                Pro firmy je zásadní oddělení dat, role, přístupová práva a jasné hranice mezi organizacemi. Bez toho je AI jen riziko v hezkém UI.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[28px] border border-slate-800 bg-slate-950 p-6">
                <h3 className="font-bold">Organization isolation</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">Každý dokument, email a query musí být scoped přes organization_id.</p>
              </div>
              <div className="rounded-[28px] border border-slate-800 bg-slate-950 p-6">
                <h3 className="font-bold">Role management</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">Owner, admin, member a superadmin pro řízenou správu přístupů.</p>
              </div>
              <div className="rounded-[28px] border border-slate-800 bg-slate-950 p-6">
                <h3 className="font-bold">Human-in-the-loop</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">AI navrhuje. Uživatel schvaluje. To je správný model pro citlivou komunikaci.</p>
              </div>
              <div className="rounded-[28px] border border-slate-800 bg-slate-950 p-6">
                <h3 className="font-bold">Audit-ready směr</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">Další krok je audit log, usage limits, billing a přesnější oprávnění dokumentů.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="login" className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-400">Přístup</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
                Začni malým pilotem. Jeden tým, jeden proces, jasný výsledek.
              </h2>
              <p className="mt-5 leading-8 text-slate-400">
                Slabý směr by byl prodávat „AI chatbot“. Silnější pozice je workflow assistant pro konkrétní provozní bolest: dokumenty, emaily a follow-upy.
              </p>
            </div>

            <div className="rounded-[32px] border border-slate-800 bg-slate-900/85 p-6 shadow-2xl shadow-black/30">
              {accessToken ? (
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-emerald-400">Přihlášeno</p>
                  <h3 className="mt-3 text-3xl font-bold">Vítej zpět.</h3>
                  <p className="mt-3 text-slate-400">
                    Jsi přihlášený jako <span className="text-slate-100">{authUser?.email}</span>.
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <a href="/aplikace" className="rounded-2xl bg-emerald-500 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-400">
                      Otevřít aplikaci
                    </a>
                    <button onClick={logout} className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800">
                      Odhlásit
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-5 inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                    Early access
                  </div>

                  <h3 className="text-3xl font-bold">Přístup do Operio</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Přihlas se nebo vytvoř účet pro firemní workspace.
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-950 p-1">
                    <button
                      onClick={() => setAuthMode("login")}
                      className={`rounded-xl px-4 py-3 text-sm font-semibold ${authMode === "login" ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-white"}`}
                    >
                      Přihlášení
                    </button>
                    <button
                      onClick={() => setAuthMode("register")}
                      className={`rounded-xl px-4 py-3 text-sm font-semibold ${authMode === "register" ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-white"}`}
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
                      </>
                    )}
                  </div>

                  <button
                    onClick={handleAuth}
                    disabled={authLoading || !authEmail || !authPassword}
                    className="mt-6 w-full rounded-2xl bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {authLoading ? "Zpracovávám..." : authMode === "login" ? "Přihlásit" : "Vytvořit účet"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <footer className="border-t border-slate-800 px-6 py-8">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-sm text-slate-500 md:flex-row md:items-center">
            <p>© Operio. AI workplace assistant platform.</p>
            <p>Documents • Email • Follow-ups • Organization management</p>
          </div>
        </footer>
      </div>
    </main>
  );
}
