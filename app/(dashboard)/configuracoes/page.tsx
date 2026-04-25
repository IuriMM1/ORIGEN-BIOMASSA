"use client";

import Link from "next/link";
import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PARAM_DEFS, paramDefById, resolveParamLabel } from "@/lib/analysis-params";
import { supabase } from "@/lib/supabase";

const primary = "#143328";
const lime = "#8BC34A";

type CadastroView = "todos" | "biomassa" | "responsaveis" | "laboratorios" | "metodos" | "limites";

type BiomassTypeRow = { id: string; name: string; description: string | null; created_at: string };
type ResponsibleRow = { id: string; name: string; professional_reg: string | null; email: string | null; created_at: string };
type LabRow = { id: string; name: string; cnpj: string | null; email: string | null; created_at: string };
type MethodRow = {
  id: string;
  name: string;
  norm_reference: string | null;
  description: string | null;
  parameter_key: string | null;
  created_at: string;
};
type LimitRow = {
  id: string;
  biomass_type_id: string;
  parameter_key: string;
  unit: string;
  limit_min: string | null;
  limit_max: string | null;
  applies_to: string;
  created_at: string;
};

type ParamDefinitionRow = {
  id: string;
  parameter_key: string;
  label: string;
  unit: string;
  default_method: string | null;
  created_at: string;
};

const selectClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#143328] focus:ring-1 focus:ring-[#143328]/25";
const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#143328] focus:ring-1 focus:ring-[#143328]/25";

