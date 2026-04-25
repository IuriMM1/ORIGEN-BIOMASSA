"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatAcceptableLimitCell,
  PARAM_DEFS,
  parseAnalysisResultNumber,
  valueConformsToConfiguredLimits,
  type AnalysisLabField,
  type ParamDef,
} from "@/lib/analysis-params";
import { supabase } from "@/lib/supabase";

const primary = "#143328";
const lime = "#8BC34A";

const FALLBACK_LABS = ["Laboratório ORIGEN", "Laboratório parceiro A", "Laboratório parceiro B"];
const FALLBACK_ANALYSTS: { id: string; name: string; professional_reg: string | null }[] = [
  { id: "fallback-1", name: "Mariana Oliveira", professional_reg: null },
  { id: "fallback-2", name: "Carlos Mendes", professional_reg: null },
  { id: "fallback-3", name: "Ana Paula Ribeiro", professional_reg: null },
];

type ParamDefinitionRow = {
  parameter_key: string;
  label: string;
  unit: string;
  default_method: string | null;
};

type BiomassType = { id: string; name: string };
type SampleRow = { id: string; code: string; quadrant: string | null };
type Supplier = { id: string; name: string };

type AcceptableLimitRow = {
  biomass_type_id: string;
  parameter_key: string;
  unit: string;
  limit_min: string | null;
  limit_max: string | null;
};

type AnalysisMethodRow = {
  id: string;
  name: string;
  norm_reference: string | null;
  parameter_key: string | null;
};

type ResponsibleRow = { id: string; name: string; professional_reg: string | null };
type LaboratoryRow = { id: string; name: string };

type MergedParamRow = (ParamDef & { limitDisplay: string; methodOptionLabels: string[]; isCustom: false }) | {
  id: string;
  label: string;
  unit: string;
  defaultMethod: string;
  defaultLimitDisplay: string;
  field: null;
  limitDisplay: string;
  methodOptionLabels: string[];
  isCustom: true;
};

function Req() {
  return <span className="text-red-500">*</span>;
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-600">
      {children}
      {required ? <Req /> : null}
    </label>
  );
}

const input =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#143328] focus:ring-1 focus:ring-[#143328]/25";
const select = `${input} appearance-none bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat pr-9`;

