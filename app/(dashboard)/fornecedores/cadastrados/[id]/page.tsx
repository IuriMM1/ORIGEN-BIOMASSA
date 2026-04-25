"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  enrichSupplierDisplay,
  formatDate,
  formatPhone,
  getDisplayStatus,
  initials,
  type RowStatus,
  type SupplierRow,
} from "../../_fornecedor-utils";

const primary = "#143328";

function StatusBadge({ status }: { status: RowStatus }) {
  const styles: Record<RowStatus, string> = {
    Ativo: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80",
    Pendente: "bg-amber-100 text-amber-900 ring-1 ring-amber-200/80",
    Inativo: "bg-red-100 text-red-800 ring-1 ring-red-200/80",
  };
  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{status}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-900">{children ?? "—"}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-100/80 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="mb-6 border-b border-gray-100 pb-3 text-sm font-semibold" style={{ color: primary }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function FornecedorDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [supplier, setSupplier] = useState<SupplierRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (!id) {
      setMissing(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("suppliers").select("*").eq("id", id).maybeSingle();
      if (cancelled) return;
      setLoading(false);
      if (error || !data) {
        setMissing(true);
        setSupplier(null);
        return;
      }
      setSupplier(data as SupplierRow);
      setMissing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function persistStatus(next: "ativo" | "inativo") {
    if (!supplier) return;
    setUpdatingStatus(true);
    const { error } = await supabase.from("suppliers").update({ status: next }).eq("id", supplier.id);
    setUpdatingStatus(false);
    if (error) {
      const msg = error.message.toLowerCase();
      alert(
        msg.includes("column") || msg.includes("schema") || msg.includes("status")
          ? "Crie a coluna `status` na tabela `suppliers` no Supabase. Veja o ficheiro supabase/migrations/20260225120000_suppliers_status.sql neste projeto."
          : "Não foi possível atualizar: " + error.message,
      );
      return;
    }
    setSupplier({ ...supplier, status: next });
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-transparent text-gray-500">
        Carregando…
      </div>
    );
  }

  if (missing || !supplier) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-gray-600">Fornecedor não encontrado.</p>
        <Link href="/fornecedores/cadastrados" className="mt-4 inline-block text-sm font-semibold hover:underline" style={{ color: primary }}>
          Voltar à lista
        </Link>
      </div>
    );
  }

  const d = enrichSupplierDisplay(supplier);
  const situacao = getDisplayStatus(supplier);
  const emDash = "—";

  return (
    <div className="min-h-screen bg-transparent pb-12 pt-8">
      <div className="mx-auto max-w-[1000px] px-6 lg:px-10">
        <button
          type="button"
          onClick={() => router.push("/fornecedores/cadastrados")}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-gray-900"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Voltar para fornecedores cadastrados
        </button>

        <header className="mb-8 flex flex-col gap-4 border-b border-gray-200/80 pb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {supplier.logo_url ? (
              <img
                src={supplier.logo_url}
                alt=""
                className="h-16 w-16 shrink-0 rounded-full border border-gray-200/90 bg-white object-cover shadow-sm"
              />
            ) : (
              <span
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                style={{ backgroundColor: primary }}
              >
                {initials(supplier.name)}
              </span>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">{supplier.name}</h1>
              <p className="mt-1 text-sm text-gray-500">{d.cnpj}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={situacao} />
                <span className="text-xs text-gray-500">Cadastrado em {formatDate(supplier.created_at)}</span>
              </div>
            </div>
          </div>
          <Link
            href={`/fornecedores/cadastro?edit=${supplier.id}`}
            className="inline-flex shrink-0 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105"
            style={{ backgroundColor: primary }}
          >
            Editar cadastro
          </Link>
        </header>

        <div className="space-y-6">
          <Section title="Situação no sistema">
            <p className="mb-5 max-w-xl text-sm leading-relaxed text-gray-600">
              Altere entre <strong className="text-gray-800">Ativo</strong> e <strong className="text-gray-800">Inativo</strong>. Inativos podem ser excluídos de fluxos operacionais até serem reativados.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <StatusBadge status={situacao} />
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100/90 p-1 shadow-inner">
                <button
                  type="button"
                  disabled={updatingStatus || situacao === "Ativo"}
                  onClick={() => persistStatus("ativo")}
                  className={`rounded-md px-5 py-2.5 text-sm font-semibold transition ${
                    situacao === "Ativo" ? "bg-white text-[#143328] shadow-sm" : "text-gray-600 hover:text-gray-900"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  Ativo
                </button>
                <button
                  type="button"
                  disabled={updatingStatus || situacao === "Inativo"}
                  onClick={() => persistStatus("inativo")}
                  className={`rounded-md px-5 py-2.5 text-sm font-semibold transition ${
                    situacao === "Inativo" ? "bg-white text-[#143328] shadow-sm" : "text-gray-600 hover:text-gray-900"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  Inativo
                </button>
              </div>
            </div>
            {updatingStatus ? <p className="mt-3 text-xs text-gray-500">Salvando…</p> : null}
          </Section>

          <Section title="Dados do fornecedor">
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Razão social">{supplier.name}</Field>
              <Field label="Nome fantasia">{emDash}</Field>
              <Field label="CNPJ">{d.cnpj}</Field>
              <Field label="Inscrição estadual">{emDash}</Field>
              <Field label="Inscrição municipal">{emDash}</Field>
              <Field label="Ramo de atividade">{emDash}</Field>
              <Field label="Telefone">{formatPhone(supplier.phone)}</Field>
              <Field label="E-mail">{supplier.email ?? emDash}</Field>
              <Field label="Website">{emDash}</Field>
            </div>
          </Section>

          <Section title="Responsável / Contato principal">
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Nome completo">{supplier.contact ?? emDash}</Field>
              <Field label="Cargo">{emDash}</Field>
              <Field label="Telefone">{formatPhone(supplier.phone)}</Field>
              <Field label="E-mail">{supplier.email ?? emDash}</Field>
            </div>
          </Section>

          <Section title="Informações comerciais">
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Tipo de fornecedor">{d.tipo}</Field>
              <Field label="Condição de pagamento">{d.condicaoPagamento}</Field>
              <Field label="Prazo de entrega médio">{d.prazoEntrega} dias</Field>
              <Field label="Volume médio mensal fornecido">{d.volumeMensal} ton</Field>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Tipo de biomassa fornecida</p>
                <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-gray-900">
                  <span className="text-[#8BC34A]" aria-hidden>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M11 20A7 7 0 0 1 9.8 6.1C15 5 17 8 17 8s-3 1-4 4-1.5 6.5-2 8M11 20s-1-4 1-6 4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {d.bio}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Observações</p>
                <p className="mt-1 text-sm text-gray-600">{emDash}</p>
              </div>
            </div>
          </Section>

          <Section title="Endereço">
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="CEP">{emDash}</Field>
              <Field label="Endereço">{emDash}</Field>
              <Field label="Número">{emDash}</Field>
              <Field label="Complemento">{emDash}</Field>
              <Field label="Bairro">{supplier.region ?? emDash}</Field>
              <Field label="Cidade">{supplier.city ?? emDash}</Field>
              <Field label="UF">{supplier.state ?? emDash}</Field>
            </div>
            <div className="mt-6 flex gap-3 rounded-lg border border-[#c8e6c9] bg-[#e8f5e9] px-4 py-3 text-sm text-gray-800">
              <svg className="mt-0.5 h-5 w-5 shrink-0" style={{ color: primary }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p>
                {[supplier.region, supplier.city, supplier.state].filter(Boolean).length > 0
                  ? [supplier.region, supplier.city, supplier.state].filter(Boolean).join(" · ")
                  : "Endereço completo não informado no cadastro."}
              </p>
            </div>
          </Section>

          <Section title="Documentos">
            <p className="text-sm text-gray-600">Documentos anexados não estão disponíveis nesta visualização até a integração com armazenamento de arquivos.</p>
            <ul className="mt-4 space-y-2 text-sm text-gray-500">
              <li>• Contrato social / Estatuto</li>
              <li>• CNPJ</li>
              <li>• Inscrição estadual</li>
              <li>• Comprovante de endereço</li>
              <li>• Outros documentos</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}
