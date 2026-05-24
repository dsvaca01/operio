export default function ProductPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-emerald-400">
            Operio
          </p>

          <h1 className="text-5xl font-bold leading-tight">
            AI asistenti pro firemní dokumenty, emaily a operativu.
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-300">
            Operio pomáhá malým a středním firmám rychle najít informace,
            shrnout emaily a připravit návrhy odpovědí bez zbytečného hledání
            v dokumentech, inboxu a hlavách zaměstnanců.
          </p>

          <div className="mt-8 flex gap-4">
            <a
              href="/"
              className="rounded-2xl bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-400"
            >
              Otevřít demo
            </a>

            <a
              href="#use-cases"
              className="rounded-2xl border border-slate-700 px-6 py-3 font-semibold text-slate-200 hover:bg-slate-900"
            >
              Jak to funguje
            </a>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-900/60">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-16 md:grid-cols-3">
          <div className="rounded-3xl bg-slate-950 p-6">
            <h3 className="text-xl font-semibold">Méně hledání</h3>
            <p className="mt-3 text-slate-400">
              Zaměstnanci se zeptají přirozeným jazykem a Operio najde odpověď
              v dokumentech.
            </p>
          </div>

          <div className="rounded-3xl bg-slate-950 p-6">
            <h3 className="text-xl font-semibold">Rychlejší emaily</h3>
            <p className="mt-3 text-slate-400">
              Nepřečtené emaily se shrnou do jasného přehledu a AI připraví
              návrh odpovědi.
            </p>
          </div>

          <div className="rounded-3xl bg-slate-950 p-6">
            <h3 className="text-xl font-semibold">Firemní znalosti</h3>
            <p className="mt-3 text-slate-400">
              Know-how firmy nezůstává jen v hlavách jednotlivců, ale je
              dostupné celému týmu.
            </p>
          </div>
        </div>
      </section>

      <section id="use-cases" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-bold">Co Operio umí</h2>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="text-2xl font-semibold">Knowledge Assistant</h3>
            <p className="mt-4 text-slate-400">
              Nahrajete PDF, DOCX nebo TXT dokumenty. Uživatel se zeptá a AI
              odpoví pouze z dostupných firemních podkladů.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="text-2xl font-semibold">Email Assistant</h3>
            <p className="mt-4 text-slate-400">
              Načte nepřečtené emaily, vytvoří denní přehled, zvýrazní úkoly
              a podle instrukce připraví návrh odpovědi.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-3xl font-bold">
            Začněte jednoduchým pilotem.
          </h2>

          <p className="mt-4 max-w-2xl text-lg">
            Vybereme jeden konkrétní problém ve firmě, napojíme dokumenty nebo
            emaily a během krátké doby ukážeme měřitelný přínos.
          </p>

          <a
            href="/"
            className="mt-6 inline-block rounded-2xl rounded-2xl bg-emerald-500 px-6 py-3 font-semibold text-white hover:bg-emerald-400"
          >
            Vyzkoušet demo
          </a>
        </div>
      </section>
    </main>
  );
}