function ParamRowActionsMenu({ onRemove }: { onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative flex justify-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        aria-label="Ações"
        aria-expanded={open}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="6" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="18" r="1.5" />
        </svg>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[9rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
            onClick={() => {
              onRemove();
              setOpen(false);
            }}
          >
            Remover
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function CriarNovaAnalisePage() {
  const router = useRouter();
  const [samples, setSamples] = useState<SampleRow[]>([]);
  const [biomassTypes, setBiomassTypes] = useState<BiomassType[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [codigo, setCodigo] = useState("");
  const [codigoLoading, setCodigoLoading] = useState(true);
  const [dataEntrada, setDataEntrada] = useState("");
  const [amostraMode, setAmostraMode] = useState<"select" | "create">("select");
  const [amostraId, setAmostraId] = useState("");
  const [quadranteNovo, setQuadranteNovo] = useState("");
  const [tipoBiomassaId, setTipoBiomassaId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [laboratorio, setLaboratorio] = useState(FALLBACK_LABS[0]);
  const labInitializedFromDb = useRef(false);
  const [descricao, setDescricao] = useState("");
  const [paramResults, setParamResults] = useState<Record<string, string>>(() =>
    Object.fromEntries(PARAM_DEFS.map((p) => [p.id, ""])),
  );
  const [acceptableLimits, setAcceptableLimits] = useState<AcceptableLimitRow[]>([]);
  const [analysisMethods, setAnalysisMethods] = useState<AnalysisMethodRow[]>([]);
  const [responsiblesDb, setResponsiblesDb] = useState<ResponsibleRow[]>([]);
  const [laboratoriesDb, setLaboratoriesDb] = useState<LaboratoryRow[]>([]);
  const [paramDefinitions, setParamDefinitions] = useState<ParamDefinitionRow[]>([]);
  const [methodByParam, setMethodByParam] = useState<Record<string, string>>({});
  const [removedParamIds, setRemovedParamIds] = useState<Set<string>>(() => new Set());

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = new Date();
    setDataEntrada(t.toISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    (async () => {
      setCodigoLoading(true);

      function nextFromSuffix(last: string): string {
        const m = last.match(/(\d{4})\s*$/);
        const n = m ? parseInt(m[1], 10) + 1 : 1;
        return `ANA-ORI-${String(Math.min(Math.max(n, 1), 9999)).padStart(4, "0")}`;
      }

      const { data: peek, error: peekErr } = await supabase.rpc("peek_next_analysis_code");
      if (!peekErr && peek != null && String(peek).trim() !== "") {
        setCodigo(String(peek).trim());
        setCodigoLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("lab_analyses")
        .select("analysis_code")
        .not("analysis_code", "is", null)
        .ilike("analysis_code", "ANA-ORI-%")
        .order("analysis_code", { ascending: false })
        .limit(1);

      if (!error && data?.length) {
        const last = String((data[0] as { analysis_code: string }).analysis_code);
        setCodigo(nextFromSuffix(last));
        setCodigoLoading(false);
        return;
      }

      if (!error && (!data || data.length === 0)) {
        setCodigo("ANA-ORI-0001");
        setCodigoLoading(false);
        return;
      }

      const { data: noteRows, error: notesErr } = await supabase
        .from("lab_analyses")
        .select("notes")
        .order("created_at", { ascending: false })
        .limit(300);

      if (!notesErr && noteRows?.length) {
        let maxN = 0;
        for (const row of noteRows as { notes: string | null }[]) {
          const t = row.notes ?? "";
          const m = t.match(/Código da análise:\s*ANA-ORI-(\d{4})/i);
          if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
        }
        if (maxN > 0) {
          setCodigo(`ANA-ORI-${String(Math.min(maxN + 1, 9999)).padStart(4, "0")}`);
          setCodigoLoading(false);
          return;
        }
      }

      setCodigo("ANA-ORI-0001");
      setCodigoLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const [rSamples, rBio, rSup] = await Promise.all([
        supabase.from("lab_samples").select("id, code, quadrant").order("created_at", { ascending: false }),
        supabase.from("biomass_types").select("id, name").order("name"),
        supabase.from("suppliers").select("id, name").order("name"),
      ]);
      if (!rSamples.error && rSamples.data) setSamples(rSamples.data as SampleRow[]);
      if (!rBio.error && rBio.data) setBiomassTypes(rBio.data as BiomassType[]);
      if (!rSup.error && rSup.data) setSuppliers(rSup.data as Supplier[]);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const [rl, mth, resp, lab, pd] = await Promise.all([
        supabase.from("acceptable_limits").select("biomass_type_id, parameter_key, unit, limit_min, limit_max"),
        supabase.from("analysis_methods").select("id, name, norm_reference, parameter_key"),
        supabase.from("analysis_responsibles").select("id, name, professional_reg"),
        supabase.from("laboratories").select("id, name"),
        supabase.from("analysis_parameter_definitions").select("parameter_key, label, unit, default_method"),
      ]);
      if (!rl.error && rl.data) setAcceptableLimits(rl.data as AcceptableLimitRow[]);
      if (!mth.error && mth.data) setAnalysisMethods(mth.data as AnalysisMethodRow[]);
      if (!resp.error && resp.data) setResponsiblesDb(resp.data as ResponsibleRow[]);
      if (!lab.error && lab.data) setLaboratoriesDb(lab.data as LaboratoryRow[]);
      if (!pd.error && pd.data) setParamDefinitions(pd.data as ParamDefinitionRow[]);
      else setParamDefinitions([]);
    })();
  }, []);

  const analystRows = useMemo(() => (responsiblesDb.length > 0 ? responsiblesDb : FALLBACK_ANALYSTS), [responsiblesDb]);
  const labNames = useMemo(() => (laboratoriesDb.length > 0 ? laboratoriesDb.map((l) => l.name) : FALLBACK_LABS), [laboratoriesDb]);

  useEffect(() => {
    if (laboratoriesDb.length > 0 && !labInitializedFromDb.current) {
      labInitializedFromDb.current = true;
      setLaboratorio(laboratoriesDb[0].name);
    }
  }, [laboratoriesDb]);

  useEffect(() => {
    if (analystRows.length > 0 && !responsavelId) setResponsavelId(analystRows[0].id);
  }, [analystRows, responsavelId]);

  const limitsForBio = useMemo(() => {
    if (!tipoBiomassaId) return [];
    return acceptableLimits.filter((l) => l.biomass_type_id === tipoBiomassaId);
  }, [acceptableLimits, tipoBiomassaId]);

  const mergedParamRows: MergedParamRow[] = useMemo(() => {
    const builtIn: MergedParamRow[] = PARAM_DEFS.map((def) => {
      const lim = limitsForBio.find((l) => l.parameter_key === def.id);
      const limitDisplay = formatAcceptableLimitCell(lim?.limit_min, lim?.limit_max, lim?.unit ?? def.unit, def.defaultLimitDisplay);
      const mFor = analysisMethods.filter((m) => !m.parameter_key || m.parameter_key === def.id);
      const methodOptionLabels =
        mFor.length > 0
          ? [...new Set(mFor.map((m) => `${m.name}${m.norm_reference ? ` (${m.norm_reference})` : ""}`))]
          : [];
      return { ...def, limitDisplay, methodOptionLabels, isCustom: false as const };
    });
    const customRows: MergedParamRow[] = paramDefinitions.map((c) => {
      const lim = limitsForBio.find((l) => l.parameter_key === c.parameter_key);
      const limitDisplay = formatAcceptableLimitCell(lim?.limit_min, lim?.limit_max, lim?.unit ?? c.unit, "—");
      const defaultMethod = c.default_method?.trim() || "—";
      const mFor = analysisMethods.filter((m) => !m.parameter_key || m.parameter_key === c.parameter_key);
      const methodOptionLabels =
        mFor.length > 0
          ? [...new Set(mFor.map((m) => `${m.name}${m.norm_reference ? ` (${m.norm_reference})` : ""}`))]
          : [];
      return {
        id: c.parameter_key,
        label: c.label,
        unit: c.unit,
        defaultMethod,
        defaultLimitDisplay: "—",
        field: null,
        limitDisplay,
        methodOptionLabels,
        isCustom: true as const,
      };
    });
    return [...builtIn, ...customRows];
  }, [limitsForBio, analysisMethods, paramDefinitions]);

  useEffect(() => {
    setParamResults((prev) => {
      const next = { ...prev };
      for (const c of paramDefinitions) {
        if (next[c.parameter_key] === undefined) next[c.parameter_key] = "";
      }
      return next;
    });
  }, [paramDefinitions]);

  useEffect(() => {
    setMethodByParam((prev) => {
      const next = { ...prev };
      for (const row of mergedParamRows) {
        const current = next[row.id];
        const first = row.methodOptionLabels[0] ?? "";
        if (row.methodOptionLabels.length === 0) {
          next[row.id] = "";
        } else if (current == null || !row.methodOptionLabels.includes(current)) {
          next[row.id] = first;
        }
      }
      return next;
    });
  }, [mergedParamRows]);

  useEffect(() => {
    setRemovedParamIds(new Set());
  }, [tipoBiomassaId]);

  useEffect(() => {
    if (amostraMode === "select") setQuadranteNovo("");
    else setAmostraId("");
  }, [amostraMode]);

  const visibleMergedRows = useMemo(
    () => mergedParamRows.filter((r) => !removedParamIds.has(r.id)),
    [mergedParamRows, removedParamIds],
  );

  const resumo = useMemo(() => {
    let amostraLabel = "—";
    if (amostraMode === "select" && amostraId) {
      const s = samples.find((x) => x.id === amostraId);
      amostraLabel = s ? `${s.code}${s.quadrant ? ` — ${s.quadrant}` : ""}` : "—";
    } else if (amostraMode === "create") {
      amostraLabel = quadranteNovo.trim() ? `Nova amostra — quadrante: ${quadranteNovo.trim()}` : "Nova amostra (preencha o quadrante)";
    }
    const fornecedorNome = suppliers.find((s) => s.id === fornecedorId)?.name ?? "—";
    const bioNome = biomassTypes.find((b) => b.id === tipoBiomassaId)?.name ?? "—";
    return {
      amostra: amostraLabel,
      fornecedor: fornecedorNome,
      biomassa: bioNome,
      laboratorio,
    };
  }, [amostraMode, amostraId, samples, quadranteNovo, fornecedorId, suppliers, tipoBiomassaId, biomassTypes, laboratorio]);

  const dadosBasicosOk = Boolean(
    codigo.trim() &&
      !codigoLoading &&
      dataEntrada &&
      tipoBiomassaId &&
      fornecedorId &&
      responsavelId &&
      laboratorio &&
      (amostraMode === "select" ? amostraId : quadranteNovo.trim()),
  );
  const amostraOk = Boolean(amostraMode === "select" ? amostraId : quadranteNovo.trim());
  const parametrosOk = visibleMergedRows.some((p) => paramResults[p.id]?.trim() !== "");

  const conformityByParamId = useMemo(() => {
    const map: Record<string, "ok" | "fail" | "neutral"> = {};
    for (const row of visibleMergedRows) {
      const raw = paramResults[row.id]?.trim() ?? "";
      const val = parseAnalysisResultNumber(raw);
      const lim = limitsForBio.find((l) => l.parameter_key === row.id);
      if (val == null) {
        map[row.id] = "neutral";
        continue;
      }
      if (!lim) {
        map[row.id] = "neutral";
        continue;
      }
      const c = valueConformsToConfiguredLimits(val, lim.limit_min, lim.limit_max);
      if (c === null) map[row.id] = "neutral";
      else map[row.id] = c ? "ok" : "fail";
    }
    return map;
  }, [visibleMergedRows, paramResults, limitsForBio]);

  function setParam(id: string, v: string) {
    setParamResults((prev) => ({ ...prev, [id]: v }));
  }

  function buildNotesFromExtras(analysisCodeForNotes: string, sampleCodeForNotes: string | null) {
    const parts: string[] = [];
    if (analysisCodeForNotes.trim()) parts.push(`Código da análise: ${analysisCodeForNotes.trim()}`);
    if (sampleCodeForNotes) parts.push(`Código da amostra: ${sampleCodeForNotes}`);
    if (amostraMode === "create" && quadranteNovo.trim()) parts.push(`Quadrante: ${quadranteNovo.trim()}`);
    if (laboratorio) parts.push(`Laboratório: ${laboratorio}`);
    if (descricao.trim()) parts.push(descricao.trim());
    for (const row of visibleMergedRows) {
      const v = paramResults[row.id]?.trim();
      if (!v) continue;
      const m = methodByParam[row.id]?.trim();
      if (m) parts.push(`${row.label} (${row.unit}): ${v} — Método: ${m}`);
      else parts.push(`${row.label} (${row.unit}): ${v}`);
    }
    return parts.join("\n\n") || null;
  }

  async function submitAnalysis() {
    if (codigoLoading) {
      alert("A preparar o código da análise…");
      return;
    }
    if (amostraMode === "select" && !amostraId) {
      alert("Selecione uma amostra.");
      return;
    }
    if (amostraMode === "create" && !quadranteNovo.trim()) {
      alert("Indique o quadrante da nova amostra.");
      return;
    }
    const analystPerson = analystRows.find((a) => a.id === responsavelId);
    const analystStr = analystPerson
      ? `${analystPerson.name}${analystPerson.professional_reg ? ` — ${analystPerson.professional_reg}` : ""}`
      : "";
    if (!analystStr.trim()) {
      alert("Selecione o responsável pela análise.");
      return;
    }
    const get = (field: AnalysisLabField) => {
      const row = PARAM_DEFS.find((r) => r.field === field);
      if (!row) return null;
      const v = paramResults[row.id]?.trim();
      if (!v) return null;
      const n = Number(v.replace(",", "."));
      return Number.isFinite(n) ? n : null;
    };

    let sampleIdToUse = amostraId;
    let sampleCodeForNotes: string | null = null;
    if (amostraMode === "create") {
      const { data: nextCode, error: codeErr } = await supabase.rpc("next_sample_code");
      if (codeErr || nextCode == null || nextCode === "") {
        alert("Erro ao gerar código da amostra: " + (codeErr?.message ?? "RPC indisponível. Aplique a migração no Supabase."));
        return;
      }
      const codeStr = String(nextCode);
      const { data: insertedSample, error: sampleErr } = await supabase
        .from("lab_samples")
        .insert({ code: codeStr, quadrant: quadranteNovo.trim() || null })
        .select("id, code")
        .single();
      if (sampleErr || !insertedSample) {
        alert("Erro ao criar amostra: " + (sampleErr?.message ?? ""));
        return;
      }
      sampleIdToUse = insertedSample.id as string;
      sampleCodeForNotes = insertedSample.code as string;
      setSamples((prev) => [{ id: insertedSample.id as string, code: codeStr, quadrant: quadranteNovo.trim() || null }, ...prev]);
    } else {
      sampleCodeForNotes = samples.find((s) => s.id === amostraId)?.code ?? null;
    }

    const { data: finalAnalysisCode, error: codeRpcErr } = await supabase.rpc("next_analysis_code");
    if (codeRpcErr || finalAnalysisCode == null || finalAnalysisCode === "") {
      alert(
        "Erro ao reservar o código da análise: " +
          (codeRpcErr?.message ?? "RPC indisponível. Aplique a migração no Supabase (função next_analysis_code)."),
      );
      return;
    }
    const analysisCodeStr = String(finalAnalysisCode).trim();

    setSaving(true);
    const { error } = await supabase.from("lab_analyses").insert({
      lot_id: null,
      sample_id: sampleIdToUse,
      analysis_code: analysisCodeStr,
      biomass_type_id: tipoBiomassaId || null,
      supplier_id: fornecedorId || null,
      moisture: get("moisture"),
      impurity: get("impurity"),
      granulometry: null,
      density: get("density"),
      ash: get("ash"),
      calorific_value: get("calorific_value"),
      fine_material: get("fine_material"),
      analyst: analystStr.trim(),
      analysis_date: dataEntrada ? `${dataEntrada}T12:00:00` : null,
      notes: buildNotesFromExtras(analysisCodeStr, sampleCodeForNotes),
    });
    setSaving(false);
    if (error) {
      alert("Erro ao criar análise: " + error.message);
      return;
    }
    router.push("/analises/realizadas");
    router.refresh();
  }

  const selectChevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;

  return (
    <div className="min-h-screen bg-transparent pb-28 pt-6">
      <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => router.push("/analises/realizadas")}
              className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50"
              aria-label="Voltar"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight lg:text-3xl" style={{ color: primary }}>
                Criar nova análise
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Análises <span className="text-gray-400">›</span> Nova análise
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
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

        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1 space-y-6">
            {/* 1. Dados da análise */}
            <section className="rounded-xl border border-gray-100/80 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6 border-b border-gray-100 pb-4">
                <h2 className="text-base font-semibold" style={{ color: primary }}>
                  1. Dados da análise
                </h2>
                <p className="mt-1 text-sm text-gray-500">Informe os dados básicos para identificação da análise.</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <Label required>Código da análise</Label>
                  <input
                    className={`${input} bg-gray-50 text-gray-800`}
                    readOnly
                    value={codigoLoading ? "A carregar…" : codigo || "ANA-ORI-0001"}
                    title="Pré-visualização do próximo código; o valor definitivo é reservado ao guardar (único)."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Valor indicativo (contador na base ou últimas análises ANA-ORI). Ao guardar, o sistema reserva o código definitivo com{" "}
                    <code className="rounded bg-gray-100 px-1">next_analysis_code</code>, sem duplicar.
                  </p>
                </div>
                <div>
                  <Label required>Data de entrada da amostra</Label>
                  <div className="relative">
                    <input type="date" className={`${input} pr-10`} value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
                      </svg>
                    </span>
                  </div>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <Label required>Amostra</Label>
                  <div className="mb-3 flex flex-wrap gap-4 text-sm">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input type="radio" name="amostraMode" checked={amostraMode === "select"} onChange={() => setAmostraMode("select")} className="text-[#143328]" />
                      <span>Selecionar amostra existente</span>
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input type="radio" name="amostraMode" checked={amostraMode === "create"} onChange={() => setAmostraMode("create")} className="text-[#143328]" />
                      <span>Criar nova amostra (AMO-ORI-XXXX)</span>
                    </label>
                  </div>
                  {amostraMode === "select" ? (
                    <select
                      className={select}
                      style={{ backgroundImage: selectChevron }}
                      value={amostraId}
                      onChange={(e) => setAmostraId(e.target.value)}
                    >
                      <option value="">Selecione a amostra</option>
                      {samples.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code}
                          {s.quadrant ? ` — ${s.quadrant}` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500">O código AMO-ORI-XXXX será atribuído ao guardar a análise. Indique o quadrante (texto livre).</p>
                      <div>
                        <Label required>Quadrante</Label>
                        <input
                          className={input}
                          value={quadranteNovo}
                          onChange={(e) => setQuadranteNovo(e.target.value)}
                          placeholder="Ex.: Q1 — setor norte"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Label required>Tipo de biomassa</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2" style={{ color: lime }}>
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                        <path d="M11 20A7 7 0 0 1 9.8 6.1C15 5 17 8 17 8s-3 1-4 4-1.5 6.5-2 8M11 20s-1-4 1-6 4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <select
                      className={`${select} pl-10`}
                      style={{ backgroundImage: selectChevron }}
                      value={tipoBiomassaId}
                      onChange={(e) => setTipoBiomassaId(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {biomassTypes.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label required>Fornecedor</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                        <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <select
                      className={`${select} pl-10`}
                      style={{ backgroundImage: selectChevron }}
                      value={fornecedorId}
                      onChange={(e) => setFornecedorId(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label required>Responsável pela análise</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <select
                      className={`${select} pl-10`}
                      style={{ backgroundImage: selectChevron }}
                      value={responsavelId}
                      onChange={(e) => setResponsavelId(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {analystRows.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.professional_reg ? ` — ${p.professional_reg}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <Label required>Laboratório / local</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                        <path d="M9 3h6v18H9zM12 7v4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <select className={`${select} pl-10`} style={{ backgroundImage: selectChevron }} value={laboratorio} onChange={(e) => setLaboratorio(e.target.value)}>
                      {labNames.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="mb-1.5 flex justify-between gap-2">
                    <Label>Descrição / observações</Label>
                    <span className="text-xs text-gray-400">
                      {descricao.length}/300
                    </span>
                  </div>
                  <textarea
                    className={`${input} min-h-[100px] resize-y`}
                    maxLength={300}
                    placeholder="Informações adicionais sobre a análise (opcional)."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* 2. Parâmetros */}
            <section className="rounded-xl border border-gray-100/80 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6 flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold" style={{ color: primary }}>
                    2. Parâmetros resultantes da análise
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Limites e métodos vêm de <strong className="font-medium text-gray-700">Configurações</strong> para o tipo de biomassa escolhido. O status compara o resultado com o limite aceitável.
                  </p>
                </div>
                {mergedParamRows.some((r) => removedParamIds.has(r.id)) ? (
                  <div className="flex min-w-[220px] flex-col gap-1 self-start sm:self-end">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-600">Adicionar parâmetro</span>
                    <select
                      className={select}
                      style={{ backgroundImage: selectChevron }}
                      defaultValue=""
                      onChange={(e) => {
                        const id = e.target.value;
                        if (!id) return;
                        setRemovedParamIds((prev) => {
                          const n = new Set(prev);
                          n.delete(id);
                          return n;
                        });
                        e.target.value = "";
                      }}
                    >
                      <option value="">Escolher parâmetro removido…</option>
                      {mergedParamRows
                        .filter((r) => removedParamIds.has(r.id))
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : null}
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full min-w-[880px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/90">
                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Parâmetro</th>
                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Resultado <Req />
                      </th>
                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Unidade</th>
                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Método</th>
                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Limite aceitável</th>
                      <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Status</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMergedRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">
                          Nenhum parâmetro na tabela. Use &quot;Adicionar parâmetro&quot; acima para repor linhas removidas.
                        </td>
                      </tr>
                    ) : null}
                    {visibleMergedRows.map((row) => {
                      const st = conformityByParamId[row.id];
                      const statusNode =
                        st === "fail" ? (
                          <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-100">
                            Não Conforme
                          </span>
                        ) : st === "ok" ? (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">
                            Conforme
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600 ring-1 ring-gray-100">—</span>
                        );
                      const hasMethods = row.methodOptionLabels.length > 0;
                      return (
                        <tr key={row.id} className="border-b border-gray-50 last:border-0">
                          <td className="px-3 py-3 font-medium text-gray-900">{row.label}</td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              className={input}
                              value={paramResults[row.id]}
                              onChange={(e) => setParam(row.id, e.target.value)}
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-3 text-gray-600">{row.unit}</td>
                          <td className="px-3 py-2">
                            {hasMethods ? (
                              <select
                                className={select}
                                style={{ backgroundImage: selectChevron }}
                                value={methodByParam[row.id] ?? row.methodOptionLabels[0]}
                                onChange={(e) => setMethodByParam((prev) => ({ ...prev, [row.id]: e.target.value }))}
                              >
                                {row.methodOptionLabels.map((label) => (
                                  <option key={label} value={label}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-amber-800">Cadastre o método em Configurações.</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1.5 text-gray-700">
                              {row.limitDisplay !== "—" ? (
                                <>
                                  <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                                    <path d="M4 12h16M12 4v16" strokeLinecap="round" />
                                  </svg>
                                  {row.limitDisplay}
                                </>
                              ) : (
                                "—"
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-3">{statusNode}</td>
                          <td className="px-3 py-2 text-center">
                            <ParamRowActionsMenu onRemove={() => setRemovedParamIds((prev) => new Set(prev).add(row.id))} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 flex items-start gap-2 text-xs text-gray-500">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
                </svg>
                Todos os resultados são de responsabilidade do laboratório.
              </p>
            </section>
          </div>

          {/* Coluna direita */}
          <aside className="w-full shrink-0 space-y-4 xl:w-[340px]">
            <div className="rounded-xl border border-gray-100/80 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold" style={{ color: primary }}>
                Resumo da análise
              </h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-medium text-gray-500">Amostra</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{resumo.amostra}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">Fornecedor</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{resumo.fornecedor}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">Tipo de biomassa</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{resumo.biomassa}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500">Laboratório</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{resumo.laboratorio}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-gray-100/80 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold" style={{ color: primary }}>
                Checklist da análise
              </h3>
              <ul className="mt-4 space-y-3">
                <li className="flex items-center gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className={dadosBasicosOk ? "font-medium text-gray-900" : "text-gray-500"}>Dados da análise preenchidos</span>
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${amostraOk ? "bg-emerald-500 text-white" : "border-2 border-gray-200 bg-white"}`}>
                    {amostraOk ? (
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                        <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </span>
                  <span className={amostraOk ? "font-medium text-gray-900" : "text-gray-500"}>Amostra selecionada</span>
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${parametrosOk ? "bg-emerald-500 text-white" : "border-2 border-gray-200 bg-white"}`}>
                    {parametrosOk ? (
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                        <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </span>
                  <span className={parametrosOk ? "font-medium text-gray-900" : "text-gray-500"}>Parâmetros informados</span>
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-500">
                  <span className="flex h-6 w-6 shrink-0 rounded-full border-2 border-gray-200 bg-white" />
                  Resultados inseridos
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-500">
                  <span className="flex h-6 w-6 shrink-0 rounded-full border-2 border-gray-200 bg-white" />
                  Revisão concluída
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 text-sm text-gray-600">
              <div className="flex gap-3">
                <svg className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
                </svg>
                <p>
                  <strong className="text-gray-800">Importante:</strong> após criar, a análise ficará com status &quot;Em andamento&quot; e poderá ser acompanhada na lista de análises.
                </p>
              </div>
            </div>
          </aside>
        </div>

        {/* Rodapé fixo */}
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/95 py-4 pl-6 pr-6 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-sm sm:pl-72">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => router.push("/analises/realizadas")} className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50">
              Cancelar
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => alert("Rascunho guardado localmente (próximo passo: persistir na base).")}
                className="inline-flex items-center gap-2 rounded-lg border-2 px-5 py-2.5 text-sm font-semibold shadow-sm transition hover:bg-gray-50"
                style={{ borderColor: primary, color: primary }}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M17 21v-8H7v8M7 3v5h8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Salvar rascunho
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={submitAnalysis}
                className="inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105 disabled:opacity-60"
                style={{ backgroundColor: primary }}
              >
                {saving ? "A criar…" : "Revisar e criar análise"}
                <span aria-hidden>→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
