import type { SupabaseClient } from "@supabase/supabase-js";

export type LabAnalysisRow = {
  id: string;
  created_at: string;
  moisture: number | null;
  impurity: number | null;
  granulometry: string | null;
  density: number | null;
  ash: number | null;
  calorific_value: number | null;
  fine_material: number | null;
  analyst: string | null;
  analysis_date: string | null;
  notes: string | null;
  analysis_code: string | null;
  sample_id: string | null;
  biomass_types: { name: string } | null;
  suppliers: { name: string } | null;
  lab_samples: { code: string; quadrant: string | null } | null;
};

const LAB_ANALYSIS_BASE_FIELDS = `
id,
created_at,
moisture,
impurity,
granulometry,
density,
ash,
calorific_value,
fine_material,
analyst,
analysis_date,
notes`;

function isSchemaRelationshipOrColumnError(msg: string | undefined): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return (
    m.includes("relationship") ||
    m.includes("schema cache") ||
    m.includes("does not exist") ||
    (m.includes("column") && m.includes("lab_analyses"))
  );
}

const SELECT_VARIANTS = [
  `
${LAB_ANALYSIS_BASE_FIELDS},
analysis_code,
sample_id,
biomass_types(name),
suppliers(name),
lab_samples(code, quadrant)
`,
  `
${LAB_ANALYSIS_BASE_FIELDS},
analysis_code,
sample_id,
lab_samples(code, quadrant)
`,
  `
${LAB_ANALYSIS_BASE_FIELDS},
analysis_code,
sample_id
`,
  `
${LAB_ANALYSIS_BASE_FIELDS}
`,
];

export async function fetchLabAnalysesList(client: SupabaseClient): Promise<{ data: LabAnalysisRow[]; error: string | null }> {
  let lastMessage: string | null = null;
  for (const sel of SELECT_VARIANTS) {
    const { data: rows, error } = await client.from("lab_analyses").select(sel).order("created_at", { ascending: false });
    if (!error && rows) {
      return { data: rows as unknown as LabAnalysisRow[], error: null };
    }
    lastMessage = error?.message ?? "Erro desconhecido";
    if (!isSchemaRelationshipOrColumnError(error?.message)) break;
  }
  return { data: [], error: lastMessage };
}

export async function fetchLabAnalysisById(
  client: SupabaseClient,
  id: string,
): Promise<{ data: LabAnalysisRow | null; error: string | null }> {
  let lastMessage: string | null = null;
  for (const sel of SELECT_VARIANTS) {
    const { data: row, error } = await client.from("lab_analyses").select(sel).eq("id", id).maybeSingle();
    if (!error) {
      return { data: (row as unknown as LabAnalysisRow) ?? null, error: null };
    }
    lastMessage = error?.message ?? "Erro desconhecido";
    if (!isSchemaRelationshipOrColumnError(error?.message)) break;
  }
  return { data: null, error: lastMessage };
}
