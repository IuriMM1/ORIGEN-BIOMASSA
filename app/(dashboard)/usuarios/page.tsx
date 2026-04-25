"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAllAppProfiles, syncAppProfileGapsFromMetadata, touchLastSeen, type AppProfileRow } from "@/lib/app-profile";
import { supabase } from "@/lib/supabase";

const primary = "#143328";

function formatLastSeen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleLabel(role: string): string {
  if (role === "admin") return "Administrador";
  if (role === "usuario") return "Utilizador";
  return role;
}

export default function UsuariosPage() {
  const [rows, setRows] = useState<AppProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await fetchAllAppProfiles(supabase);
    setLoading(false);
    if (error) {
      setErr(error);
      setRows([]);
      return;
    }
    setRows(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const u = session?.user;
      if (u && !cancelled) {
        await syncAppProfileGapsFromMetadata(supabase, u.id, u.user_metadata as Record<string, unknown>);
        await touchLastSeen(supabase, u.id);
      }
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <div className="min-h-screen bg-transparent pb-16 pt-8">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: primary }}>
            Utilizadores
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Lista de contas registadas: nome, grau de acesso, último acesso à plataforma e empresa.
          </p>
        </header>

        {err ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
            <p className="font-semibold">Não foi possível carregar os perfis.</p>
            <p className="mt-1 text-amber-900/95">{err}</p>
            <div className="mt-4 space-y-2 border-t border-amber-200/80 pt-3 text-xs leading-relaxed text-amber-900/90">
              <p className="font-semibold text-amber-950">Como corrigir no Supabase</p>
              <ol className="list-decimal space-y-1.5 pl-4">
                <li>
                  Abra o painel do projeto → <strong>SQL Editor</strong> → nova consulta.
                </li>
                <li>
                  Copie e execute <strong>todo</strong> o ficheiro{" "}
                  <code className="rounded bg-amber-100/90 px-1 font-mono text-[11px]">supabase/migrations/20260428200000_app_profiles_roles.sql</code>{" "}
                  (está na pasta do repositório).
                </li>
                <li>
                  Se o erro falar em <em>schema cache</em> mas a tabela já existir, no SQL Editor execute:{" "}
                  <code className="mt-1 block rounded bg-amber-100/90 px-2 py-1 font-mono text-[11px]">NOTIFY pgrst, &apos;reload schema&apos;;</code>
                </li>
                <li>Volte a esta página e atualize o browser (F5).</li>
              </ol>
            </div>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/90">
                  <th className="px-4 py-3 font-semibold text-gray-700">Nome</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Grau de acesso</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Último acesso</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Empresa</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                      A carregar…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                      Nenhum perfil encontrado.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-medium text-gray-900">{r.full_name?.trim() || r.email || "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            r.role === "admin" ?
                              "inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-100"
                            : "inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-800 ring-1 ring-slate-200/80"
                          }
                        >
                          {roleLabel(r.role)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatLastSeen(r.last_seen_at)}</td>
                      <td className="max-w-[240px] truncate px-4 py-3 text-gray-700" title={r.company ?? undefined}>
                        {r.company?.trim() || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
