"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchLabAnalysesList, type LabAnalysisRow } from "@/lib/lab-analyses-query";
import { supabase } from "@/lib/supabase";

const primary = "#143328";
const lime = "#8BC34A";
const pageSize = 8;

type AnalysisRow = LabAnalysisRow;

type RowStatus = "Concluída" | "Cancelada";

type Enriched = {
  row: AnalysisRow;
  displayId: number;
  code: string;
  status: RowStatus;
  amostraCode: string;
  /** Quadrante ou detalhe da amostra */
  amostraDetalhe: string;
  biomassa: string;
  fornecedor: string;
  entryDate: Date | null;
};

function parseCodigoNotes(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/Código da análise:\s*([^\n]+)/i);
  return m?.[1]?.trim() || null;
}

function parseAmostraCodigoNotes(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/Código da amostra:\s*([^\n]+)/i);
  return m?.[1]?.trim() || null;
}

function parseQuadranteNotes(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/Quadrante:\s*([^\n]+)/i);
  return m?.[1]?.trim() || null;
}

function formatDatePt(d: Date | null): string {
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatPct(n: number | null, cancelled: boolean): string {
  if (cancelled) return "—";
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(2).replace(".", ",")}%`;
}

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15 5 17 8 17 8s-3 1-4 4-1.5 6.5-2 8M11 20s-1-4 1-6 4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AnalysisStatusBadge({ status }: { status: RowStatus }) {
  if (status === "Concluída") {
    return <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-100">Concluída</span>;
  }
  return <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-900 ring-1 ring-red-100">Cancelada</span>;
}

function defaultPeriodRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

function rowEntryDate(a: AnalysisRow): Date | null {
  const s = a.analysis_date || a.created_at;
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inPeriod(d: Date | null, from: string, to: string): boolean {
  if (!d || !from || !to) return true;
  const t = d.getTime();
  const f = new Date(from + "T00:00:00").getTime();
  const e = new Date(to + "T23:59:59.999").getTime();
  return t >= f && t <= e;
}

export default function AnalisesRealizadasPage() {
  const router = useRouter();
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [filterBiomassa, setFilterBiomassa] = useState("Todos");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [page, setPage] = useState(1);
  /** Ordenação por data de entrada (mais recente primeiro quando true) */
  const [sortDateDesc, setSortDateDesc] = useState(true);

  useEffect(() => {
    const { from, to } = defaultPeriodRange();
    setPeriodFrom(from);
    setPeriodTo(to);
  }, []);

  async function loadAnalyses() {
    setLoading(true);
    const { data, error } = await fetchLabAnalysesList(supabase);
    setLoading(false);
    if (error) {
      alert("Erro ao carregar análises: " + error);
      return;
    }
    setAnalyses(data);
  }

  useEffect(() => {
    loadAnalyses();
  }, []);

  const idToRank = useMemo(() => {
    const copy = [...analyses];
    copy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const m = new Map<string, number>();
    copy.forEach((a, i) => m.set(a.id, i + 1));
    return m;
  }, [analyses]);

  const enrichedAll: Enriched[] = useMemo(() => {
    const n = analyses.length;
    return analyses.map((row) => {
      const displayId = idToRank.get(row.id) ?? n;
      const fromNotes = parseCodigoNotes(row.notes);
      const y = new Date(row.analysis_date || row.created_at).getFullYear();
      const code =
        (row.analysis_code && row.analysis_code.trim()) ||
        fromNotes ||
        `AN-${y}-${String(displayId).padStart(4, "0")}`;
      const status: RowStatus = "Concluída";
      const sample = row.lab_samples;
      const amostraFromNotes = parseAmostraCodigoNotes(row.notes);
      const quadranteNotes = parseQuadranteNotes(row.notes);
      const amostraCode = sample?.code?.trim() || amostraFromNotes || "—";
      const quadrante = sample?.quadrant?.trim() || quadranteNotes || null;
      const amostraDetalhe = quadrante
        ? `Quadrante: ${quadrante}`
        : sample?.code?.trim() || amostraFromNotes
          ? "Sem quadrante registado"
          : "—";
      const biomassa = row.biomass_types?.name ?? "—";
      const fornecedor = row.suppliers?.name ?? "—";
      return {
        row,
        displayId,
        code,
        status,
        amostraCode,
        amostraDetalhe,
        biomassa,
        fornecedor,
        entryDate: rowEntryDate(row),
      };
    });
  }, [analyses, idToRank]);

  const biomassaOptions = useMemo(() => {
    const s = new Set<string>();
    enrichedAll.forEach((e) => {
      if (e.biomassa && e.biomassa !== "—") s.add(e.biomassa);
    });
    return ["Todos", ...[...s].sort((a, b) => a.localeCompare(b, "pt"))];
  }, [enrichedAll]);

  const filtered = useMemo(() => {
    let rows = enrichedAll;
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (e) =>
          e.code.toLowerCase().includes(q) ||
          (e.row.analysis_code && e.row.analysis_code.toLowerCase().includes(q)) ||
          String(e.displayId).includes(q) ||
          e.amostraCode.toLowerCase().includes(q) ||
          e.amostraDetalhe.toLowerCase().includes(q) ||
          e.biomassa.toLowerCase().includes(q) ||
          e.fornecedor.toLowerCase().includes(q) ||
          (e.row.analyst && e.row.analyst.toLowerCase().includes(q)) ||
          (e.row.notes && e.row.notes.toLowerCase().includes(q)),
      );
    }
    if (filterStatus !== "Todos") {
      rows = rows.filter((e) => e.status === filterStatus);
    }
    if (filterBiomassa !== "Todos") {
      rows = rows.filter((e) => e.biomassa === filterBiomassa);
    }
    rows = rows.filter((e) => inPeriod(e.entryDate, periodFrom, periodTo));
    rows = [...rows].sort((a, b) => {
      const ta = a.entryDate?.getTime() ?? 0;
      const tb = b.entryDate?.getTime() ?? 0;
      if (ta !== tb) return sortDateDesc ? tb - ta : ta - tb;
      return sortDateDesc ? b.displayId - a.displayId : a.displayId - b.displayId;
    });
    return rows;
  }, [enrichedAll, search, filterStatus, filterBiomassa, periodFrom, periodTo, sortDateDesc]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const sliceStart = (currentPage - 1) * pageSize;
  const pageRows = filtered.slice(sliceStart, sliceStart + pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, filterStatus, filterBiomassa, periodFrom, periodTo, sortDateDesc]);

  const kpis = useMemo(() => {
    const concluded = enrichedAll.filter((e) => e.status === "Concluída");
    const cancelled = enrichedAll.filter((e) => e.status === "Cancelada");
    const n = enrichedAll.length;
    const nConc = concluded.length;
    const nCanc = cancelled.length;
    const pct = (x: number, d: number) => (d === 0 ? "0,0" : ((x / d) * 100).toFixed(1).replace(".", ","));

    const moist = concluded.map((e) => e.row.moisture).filter((v): v is number => v !== null && !Number.isNaN(v));
    const imp = concluded.map((e) => e.row.impurity).filter((v): v is number => v !== null && !Number.isNaN(v));
    const avgMoist = moist.length ? moist.reduce((a, b) => a + b, 0) / moist.length : null;
    const avgImp = imp.length ? imp.reduce((a, b) => a + b, 0) / imp.length : null;

    const now = new Date();
    const thisStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();
    const thisMonth = analyses.filter((a) => new Date(a.created_at).getTime() >= thisStart).length;
    const lastMonth = analyses.filter((a) => {
      const t = new Date(a.created_at).getTime();
      return t >= lastStart && t <= lastEnd;
    }).length;
    let trend = 0;
    if (lastMonth > 0) trend = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
    else if (thisMonth > 0) trend = 100;

    return {
      total: n,
      concluidas: nConc,
      canceladas: nCanc,
      pctConc: pct(nConc, n),
      pctCanc: pct(nCanc, n),
      avgMoist,
      avgImp,
      trend,
    };
  }, [enrichedAll, analyses]);

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

  function exportCsv() {
    const headers = [
      "Código análise (ANA-ORI)",
      "ID sequencial",
      "Amostra (AMO-ORI)",
      "Quadrante / detalhe",
      "Tipo biomassa",
      "Fornecedor",
      "Data entrada",
      "Status",
      "% Umidade",
      "Impureza %",
      "Responsável",
    ];
    const lines = filtered.map((e) =>
      [
        e.code,
        e.displayId,
        e.amostraCode,
        e.amostraDetalhe,
        e.biomassa,
        e.fornecedor,
        formatDatePt(e.entryDate),
        e.status,
        e.row.moisture ?? "",
        e.row.impurity ?? "",
        e.row.analyst ?? "",
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(";"),
    );
    const blob = new Blob([headers.join(";") + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "analises-realizadas.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectClass =
    "min-w-[140px] rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#143328] focus:ring-1 focus:ring-[#143328]/25";
  const periodInput = "rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm text-gray-800 outline-none focus:border-[#143328] focus:ring-1 focus:ring-[#143328]/25";

  return (
    <div className="min-h-screen bg-transparent pb-12 pt-8">
      <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
        <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: primary }}>
              Análises realizadas
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-gray-500">
              Lista alinhada ao cadastro atual: códigos <span className="font-medium text-gray-700">ANA-ORI-XXXX</span>, amostras{" "}
              <span className="font-medium text-gray-700">AMO-ORI-XXXX</span> com quadrante, tipo de biomassa e fornecedor gravados na análise.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/analises/nova"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105"
              style={{ backgroundColor: primary }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Nova análise
            </Link>
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              <svg className="h-4 w-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Exportar
            </button>
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

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-gray-100/80 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total de análises</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{kpis.total}</p>
                <p className={`mt-2 text-xs font-semibold ${kpis.trend >= 0 ? "" : "text-red-600"}`} style={kpis.trend >= 0 ? { color: lime } : undefined}>
                  {kpis.trend >= 0 ? "↑" : "↓"} {Math.abs(kpis.trend)}% vs mês anterior
                </p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <path d="M9 3h6v18H9zM12 7v10" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8 21h8" strokeLinecap="round" />
                </svg>
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-gray-100/80 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Concluídas</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{kpis.concluidas}</p>
                <p className="mt-2 text-xs font-semibold" style={{ color: lime }}>
                  {kpis.pctConc}% do total
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
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Canceladas</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{kpis.canceladas}</p>
                <p className="mt-2 text-xs font-semibold text-red-600">{kpis.pctCanc}% do total</p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600 ring-1 ring-red-100">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="m15 9-6 6M9 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-gray-100/80 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="grid flex-1 grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Média de umidade</p>
                  <p className="mt-2 text-xl font-bold text-gray-900">{kpis.avgMoist != null ? `${kpis.avgMoist.toFixed(2).replace(".", ",")}%` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Média do grau de impureza</p>
                  <p className="mt-2 text-xl font-bold text-gray-900">{kpis.avgImp != null ? `${kpis.avgImp.toFixed(2).replace(".", ",")}%` : "—"}</p>
                </div>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#8BC34A] ring-1 ring-emerald-100">
                <LeafIcon className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-xs text-gray-500">das análises concluídas</p>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-100/80 bg-white p-4 shadow-sm lg:flex-row lg:flex-wrap lg:items-end">
          <div className="relative min-w-[200px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="search"
              placeholder="Buscar por ANA-ORI, AMO-ORI, quadrante, biomassa, fornecedor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#143328] focus:ring-1 focus:ring-[#143328]/25"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">Status</span>
            <select className={selectClass} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option>Todos</option>
              <option>Concluída</option>
              <option>Cancelada</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">Período</span>
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" className={periodInput} value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} aria-label="Data inicial" />
              <span className="text-gray-400">—</span>
              <input type="date" className={periodInput} value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} aria-label="Data final" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500">Tipo de biomassa</span>
            <select className={`min-w-[200px] ${selectClass}`} value={filterBiomassa} onChange={(e) => setFilterBiomassa(e.target.value)}>
              {biomassaOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 lg:ml-auto lg:pb-0.5">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Filtros
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-100/80 bg-white shadow-sm">
          <p className="border-b border-gray-100 bg-gray-50/50 px-4 py-2 text-xs text-gray-600">
            Clique numa linha da tabela para ver todos os dados da análise.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/90">
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Código da análise</th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-600">
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setSortDateDesc((v) => !v);
                      }}
                      className="inline-flex items-center gap-1 font-semibold text-gray-600 hover:text-gray-900"
                    >
                      Data de entrada
                      <svg className={`h-3.5 w-3.5 transition ${sortDateDesc ? "" : "rotate-180"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Amostra</th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Tipo de biomassa</th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Fornecedor</th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Status</th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-600">% Umidade</th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Grau de impureza (%)</th>
                  <th className="px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Responsável</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center text-gray-500">
                      Carregando…
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center text-gray-500">
                      Nenhuma análise encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((e) => (
                    <tr
                      key={e.row.id}
                      role="link"
                      tabIndex={0}
                      className="cursor-pointer border-b border-gray-50 transition hover:bg-emerald-50/60"
                      onClick={() => router.push(`/analises/realizadas/${e.row.id}`)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" || ev.key === " ") {
                          ev.preventDefault();
                          router.push(`/analises/realizadas/${e.row.id}`);
                        }
                      }}
                    >
                      <td className="px-4 py-3.5">
                        <p className="font-mono text-sm font-bold tracking-tight text-gray-900">{e.code}</p>
                        <p className="text-xs text-gray-500">Ordem cronológica: #{e.displayId}</p>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">{formatDatePt(e.entryDate)}</td>
                      <td className="px-4 py-3.5">
                        <p className="font-mono text-sm font-medium text-gray-900">{e.amostraCode}</p>
                        <p className="text-xs text-gray-600">{e.amostraDetalhe}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-gray-800">
                          <span className="text-[#8BC34A]" aria-hidden>
                            <LeafIcon className="h-4 w-4 shrink-0" />
                          </span>
                          {e.biomassa}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-gray-800">{e.fornecedor}</td>
                      <td className="px-4 py-3.5">
                        <AnalysisStatusBadge status={e.status} />
                      </td>
                      <td className="px-4 py-3.5 text-gray-800">{formatPct(e.row.moisture, e.status === "Cancelada")}</td>
                      <td className="px-4 py-3.5 text-gray-800">{formatPct(e.row.impurity, e.status === "Cancelada")}</td>
                      <td className="px-4 py-3.5 text-gray-800">{e.row.analyst ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 border-t border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Mostrando {total === 0 ? 0 : sliceStart + 1} a {Math.min(sliceStart + pageSize, total)} de {total} análises
            </p>
            <nav className="flex flex-wrap items-center justify-center gap-1" aria-label="Paginação">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage(1)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
                aria-label="Primeira página"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="m11 18-6-6 6-6M21 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
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
                    className={`flex h-9 min-w-[2.25rem] items-center justify-center rounded-full px-2 text-sm font-semibold transition ${
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
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(totalPages)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
                aria-label="Última página"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="m13 18 6-6-6-6M3 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
