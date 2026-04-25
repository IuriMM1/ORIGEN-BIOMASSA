"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Collection = {
  id: string;
  collector: string | null;
  collection_date: string | null;
  quadrants: string | null;
  points: number | null;
  raw_sample_weight: number | null;
  reduced_sample_weight: number | null;
  method: string | null;
  notes: string | null;
};

export default function ColetasPage() {
  const [collections, setCollections] = useState<Collection[]>([]);

  const [collector, setCollector] = useState("");
  const [collectionDate, setCollectionDate] = useState("");
  const [quadrants, setQuadrants] = useState("");
  const [points, setPoints] = useState("");
  const [rawSampleWeight, setRawSampleWeight] = useState("");
  const [reducedSampleWeight, setReducedSampleWeight] = useState("");
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");

  const loadCollections = useCallback(async () => {
    const { data, error } = await supabase
      .from("sample_collections")
      .select(
        `
        id,
        collector,
        collection_date,
        quadrants,
        points,
        raw_sample_weight,
        reduced_sample_weight,
        method,
        notes
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      alert("Erro ao carregar coletas: " + error.message);
      return;
    }

    setCollections((data as unknown as Collection[]) || []);
  }, []);

  async function createCollection() {
    if (!collector.trim()) {
      alert("Informe o responsável pela coleta");
      return;
    }

    const payload: Record<string, unknown> = {
      lot_id: null,
      collector,
      collection_date: collectionDate || null,
      quadrants,
      points: points ? Number(points) : null,
      raw_sample_weight: rawSampleWeight ? Number(rawSampleWeight) : null,
      reduced_sample_weight: reducedSampleWeight ? Number(reducedSampleWeight) : null,
      method,
      notes,
    };

    let { error } = await supabase.from("sample_collections").insert(payload as never);

    if (error?.message?.toLowerCase().includes("lot_id") && error.message.toLowerCase().includes("null")) {
      alert(
        "A base de dados ainda exige lote nesta tabela. Aplique a migração que torna `sample_collections.lot_id` opcional (ficheiro `20260428140000_...` em `supabase/migrations`).",
      );
      return;
    }

    if (error) {
      alert("Erro ao salvar coleta: " + error.message);
      return;
    }

    setCollector("");
    setCollectionDate("");
    setQuadrants("");
    setPoints("");
    setRawSampleWeight("");
    setReducedSampleWeight("");
    setMethod("");
    setNotes("");

    loadCollections();
  }

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  return (
    <main className="min-h-screen bg-transparent p-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-6 text-3xl font-bold text-gray-900">Coleta de Amostras</h1>

        <div className="mb-8 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">Registrar coleta</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <input
              className="rounded border p-2"
              placeholder="Responsável pela coleta"
              value={collector}
              onChange={(e) => setCollector(e.target.value)}
            />

            <input
              className="rounded border p-2"
              type="datetime-local"
              value={collectionDate}
              onChange={(e) => setCollectionDate(e.target.value)}
            />

            <input
              className="rounded border p-2"
              placeholder="Quadrantes coletados"
              value={quadrants}
              onChange={(e) => setQuadrants(e.target.value)}
            />

            <input
              className="rounded border p-2"
              type="number"
              placeholder="Número de pontos"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />

            <input
              className="rounded border p-2"
              type="number"
              placeholder="Massa amostra bruta"
              value={rawSampleWeight}
              onChange={(e) => setRawSampleWeight(e.target.value)}
            />

            <input
              className="rounded border p-2"
              type="number"
              placeholder="Massa amostra reduzida"
              value={reducedSampleWeight}
              onChange={(e) => setReducedSampleWeight(e.target.value)}
            />

            <input
              className="rounded border p-2"
              placeholder="Método de coleta"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            />

            <input
              className="rounded border p-2 md:col-span-2"
              placeholder="Observações"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={createCollection}
            className="mt-4 rounded bg-[#0B3D2E] px-5 py-2 font-semibold text-white hover:bg-green-800"
          >
            Salvar coleta
          </button>
        </div>

        <div className="rounded-2xl border border-[#DDE7E1] bg-white/90 p-6 shadow-sm backdrop-blur">
          <h2 className="mb-4 text-xl font-semibold">Coletas registradas</h2>

          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b">
                <th className="p-2">Coletor</th>
                <th className="p-2">Data</th>
                <th className="p-2">Quadrantes</th>
                <th className="p-2">Pontos</th>
                <th className="p-2">Amostra bruta</th>
                <th className="p-2">Amostra reduzida</th>
                <th className="p-2">Observações</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((collection) => (
                <tr key={collection.id} className="border-b">
                  <td className="p-2">{collection.collector}</td>
                  <td className="p-2">{collection.collection_date}</td>
                  <td className="p-2">{collection.quadrants}</td>
                  <td className="p-2">{collection.points}</td>
                  <td className="p-2">{collection.raw_sample_weight}</td>
                  <td className="p-2">{collection.reduced_sample_weight}</td>
                  <td className="max-w-[200px] truncate p-2 text-gray-600" title={collection.notes ?? undefined}>
                    {collection.notes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
