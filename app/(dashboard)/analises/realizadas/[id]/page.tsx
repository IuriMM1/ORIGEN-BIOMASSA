"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchLabAnalysisById, type LabAnalysisRow } from "@/lib/lab-analyses-query";
import { supabase } from "@/lib/supabase";

const primary = "#143328";

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

function fmtNum(n: number | null | undefined, unit?: string): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const s = n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
  return unit ? `${s} ${unit}` : s;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-100 py-3 last:border-0 sm:grid sm:grid-cols-[minmax(0,220px)_1fr] sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 sm:mt-0">{children}</dd>
    </div>
  );
}

export default function AnaliseDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [row, setRow] = useState<LabAnalysisRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setErr("Identificador inválido.");
      return;
    }
    (async () => {
      setLoading(true);
      setErr(null);
      const { data, error } = await fetchLabAnalysisById(supabase, id);
      setLoading(false);
      if (error) {
        setErr(error);
        setRow(null);
        return;
      }
      if (!data) {
        setErr("Análise não encontrada.");
        setRow(null);
        return;
      }
      setRow(data);
    })();
  }, [id]);

  const summary = useMemo(() => {
    if (!row) return null;
    const fromNotes = parseCodigoNotes(row.notes);
    const y = new Date(row.analysis_date || row.created_at).getFullYear();
    const code = (row.analysis_code && row.analysis_code.trim()) || fromNotes || `AN-${y} — registo sem código ANA-ORI`;
    const sample = row.lab_samples;
    const amostraFromNotes = parseAmostraCodigoNotes(row.notes);
    const amostraCode = sample?.code?.trim() || amostraFromNotes || "—";
    const quadrante = sample?.quadrant?.trim() || parseQuadranteNotes(row.notes) || null;
    const biomassa = row.biomass_types?.name ?? "—";
    const fornecedor = row.suppliers?.name ?? "—";
    return { code, amostraCode, quadrante, biomassa, fornecedor };
  }, [row]);

  const notesExtra = useMemo(() => {
    if (!row?.notes?.trim()) return null;
    const lines = row.notes.split("\n\n").filter(Boolean);
    return lines;
  }, [row]);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent pb-16 pt-8">
        <div className="mx-auto max-w-3xl px-6 text-center text-gray-500">A carregar…</div>
      </div>
    );
  }

  if (err || !row || !summary) {
    return (
      <div className="min-h-screen bg-transparent pb-16 pt-8">
        <div className="mx-auto max-w-3xl px-6">
          <p className="text-red-700">{err ?? "Dados indisponíveis."}</p>
          <Link href="/analises/realizadas" className="mt-4 inline-block text-sm font-semibold underline" style={{ color: primary }}>
            Voltar à lista
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pb-24 pt-6">
      <div className="mx-auto max-w-3xl px-6 lg:px-10">
        <header className="mb-8">
          <button
            type="button"
            onClick={() => router.push("/analises/realizadas")}
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-gray-900"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Análises realizadas
          </button>
          <p className="text-sm text-gray-500">
            Análises <span className="text-gray-400">›</span> Realizadas <span className="text-gray-400">›</span> Detalhe
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight lg:text-3xl" style={{ color: primary }}>
            Análise {summary.code}
          </h1>
          <p className="mt-1 font-mono text-xs text-gray-500">ID interno: {row.id}</p>
        </header>

        <div className="space-y-6">
          <section className="rounded-xl border border-gray-100/80 bg-white p-6 shadow-sm">
            <h2 className="mb-4 border-b border-gray-100 pb-2 text-base font-semibold" style={{ color: primary }}>
              Identificação e contexto
            </h2>
            <dl>
              <Field label="Código da análise">
                <span className="font-mono font-semibold">{summary.code}</span>
              </Field>
              <Field label="Registado em">{formatDateTimePt(row.created_at)}</Field>
              <Field label="Data da análise (entrada)">{formatDatePt(row.analysis_date)}</Field>
              <Field label="Responsável / analista">{row.analyst ?? "—"}</Field>
              <Field label="Tipo de biomassa">{summary.biomassa}</Field>
              <Field label="Fornecedor">{summary.fornecedor}</Field>
              <Field label="Amostra (código)">
                <span className="font-mono">{summary.amostraCode}</span>
              </Field>
              <Field label="Quadrante / detalhe amostra">{summary.quadrante ?? "—"}</Field>
              {row.sample_id ? <Field label="ID da amostra (UUID)">{row.sample_id}</Field> : null}
            </dl>
          </section>

          <section className="rounded-xl border border-gray-100/80 bg-white p-6 shadow-sm">
            <h2 className="mb-4 border-b border-gray-100 pb-2 text-base font-semibold" style={{ color: primary }}>
              Resultados de laboratório
            </h2>
            <dl>
              <Field label="Umidade (%)">{fmtNum(row.moisture, "%")}</Field>
              <Field label="Impureza (%)">{fmtNum(row.impurity, "%")}</Field>
              <Field label="Cinzas (%)">{fmtNum(row.ash, "%")}</Field>
              <Field label="Material volátil / finos (%)">{fmtNum(row.fine_material, "%")}</Field>
              <Field label="PCS / poder calorífico">{fmtNum(row.calorific_value, "kcal/kg")}</Field>
              <Field label="Densidade aparente">{fmtNum(row.density, "kg/m³")}</Field>
              <Field label="Granulometria">{row.granulometry?.trim() || "—"}</Field>
            </dl>
          </section>

          {notesExtra && notesExtra.length > 0 ? (
            <section className="rounded-xl border border-gray-100/80 bg-white p-6 shadow-sm">
              <h2 className="mb-4 border-b border-gray-100 pb-2 text-base font-semibold" style={{ color: primary }}>
                Observações e texto livre
              </h2>
              <ul className="space-y-3 text-sm text-gray-800">
                {notesExtra.map((block, i) => (
                  <li key={i} className="whitespace-pre-wrap rounded-lg bg-gray-50/80 p-3 text-gray-800">
                    {block}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="mt-10">
          <Link
            href="/analises/realizadas"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            Voltar à lista
          </Link>
        </div>
      </div>
    </div>
  );
}