function newParameterKeyFromLabel(label: string): string {
  const base = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 28);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "param"}_${suffix}`;
}

function ActionsMenu({
  menuId,
  openMenuId,
  setOpenMenuId,
  onEdit,
  onDelete,
}: {
  menuId: string;
  openMenuId: string | null;
  setOpenMenuId: (v: string | null) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const open = openMenuId === menuId;
  return (
    <td className="relative px-3 py-2 text-center">
      <button
        type="button"
        aria-label="Abrir menu de ações"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpenMenuId(open ? null : menuId);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="6" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="18" r="1.5" />
        </svg>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-2 top-full z-50 mt-1 min-w-[220px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50"
            onClick={() => {
              setOpenMenuId(null);
              onEdit();
            }}
          >
            Alterar
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2.5 text-left text-sm text-red-700 hover:bg-red-50"
            onClick={() => {
              setOpenMenuId(null);
              onDelete();
            }}
          >
            Remover (excluir)
          </button>
        </div>
      ) : null}
    </td>
  );
}

function EditBiomassRow({ row, onClose, onSaved }: { row: BiomassTypeRow; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(row.name);
  const [description, setDescription] = useState(row.description ?? "");
  async function save() {
    if (!name.trim()) {
      alert("Informe o nome.");
      return;
    }
    const { error } = await supabase.from("biomass_types").update({ name: name.trim(), description: description.trim() || null }).eq("id", row.id);
    if (error) {
      alert("Erro ao guardar: " + error.message);
      return;
    }
    onSaved();
  }
  return (
    <div className="flex flex-wrap items-end gap-2 p-4">
      <div className="min-w-[160px] flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-500">Nome</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="min-w-[200px] flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-500">Descrição</label>
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <button type="button" onClick={save} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: primary }}>
        Guardar
      </button>
      <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
        Cancelar
      </button>
    </div>
  );
}

function EditResponsibleRow({ row, onClose, onSaved }: { row: ResponsibleRow; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(row.name);
  const [professional_reg, setProfessionalReg] = useState(row.professional_reg ?? "");
  const [email, setEmail] = useState(row.email ?? "");
  async function save() {
    if (!name.trim()) {
      alert("Informe o nome.");
      return;
    }
    const { error } = await supabase
      .from("analysis_responsibles")
      .update({
        name: name.trim(),
        professional_reg: professional_reg.trim() || null,
        email: email.trim() || null,
      })
      .eq("id", row.id);
    if (error) {
      alert("Erro ao guardar: " + error.message);
      return;
    }
    onSaved();
  }
  return (
    <div className="flex flex-wrap items-end gap-2 p-4">
      <div className="min-w-[140px] flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-500">Nome</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="min-w-[120px] flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-500">Empresa</label>
        <input className={inputClass} value={professional_reg} onChange={(e) => setProfessionalReg(e.target.value)} placeholder="Empresa onde trabalha" />
      </div>
      <div className="min-w-[180px] flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-500">E-mail</label>
        <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <button type="button" onClick={save} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: primary }}>
        Guardar
      </button>
      <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
        Cancelar
      </button>
    </div>
  );
}

function EditLabRow({ row, onClose, onSaved }: { row: LabRow; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(row.name);
  async function save() {
    if (!name.trim()) {
      alert("Informe o nome.");
      return;
    }
    const { error } = await supabase.from("laboratories").update({ name: name.trim() }).eq("id", row.id);
    if (error) {
      alert("Erro ao guardar: " + error.message);
      return;
    }
    onSaved();
  }
  return (
    <div className="flex flex-wrap items-end gap-2 p-4">
      <div className="min-w-[220px] flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-500">Nome do laboratório</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <button type="button" onClick={save} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: primary }}>
        Guardar
      </button>
      <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
        Cancelar
      </button>
    </div>
  );
}

function EditMethodRow({
  row,
  customParamDefs,
  onClose,
  onSaved,
}: {
  row: MethodRow;
  customParamDefs: ParamDefinitionRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(row.name);
  const [norm_reference, setNormReference] = useState(row.norm_reference ?? "");
  const [description, setDescription] = useState(row.description ?? "");
  const [parameter_key, setParameterKey] = useState(row.parameter_key ?? "");
  async function save() {
    if (!name.trim()) {
      alert("Informe o nome do método.");
      return;
    }
    const { error } = await supabase
      .from("analysis_methods")
      .update({
        name: name.trim(),
        norm_reference: norm_reference.trim() || null,
        description: description.trim() || null,
        parameter_key: parameter_key.trim() || null,
      })
      .eq("id", row.id);
    if (error) {
      alert("Erro ao guardar: " + error.message);
      return;
    }
    onSaved();
  }
  return (
    <div className="flex flex-wrap items-end gap-2 p-4">
      <div className="min-w-[140px] flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-500">Método</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="min-w-[140px] flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-500">Norma / referência</label>
        <input className={inputClass} value={norm_reference} onChange={(e) => setNormReference(e.target.value)} />
      </div>
      <div className="min-w-[160px] flex-1">
        <label className="mb-1 block text-xs font-medium text-gray-500">Descrição</label>
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="min-w-[160px]">
        <label className="mb-1 block text-xs font-medium text-gray-500">Parâmetro</label>
        <select className={selectClass} value={parameter_key} onChange={(e) => setParameterKey(e.target.value)}>
          <option value="">Todos</option>
          {PARAM_DEFS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          {customParamDefs.map((c) => (
            <option key={c.parameter_key} value={c.parameter_key}>
              {c.label} (personalizado)
            </option>
          ))}
        </select>
      </div>
      <button type="button" onClick={save} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: primary }}>
        Guardar
      </button>
      <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
        Cancelar
      </button>
    </div>
  );
}

function EditParamDefRow({ row, onClose, onSaved }: { row: ParamDefinitionRow; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(row.label);
  const [unit, setUnit] = useState(row.unit);
  const [default_method, setDefaultMethod] = useState(row.default_method ?? "");
  async function save() {
    if (!label.trim()) {
      alert("Informe o nome do parâmetro.");
      return;
    }
    const { error } = await supabase
      .from("analysis_parameter_definitions")
      .update({
        label: label.trim(),
        unit: unit.trim() || "%",
        default_method: default_method.trim() || null,
      })
      .eq("id", row.id);
    if (error) {
      alert("Erro ao guardar: " + error.message);
      return;
    }
    onSaved();
  }
  return (
    <div className="space-y-3 p-4">
      <p className="text-xs text-gray-500">
        Chave técnica (não editável): <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-800">{row.parameter_key}</code>
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-500">Nome do parâmetro</label>
          <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="min-w-[80px]">
          <label className="mb-1 block text-xs font-medium text-gray-500">Unidade</label>
          <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-500">Método padrão (opcional)</label>
          <input className={inputClass} value={default_method} onChange={(e) => setDefaultMethod(e.target.value)} />
        </div>
        <button type="button" onClick={save} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: primary }}>
          Guardar
        </button>
        <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function EditLimitRow({
  row,
  paramLabel,
  onClose,
  onSaved,
}: {
  row: LimitRow;
  paramLabel: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [unit, setUnit] = useState(row.unit);
  const [limit_min, setLimitMin] = useState(row.limit_min ?? "");
  const [limit_max, setLimitMax] = useState(row.limit_max ?? "");
  const [applies_to, setAppliesTo] = useState(row.applies_to);
  async function save() {
    const { error } = await supabase
      .from("acceptable_limits")
      .update({
        unit: unit.trim() || "%",
        limit_min: limit_min.trim() || null,
        limit_max: limit_max.trim() || null,
        applies_to: applies_to.trim() || "Geral",
      })
      .eq("id", row.id);
    if (error) {
      alert("Erro ao guardar: " + error.message);
      return;
    }
    onSaved();
  }
  return (
    <div className="space-y-3 p-4">
      <p className="text-xs text-gray-500">
        Parâmetro: <strong className="text-gray-800">{paramLabel}</strong> — o tipo de biomassa e o parâmetro não podem ser alterados aqui; remova e crie de novo se precisar.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[80px]">
          <label className="mb-1 block text-xs font-medium text-gray-500">Unidade</label>
          <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-500">Limite mínimo</label>
          <input className={inputClass} value={limit_min} onChange={(e) => setLimitMin(e.target.value)} placeholder="ex: ≤ 55,00" />
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-500">Limite máximo</label>
          <input className={inputClass} value={limit_max} onChange={(e) => setLimitMax(e.target.value)} />
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-500">Aplicável para</label>
          <input className={inputClass} value={applies_to} onChange={(e) => setAppliesTo(e.target.value)} />
        </div>
        <button type="button" onClick={save} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: primary }}>
          Guardar
        </button>
        <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function ConfigInner() {
  const searchParams = useSearchParams();
  const [cadastro, setCadastro] = useState<CadastroView>("todos");

  const [biomassTypes, setBiomassTypes] = useState<BiomassTypeRow[]>([]);
  const [responsibles, setResponsibles] = useState<ResponsibleRow[]>([]);
  const [labs, setLabs] = useState<LabRow[]>([]);
  const [methods, setMethods] = useState<MethodRow[]>([]);
  const [limits, setLimits] = useState<LimitRow[]>([]);
  const [paramDefinitions, setParamDefinitions] = useState<ParamDefinitionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [bioName, setBioName] = useState("");
  const [bioDesc, setBioDesc] = useState("");
  const [respName, setRespName] = useState("");
  const [respReg, setRespReg] = useState("");
  const [respEmail, setRespEmail] = useState("");
  const [labName, setLabName] = useState("");
  const [newParamLabel, setNewParamLabel] = useState("");
  const [newParamUnit, setNewParamUnit] = useState("");
  const [newParamDefaultMethod, setNewParamDefaultMethod] = useState("");
  const [metName, setMetName] = useState("");
  const [metNorm, setMetNorm] = useState("");
  const [metDesc, setMetDesc] = useState("");
  const [metParam, setMetParam] = useState("");
  const [limBio, setLimBio] = useState("");
  const [limParam, setLimParam] = useState(PARAM_DEFS[0]?.id ?? "um");
  const [limMin, setLimMin] = useState("");
  const [limMax, setLimMax] = useState("");
  const [limApplies, setLimApplies] = useState("Geral");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenuId]);

  const reload = useCallback(async () => {
    setLoading(true);
    const [b, r, l, m, lim, pd] = await Promise.all([
      supabase.from("biomass_types").select("id, name, description, created_at").order("created_at", { ascending: false }),
      supabase.from("analysis_responsibles").select("*").order("created_at", { ascending: false }),
      supabase.from("laboratories").select("*").order("created_at", { ascending: false }),
      supabase.from("analysis_methods").select("*").order("created_at", { ascending: false }),
      supabase.from("acceptable_limits").select("*").order("created_at", { ascending: false }),
      supabase.from("analysis_parameter_definitions").select("*").order("created_at", { ascending: false }),
    ]);
    setLoading(false);
    if (!b.error && b.data) setBiomassTypes(b.data as BiomassTypeRow[]);
    else if (b.error) console.error(b.error);
    if (!r.error && r.data) setResponsibles(r.data as ResponsibleRow[]);
    else if (r.error?.code === "42P01" || r.error?.message?.includes("does not exist")) {
      setResponsibles([]);
    } else if (r.error) console.error(r.error);
    if (!l.error && l.data) setLabs(l.data as LabRow[]);
    else if (l.error?.code === "42P01" || l.error?.message?.includes("does not exist")) setLabs([]);
    else if (l.error) console.error(l.error);
    if (!m.error && m.data) setMethods(m.data as MethodRow[]);
    else if (m.error?.code === "42P01" || m.error?.message?.includes("does not exist")) setMethods([]);
    else if (m.error) console.error(m.error);
    if (!lim.error && lim.data) setLimits(lim.data as LimitRow[]);
    else if (lim.error?.code === "42P01" || lim.error?.message?.includes("does not exist")) setLimits([]);
    else if (lim.error) console.error(lim.error);
    if (!pd.error && pd.data) setParamDefinitions(pd.data as ParamDefinitionRow[]);
    else if (pd.error?.code === "42P01" || pd.error?.message?.includes("does not exist")) setParamDefinitions([]);
    else if (pd.error) console.error(pd.error);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const v = searchParams.get("cadastro") as CadastroView | null;
    if (v && ["todos", "biomassa", "responsaveis", "laboratorios", "metodos", "limites"].includes(v)) setCadastro(v);
  }, [searchParams]);

  useEffect(() => {
    if (!biomassTypes.length) {
      setLimBio("");
      return;
    }
    if (!limBio || !biomassTypes.some((b) => b.id === limBio)) setLimBio(biomassTypes[0].id);
  }, [biomassTypes, limBio]);

  const limitsFiltered = useMemo(() => {
    if (!limBio) return limits;
    return limits.filter((x) => x.biomass_type_id === limBio);
  }, [limits, limBio]);

  const allParameterKeys = useMemo(
    () => [...PARAM_DEFS.map((p) => p.id), ...paramDefinitions.map((d) => d.parameter_key)],
    [paramDefinitions],
  );

  useEffect(() => {
    if (!allParameterKeys.includes(limParam)) setLimParam(PARAM_DEFS[0]?.id ?? "um");
  }, [allParameterKeys, limParam]);

  const preview = cadastro === "todos" ? 5 : undefined;

  function slice<T>(arr: T[]) {
    if (preview == null) return arr;
    return arr.slice(0, preview);
  }

  async function addBiomass() {
    if (!bioName.trim()) {
      alert("Informe o nome do tipo de biomassa.");
      return;
    }
    const { error } = await supabase.from("biomass_types").insert({ name: bioName.trim(), description: bioDesc.trim() || null });
    if (error) {
      alert("Erro: " + error.message);
      return;
    }
    setBioName("");
    setBioDesc("");
    reload();
  }

  async function addResponsible() {
    if (!respName.trim()) {
      alert("Informe o nome.");
      return;
    }
    const { error } = await supabase.from("analysis_responsibles").insert({
      name: respName.trim(),
      professional_reg: respReg.trim() || null,
      email: respEmail.trim() || null,
    });
    if (error) {
      alert(error.message.includes("does not exist") ? "Crie as tabelas no Supabase (ficheiro supabase/migrations/20260424120000_analysis_configuration.sql)." : "Erro: " + error.message);
      return;
    }
    setRespName("");
    setRespReg("");
    setRespEmail("");
    reload();
  }

  async function addLab() {
    if (!labName.trim()) {
      alert("Informe o nome do laboratório.");
      return;
    }
    const { error } = await supabase.from("laboratories").insert({
      name: labName.trim(),
    });
    if (error) {
      alert(error.message.includes("does not exist") ? "Crie as tabelas no Supabase (ver migração analysis_configuration)." : "Erro: " + error.message);
      return;
    }
    setLabName("");
    reload();
  }

  async function addParamDefinition() {
    if (!newParamLabel.trim()) {
      alert("Informe o nome do novo parâmetro.");
      return;
    }
    if (!newParamUnit.trim()) {
      alert("Informe a unidade (ex: %, kcal/kg).");
      return;
    }
    const parameter_key = newParameterKeyFromLabel(newParamLabel);
    const { error } = await supabase.from("analysis_parameter_definitions").insert({
      parameter_key,
      label: newParamLabel.trim(),
      unit: newParamUnit.trim(),
      default_method: newParamDefaultMethod.trim() || null,
    });
    if (error) {
      alert(error.message.includes("does not exist") ? "Execute a migração analysis_parameter_definitions no Supabase." : "Erro: " + error.message);
      return;
    }
    setNewParamLabel("");
    setNewParamUnit("");
    setNewParamDefaultMethod("");
    reload();
  }

  async function removeParamDefinition(row: ParamDefinitionRow) {
    if (!confirm(`Remover o parâmetro «${row.label}»?`)) return;
    setEditingKey(null);
    const { count: limCount, error: le } = await supabase
      .from("acceptable_limits")
      .select("id", { count: "exact", head: true })
      .eq("parameter_key", row.parameter_key);
    if (le) {
      console.error(le);
    } else if (limCount != null && limCount > 0) {
      alert(`Existem ${limCount} limite(s) associados a este parâmetro. Remova-os primeiro na tabela de limites abaixo.`);
      return;
    }
    const { count: metCount, error: me } = await supabase
      .from("analysis_methods")
      .select("id", { count: "exact", head: true })
      .eq("parameter_key", row.parameter_key);
    if (me) {
      console.error(me);
    } else if (metCount != null && metCount > 0) {
      alert(`Existem ${metCount} método(s) associados a este parâmetro. Remova ou altere-os na secção Métodos.`);
      return;
    }
    const { error } = await supabase.from("analysis_parameter_definitions").delete().eq("id", row.id);
    if (error) {
      alert("Erro ao remover: " + error.message);
      return;
    }
    reload();
  }

  async function addMethod() {
    if (!metName.trim()) {
      alert("Informe o nome do método.");
      return;
    }
    const { error } = await supabase.from("analysis_methods").insert({
      name: metName.trim(),
      norm_reference: metNorm.trim() || null,
      description: metDesc.trim() || null,
      parameter_key: metParam.trim() || null,
    });
    if (error) {
      alert(error.message.includes("does not exist") ? "Crie as tabelas no Supabase (ver migração analysis_configuration)." : "Erro: " + error.message);
      return;
    }
    setMetName("");
    setMetNorm("");
    setMetDesc("");
    setMetParam("");
    reload();
  }

  async function addLimit() {
    if (!limBio || !biomassTypes.length) {
      alert("Cadastre pelo menos um tipo de biomassa antes de definir limites.");
      return;
    }
    const def = PARAM_DEFS.find((p) => p.id === limParam);
    const customDef = paramDefinitions.find((d) => d.parameter_key === limParam);
    const { error } = await supabase.from("acceptable_limits").upsert(
      {
        biomass_type_id: limBio,
        parameter_key: limParam,
        unit: def?.unit ?? customDef?.unit ?? "%",
        limit_min: limMin.trim() || null,
        limit_max: limMax.trim() || null,
        applies_to: limApplies.trim() || "Geral",
      },
      { onConflict: "biomass_type_id,parameter_key" },
    );
    if (error) {
      alert(error.message.includes("does not exist") ? "Crie a tabela acceptable_limits no Supabase." : "Erro: " + error.message);
      return;
    }
    setLimMin("");
    setLimMax("");
    reload();
  }

  async function removeRow(table: string, id: string, label: string) {
    if (!confirm(`Remover ${label}?`)) return;
    setEditingKey(null);

    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      const msg = error.message ?? "";
      const fk =
        error.code === "23503" ||
        msg.includes("foreign key constraint") ||
        msg.includes("violates foreign key");
      if (fk) {
        alert(
            "Não é possível remover este registo porque ainda está ligado a outros dados (por exemplo limites de análise ou análises).\n\n" +
            "Atualize ou elimine essas referências e tente novamente.",
        );
        return;
      }
      alert("Erro ao remover: " + msg);
      return;
    }
    reload();
  }

  function finishSaved() {
    setEditingKey(null);
    reload();
  }

  const show = (v: CadastroView) => cadastro === "todos" || cadastro === v;

  return (
    <div className="min-h-screen bg-transparent pb-16 pt-8">
      <div className="mx-auto max-w-[1440px] px-6 lg:px-10">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: primary }}>
              Configurações da plataforma
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-gray-500">
              Parametrize as informações utilizadas em todo o sistema. Os cadastros abaixo alteram campos e limites da tela de análises.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cadastros</label>
              <select
                className={`min-w-[240px] ${selectClass}`}
                value={cadastro}
                onChange={(e) => setCadastro(e.target.value as CadastroView)}
              >
                <option value="todos">Todos os cadastros</option>
                <option value="biomassa">1. Tipos de biomassa</option>
                <option value="responsaveis">2. Responsáveis por análise</option>
                <option value="laboratorios">3. Laboratórios</option>
                <option value="metodos">4. Métodos de análise</option>
                <option value="limites">5. Limites aceitáveis</option>
              </select>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 self-start rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <svg className="h-4 w-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" strokeLinecap="round" />
            </svg>
            Ajuda
          </button>
        </header>

        {loading ? (
          <p className="text-sm text-gray-500">A carregar cadastros…</p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          {show("biomassa") ? (
            <section className="rounded-xl border border-gray-100/80 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#8BC34A] ring-1 ring-emerald-100">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                      <path d="M11 20A7 7 0 0 1 9.8 6.1C15 5 17 8 17 8s-3 1-4 4-1.5 6.5-2 8M11 20s-1-4 1-6 4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">1. Cadastrar tipo de biomassa</h2>
                    <p className="mt-1 text-sm text-gray-500">Tipos disponíveis na nova análise e nos limites.</p>
                  </div>
                </div>
                <span className="text-xs text-gray-400">—</span>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <input className={`${inputClass} max-w-[200px]`} placeholder="Nome" value={bioName} onChange={(e) => setBioName(e.target.value)} />
                <input className={`${inputClass} min-w-[180px] flex-1`} placeholder="Descrição" value={bioDesc} onChange={(e) => setBioDesc(e.target.value)} />
                <button
                  type="button"
                  onClick={addBiomass}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
                  style={{ backgroundColor: primary }}
                >
                  + Novo tipo
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/90">
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Tipo de biomassa</th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Descrição</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice(biomassTypes).map((row) => (
                      <Fragment key={row.id}>
                        <tr className="border-b border-gray-50">
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-2 font-medium text-gray-900">
                              <span style={{ color: lime }} aria-hidden>
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                                  <path d="M11 20A7 7 0 0 1 9.8 6.1C15 5 17 8 17 8s-3 1-4 4-1.5 6.5-2 8M11 20s-1-4 1-6 4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </span>
                              {row.name}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-600">{row.description ?? "—"}</td>
                          <ActionsMenu
                            menuId={`biomass-${row.id}`}
                            openMenuId={openMenuId}
                            setOpenMenuId={setOpenMenuId}
                            onEdit={() => setEditingKey(`biomass-${row.id}`)}
                            onDelete={() => removeRow("biomass_types", row.id, row.name)}
                          />
                        </tr>
                        {editingKey === `biomass-${row.id}` ? (
                          <tr className="border-b border-gray-100 bg-gray-50/90">
                            <td colSpan={3} className="p-0">
                              <EditBiomassRow row={row} onClose={() => setEditingKey(null)} onSaved={finishSaved} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link href="/tipos-biomassa" className="mt-3 inline-flex text-sm font-semibold hover:underline" style={{ color: primary }}>
                Ver todos os tipos de biomassa →
              </Link>
            </section>
          ) : null}

          {show("responsaveis") ? (
            <section className="rounded-xl border border-gray-100/80 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">2. Cadastrar responsável por análise</h2>
                  <p className="mt-1 text-sm text-gray-500">Aparecem no campo &quot;Responsável pela análise&quot;.</p>
                </div>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <input className={`${inputClass} max-w-[200px]`} placeholder="Nome" value={respName} onChange={(e) => setRespName(e.target.value)} />
                <input className={`${inputClass} max-w-[200px]`} placeholder="Empresa" value={respReg} onChange={(e) => setRespReg(e.target.value)} />
                <input className={`${inputClass} min-w-[200px] flex-1`} placeholder="E-mail" value={respEmail} onChange={(e) => setRespEmail(e.target.value)} />
                <button type="button" onClick={addResponsible} className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: primary }}>
                  + Novo responsável
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/90">
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Responsável</th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Empresa</th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">E-mail</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice(responsibles).map((row) => (
                      <Fragment key={row.id}>
                        <tr className="border-b border-gray-50">
                          <td className="px-3 py-2.5 font-medium text-gray-900">{row.name}</td>
                          <td className="px-3 py-2.5 text-gray-600">{row.professional_reg ?? "—"}</td>
                          <td className="px-3 py-2.5 text-gray-600">{row.email ?? "—"}</td>
                          <ActionsMenu
                            menuId={`responsible-${row.id}`}
                            openMenuId={openMenuId}
                            setOpenMenuId={setOpenMenuId}
                            onEdit={() => setEditingKey(`responsible-${row.id}`)}
                            onDelete={() => removeRow("analysis_responsibles", row.id, row.name)}
                          />
                        </tr>
                        {editingKey === `responsible-${row.id}` ? (
                          <tr className="border-b border-gray-100 bg-gray-50/90">
                            <td colSpan={4} className="p-0">
                              <EditResponsibleRow row={row} onClose={() => setEditingKey(null)} onSaved={finishSaved} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link href="/configuracoes?cadastro=responsaveis" className="mt-3 inline-flex text-sm font-semibold hover:underline" style={{ color: primary }}>
                Ver todos os responsáveis →
              </Link>
            </section>
          ) : null}

          {show("laboratorios") ? (
            <section className="rounded-xl border border-gray-100/80 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-teal-800 ring-1 ring-emerald-100">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                    <path d="M9 3h6v18H9zM12 7v4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">3. Cadastrar laboratório</h2>
                  <p className="mt-1 text-sm text-gray-500">Lista o campo &quot;Laboratório / local&quot; na nova análise.</p>
                </div>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <input className={`${inputClass} min-w-[240px] flex-1`} placeholder="Nome do laboratório" value={labName} onChange={(e) => setLabName(e.target.value)} />
                <button type="button" onClick={addLab} className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: primary }}>
                  + Novo laboratório
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full min-w-[320px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/90">
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Laboratório</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice(labs).map((row) => (
                      <Fragment key={row.id}>
                        <tr className="border-b border-gray-50">
                          <td className="px-3 py-2.5 font-medium text-gray-900">{row.name}</td>
                          <ActionsMenu
                            menuId={`lab-${row.id}`}
                            openMenuId={openMenuId}
                            setOpenMenuId={setOpenMenuId}
                            onEdit={() => setEditingKey(`lab-${row.id}`)}
                            onDelete={() => removeRow("laboratories", row.id, row.name)}
                          />
                        </tr>
                        {editingKey === `lab-${row.id}` ? (
                          <tr className="border-b border-gray-100 bg-gray-50/90">
                            <td colSpan={2} className="p-0">
                              <EditLabRow row={row} onClose={() => setEditingKey(null)} onSaved={finishSaved} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link href="/configuracoes?cadastro=laboratorios" className="mt-3 inline-flex text-sm font-semibold hover:underline" style={{ color: primary }}>
                Ver todos os laboratórios →
              </Link>
            </section>
          ) : null}

          {show("metodos") ? (
            <section className="rounded-xl border border-gray-100/80 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">4. Cadastrar método de análise</h2>
                  <p className="mt-1 text-sm text-gray-500">Opcional: associe um parâmetro para filtrar na nova análise.</p>
                </div>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <input className={`${inputClass} min-w-[160px] flex-1`} placeholder="Método" value={metName} onChange={(e) => setMetName(e.target.value)} />
                <input className={`${inputClass} min-w-[160px] flex-1`} placeholder="Norma / referência" value={metNorm} onChange={(e) => setMetNorm(e.target.value)} />
                <input className={`${inputClass} min-w-[200px] flex-1`} placeholder="Descrição" value={metDesc} onChange={(e) => setMetDesc(e.target.value)} />
                <select className={selectClass} value={metParam} onChange={(e) => setMetParam(e.target.value)}>
                  <option value="">Todos os parâmetros</option>
                  {PARAM_DEFS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                  {paramDefinitions.map((c) => (
                    <option key={c.parameter_key} value={c.parameter_key}>
                      {c.label} (personalizado)
                    </option>
                  ))}
                </select>
                <button type="button" onClick={addMethod} className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: primary }}>
                  + Novo método
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/90">
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Método</th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Norma / referência</th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Descrição</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice(methods).map((row) => (
                      <Fragment key={row.id}>
                        <tr className="border-b border-gray-50">
                          <td className="px-3 py-2.5 font-medium text-gray-900">
                            {row.name}
                            {row.parameter_key ? (
                              <span className="ml-2 text-xs font-normal text-gray-400">({paramDefById(row.parameter_key)?.label ?? row.parameter_key})</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600">{row.norm_reference ?? "—"}</td>
                          <td className="px-3 py-2.5 text-gray-600">{row.description ?? "—"}</td>
                          <ActionsMenu
                            menuId={`method-${row.id}`}
                            openMenuId={openMenuId}
                            setOpenMenuId={setOpenMenuId}
                            onEdit={() => setEditingKey(`method-${row.id}`)}
                            onDelete={() => removeRow("analysis_methods", row.id, row.name)}
                          />
                        </tr>
                        {editingKey === `method-${row.id}` ? (
                          <tr className="border-b border-gray-100 bg-gray-50/90">
                            <td colSpan={4} className="p-0">
                              <EditMethodRow row={row} customParamDefs={paramDefinitions} onClose={() => setEditingKey(null)} onSaved={finishSaved} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link href="/configuracoes?cadastro=metodos" className="mt-3 inline-flex text-sm font-semibold hover:underline" style={{ color: primary }}>
                Ver todos os métodos →
              </Link>
            </section>
          ) : null}
        </div>

        {show("limites") ? (
          <section className="mt-6 rounded-xl border border-gray-100/80 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-col gap-4 border-b border-gray-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">5. Cadastrar limites aceitáveis</h2>
                  <p className="mt-1 text-sm text-gray-500">Defina os limites por tipo de biomassa; estes valores aparecem na coluna &quot;Limite aceitável&quot; ao criar uma nova análise.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-500">Tipo de biomassa</span>
                  <select className={`min-w-[220px] ${selectClass}`} value={limBio} onChange={(e) => setLimBio(e.target.value)} disabled={!biomassTypes.length}>
                    {!biomassTypes.length ? <option value="">Sem tipos cadastrados</option> : null}
                    {biomassTypes.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={addLimit} className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: primary }}>
                  + Novo limite
                </button>
              </div>
            </div>
            <div className="mb-6 rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-4">
              <p className="mb-1 text-sm font-semibold text-gray-900">+ Novo parâmetro</p>
              <p className="mb-3 text-sm text-gray-600">
                Parâmetros que ainda não estão na lista fixa (umidade, cinzas, etc.) ficam disponíveis para limites, métodos e na nova análise.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <input className={`${inputClass} min-w-[180px] flex-1`} placeholder="Nome do parâmetro" value={newParamLabel} onChange={(e) => setNewParamLabel(e.target.value)} />
                <input className={`${inputClass} w-24`} placeholder="Unidade" value={newParamUnit} onChange={(e) => setNewParamUnit(e.target.value)} />
                <input className={`${inputClass} min-w-[200px] flex-1`} placeholder="Método padrão (opcional)" value={newParamDefaultMethod} onChange={(e) => setNewParamDefaultMethod(e.target.value)} />
                <button type="button" onClick={addParamDefinition} className="rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: primary }}>
                  + Novo parâmetro
                </button>
              </div>
            </div>
            {paramDefinitions.length > 0 ? (
              <div className="mb-6 overflow-x-auto rounded-lg border border-gray-100">
                <p className="border-b border-gray-100 bg-gray-50/90 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Parâmetros personalizados</p>
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/90">
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Parâmetro</th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Chave</th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Unidade</th>
                      <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Método padrão</th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paramDefinitions.map((row) => (
                      <Fragment key={row.id}>
                        <tr className="border-b border-gray-50">
                          <td className="px-3 py-2.5 font-medium text-gray-900">{row.label}</td>
                          <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{row.parameter_key}</td>
                          <td className="px-3 py-2.5 text-gray-600">{row.unit}</td>
                          <td className="px-3 py-2.5 text-gray-600">{row.default_method ?? "—"}</td>
                          <ActionsMenu
                            menuId={`paramdef-${row.id}`}
                            openMenuId={openMenuId}
                            setOpenMenuId={setOpenMenuId}
                            onEdit={() => setEditingKey(`paramdef-${row.id}`)}
                            onDelete={() => removeParamDefinition(row)}
                          />
                        </tr>
                        {editingKey === `paramdef-${row.id}` ? (
                          <tr className="border-b border-gray-100 bg-gray-50/90">
                            <td colSpan={5} className="p-0">
                              <EditParamDefRow row={row} onClose={() => setEditingKey(null)} onSaved={finishSaved} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <select className={selectClass} value={limParam} onChange={(e) => setLimParam(e.target.value)}>
                <optgroup label="Parâmetros padrão">
                  {PARAM_DEFS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label} ({p.unit})
                    </option>
                  ))}
                </optgroup>
                {paramDefinitions.length > 0 ? (
                  <optgroup label="Parâmetros personalizados">
                    {paramDefinitions.map((c) => (
                      <option key={c.parameter_key} value={c.parameter_key}>
                        {c.label} ({c.unit})
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              <input className={inputClass} placeholder='Limite mínimo (ex: ≤ 55,00)' value={limMin} onChange={(e) => setLimMin(e.target.value)} />
              <input className={inputClass} placeholder="Limite máximo (ex: ≤ 3,00)" value={limMax} onChange={(e) => setLimMax(e.target.value)} />
              <input className={inputClass} placeholder="Aplicável para" value={limApplies} onChange={(e) => setLimApplies(e.target.value)} />
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/90">
                    <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Parâmetro</th>
                    <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Unidade</th>
                    <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Limite mínimo</th>
                    <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Limite máximo</th>
                    <th className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-600">Aplicável para</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {limitsFiltered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">
                        Nenhum limite para este tipo de biomassa. Utilize &quot;+ Novo limite&quot; para adicionar.
                      </td>
                    </tr>
                  ) : (
                    (cadastro === "todos" ? limitsFiltered.slice(0, 5) : limitsFiltered).map((row) => {
                      const pLabel = resolveParamLabel(row.parameter_key, paramDefinitions);
                      const bioName = biomassTypes.find((b) => b.id === row.biomass_type_id)?.name ?? "—";
                      return (
                        <Fragment key={row.id}>
                          <tr className="border-b border-gray-50">
                            <td className="px-3 py-2.5 font-medium text-gray-900">
                              {pLabel}
                              <span className="mt-0.5 block text-xs font-normal text-gray-400">{bioName}</span>
                            </td>
                            <td className="px-3 py-2.5 text-gray-600">{row.unit}</td>
                            <td className="px-3 py-2.5 text-gray-700">{row.limit_min ?? "—"}</td>
                            <td className="px-3 py-2.5 text-gray-700">{row.limit_max ?? "—"}</td>
                            <td className="px-3 py-2.5 text-gray-600">{row.applies_to}</td>
                            <ActionsMenu
                              menuId={`limit-${row.id}`}
                              openMenuId={openMenuId}
                              setOpenMenuId={setOpenMenuId}
                              onEdit={() => setEditingKey(`limit-${row.id}`)}
                              onDelete={() => removeRow("acceptable_limits", row.id, "este limite")}
                            />
                          </tr>
                          {editingKey === `limit-${row.id}` ? (
                            <tr className="border-b border-gray-100 bg-gray-50/90">
                              <td colSpan={6} className="p-0">
                                <EditLimitRow
                                  row={row}
                                  paramLabel={resolveParamLabel(row.parameter_key, paramDefinitions)}
                                  onClose={() => setEditingKey(null)}
                                  onSaved={finishSaved}
                                />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Link href="/configuracoes?cadastro=limites" className="mt-3 inline-flex text-sm font-semibold hover:underline" style={{ color: primary }}>
              Ver todos os limites aceitáveis →
            </Link>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export default function ConfiguracoesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center bg-transparent text-sm text-gray-500">A carregar…</div>
      }
    >
      <ConfigInner />
    </Suspense>
  );
}
