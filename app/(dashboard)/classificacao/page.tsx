"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Analysis = {
  id: string;
  lot_id: string | null;
  moisture: number | null;
  impurity: number | null;
  analyst: string | null;
  analysis_code: string | null;
  biomass_types: { name: string } | null;
  lab_samples: { code: string } | null;
};

type Classification = {
  id: string;
  class: string | null;
  technical_note: string | null;
  lot_id: string | null;
  lab_analysis_id: string | null;
  lots: { origin: string | null; vehicle_plate: string | null } | null;
  lab_analyses: { analysis_code: string | null; id: string } | null;
};

function classifyBiomass(moisture: number | null, impurity: number | null) {
  if (moisture === null || impurity === null) {
    return {
      class: "Incompleto",
      note: "Análise incompleta. Informe umidade e impureza.",
    };
  }

  if (moisture <= 30 && impurity <= 3) {
    return {
      class: "A",
      note: "Biomassa com boa qualidade para uso industrial.",
    };
  }

  if (moisture <= 40 && impurity <= 6) {
    return {
      class: "B",
      note: "Biomassa aceitável, com atenção para eficiência de queima.",
    };
  }

  if (moisture <= 50 && impurity <= 10) {
    return {
      class: "C",
      note: "Biomassa de baixa qualidade. Recomenda-se avaliação comercial.",
    };
  }

  return {
    class: "Reprovado",
    note: "Biomassa fora dos limites mínimos definidos.",
  };
}

function analysisLabel(a: Analysis): string {
  const code = a.analysis_code?.trim();
  const bio = a.biomass_types?.name ?? "—";
  const sample = a.lab_samples?.code?.trim();
  const head = code || sample || `Análise ${a.id.slice(0, 8)}…`;
  return `${head} · ${bio} · Umidade: ${a.moisture}% · Impureza: ${a.impurity}%`;
}

function classificationContext(c: Classification): string {
  const ac = c.lab_analyses?.analysis_code?.trim();
  if (ac) return ac;
  if (c.lab_analyses?.id) return `Análise ${c.lab_analyses.id.slice(0, 8)}…`;
  if (c.lots?.origin || c.lots?.vehicle_plate) {
    return [c.lots?.origin, c.lots?.vehicle_plate].filter(Boolean).join(" | ") || "—";
  }
  return "—";
}

export default function ClassificacaoPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [analysisId, setAnalysisId] = useState("");

  const loadAnalyses = useCallback(async () => {
    const { data, error } = await supabase
      .from("lab_analyses")
      .select(
        `
        id,
        lot_id,
        moisture,
        impurity,
        analyst,
        analysis_code,
        biomass_types(name),
        lab_samples(code)
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      alert("Erro ao carregar análises: " + error.message);
      return;
    }

    setAnalyses((data as unknown as Analysis[]) || []);
  }, []);

  const loadClassifications = useCallback(async () => {
    const full = await supabase.from("classifications").select(`
        id,
        class,
        technical_note,
        lot_id,
        lab_analysis_id,
        lab_analyses(id, analysis_code),
        lots(origin, vehicle_plate)
      `);

    if (!full.error && full.data) {
      setClassifications(full.data as unknown as Classification[]);
      return;
    }

    const legacy = await supabase.from("classifications").select(`
        id,
        class,
        technical_note,
        lot_id,
        lots(origin, vehicle_plate)
      `);
    if (legacy.error) {
      alert("Erro ao carregar classificações: " + legacy.error.message);
      return;
    }
    const rows = (legacy.data as unknown as Omit<Classification, "lab_analysis_id" | "lab_analyses">[]) || [];
    setClassifications(
      rows.map((r) => ({
        ...r,
        lab_analysis_id: null,
        lab_analyses: null,
      })),
    );
  }, []);

  async function createClassification() {
    const analysis = analyses.find((item) => item.id === analysisId);

    if (!analysis) {
      alert("Selecione uma análise");
      return;
    }

    const result = classifyBiomass(analysis.moisture, analysis.impurity);

    const insertPayload: Record<string, unknown> = {
      lot_id: analysis.lot_id ?? null,
      lab_analysis_id: analysis.id,
      class: result.class,
      technical_note: result.note,
    };

    let { error } = await supabase.from("classifications").insert(insertPayload);

    const msg = (error?.message ?? "").toLowerCase();
    if (msg.includes("lab_analysis_id") || msg.includes("schema cache") || /column.*does not exist/i.test(error?.message ?? "")) {
      const { error: e2 } = await supabase.from("classifications").insert({
        lot_id: analysis.lot_id ?? null,
        class: result.class,
        technical_note: result.note,
      });
      error = e2;
    }

    if (error) {
      alert(
        "Erro ao salvar classificação: " +
          error.message +
          "\n\nSe a mensagem falar de coluna ou schema, aplique as migrações Supabase mais recentes (inclui `lab_analysis_id` em `classifications`).",
      );
      return;
    }

    if (analysis.lot_id) {
      await supabase.from("lots").update({ status: "classificado" }).eq("id", analysis.lot_id);
    }

    setAnalysisId("");
    loadClassifications();
  }

  useEffect(() => {
    loadAnalyses();
    loadClassifications();
  }, [loadAnalyses, loadClassifications]);

  return (
    <main className="min-h-screen bg-transparent p-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-6 text-3xl font-bold text-gray-900">Classificação da Biomassa</h1>

        <div className="mb-8 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">Gerar classificação</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <select className="rounded border p-2" value={analysisId} onChange={(e) => setAnalysisId(e.target.value)}>
              <option value="">Selecione uma análise</option>
              {analyses.map((a) => (
                <option key={a.id} value={a.id}>
                  {analysisLabel(a)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={createClassification}
            className="mt-4 rounded bg-[#0B3D2E] px-5 py-2 font-semibold text-white hover:bg-green-800"
          >
            Classificar biomassa
          </button>
        </div>

        <div className="rounded-2xl border border-[#DDE7E1] bg-white/90 p-6 shadow-sm backdrop-blur">
          <h2 className="mb-4 text-xl font-semibold">Classificações geradas</h2>

          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b">
                <th className="p-2">Análise / referência</th>
                <th className="p-2">Classe</th>
                <th className="p-2">Parecer técnico</th>
              </tr>
            </thead>
            <tbody>
              {classifications.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="p-2">{classificationContext(item)}</td>
                  <td className="p-2 font-semibold">{item.class}</td>
                  <td className="p-2">{item.technical_note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
