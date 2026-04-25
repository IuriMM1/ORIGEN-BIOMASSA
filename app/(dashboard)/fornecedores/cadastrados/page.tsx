"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  enrichSupplierDisplay,
  formatDate,
  formatPhone,
  getDisplayStatus,
  initials,
  statusDbToAtivoInativo,
  type SupplierRow,
} from "../_fornecedor-utils";

const primary = "#143328";
const lime = "#8BC34A";
const pageSize = 8;

type Supplier = SupplierRow;

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15 5 17 8 17 8s-3 1-4 4-1.5 6.5-2 8M11 20s-1-4 1-6 4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function FornecedoresCadastradosPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterTipo, setFilterTipo] = useState("Todos");
  const [filterBiomassa, setFilterBiomassa] = useState("Todos");
  const [page, setPage] = useState(1);
  const [sortDesc, setSortDesc] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("suppliers").select("*").order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      console.error(error);
      return;
    }
    setSuppliers((data as Supplier[]) || []);
  }

  async function updateSupplierStatus(id: string, value: "ativo" | "inativo") {
    const { error } = await supabase.from("suppliers").update({ status: value }).eq("id", id);
    if (error) {
      const hint =
        /status.*schema cache|column.*status/i.test(error.message) ?
          "\n\nA coluna status ainda não existe na base remota. No Supabase: SQL Editor → execute o ficheiro supabase/migrations/20260225120000_suppliers_status.sql (ou 20260426120000_ensure_suppliers_status.sql); depois Settings → API → Reload schema."
        : "";
      alert("Erro ao atualizar status: " + error.message + hint);
      return;
    }
    setSuppliers((prev) => prev.map((x) => (x.id === id ? { ...x, status: value } : x)));
  }

  async function deleteSupplier(id: string, name: string) {
    if (!confirm(`Excluir permanentemente o fornecedor "${name}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) {
      alert("Erro ao excluir: " + error.message);
      return;
    }
    setSuppliers((prev) => prev.filter((x) => x.id !== id));
  }

  useEffect(() => {
    load();
  }, []);

  const enriched = useMemo(() => {
    return suppliers.map((s) => ({ s, ...enrichSupplierDisplay(s) }));
  }, [suppliers]);

  const filtered = useMemo(() => {
    let rows = enriched;
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        ({ s, cnpj, bio, tipo }) =>
          s.name.toLowerCase().includes(q) ||
          (s.city && s.city.toLowerCase().includes(q)) ||
          (s.phone && s.phone.includes(q)) ||
          cnpj.toLowerCase().includes(q) ||
          bio.toLowerCase().includes(q) ||
          tipo.toLowerCase().includes(q),
      );
    }
    if (filterStatus !== "Todos") rows = rows.filter((r) => r.status === filterStatus);
    if (filterTipo !== "Todos") rows = rows.filter((r) => r.tipo === filterTipo);
    if (filterBiomassa !== "Todos") rows = rows.filter((r) => r.bio === filterBiomassa);
    rows = [...rows].sort((a, b) => {
      const ta = a.s.created_at ? new Date(a.s.created_at).getTime() : 0;
      const tb = b.s.created_at ? new Date(b.s.created_at).getTime() : 0;
      return sortDesc ? tb - ta : ta - tb;
    });
    return rows;
  }, [enriched, search, filterStatus, filterTipo, filterBiomassa, sortDesc]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const sliceStart = (currentPage - 1) * pageSize;
  const pageRows = filtered.slice(sliceStart, sliceStart + pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, filterStatus, filterTipo, filterBiomassa]);

  const kpis = useMemo(() => {
    const n = suppliers.length;
    if (n === 0) {
      return {
        total: 0,
        ativos: 0,
        inativos: 0,
        pctAtivos: "0,0",
        pctInat: "0,0",
      };
    }
    const ativos = enriched.filter((r) => r.status === "Ativo").length;
    const inativos = enriched.filter((r) => r.status === "Inativo").length;
    return {
      total: n,
      ativos,
      inativos,
      pctAtivos: ((ativos / n) * 100).toFixed(1).replace(".", ","),
      pctInat: ((inativos / n) * 100).toFixed(1).replace(".", ","),
    };
  }, [suppliers.length, enriched]);

  function exportCsv() {
    const headers = ["Fornecedor", "CNPJ", "Tipo", "Biomassa", "Cidade", "UF", "Telefone", "Status", "Cadastro"];
    const lines = filtered.map(({ s, cnpj, tipo, bio, status }) =>
      [s.name, cnpj, tipo, bio, s.city ?? "", s.state ?? "", s.phone ?? "", status, formatDate(s.created_at)]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(";"),
    );
    const blob = new Blob([headers.join(";") + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fornecedores.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const paginationNums = useMemo(() => {
    const tp = totalPages;
    if (tp <= 9) return Array.from({ length: tp }, (_, i) => i + 1) as (number | "ellipsis")[];
    const set = new Set<number>();
    set.add(1);
    set.add(tp);
    for (let i = currentPage - 2; i <= currentPage + 2; i++) {
      if (i >= 1 && i <= tp) set.add(i);
    }
    const sorted = [...set].sort((a, b) => a - b);
    const out: (number | "ellipsis")[] = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("ellipsis");
      out.push(sorted[i]);
    }
    return out;
  }, [totalPages, currentPage]);

  const selectClass =
    "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#143328] focus:ring-1 focus:ring-[#143328]/25";

  return (
    <div className="min-h-screen bg-transparent pb-12 pt-8">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: primary }}>
              Fornecedores
            </h1>
            <p className="mt-1.5 text-sm text-gray-500">Gerencie e visualize os fornecedores cadastrados</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/fornecedores/cadastro"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105"
              style={{ backgroundColor: primary }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Novo Fornecedor
            </Link>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" strokeLinecap="round" />
              </svg>
              Ajuda
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50"
              aria-label="Notificações"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </header>

        {/* Cards resumo */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-gray-100/80 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total de Fornecedores</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{kpis.total}</p>
                <p className="mt-2 text-xs font-semibold" style={{ color: lime }}>
                  ↑ 12% vs mês anterior
                </p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 22V12h6v10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-gray-100/80 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Fornecedores Ativos</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{kpis.ativos}</p>
                <p className="mt-2 text-xs font-semibold" style={{ color: lime }}>
                  {kpis.pctAtivos}% do total
                </p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-gray-100/80 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Inativos</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{kpis.inativos}</p>
                <p className="mt-2 text-xs font-semibold text-red-600">{kpis.pctInat}% do total</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600 ring-1 ring-red-100">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="m15 9-6 6M9 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-100/80 bg-white p-4 shadow-sm lg:flex-row lg:flex-wrap lg:items-center">
          <div className="relative min-w-[200px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="search"
              placeholder="Buscar fornecedor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#143328] focus:ring-1 focus:ring-[#143328]/25"
            />
          </div>
          <select className={`min-w-[160px] ${selectClass}`} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option>Todos</option>
            <option>Ativo</option>
            <option>Inativo</option>
          </select>
          <select className={`min-w-[180px] ${selectClass}`} value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
            <option>Todos</option>
            <option>Fornecedor</option>
            <option>Cooperativa</option>
          </select>
          <select className={`min-w-[200px] ${selectClass}`} value={filterBiomassa} onChange={(e) => setFilterBiomassa(e.target.value)}>
            <option>Todos</option>
            <option>Cavaco de Eucalipto</option>
            <option>Resíduo Florestal</option>
            <option>Pellet de Madeira</option>
          </select>
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Filtros
            </button>
            <button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Exportar
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-hidden rounded-xl border border-gray-100/80 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/90">
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Fornecedor</th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Tipo de Fornecedor</th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Tipo de Biomassa</th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Cidade / UF</th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Telefone</th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Status</th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
                    <button type="button" onClick={() => setSortDesc((v) => !v)} className="inline-flex items-center gap-1 font-semibold text-gray-600 hover:text-gray-900">
                      Cadastro
                      <svg className={`h-3.5 w-3.5 transition ${sortDesc ? "" : "rotate-180"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-gray-500">
                      Carregando…
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-gray-500">
                      Nenhum fornecedor encontrado.
                    </td>
                  </tr>
                ) : (
                  pageRows.map(({ s, tipo, bio, cnpj }) => {
                    const dbSt = statusDbToAtivoInativo(s);
                    return (
                      <tr key={s.id} className="border-b border-gray-50 transition hover:bg-gray-50/80">
                        <td className="px-4 py-3.5">
                          <Link href={`/fornecedores/cadastrados/${s.id}`} className="flex items-center gap-3 rounded-lg outline-none ring-offset-2 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#143328]/30">
                            {s.logo_url ? (
                              <img
                                src={s.logo_url}
                                alt=""
                                className="h-10 w-10 shrink-0 rounded-full border border-gray-200/80 bg-white object-cover"
                              />
                            ) : (
                              <span
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                style={{ backgroundColor: primary }}
                              >
                                {initials(s.name)}
                              </span>
                            )}
                            <div className="min-w-0 text-left">
                              <p className="font-semibold text-gray-900">{s.name}</p>
                              <p className="text-xs text-gray-500">{cnpj}</p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3.5 text-gray-700">{tipo}</td>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-gray-700">
                            <span className="text-[#8BC34A]" aria-hidden>
                              <LeafIcon className="h-4 w-4 shrink-0" />
                            </span>
                            <span>{bio}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-gray-700">
                          {(s.city || "—") + " / " + (s.state || "—")}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{formatPhone(s.phone)}</td>
                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <select
                            aria-label={`Status de ${s.name}`}
                            value={dbSt}
                            onChange={(e) => updateSupplierStatus(s.id, e.target.value as "ativo" | "inativo")}
                            className={`${selectClass} min-w-[8.5rem] py-2 text-xs font-semibold ${
                              dbSt === "inativo" ? "border-red-200 bg-red-50 text-red-800 ring-1 ring-red-100" : ""
                            }`}
                          >
                            <option value="ativo">Ativo</option>
                            <option value="inativo">Inativo</option>
                          </select>
                          <span className="sr-only">Situação na lista: {getDisplayStatus(s)}</span>
                        </td>
                        <td className="px-4 py-3.5 text-gray-600">{formatDate(s.created_at)}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <Link
                              href={`/fornecedores/cadastro?edit=${s.id}`}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50"
                            >
                              Alterar
                            </Link>
                            <button
                              type="button"
                              onClick={() => deleteSupplier(s.id, s.name)}
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 shadow-sm transition hover:bg-red-100"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 border-t border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Mostrando {total === 0 ? 0 : sliceStart + 1} a {Math.min(sliceStart + pageSize, total)} de {total} fornecedores
            </p>
            <nav className="flex flex-wrap items-center justify-center gap-1" aria-label="Paginação">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
                aria-label="Página anterior"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {paginationNums.map((n, i) =>
                n === "ellipsis" ? (
                  <span key={`e-${i}`} className="px-2 text-gray-400">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg px-2 text-sm font-semibold transition ${
                      currentPage === n ? "text-white shadow-sm" : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                    style={currentPage === n ? { backgroundColor: primary } : undefined}
                  >
                    {n}
                  </button>
                ),
              )}
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
                aria-label="Próxima página"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
