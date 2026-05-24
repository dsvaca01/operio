"use client";

import { useEffect, useState } from "react";

type Member = {
  user_id: number;
  email: string;
  full_name: string | null;
  organization_role: "owner" | "admin" | "member";
  global_role?: "user" | "superadmin";
};

type CurrentUser = {
  id?: number;
  email: string;
  full_name?: string | null;
  role?: "owner" | "admin" | "member";
  global_role?: "user" | "superadmin";
};

export default function AdminPage() {
  const API_URL = "http://localhost:8000";

  const [members, setMembers] = useState<Member[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const getToken = () => {
    return localStorage.getItem("access_token") || "";
  };

  const loadMembers = async () => {
    try {
      setLoading(true);
      setMessage("");

      const token = getToken();

      if (!token) {
        setMessage("Nejsi přihlášený. Přihlas se nejdřív na hlavní stránce.");
        return;
      }

      // načtení aktuálního uživatele
      const meResponse = await fetch(`${API_URL}/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const me = await meResponse.json();

      if (!meResponse.ok) {
        setMessage(
          me.detail || "Nepodařilo se načíst aktuálního uživatele."
        );
        return;
      }

      setCurrentUser(me);

      const superadmin = me.global_role === "superadmin";
      setIsSuperadmin(superadmin);

      // superadmin vidí všechny uživatele
      // běžný admin/owner jen svoji organizaci
      const usersEndpoint = superadmin
        ? `${API_URL}/superadmin/users`
        : `${API_URL}/admin/members`;

      const response = await fetch(usersEndpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Nepodařilo se načíst uživatele.");
        return;
      }

      setMembers(data.members || data.users || []);
    } catch (error) {
      console.error("Failed to load users", error);
      setMessage("Chyba při načítání uživatelů.");
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (
    userId: number,
    role: Member["organization_role"]
  ) => {
    try {
      setLoading(true);
      setMessage("");

      const token = getToken();

      if (!token) {
        setMessage("Nejsi přihlášený.");
        return;
      }

      // superadmin používá vlastní endpoint
      const roleEndpoint = isSuperadmin
        ? `${API_URL}/superadmin/users/role`
        : `${API_URL}/admin/members/role`;

      const response = await fetch(roleEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail || "Nepodařilo se změnit roli."
        );
        return;
      }

      setMessage("Role byla upravena.");

      // reload tabulky
      await loadMembers();
    } catch (error) {
      console.error("Failed to update role", error);
      setMessage("Chyba při změně role.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100 lg:p-10">
      <div className="mx-auto max-w-5xl">

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-400">
              Operio Admin
            </p>

            <h1 className="mt-2 text-4xl font-bold">
              Správa uživatelů
            </h1>

            <p className="mt-3 max-w-2xl text-slate-400">
              {isSuperadmin
                ? "Superadmin režim: vidíš všechny uživatele systému."
                : "Přehled členů firmy a změna jejich rolí."}
            </p>

            {currentUser && (
              <p className="mt-2 text-sm text-slate-500">
                Přihlášen jako:
                {" "}
                <span className="text-slate-300">
                  {currentUser.email}
                </span>

                {" · "}

                global_role:
                {" "}

                <span className="text-emerald-300">
                  {currentUser.global_role || "user"}
                </span>
              </p>
            )}
          </div>

          <div className="flex gap-3">

            <a
              href="/"
              className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-900"
            >
              Zpět
            </a>

            <button
              onClick={loadMembers}
              disabled={loading}
              className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading ? "Načítám..." : "Obnovit"}
            </button>

          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
            {message}
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">

          <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr] border-b border-slate-800 bg-slate-950 px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <div>Uživatel</div>
            <div>Email</div>
            <div>Org role</div>
            <div>Global role</div>
            <div>Akce</div>
          </div>

          {members.length === 0 && !loading && (
            <div className="p-6 text-sm text-slate-500">
              Žádní uživatelé k zobrazení.
            </div>
          )}

          {members.map((member) => (
            <div
              key={member.user_id}
              className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr] items-center border-b border-slate-800 px-5 py-4 text-sm last:border-b-0"
            >

              <div className="font-medium text-slate-100">
                {member.full_name || "Bez jména"}
              </div>

              <div className="text-slate-400">
                {member.email}
              </div>

              <div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    member.organization_role === "owner"
                      ? "bg-amber-500/20 text-amber-300"
                      : member.organization_role === "admin"
                      ? "bg-indigo-500/20 text-indigo-300"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {member.organization_role || "member"}
                </span>
              </div>

              <div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    member.global_role === "superadmin"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {member.global_role || "user"}
                </span>
              </div>

              <div>
                <select
                  value={member.organization_role || "member"}
                  onChange={(e) =>
                    updateRole(
                      member.user_id,
                      e.target.value as Member["organization_role"]
                    )
                  }
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-sm outline-none focus:border-emerald-500 disabled:opacity-50"
                >
                  <option value="owner">owner</option>
                  <option value="admin">admin</option>
                  <option value="member">member</option>
                </select>
              </div>

            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">

          <h2 className="font-semibold text-slate-100">
            Role
          </h2>

          <div className="mt-3 grid gap-3 text-sm text-slate-400 md:grid-cols-4">

            <div>
              <span className="font-semibold text-amber-300">
                owner
              </span>

              <p className="mt-1">
                Vlastník firmy. Může měnit role.
              </p>
            </div>

            <div>
              <span className="font-semibold text-indigo-300">
                admin
              </span>

              <p className="mt-1">
                Správa firmy bez změny owner role.
              </p>
            </div>

            <div>
              <span className="font-semibold text-slate-300">
                member
              </span>

              <p className="mt-1">
                Běžný uživatel workspace.
              </p>
            </div>

            <div>
              <span className="font-semibold text-emerald-300">
                superadmin
              </span>

              <p className="mt-1">
                Globální role. Vidí všechny uživatele systému.
              </p>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}
