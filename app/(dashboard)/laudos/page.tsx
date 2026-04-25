"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatAcceptableLimitCell,
  PARAM_DEFS,
  valueConformsToConfiguredLimits,
  type AnalysisLabField,
} from "@/lib/analysis-params";
import { fetchLabAnalysesList, type LabAnalysisRow } from "@/lib/lab-analyses-query";
import { supabase } from "@/lib/supabase";

const primary = "#143328";
const lime = "#8BC34A";

type AcceptableLimitRow = {
  biomass_type_id: string;
  parameter_key: string;
  unit: string;
  limit_min: string | null;
  limit_max: string | null;
};

type BiomassTypeRow = { id: string; name: string };

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

function parseLaboratorioNotes(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/Laboratório:\s*([^\n]+)/i);
  return m?.[1]?.trim() || null;
}

/** Extrai método gravado nas notas (formato da tela Nova análise). */
function parseMethodFromNotes(notes: string | null, label: string): string | null {
  if (!notes) return null;
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${esc}\\s*\\([^)]+\\):\\s*[\\d.,]+\\s*—\\s*Método:\\s*([^\\n]+)`, "i");
  const m = notes.match(re);
  return m?.[1]?.trim() ?? null;
}

function formatDatePt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTimePt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtResult(n: number | null | undefined, unit: string): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const s = n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
  return unit === "%" ? `${s.replace(".", ",")} %` : `${s.replace(".", ",")} ${unit}`.trim();
}

function analysisDisplayCode(row: LabAnalysisRow): string {
  const fromNotes = parseCodigoNotes(row.notes);
  return (row.analysis_code && row.analysis_code.trim()) || fromNotes || "—";
}

function laudoNumber(row: LabAnalysisRow): string {
  const y = new Date(row.analysis_date || row.created_at).getFullYear();
  const ac = analysisDisplayCode(row);
  const m = ac.match(/(\d{4})\s*$/);
  const suffix = m ? m[1] : String(Math.abs(hashId(row.id)) % 10000).padStart(4, "0");
  return `LN-${y}-${suffix}`;
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i);
  return h;
}

function getRowValue(row: LabAnalysisRow, field: AnalysisLabField): number | null {
  if (field === "extra_carbono") return null;
  const v = row[field as keyof LabAnalysisRow];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function analystNameOnly(analyst: string | null): string {
  if (!analyst?.trim()) return "—";
  const parts = analyst.split("—");
  return parts[0]?.trim() || analyst.trim();
}

function analystReg(analyst: string | null): string | null {
  if (!analyst?.trim()) return null;
  const parts = analyst.split("—");
  const rest = parts.slice(1).join("—").trim();
  return rest || null;
}

export default function LaudosPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] bg-transparent px-6 py-10 text-gray-500">A carregar laudos…</div>
      }
    >
      <LaudosPageInner />
    </Suspense>
  );
}

function LaudosPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docRef = useRef<HTMLDivElement>(null);

  const [rows, setRows] = useState<LabAnalysisRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listErr, setListErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [limits, setLimits] = useState<AcceptableLimitRow[]>([]);
  const [biomassTypes, setBiomassTypes] = useState<BiomassTypeRow[]>([]);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setListErr(null);
    const { data, error } = await fetchLabAnalysesList(supabase);
    setLoadingList(false);
    if (error) {
      setListErr(error);
      setRows([]);
      return;
    }
    setRows(data);
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    (async () => {
      const [l, b] = await Promise.all([
        supabase.from("acceptable_limits").select("biomass_type_id, parameter_key, unit, limit_min, limit_max"),
        supabase.from("biomass_types").select("id, name"),
      ]);
      if (!l.error && l.data) setLimits(l.data as AcceptableLimitRow[]);
      if (!b.error && b.data) setBiomassTypes(b.data as BiomassTypeRow[]);
    })();
  }, []);

  const qId = searchParams.get("analise") ?? "";
  useEffect(() => {
    if (qId && rows.some((r) => r.id === qId)) setSelectedId(qId);
  }, [qId, rows]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const biomassTypeId = useMemo(() => {
    if (!selected) return null;
    const name = selected.biomass_types?.name ?? null;
    if (!name) return null;
    return biomassTypes.find((b) => b.name === name)?.id ?? null;
  }, [selected, biomassTypes]);

  const limitsForBio = useMemo(() => {
    if (!biomassTypeId) return [];
    return limits.filter((x) => x.biomass_type_id === biomassTypeId);
  }, [limits, biomassTypeId]);

  const emissionDate = useMemo(() => {
    if (!selected) return new Date();
    const d = new Date(selected.analysis_date || selected.created_at);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [selected]);

  const laudoCode = selected ? laudoNumber(selected) : "";
  const analysisCode = selected ? analysisDisplayCode(selected) : "";
  const sampleCode =
    selected?.lab_samples?.code?.trim() || (selected ? parseAmostraCodigoNotes(selected.notes) : null) || "—";
  const quadrante = selected?.lab_samples?.quadrant?.trim() || (selected ? parseQuadranteNotes(selected.notes) : null) || "—";
  const biomassa = selected?.biomass_types?.name ?? "—";
  const fornecedor = selected?.suppliers?.name ?? "—";
  const coletaLabel = "—";
  const laboratorio = selected ? parseLaboratorioNotes(selected.notes) ?? "Laboratório ORIGEN" : "Laboratório ORIGEN";
  const responsavel = selected ? analystNameOnly(selected.analyst) : "—";
  const regProf = selected ? analystReg(selected.analyst) : null;

  const paramRows = useMemo(() => {
    if (!selected) return [];
    const notes = selected.notes;
    return PARAM_DEFS.map((def) => {
      const val = getRowValue(selected, def.field);
      const lim = limitsForBio.find((l) => l.parameter_key === def.id);
      const limitCell = lim
        ? formatAcceptableLimitCell(lim.limit_min, lim.limit_max, lim.unit, def.defaultLimitDisplay)
        : def.defaultLimitDisplay;
      const method = parseMethodFromNotes(notes, def.label) ?? def.defaultMethod;
      let conform: boolean | null = null;
      if (val != null && lim) {
        conform = valueConformsToConfiguredLimits(val, lim.limit_min, lim.limit_max);
      }
      return { def, val, limitCell, method, conform };
    });
  }, [selected, limitsForBio]);

  const allConform = useMemo(() => {
    const checks = paramRows.map((r) => r.conform).filter((c): c is boolean => c === true || c === false);
    if (checks.length === 0) return true;
    return checks.every((c) => c);
  }, [paramRows]);

  const totalParams = paramRows.filter((r) => r.val != null).length;

  function syncUrl(id: string) {
    const u = new URL(window.location.href);
    if (id) u.searchParams.set("analise", id);
    else u.searchParams.delete("analise");
    router.replace(`${u.pathname}?${u.searchParams.toString()}`, { scroll: false });
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    syncUrl(id);
  }

  function printDocument() {
    window.print();
  }

  function downloadPdfHint() {
    printDocument();
  }

  const historyEvents = useMemo(() => {
    if (!selected) return [];
    const base = selected.analysis_date || selected.created_at;
    const t0 = new Date(base).getTime();
    return [
      { label: "Laudo gerado", actor: "Sistema", at: new Date(t0) },
      { label: "Dados da análise", actor: responsavel !== "—" ? responsavel : "Laboratório", at: new Date(t0 + 120_000) },
      { label: "Laudo disponível para emissão", actor: responsavel !== "—" ? responsavel : "Sistema", at: new Date(t0 + 300_000) },
    ];
  }, [selected, responsavel]);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
@media print {
  aside[class*="fixed"], aside.fixed { display: none !important; }
  main.ml-72 { margin-left: 0 !important; background: #fff !important; }
  .laudo-no-print { display: none !important; }
  .laudo-print-only { display: block !important; }
  .laudo-doc-shadow { box-shadow: none !important; border: none !important; }
}
`,
        }}
      />

      <div className="min-h-screen bg-transparent pb-24 pt-6">
        <div className="mx-auto max-w-[1600px] px-6 lg:px-10">
          <header className="laudo-no-print mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight lg:text-3xl" style={{ color: primary }}>
                Laudos
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Laudos <span className="text-gray-400">›</span>{" "}
                <span className="font-medium text-gray-700">{selected ? laudoCode : "Selecionar análise"}</span>
              </p>
              <p className="mt-2 max-w-2xl text-sm text-gray-600">
                Escolha uma análise laboratorial já registada (mesmos dados de <strong>Análises</strong> e amostras). O laudo é montado
                automaticamente; use <strong>Baixar PDF</strong> ou <strong>Imprimir</strong> e guarde como PDF no navegador.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!selected}
                onClick={downloadPdfHint}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Baixar PDF
              </button>
              <button
                type="button"
                disabled={!selected}
                onClick={printDocument}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: primary }}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Imprimir
              </button>
              <Link
                href="/analises/realizadas"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition hover:bg-gray-50"
              >
                Ver análises
              </Link>
            </div>
          </header>

          <div className="laudo-no-print mb-6 max-w-xl">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-600">Análise / amostra</label>
            <select
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none focus:border-[#143328] focus:ring-1 focus:ring-[#143328]/25"
              value={selectedId}
              onChange={(e) => handleSelect(e.target.value)}
              disabled={loadingList}
            >
              <option value="">{loadingList ? "A carregar…" : "Selecione uma análise realizada"}</option>
              {rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {analysisDisplayCode(r)} — {r.lab_samples?.code ?? parseAmostraCodigoNotes(r.notes) ?? "Amostra"} —{" "}
                  {formatDatePt(r.analysis_date || r.created_at)}
                </option>
              ))}
            </select>
            {listErr ? <p className="mt-2 text-sm text-red-600">{listErr}</p> : null}
          </div>

          {!selected ? (
            <div className="laudo-no-print rounded-xl border border-dashed border-gray-300 bg-white/80 p-12 text-center text-gray-500">
              Selecione uma análise para pré-visualizar o laudo.
            </div>
          ) : (
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
              <div ref={docRef} id="laudo-print-root" className="laudo-doc-shadow min-w-0 flex-1 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10">
                <header className="mb-8 flex flex-col gap-6 border-b border-gray-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <img src="/logo-origen.png?v=logo2" alt="ORIGEN" className="h-14 w-auto object-contain" width={140} height={56} />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Laudo de análise</p>
                      <p className="font-mono text-lg font-bold text-gray-900">{laudoCode}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-1 gap-1 text-right text-sm sm:text-right">
                    <div>
                      <dt className="inline text-gray-500">Data de emissão: </dt>
                      <dd className="inline font-medium text-gray-900">{formatDatePt(emissionDate.toISOString())}</dd>
                    </div>
                    <div>
                      <dt className="inline text-gray-500">Versão: </dt>
                      <dd className="inline font-medium text-gray-900">1.0</dd>
                    </div>
                    <div>
                      <dt className="inline text-gray-500">Análise ref.: </dt>
                      <dd className="inline font-mono font-medium text-gray-900">{analysisCode}</dd>
                    </div>
                  </dl>
                </header>

                <section className="mb-8">
                  <h2 className="mb-4 border-b border-gray-200 pb-2 text-sm font-bold uppercase tracking-wide text-gray-800">
                    1. Identificação da amostra
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DocField label="Amostra" value={sampleCode} />
                    <DocField label="Tipo de biomassa" value={biomassa} icon="leaf" />
                    <DocField label="Fornecedor" value={fornecedor} />
                    <DocField label="Coleta / logística" value={coletaLabel} />
                    <DocField label="Data de entrada" value={formatDatePt(selected.analysis_date || selected.created_at)} />
                    <DocField label="Laboratório" value={laboratorio} />
                    <DocField label="Responsável" value={responsavel} />
                    <DocField label="Data da análise" value={formatDatePt(selected.analysis_date)} />
                    <DocField label="Quadrante / detalhe" value={quadrante} />
                    <DocField label="Objetivo" value="Caracterização da amostra e verificação de conformidade com limites técnicos." />
                  </div>
                </section>

                <section className="mb-8">
                  <h2 className="mb-4 border-b border-gray-200 pb-2 text-sm font-bold uppercase tracking-wide text-gray-800">
                    2. Resultados da análise
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                          <th className="px-3 py-2">Parâmetro</th>
                          <th className="px-3 py-2">Resultado</th>
                          <th className="px-3 py-2">Unidade</th>
                          <th className="px-3 py-2">Método</th>
                          <th className="px-3 py-2">Limites aceitáveis</th>
                          <th className="px-3 py-2">Conformidade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paramRows.map(({ def, val, limitCell, method, conform }) => (
                          <tr key={def.id} className="border-b border-gray-100">
                            <td className="px-3 py-2.5 font-medium text-gray-900">{def.label}</td>
                            <td className="px-3 py-2.5 text-gray-800">{val != null ? fmtResult(val, def.unit) : "—"}</td>
                            <td className="px-3 py-2.5 text-gray-600">{def.unit}</td>
                            <td className="px-3 py-2.5 text-gray-600">{method}</td>
                            <td className="px-3 py-2.5 text-gray-600">{limitCell}</td>
                            <td className="px-3 py-2.5">
                              {val == null ? (
                                <span className="text-gray-400">—</span>
                              ) : conform === null ? (
                                <span className="text-gray-500">N/A</span>
                              ) : conform ? (
                                <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                  Conforme
                                </span>
                              ) : (
                                <span className="font-medium text-red-700">Não conforme</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-xs text-gray-500">Resultados válidos apenas para a amostra analisada.</p>
                </section>

                <section className="mb-10">
                  <h2 className="mb-3 border-b border-gray-200 pb-2 text-sm font-bold uppercase tracking-wide text-gray-800">3. Conclusão</h2>
                  <p className="text-sm leading-relaxed text-gray-800">
                    Com base nos resultados apresentados, a amostra <strong>{sampleCode}</strong> encontra-se{" "}
                    <strong>{allConform ? "em conformidade" : "com parâmetros fora dos limites configurados"}</strong> com os limites
                    aceitáveis definidos para o tipo de biomassa <strong>{biomassa}</strong>, quando aplicável. Este documento integra os
                    dados registados na plataforma ORIGEN para a análise <span className="font-mono">{analysisCode}</span>.
                  </p>
                </section>

                <footer className="flex flex-col gap-8 border-t border-gray-200 pt-8 sm:flex-row sm:justify-between">
                  <div>
                    <p className="font-serif text-2xl italic text-gray-800">{responsavel !== "—" ? responsavel : "Responsável técnico"}</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">{responsavel}</p>
                    <p className="text-xs text-gray-500">Responsável técnica / analista</p>
                    {regProf ? <p className="mt-1 text-xs text-gray-600">{regProf}</p> : null}
                  </div>
                  <div className="max-w-sm text-right text-xs leading-relaxed text-gray-600">
                    <p className="font-semibold text-gray-800">{laboratorio}</p>
                    <p>Rua da Biomassa, 100 — São Paulo, SP</p>
                    <p>CNPJ 00.000.000/0001-00 · contato@origen.com.br</p>
                    <p>(11) 3000-0000</p>
                  </div>
                </footer>
              </div>

              <aside className="laudo-no-print w-full shrink-0 space-y-4 xl:w-[320px]">
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">Resumo do laudo</h3>
                  <dl className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">Código</dt>
                      <dd className="font-mono font-medium text-gray-900">{laudoCode}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">Estado</dt>
                      <dd>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">
                          Concluído
                        </span>
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">Emissão</dt>
                      <dd className="text-gray-800">{formatDatePt(emissionDate.toISOString())}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">Amostra</dt>
                      <dd className="text-right font-mono text-gray-900">{sampleCode}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">Fornecedor</dt>
                      <dd className="max-w-[12rem] truncate text-right text-gray-800" title={fornecedor}>
                        {fornecedor}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">Laboratório</dt>
                      <dd className="max-w-[12rem] truncate text-right text-gray-800">{laboratorio}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-gray-500">Parâmetros</dt>
                      <dd className="text-gray-900">{totalParams}</dd>
                    </div>
                  </dl>
                  <div className="mt-5 rounded-lg border border-emerald-100 p-4 text-center" style={{ backgroundColor: `${lime}22` }}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Resultado geral</p>
                    <div className="mt-2 flex flex-col items-center gap-1">
                      <svg className="h-10 w-10 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-lg font-bold text-emerald-800">{allConform ? "CONFORME" : "REVISAR"}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">Histórico do laudo</h3>
                  <ul className="mt-4 space-y-4">
                    {historyEvents.map((ev, i) => (
                      <li key={i} className="relative pl-5">
                        <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: primary }} />
                        {i < historyEvents.length - 1 ? (
                          <span className="absolute left-[3px] top-4 h-[calc(100%+0.5rem)] w-px bg-gray-200" aria-hidden />
                        ) : null}
                        <p className="text-sm font-medium text-gray-900">{ev.label}</p>
                        <p className="text-xs text-gray-500">
                          {ev.actor} · {formatDateTimePt(ev.at.toISOString())}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-gray-800">Arquivos relacionados</h3>
                  <ul className="mt-3 space-y-2">
                    <li className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-gray-800">Relatório de análise — {sampleCode}.pdf</span>
                      <button
                        type="button"
                        onClick={printDocument}
                        className="shrink-0 rounded p-1 text-gray-500 hover:bg-white hover:text-gray-800"
                        aria-label="Gerar PDF"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </li>
                  </ul>
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function DocField({ label, value, icon }: { label: string; value: string; icon?: "leaf" }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-2 text-sm text-gray-900">
        {icon === "leaf" ? (
          <svg className="h-4 w-4 shrink-0" style={{ color: lime }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15 5 17 8 17 8s-3 1-4 4-1.5 6.5-2 8M11 20s-1-4 1-6 4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
        <span>{value}</span>
      </dd>
    </div>
  );
}
