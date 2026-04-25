/**
 * Parâmetros de análise alinhados entre Configurações (limites / métodos)
 * e a tela "Criar nova análise". `id` é a chave em `acceptable_limits.parameter_key`
 * e em `analysis_methods.parameter_key`.
 */
export type AnalysisLabField =
  | "moisture"
  | "ash"
  | "fine_material"
  | "calorific_value"
  | "density"
  | "impurity"
  | "granulometry"
  | "extra_carbono";

export type ParamDef = {
  id: string;
  label: string;
  unit: string;
  defaultMethod: string;
  defaultLimitDisplay: string;
  field: AnalysisLabField;
};

export const PARAM_DEFS: readonly ParamDef[] = [
  { id: "um", label: "Umidade", unit: "%", defaultMethod: "ABNT NBR 14774-2", defaultLimitDisplay: "≤ 55,00 %", field: "moisture" },
  { id: "cin", label: "Cinzas", unit: "%", defaultMethod: "ABNT NBR 14774-2", defaultLimitDisplay: "≤ 8,00 %", field: "ash" },
  { id: "mv", label: "Material volátil", unit: "%", defaultMethod: "ABNT NBR 14774-3", defaultLimitDisplay: "—", field: "fine_material" },
  { id: "cf", label: "Carbono fixo", unit: "%", defaultMethod: "Cálculo", defaultLimitDisplay: "—", field: "extra_carbono" },
  { id: "pcs", label: "PCS", unit: "kcal/kg", defaultMethod: "ABNT NBR 14775", defaultLimitDisplay: "≥ 2.500", field: "calorific_value" },
  { id: "dens", label: "Densidade aparente", unit: "kg/m³", defaultMethod: "ABNT NBR 6920", defaultLimitDisplay: "—", field: "density" },
  { id: "imp", label: "Impureza", unit: "%", defaultMethod: "ABNT NBR 14774-2", defaultLimitDisplay: "≤ 2,00 %", field: "impurity" },
] as const;

export function paramDefById(id: string): ParamDef | undefined {
  return PARAM_DEFS.find((p) => p.id === id);
}

export type CustomParamSummary = { parameter_key: string; label: string };

/** Rótulo para chave de parâmetro: built-in (`PARAM_DEFS`) ou cadastro personalizado. */
export function resolveParamLabel(parameterKey: string, custom: readonly CustomParamSummary[]): string {
  const built = paramDefById(parameterKey);
  if (built) return built.label;
  return custom.find((c) => c.parameter_key === parameterKey)?.label ?? parameterKey;
}

export function formatAcceptableLimitCell(
  limitMin: string | null | undefined,
  limitMax: string | null | undefined,
  unit: string | null | undefined,
  fallback: string,
): string {
  const min = limitMin?.trim();
  const max = limitMax?.trim();
  const u = unit?.trim();
  if (!min && !max) return fallback;
  const parts: string[] = [];
  if (min) parts.push(u && !min.includes(u) ? `${min} ${u}` : min);
  if (max) parts.push(u && !max.includes(u) ? `${max} ${u}` : max);
  const joined = parts.join(" · ");
  return joined || fallback;
}

/** Primeiro número decimal encontrado (vírgula ou ponto). */
export function parseLimitNumber(text: string | null | undefined): number | null {
  if (!text?.trim()) return null;
  const m = text.trim().match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  return Number(m[0].replace(",", "."));
}

export function parseAnalysisResultNumber(valueStr: string): number | null {
  const t = valueStr.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * `true` dentro do limite, `false` fora, `null` se não houver limite interpretável.
 * Aceita textos do tipo "≤ 55", "≥ 2500" ou dois números em min/max.
 */
export function valueConformsToConfiguredLimits(
  value: number,
  limitMin: string | null | undefined,
  limitMax: string | null | undefined,
): boolean | null {
  const a = limitMin?.trim() || "";
  const b = limitMax?.trim() || "";
  if (!a && !b) return null;
  const nA = a ? parseLimitNumber(a) : null;
  const nB = b ? parseLimitNumber(b) : null;
  if (nA != null && nB != null) {
    const lo = Math.min(nA, nB);
    const hi = Math.max(nA, nB);
    return value >= lo && value <= hi;
  }
  if (nA != null && !b) {
    if (/≤|<=|<|máx|max/i.test(a)) return value <= nA;
    if (/≥|>=|>|mín|min/i.test(a)) return value >= nA;
    return value >= nA;
  }
  if (nB != null && !a) {
    if (/≤|<=|<|máx|max/i.test(b)) return value <= nB;
    if (/≥|>=|>|mín|min/i.test(b)) return value >= nB;
    return value <= nB;
  }
  if (nA != null) return value >= nA;
  if (nB != null) return value <= nB;
  return null;
}
