"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { fetchLabAnalysesList, type LabAnalysisRow } from "@/lib/lab-analyses-query";
import { supabase } from "@/lib/supabase";
import { statusDbToAtivoInativo, type SupplierRow } from "./fornecedores/_fornecedor-utils";

const primary = "#143328";
const lime = "#8BC34A";

type SampleRow = { id: string; created_at: string };

function defaultPeriodRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

function rowEntryDate(a: LabAnalysisRow): Date | null {
  const s = a.analysis_date || a.created_at;
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inPeriod(d: Date | null, from: string, to: string): boolean {
  if (!d || !from || !to) return true;
  const t = d.getTime();
  const f = new Date(`${from}T00:00:00`).getTime();
  const e = new Date(`${to}T23:59:59.999`).getTime();
  return t >= f && t <= e;
}

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

function analysisDisplayCode(row: LabAnalysisRow, rank: number): string {
  const y = new Date(row.analysis_date || row.created_at).getFullYear();
  const fromNotes = parseCodigoNotes(row.notes);
  return (
    (row.analysis_code && row.analysis_code.trim()) ||
    fromNotes ||
    `AN-${y}-${String(rank).padStart(4, "0")}`
  );
}

function biomassaName(row: LabAnalysisRow): string {
  return row.biomass_types?.name ?? "—";
}

function fornecedorName(row: LabAnalysisRow): string {
  return row.suppliers?.name ?? "—";
}

function amostraCode(row: LabAnalysisRow): string {
  const sample = row.lab_samples;
  const fromNotes = parseAmostraCodigoNotes(row.notes);
  return sample?.code?.trim() || fromNotes || "—";
}

function analysisConcluida(a: LabAnalysisRow): boolean {
  return a.moisture != null || a.impurity != null;
}

function analysisCancelada(a: LabAnalysisRow): boolean {
  return !!(a.notes && /cancelad|cancel|anulad/i.test(a.notes));
}

function qualityScore(a: LabAnalysisRow): number | null {
  const parts: number[] = [];
  if (a.moisture != null) parts.push(Math.max(0, 100 - Math.abs(a.moisture - 12) * 3));
  if (a.impurity != null) parts.push(Math.max(0, 100 - a.impurity * 5));
  if (a.ash != null) parts.push(Math.max(0, 100 - a.ash * 2));
  if (parts.length === 0) return null;
  return parts.reduce((s, p) => s + p, 0) / parts.length;
}

function formatPt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function DonutChart({
  segments,
  center,
}: {
  segments: { pct: number; color: string }[];
  center: ReactNode;
}) {
  const total = segments.reduce((s, x) => s + x.pct, 0);
  const norm =
    total <= 0 ?
      [{ pct: 100, color: "#e5e7eb" }]
    : segments.map((x) => ({ ...x, pct: (x.pct / total) * 100 }));
  let acc = 0;
  const stops = norm.map((seg) => {
    const start = acc;
    acc += seg.pct;
    return `${seg.color} ${start}% ${acc}%`;
  });
  return (
    <div className="relative mx-auto h-44 w-44 shrink-0">
      <div
        className="absolute inset-0 rounded-full shadow-inner ring-1 ring-gray-100"
        style={{ background: `conic-gradient(${stops.join(",")})` }}
      />
      <div className="absolute inset-[24%] flex flex-col items-center justify-center rounded-full bg-white shadow-sm">
        {center}
      </div>
    </div>
  );
}

function LineTrendChart({ points }: { points: { label: string; value: number }[] }) {
  const w = 360;
  const h = 160;
  const pad = 12;
  const maxV = Math.max(1, ...points.map((p) => p.value));
  const pts = points.map((p, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
    const y = h - pad - (p.value / maxV) * (h - pad * 2);
    return `${x},${y}`;
  });
  const poly = pts.join(" ");
  const area = `0,${h} ${poly} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-48 w-full max-w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="dashLineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lime} stopOpacity="0.35" />
          <stop offset="100%" stopColor={lime} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#dashLineFill)" />
      <polyline points={poly} fill="none" stroke={lime} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => {
        const x = pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
        const y = h - pad - (p.value / maxV) * (h - pad * 2);
        return <circle key={p.label} cx={x} cy={y} r="4" fill="white" stroke={lime} strokeWidth="2" />;
      })}
    </svg>
  );
}

function GaugeChart({ value }: { value: number }) {
  const r = 78;
  const len = Math.PI * r;
  const clamped = Math.min(100, Math.max(0, value));
  const offset = len * (1 - clamped / 100);
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 118" className="h-32 w-56" aria-hidden>
        <path
          d="M 22 100 A 78 78 0 0 1 178 100"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M 22 100 A 78 78 0 0 1 178 100"
          fill="none"
          stroke={lime}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <p className="-mt-2 text-2xl font-bold tabular-nums text-gray-900">{clamped.toFixed(1).replace(".", ",")}%</p>
    </div>
  );
}

function HorizontalBars({ rows }: { rows: { label: string; value: number; pct: number }[] }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">Sem dados no período.</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between text-xs text-gray-600">
            <span className="max-w-[70%] truncate font-medium text-gray-800">{r.label}</span>
            <span className="tabular-nums text-gray-500">{r.value}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full transition-all" style={{ width: `${r.pct}%`, backgroundColor: primary }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function KpiCard({
  title,
  value,
  sub,
  trend,
  href,
}: {
  title: string;
  value: string | number;
  sub?: string;
  trend?: { text: string; up?: boolean };
  href?: string;
}) {
  const inner = (
    <div className="rounded-xl border border-gray-100/90 bg-white p-5 shadow-sm transition hover:shadow-md">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-gray-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-gray-500">{sub}</p> : null}
      {trend ? (
        <p className={`mt-2 text-xs font-semibold ${trend.up === false ? "text-red-600" : ""}`} style={trend.up !== false ? { color: lime } : undefined}>
          {trend.text}
        </p>
      ) : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[#143328]/30">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default function DashboardPage() {
  const [analyses, setAnalyses] = useState<LabAnalysisRow[]>([]);
  const [samples, setSamples] = useState<SampleRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [biomassCount, setBiomassCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");

  useEffect(() => {
    const { from, to } = defaultPeriodRange();
    setPeriodFrom(from);
    setPeriodTo(to);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const [aRes, sRes, supRes, bioRes] = await Promise.all([
        fetchLabAnalysesList(supabase),
        supabase.from("lab_samples").select("id, created_at").order("created_at", { ascending: false }).limit(8000),
        supabase.from("suppliers").select("id, name, status, created_at"),
        supabase.from("biomass_types").select("id", { count: "exact", head: true }),
      ]);
      if (aRes.error) setLoadErr(aRes.error);
      setAnalyses(aRes.data ?? []);
      if (!sRes.error && sRes.data) setSamples(sRes.data as SampleRow[]);
      else setSamples([]);
      if (!supRes.error && supRes.data) setSuppliers(supRes.data as SupplierRow[]);
      else setSuppliers([]);
      setBiomassCount(typeof bioRes.count === "number" ? bioRes.count : 0);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Erro ao carregar o painel.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const rankMap = useMemo(() => {
    const copy = [...analyses];
    copy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const m = new Map<string, number>();
    copy.forEach((row, i) => m.set(row.id, i + 1));
    return m;
  }, [analyses]);

  const analysesInPeriod = useMemo(() => {
    return analyses.filter((a) => inPeriod(rowEntryDate(a), periodFrom, periodTo));
  }, [analyses, periodFrom, periodTo]);

  const samplesInPeriod = useMemo(() => {
    return samples.filter((s) => {
      const d = new Date(s.created_at);
      return inPeriod(d, periodFrom, periodTo);
    });
  }, [samples, periodFrom, periodTo]);

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => statusDbToAtivoInativo(s) === "ativo").length,
    [suppliers],
  );

  const kpiAmostras = samplesInPeriod.length;
  const kpiAnalisesConc = analysesInPeriod.filter(analysisConcluida).length;
  const kpiAnalisesTotal = analysesInPeriod.length;
  const pctConc =
    kpiAnalisesTotal === 0 ? "0,0" : ((kpiAnalisesConc / kpiAnalisesTotal) * 100).toFixed(1).replace(".", ",");

  const scores = useMemo(() => {
    return analysesInPeriod.map(qualityScore).filter((x): x is number => x != null);
  }, [analysesInPeriod]);
  const avgQuality = scores.length === 0 ? null : scores.reduce((a, b) => a + b, 0) / scores.length;

  const amostrasStatus = useMemo(() => {
    const conc = analysesInPeriod.filter((a) => analysisConcluida(a) && !analysisCancelada(a)).length;
    const canc = analysesInPeriod.filter(analysisCancelada).length;
    const em = Math.max(0, analysesInPeriod.length - conc - canc);
    return [
      { key: "Concluídas", value: conc, color: lime },
      { key: "Em andamento", value: em, color: "#EAB308" },
      { key: "Canceladas", value: canc, color: "#EF4444" },
    ];
  }, [analysesInPeriod]);

  const linePoints = useMemo(() => {
    const map = new Map<string, number>();
    analysesInPeriod.forEach((a) => {
      const d = rowEntryDate(a);
      if (!d || !analysisConcluida(a)) return;
      const key = d.toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    const from = new Date(periodFrom + "T00:00:00");
    const to = new Date(periodTo + "T23:59:59");
    const pts: { label: string; value: number }[] = [];
    for (let t = from.getTime(); t <= to.getTime(); t += 86400000) {
      const key = new Date(t).toISOString().slice(0, 10);
      pts.push({ label: key, value: map.get(key) ?? 0 });
    }
    if (pts.length > 45) {
      const step = Math.ceil(pts.length / 30);
      return pts.filter((_, i) => i % step === 0);
    }
    return pts;
  }, [analysesInPeriod, periodFrom, periodTo]);

  const biomassDonut = useMemo(() => {
    const m = new Map<string, number>();
    analysesInPeriod.forEach((a) => {
      const b = biomassaName(a);
      if (b === "—") return;
      m.set(b, (m.get(b) ?? 0) + 1);
    });
    const entries = [...m.entries()].sort((a, b) => b[1] - a[1]);
    const colors = ["#143328", "#1F7A63", "#8BC34A", "#A3D977", "#C8E6C9", "#94a3b8"];
    const total = entries.reduce((s, [, v]) => s + v, 0);
    return entries.slice(0, 6).map(([label, value], i) => ({
      label,
      value,
      pct: total ? (value / total) * 100 : 0,
      color: colors[i % colors.length],
    }));
  }, [analysesInPeriod]);

  const supplierBars = useMemo(() => {
    const m = new Map<string, number>();
    analysesInPeriod.forEach((a) => {
      const name = fornecedorName(a);
      if (name === "—") return;
      m.set(name, (m.get(name) ?? 0) + 1);
    });
    const top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = Math.max(1, ...top.map(([, v]) => v));
    return top.map(([label, value]) => ({ label, value, pct: (value / max) * 100 }));
  }, [analysesInPeriod]);

  const conformidade = useMemo(() => {
    let conf = 0;
    let aten = 0;
    let nconf = 0;
    analysesInPeriod.forEach((a) => {
      const q = qualityScore(a);
      if (q == null) return;
      if (q >= 90) conf += 1;
      else if (q >= 70) aten += 1;
      else nconf += 1;
    });
    return [
      { key: "Conforme", value: conf, color: lime },
      { key: "Atenção", value: aten, color: "#EAB308" },
      { key: "Não conforme", value: nconf, color: "#EF4444" },
    ];
  }, [analysesInPeriod]);

  const ultimasAnalises = useMemo(() => {
    const sorted = [...analysesInPeriod].sort((a, b) => {
      const ta = rowEntryDate(a)?.getTime() ?? 0;
      const tb = rowEntryDate(b)?.getTime() ?? 0;
      return tb - ta;
    });
    return sorted.slice(0, 5);
  }, [analysesInPeriod]);

  return (
    <main className="min-h-screen bg-transparent px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">Resumo geral da plataforma</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
              <label className="sr-only" htmlFor="dash-from">
                De
              </label>
              <input
                id="dash-from"
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                className="rounded border border-gray-200 bg-gray-50/80 px-2 py-1 text-xs text-gray-800 outline-none focus:border-[#143328]"
              />
              <span className="text-xs text-gray-400">a</span>
              <label className="sr-only" htmlFor="dash-to">
                Até
              </label>
              <input
                id="dash-to"
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                className="rounded border border-gray-200 bg-gray-50/80 px-2 py-1 text-xs text-gray-800 outline-none focus:border-[#143328]"
              />
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Filtros
            </button>
            <button
              type="button"
              onClick={() => void loadAll()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-105 disabled:opacity-60"
              style={{ backgroundColor: primary }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" strokeLinecap="round" />
                <path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" strokeLinecap="round" />
                <path d="M21 21v-5h-5" strokeLinecap="round" />
              </svg>
              {loading ? "A atualizar…" : "Atualizar"}
            </button>
          </div>
        </header>

        {loadErr ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Alguns dados não carregaram: {loadErr}
          </p>
        ) : null}

        {/* KPIs */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard title="Amostras realizadas" value={loading ? "—" : kpiAmostras} sub="No período selecionado" trend={{ text: "Registos em laboratório", up: true }} href="/coletas" />
          <KpiCard
            title="Análises concluídas"
            value={loading ? "—" : kpiAnalisesConc}
            sub={`${pctConc}% do total no período`}
            trend={{ text: `${kpiAnalisesTotal} análises no período`, up: true }}
            href="/analises/realizadas"
          />
          <KpiCard title="Fornecedores" value={loading ? "—" : activeSuppliers} sub="Ativos na plataforma" href="/fornecedores/cadastrados" />
          <KpiCard title="Tipos de biomassa" value={loading ? "—" : biomassCount} sub="Cadastrados em configurações" href="/configuracoes" />
          <KpiCard
            title="Qualidade média"
            value={loading || avgQuality == null ? "—" : `${avgQuality.toFixed(1).replace(".", ",")}%`}
            sub={avgQuality != null && avgQuality >= 90 ? "Ótima" : avgQuality != null && avgQuality >= 70 ? "Boa" : avgQuality != null ? "Regular" : "Sem métricas suficientes"}
            trend={avgQuality != null ? { text: "Indicador sintético (humidade, cinzas…)", up: avgQuality >= 85 } : undefined}
            href="/classificacao"
          />
        </div>

        {/* Gráficos — linha 1 */}
        <div className="mb-6 grid gap-6 lg:grid-cols-3">
          <section className="rounded-xl border border-gray-100/90 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Amostras por status</h2>
            <p className="mb-4 text-xs text-gray-500">Baseado nas análises do período (concluídas / em curso / canceladas).</p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <DonutChart
                segments={amostrasStatus.map((s) => ({ pct: s.value, color: s.color }))}
                center={
                  <>
                    <span className="text-2xl font-bold text-gray-900">{loading ? "—" : analysesInPeriod.length}</span>
                    <span className="text-xs text-gray-500">Total</span>
                  </>
                }
              />
              <ul className="space-y-2 text-sm">
                {amostrasStatus.map((s) => (
                  <li key={s.key} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-gray-700">{s.key}</span>
                    <span className="ml-auto tabular-nums text-gray-500">{s.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="rounded-xl border border-gray-100/90 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Análises concluídas por período</h2>
              <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600">Diário</span>
            </div>
            <LineTrendChart points={linePoints} />
            <p className="mt-2 text-center text-xs text-gray-400">Volume diário de análises com resultado no período</p>
          </section>
        </div>

        {/* Gráficos — linha 2 + gauge */}
        <div className="mb-6 grid gap-6 lg:grid-cols-3">
          <section className="rounded-xl border border-gray-100/90 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Qualidade de amostragem</h2>
            <p className="mb-2 text-xs text-gray-500">Média dos indicadores disponíveis (humidade, impurezas, cinzas).</p>
            {avgQuality == null ?
              <p className="py-10 text-center text-sm text-gray-500">Sem dados de qualidade no período.</p>
            : <GaugeChart value={avgQuality} />}
            <ul className="mt-4 space-y-1.5 text-xs text-gray-600">
              <li>
                <span className="font-semibold" style={{ color: lime }}>
                  Ótima
                </span>{" "}
                (≥ 90%)
              </li>
              <li>
                <span className="font-semibold text-amber-600">Boa</span> (70–89%)
              </li>
              <li>
                <span className="font-semibold text-orange-600">Regular</span> (50–69%)
              </li>
              <li>
                <span className="font-semibold text-red-600">Ruim</span> (&lt; 50%)
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-gray-100/90 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Amostras por tipo de biomassa</h2>
            <p className="mb-4 text-xs text-gray-500">Distribuição das análises no período.</p>
            {biomassDonut.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">Sem análises com tipo identificado.</p>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <DonutChart
                  segments={biomassDonut.map((b) => ({ pct: b.value, color: b.color }))}
                  center={
                    <>
                      <span className="text-lg font-bold text-gray-900">{biomassDonut[0]?.pct.toFixed(0) ?? 0}%</span>
                      <span className="max-w-[5rem] truncate text-[10px] leading-tight text-gray-500">{biomassDonut[0]?.label}</span>
                    </>
                  }
                />
                <ul className="max-h-44 space-y-1.5 overflow-y-auto text-xs">
                  {biomassDonut.map((b) => (
                    <li key={b.label} className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: b.color }} />
                      <span className="max-w-[10rem] truncate text-gray-700">{b.label}</span>
                      <span className="ml-auto tabular-nums text-gray-500">{b.pct.toFixed(1).replace(".", ",")}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-100/90 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Amostras por fornecedor</h2>
            <p className="mb-4 text-xs text-gray-500">Top 5 fornecedores por volume de análises no período.</p>
            <HorizontalBars rows={supplierBars} />
          </section>
        </div>

        {/* Conformidade + tabela */}
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-xl border border-gray-100/90 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Análises por status de conformidade</h2>
            <p className="mb-4 text-xs text-gray-500">Com base no score estimado (90 / 70 limiares).</p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <DonutChart
                segments={conformidade.map((c) => ({ pct: c.value, color: c.color }))}
                center={
                  <>
                    <span className="text-xl font-bold text-gray-900">
                      {(() => {
                        const t = conformidade.reduce((s, x) => s + x.value, 0);
                        if (t === 0) return "—";
                        const p = (conformidade[0].value / t) * 100;
                        return `${p.toFixed(0)}%`;
                      })()}
                    </span>
                    <span className="text-xs text-gray-500">Conforme</span>
                  </>
                }
              />
              <ul className="space-y-2 text-sm">
                {conformidade.map((c) => (
                  <li key={c.key} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="text-gray-700">{c.key}</span>
                    <span className="ml-auto tabular-nums text-gray-500">{c.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="rounded-xl border border-gray-100/90 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Últimas análises concluídas</h2>
              <Link href="/analises/realizadas" className="text-xs font-semibold hover:underline" style={{ color: primary }}>
                Ver todas
              </Link>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full min-w-[560px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/90">
                    <th className="px-3 py-2.5 font-semibold text-gray-600">Código</th>
                    <th className="px-3 py-2.5 font-semibold text-gray-600">Amostra</th>
                    <th className="px-3 py-2.5 font-semibold text-gray-600">Biomassa</th>
                    <th className="px-3 py-2.5 font-semibold text-gray-600">Fornecedor</th>
                    <th className="px-3 py-2.5 font-semibold text-gray-600">Data</th>
                    <th className="px-3 py-2.5 font-semibold text-gray-600">Qualidade</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-gray-500">
                        A carregar…
                      </td>
                    </tr>
                  ) : ultimasAnalises.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-gray-500">
                        Nenhuma análise no período.
                      </td>
                    </tr>
                  ) : (
                    ultimasAnalises.map((row) => {
                      const q = qualityScore(row);
                      const rank = rankMap.get(row.id) ?? 0;
                      const code = analysisDisplayCode(row, rank);
                      const conf = q == null ? "—" : q >= 90 ? "Ótima" : q >= 70 ? "Boa" : "Regular";
                      const pillClass =
                        q == null ?
                          "bg-gray-100 text-gray-600"
                        : q >= 90 ?
                          "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100"
                        : q >= 70 ?
                          "bg-amber-50 text-amber-900 ring-1 ring-amber-100"
                        : "bg-orange-50 text-orange-900 ring-1 ring-orange-100";
                      return (
                        <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                          <td className="px-3 py-2.5 font-medium text-gray-900">
                            <Link href={`/analises/realizadas/${row.id}`} className="hover:underline" style={{ color: primary }}>
                              {code}
                            </Link>
                          </td>
                          <td className="max-w-[120px] truncate px-3 py-2.5 text-gray-700">{amostraCode(row)}</td>
                          <td className="max-w-[100px] truncate px-3 py-2.5 text-gray-700">{biomassaName(row)}</td>
                          <td className="max-w-[120px] truncate px-3 py-2.5 text-gray-700">{fornecedorName(row)}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">{formatPt(row.analysis_date || row.created_at)}</td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${pillClass}`}>
                              {q == null ? "—" : `${q.toFixed(1).replace(".", ",")}%`}
                            </span>
                            <span className="ml-1 text-[10px] text-gray-400">{conf}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {analysisCancelada(row) ?
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-600" title="Cancelada">
                                ×
                              </span>
                            : analysisConcluida(row) ?
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600" title="Concluída">
                                ✓
                              </span>
                            :
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-amber-600" title="Em curso">
                                …
                              </span>
                            }
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-right">
              <Link
                href="/analises/realizadas"
                className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                style={{ color: primary }}
              >
                Ver todas as análises
                <span aria-hidden>→</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
