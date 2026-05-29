"use client";

import { useEffect, useState } from "react";
import { config } from "@/app/config";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type OrgRole = "owner" | "admin" | "member";
type GlobalRole = "user" | "superadmin";

type Member = {
  user_id: number;
  email: string;
  full_name: string | null;
  organization_name?: string | null;
  organization_id?: number | null;
  organization_role?: OrgRole;
  role?: OrgRole;
  global_role?: GlobalRole;
  app_access_enabled?: boolean;
};

type CurrentUser = {
  user_id?: number;
  id?: number;
  email: string;
  full_name?: string | null;
  role?: OrgRole;
  global_role?: GlobalRole;
  organization_id?: number;
};

type CreatedOrganization = {
  id: number;
  name: string;
  registration_code: string;
  is_active: boolean;
};

type TokenUsageItem = {
  user_id: number;
  email: string;
  full_name: string | null;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_usd: number;
};

export default function AdminPage() {
  const API_URL = config.apiUrl;

  const [members, setMembers] = useState<Member[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageItem[]>([]);

  const [organizationName, setOrganizationName] = useState("");
  const [customRegistrationCode, setCustomRegistrationCode] = useState("");
  const [createdOrganization, setCreatedOrganization] =
    useState<CreatedOrganization | null>(null);

  const [loading, setLoading] = useState(false);
  const [accessUpdatingUserId, setAccessUpdatingUserId] = useState<number | null>(
    null
  );
  const [roleUpdatingUserId, setRoleUpdatingUserId] = useState<number | null>(
    null
  );
  const [creatingOrganization, setCreatingOrganization] = useState(false);
  const [message, setMessage] = useState("");

  const getToken = () => localStorage.getItem("access_token") || "";

  const getMemberRole = (member: Member): OrgRole => {
    return member.organization_role || member.role || "member";
  };

  const loadTokenUsage = async (tokenOverride?: string) => {
    try {
      const token = tokenOverride || getToken();

      if (!token) {
        return;
      }

      const response = await fetch(`${API_URL}/superadmin/token-usage`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Failed to load token usage", data);
        return;
      }

      setTokenUsage(data);
    } catch (error) {
      console.error("Failed to load token usage", error);
    }
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

      const meResponse = await fetch(`${API_URL}/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const me = await meResponse.json();

      if (!meResponse.ok) {
        setMessage(me.detail || "Nepodařilo se načíst aktuálního uživatele.");
        return;
      }

      setCurrentUser(me);

      const superadmin = me.global_role === "superadmin";
      setIsSuperadmin(superadmin);

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

      if (superadmin) {
        await loadTokenUsage(token);
      } else {
        setTokenUsage([]);
      }
    } catch (error) {
      console.error("Failed to load users", error);
      setMessage("Chyba při načítání uživatelů.");
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (userId: number, role: OrgRole) => {
    try {
      setRoleUpdatingUserId(userId);
      setMessage("");

      const token = getToken();

      if (!token) {
        setMessage("Nejsi přihlášený.");
        return;
      }

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
        setMessage(data.detail || "Nepodařilo se změnit roli.");
        return;
      }

      setMembers((prev) =>
        prev.map((member) =>
          member.user_id === userId
            ? {
                ...member,
                role,
                organization_role: role,
              }
            : member
        )
      );

      setMessage("Role byla upravena.");
    } catch (error) {
      console.error("Failed to update role", error);
      setMessage("Chyba při změně role.");
    } finally {
      setRoleUpdatingUserId(null);
    }
  };

  const updateUserAccess = async (
    userId: number,
    appAccessEnabled: boolean
  ) => {
    try {
      setAccessUpdatingUserId(userId);
      setMessage("");

      const token = getToken();

      if (!token) {
        setMessage("Nejsi přihlášený.");
        return;
      }

      const response = await fetch(`${API_URL}/admin/members/access`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          app_access_enabled: appAccessEnabled,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Nepodařilo se změnit přístup uživatele.");
        return;
      }

      setMembers((prev) =>
        prev.map((member) =>
          member.user_id === userId
            ? {
                ...member,
                app_access_enabled: appAccessEnabled,
              }
            : member
        )
      );

      setMessage(
        appAccessEnabled
          ? "Přístup uživatele byl povolen."
          : "Přístup uživatele byl odebrán."
      );
    } catch (error) {
      console.error("Failed to update user access", error);
      setMessage("Chyba při změně přístupu uživatele.");
    } finally {
      setAccessUpdatingUserId(null);
    }
  };

  const createOrganization = async () => {
    try {
      setCreatingOrganization(true);
      setCreatedOrganization(null);
      setMessage("");

      const token = getToken();

      if (!token) {
        setMessage("Nejsi přihlášený.");
        return;
      }

      const cleanName = organizationName.trim();
      const cleanCode = customRegistrationCode.trim();

      if (!cleanName) {
        setMessage("Vyplň název organizace.");
        return;
      }

      const response = await fetch(`${API_URL}/superadmin/organizations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: cleanName,
          registration_code: cleanCode || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.detail || "Nepodařilo se vytvořit organizaci.");
        return;
      }

      setCreatedOrganization(data);
      setOrganizationName("");
      setCustomRegistrationCode("");
      setMessage("Organizace byla vytvořena.");
      await loadMembers();
    } catch (error) {
      console.error("Failed to create organization", error);
      setMessage("Chyba při vytváření organizace.");
    } finally {
      setCreatingOrganization(false);
    }
  };

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canChangeAccess =
    isSuperadmin ||
    currentUser?.role === "owner" ||
    currentUser?.role === "admin";

  const canChangeRole = isSuperadmin || currentUser?.role === "owner";

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100 lg:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-400">
              Operio Admin
            </p>

            <h1 className="mt-2 text-4xl font-bold">Správa uživatelů</h1>

            <p className="mt-3 max-w-2xl text-slate-400">
              {isSuperadmin
                ? "Superadmin režim: vidíš všechny uživatele systému a můžeš vytvářet organizace."
                : "Přehled členů firmy, změna rolí a povolení přístupu do aplikace."}
            </p>

            {currentUser && (
              <p className="mt-2 text-sm text-slate-500">
                Přihlášen jako:{" "}
                <span className="text-slate-300">{currentUser.email}</span>
                {" · "}
                global_role:{" "}
                <span className="text-emerald-300">
                  {currentUser.global_role || "user"}
                </span>
                {" · "}
                role:{" "}
                <span className="text-emerald-300">
                  {currentUser.role || "member"}
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

        {isSuperadmin && (
          <div className="mb-6 rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-xl">
                <h2 className="text-xl font-semibold text-slate-100">
                  Vytvořit organizaci
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Organizaci vytváří pouze superadmin. Uživatelé se potom
                  registrují přes registrační kód a čekají na schválení.
                </p>
              </div>

              <div className="grid w-full gap-3 lg:max-w-2xl lg:grid-cols-[1fr_1fr_auto]">
                <input
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  placeholder="Název organizace"
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-emerald-500"
                />

                <input
                  value={customRegistrationCode}
                  onChange={(event) =>
                    setCustomRegistrationCode(event.target.value)
                  }
                  placeholder="Vlastní kód volitelně"
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-emerald-500"
                />

                <button
                  onClick={createOrganization}
                  disabled={creatingOrganization}
                  className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {creatingOrganization ? "Vytvářím..." : "Vytvořit"}
                </button>
              </div>
            </div>

            {createdOrganization && (
              <div className="mt-5 rounded-2xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-200">
                <p>
                  Organizace vytvořena:{" "}
                  <span className="font-semibold">
                    {createdOrganization.name}
                  </span>
                </p>

                <p className="mt-2 text-emerald-300">Registrační kód:</p>

                <code className="mt-1 block rounded-xl bg-slate-950 p-3 text-emerald-300">
                  {createdOrganization.registration_code}
                </code>
              </div>
            )}
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
          <div className="grid grid-cols-[1.3fr_1.5fr_1.2fr_0.9fr_0.9fr_1.1fr_1fr] border-b border-slate-800 bg-slate-950 px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <div>Uživatel</div>
            <div>Email</div>
            <div>Organizace</div>
            <div>Org role</div>
            <div>Global role</div>
            <div>Přístup</div>
            <div>Akce</div>
          </div>

          {members.length === 0 && !loading && (
            <div className="p-6 text-sm text-slate-500">
              Žádní uživatelé k zobrazení.
            </div>
          )}

          {members.map((member) => {
            const memberRole = getMemberRole(member);
            const isAccessUpdating = accessUpdatingUserId === member.user_id;
            const isRoleUpdating = roleUpdatingUserId === member.user_id;

            return (
              <div
                key={`${member.organization_id || "org"}-${member.user_id}`}
                className="grid grid-cols-[1.3fr_1.5fr_1.2fr_0.9fr_0.9fr_1.1fr_1fr] items-center border-b border-slate-800 px-5 py-4 text-sm last:border-b-0"
              >
                <div className="font-medium text-slate-100">
                  {member.full_name || "Bez jména"}
                </div>

                <div className="break-all text-slate-400">{member.email}</div>

                <div className="text-slate-300">
                  {member.organization_name || "-"}
                </div>

                <div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      memberRole === "owner"
                        ? "bg-amber-500/20 text-amber-300"
                        : memberRole === "admin"
                        ? "bg-indigo-500/20 text-indigo-300"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {memberRole}
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
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={Boolean(member.app_access_enabled)}
                      onChange={(event) =>
                        updateUserAccess(member.user_id, event.target.checked)
                      }
                      disabled={!canChangeAccess || isAccessUpdating}
                      className="h-4 w-4 rounded border-slate-700 bg-slate-950"
                    />

                    <span>
                      {member.app_access_enabled ? "Povolen" : "Blokován"}
                    </span>
                  </label>
                </div>

                <div>
                  <select
                    value={memberRole}
                    onChange={(event) =>
                      updateRole(member.user_id, event.target.value as OrgRole)
                    }
                    disabled={!canChangeRole || isRoleUpdating}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-2 text-sm outline-none focus:border-emerald-500 disabled:opacity-50"
                  >
                    <option value="owner">owner</option>
                    <option value="admin">admin</option>
                    <option value="member">member</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="font-semibold text-slate-100">Role a přístup</h2>

          <div className="mt-3 grid gap-3 text-sm text-slate-400 md:grid-cols-5">
            <div>
              <span className="font-semibold text-amber-300">owner</span>
              <p className="mt-1">Vlastník firmy. Může měnit role.</p>
            </div>

            <div>
              <span className="font-semibold text-indigo-300">admin</span>
              <p className="mt-1">Správa firmy a povolování přístupu.</p>
            </div>

            <div>
              <span className="font-semibold text-slate-300">member</span>
              <p className="mt-1">Běžný uživatel workspace.</p>
            </div>

            <div>
              <span className="font-semibold text-emerald-300">superadmin</span>
              <p className="mt-1">Globální role. Vidí celý systém.</p>
            </div>

            <div>
              <span className="font-semibold text-emerald-300">
                Povolen přístup
              </span>
              <p className="mt-1">
                Bez povolení se uživatel nepřihlásí do aplikace.
              </p>
            </div>
          </div>
        </div>

        {isSuperadmin && (
          <div className="mt-6 rounded-3xl border border-emerald-500/20 bg-slate-900/90 p-6 shadow-lg shadow-emerald-950/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-3 text-xl font-semibold text-slate-100">
                  <span className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-emerald-400">
                    ▮▮▮
                  </span>
                  Token usage per uživatel
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Přehled spotřeby AI tokenů podle uživatelů.
                </p>
              </div>
            </div>

            <div className="mt-6 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={tokenUsage}
                  margin={{ top: 20, right: 20, left: 0, bottom: 10 }}
                >
                  <XAxis
                    dataKey="email"
                    axisLine={{ stroke: "#334155" }}
                    tickLine={false}
                    tick={{ fill: "#cbd5e1", fontSize: 12 }}
                  />

                  <YAxis
                    axisLine={{ stroke: "#334155" }}
                    tickLine={false}
                    tick={{ fill: "#cbd5e1", fontSize: 12 }}
                  />

                  <Tooltip
                    cursor={{ fill: "rgba(16, 185, 129, 0.08)" }}
                    contentStyle={{
                      backgroundColor: "#020617",
                      border: "1px solid rgba(16, 185, 129, 0.35)",
                      borderRadius: "16px",
                      color: "#e2e8f0",
                    }}
                    labelStyle={{
                      color: "#86efac",
                      fontWeight: 600,
                    }}
                  />

                  <Bar
                    dataKey="total_tokens"
                    name="Total tokens"
                    fill="#10b981"
                    radius={[10, 10, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
