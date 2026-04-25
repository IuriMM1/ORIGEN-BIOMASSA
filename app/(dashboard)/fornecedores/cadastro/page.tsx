"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ChangeEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { fetchMunicipiosByUf, UFS_BR } from "@/lib/ibge-municipios";
import { fetchViaCep, formatCepMask } from "@/lib/viacep";
import { uploadSupplierLogo } from "@/lib/supplier-logo-upload";
import { supabase } from "@/lib/supabase";
import { statusDbToAtivoInativo, type SupplierRow } from "../_fornecedor-utils";

const primary = "#143328";

function Req() {
  return <span className="text-red-500">*</span>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-5 border-b border-gray-100 pb-3 text-sm font-semibold" style={{ color: primary }}>
      {children}
    </h2>
  );
}

function Label({
  children,
  required,
  htmlFor,
}: {
  children: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-gray-700">
      {children}
      {required ? <Req /> : null}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#143328] focus:ring-1 focus:ring-[#143328]/30";

const selectClass = `${inputClass} appearance-none bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat pr-9`;

const selectChevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;

function normalizedCityName(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

function matchCityInList(lista: string[], localidade: string): string {
  const t = localidade.trim();
  if (!t) return "";
  const exact = lista.find((c) => c === t);
  if (exact) return exact;
  const n = normalizedCityName(t);
  const accent = lista.find((c) => normalizedCityName(c) === n);
  if (accent) return accent;
  return lista.find((c) => c.localeCompare(t, "pt-BR", { sensitivity: "accent" }) === 0) ?? t;
}

export default function FornecedoresCadastroPage() {
  return (
    <Suspense fallback={<div className="min-h-[30vh] bg-transparent px-6 py-10 text-center text-gray-500">A carregar…</div>}>
      <FornecedoresCadastroForm />
    </Suspense>
  );
}

function FornecedoresCadastroForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [razaoSocial, setRazaoSocial] = useState("Florestal Sul Ltda.");
  const [nomeFantasia, setNomeFantasia] = useState("Florestal Sul");
  const [cnpj, setCnpj] = useState("12.345.678/0001-90");
  const [inscEstadual, setInscEstadual] = useState("");
  const [inscMunicipal, setInscMunicipal] = useState("");
  const [ramo, setRamo] = useState("Comércio de Biomassa");
  const [telefone, setTelefone] = useState("");
  const [emailEmpresa, setEmailEmpresa] = useState("");
  const [website, setWebsite] = useState("");

  const [nomeCompleto, setNomeCompleto] = useState("");
  const [cargo, setCargo] = useState("Gerente Comercial");
  const [telefoneResp, setTelefoneResp] = useState("");
  const [emailResp, setEmailResp] = useState("");

  const [tipoFornecedor, setTipoFornecedor] = useState("");
  const [condicaoPagamento, setCondicaoPagamento] = useState("30 dias");
  const [prazoEntrega, setPrazoEntrega] = useState("");
  const [volumeMensal, setVolumeMensal] = useState("");
  const [tagsBiomassa, setTagsBiomassa] = useState<string[]>([]);
  const [biomassTypesFromConfig, setBiomassTypesFromConfig] = useState<{ id: string; name: string }[]>([]);
  const [biomassTypesLoadErr, setBiomassTypesLoadErr] = useState<string | null>(null);
  const [selectedBiomassToAdd, setSelectedBiomassToAdd] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const obsMax = 300;

  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [municipiosLoading, setMunicipiosLoading] = useState(false);
  const [municipiosErr, setMunicipiosErr] = useState<string | null>(null);

  const [statusDb, setStatusDb] = useState<"ativo" | "inativo">("ativo");
  const [saving, setSaving] = useState(false);

  const [serverLogoUrl, setServerLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null);
  const [logoCleared, setLogoCleared] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);
  /** Cidade a aplicar após carregar municípios do UF vindo do ViaCEP (evita aplicar se o UF mudar antes). */
  const pendingCepRef = useRef<{ uf: string; city: string } | null>(null);
  const ufRef = useRef(uf);

  const cepDigits = useMemo(() => cep.replace(/\D/g, "").slice(0, 8), [cep]);

  useEffect(() => {
    ufRef.current = uf;
  }, [uf]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("biomass_types").select("id, name").order("name");
      if (cancelled) return;
      if (error) {
        setBiomassTypesLoadErr(error.message);
        setBiomassTypesFromConfig([]);
        return;
      }
      setBiomassTypesLoadErr(null);
      setBiomassTypesFromConfig((data as { id: string; name: string }[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (editId) return;
    setServerLogoUrl(null);
    setLogoCleared(false);
    setLogoFile(null);
    setLogoObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [editId]);

  useEffect(() => {
    return () => {
      if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
    };
  }, [logoObjectUrl]);

  useEffect(() => {
    if (!uf) {
      setMunicipios([]);
      setMunicipiosLoading(false);
      setMunicipiosErr(null);
      setCidade("");
      pendingCepRef.current = null;
      return;
    }
    const ac = new AbortController();
    setMunicipiosLoading(true);
    setMunicipiosErr(null);
    setCidade("");
    (async () => {
      try {
        const lista = await fetchMunicipiosByUf(uf, ac.signal);
        if (ac.signal.aborted) return;
        setMunicipios(lista);
        const pending = pendingCepRef.current;
        if (pending && pending.uf === uf) {
          pendingCepRef.current = null;
          const matched = matchCityInList(lista, pending.city);
          if (matched) setCidade(matched);
        }
      } catch (e) {
        if (ac.signal.aborted) return;
        setMunicipios([]);
        setMunicipiosErr(e instanceof Error ? e.message : "Não foi possível carregar as cidades.");
      } finally {
        if (!ac.signal.aborted) setMunicipiosLoading(false);
      }
    })();
    return () => ac.abort();
  }, [uf]);

  useEffect(() => {
    if (cepDigits.length !== 8) return;
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      (async () => {
        try {
          const data = await fetchViaCep(cepDigits, ac.signal);
          if (ac.signal.aborted || !data) return;
          const ufApi = data.uf?.trim().toUpperCase();
          const loc = data.localidade?.trim() ?? "";
          setEndereco(data.logradouro?.trim() ?? "");
          setBairro(data.bairro?.trim() ?? "");
          setComplemento((prev) => (prev.trim() ? prev : data.complemento?.trim() ?? ""));
          if (data.cep) setCep(data.cep);
          else setCep(formatCepMask(cepDigits));

          if (!ufApi || !UFS_BR.includes(ufApi)) {
            pendingCepRef.current = null;
            return;
          }

          const ufUnchanged = ufRef.current === ufApi;
          if (ufUnchanged && loc) {
            pendingCepRef.current = null;
            try {
              const lista = await fetchMunicipiosByUf(ufApi, ac.signal);
              if (ac.signal.aborted) return;
              setMunicipios(lista);
              setMunicipiosErr(null);
              setCidade(matchCityInList(lista, loc));
            } catch {
              if (!ac.signal.aborted) setMunicipiosErr("Não foi possível carregar as cidades.");
            }
          } else {
            if (loc) pendingCepRef.current = { uf: ufApi, city: loc };
            else pendingCepRef.current = null;
            setUf(ufApi);
          }
        } catch {
          /* rede / abort */
        }
      })();
    }, 400);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [cepDigits]);

  useEffect(() => {
    let cancelled = false;
    if (!editId) return;
    (async () => {
      const { data, error } = await supabase.from("suppliers").select("*").eq("id", editId).maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        alert(error?.message ?? "Fornecedor não encontrado.");
        router.replace("/fornecedores/cadastro");
        return;
      }
      const row = data as SupplierRow;
      setLogoFile(null);
      setLogoCleared(false);
      setLogoObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setServerLogoUrl(row.logo_url ?? null);
      setRazaoSocial(row.name ?? "");
      setNomeFantasia("");
      setCnpj("");
      setInscEstadual("");
      setInscMunicipal("");
      setTelefone(row.phone ?? "");
      setEmailEmpresa(row.email ?? "");
      setNomeCompleto(row.contact ?? "");
      setBairro(row.region ?? "");
      setCep("");
      setEndereco("");
      setNumero("");
      setComplemento("");
      setStatusDb(statusDbToAtivoInativo(row));
      const st = (row.state ?? "").trim().toUpperCase();
      const ct = (row.city ?? "").trim();
      if (st && UFS_BR.includes(st)) {
        pendingCepRef.current = ct ? { uf: st, city: ct } : null;
        setUf(st);
      } else {
        pendingCepRef.current = null;
        setUf("");
        setCidade(ct);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId, router]);

  const enderecoPreview = useMemo(() => {
    const parts = [endereco, numero, complemento, bairro, cidade, uf].filter(Boolean);
    return parts.length ? parts.join(", ") : "Preencha o endereço para visualizar o resumo.";
  }, [endereco, numero, complemento, bairro, cidade, uf]);

  function addBiomassFromSelect() {
    const name = selectedBiomassToAdd.trim();
    if (!name) return;
    if (!biomassTypesFromConfig.some((b) => b.name === name)) return;
    if (tagsBiomassa.includes(name)) return;
    setTagsBiomassa((prev) => [...prev, name]);
    setSelectedBiomassToAdd("");
  }

  function removeTag(t: string) {
    setTagsBiomassa((prev) => prev.filter((x) => x !== t));
  }

  const logoDisplay = !logoCleared && (logoObjectUrl || serverLogoUrl);

  function onLogoFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      alert("Utilize apenas ficheiros de imagem (JPG, PNG ou WebP).");
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      alert("A imagem deve ter no máximo 2 MB.");
      return;
    }
    setLogoFile(f);
    setLogoCleared(false);
    setLogoObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }

  function removeLogo() {
    setLogoFile(null);
    setLogoCleared(true);
    setLogoObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  async function handleSalvar() {
    if (!razaoSocial.trim()) {
      alert("Informe a Razão Social.");
      return;
    }
    const payload = {
      name: razaoSocial.trim(),
      region: bairro || ramo || null,
      city: cidade || null,
      state: uf || null,
      contact: nomeCompleto || nomeFantasia || null,
      phone: telefone || telefoneResp || null,
      email: emailEmpresa || emailResp || null,
      status: statusDb,
    };
    setSaving(true);
    try {
      if (editId) {
        const { error } = await supabase.from("suppliers").update(payload).eq("id", editId);
        if (error) {
          const hint =
            /status.*schema cache|column.*status/i.test(error.message) ?
              "\n\nCrie a coluna status no Supabase (migração 20260225120000 ou 20260426120000_ensure_suppliers_status) e faça Reload schema na API."
            : /logo_url|column.*logo/i.test(error.message) ?
              "\n\nExecute a migração 20260427120000_suppliers_logo_and_storage.sql no Supabase e faça Reload schema."
            : "";
          alert("Erro ao salvar: " + error.message + hint);
          return;
        }
        if (logoFile) {
          const url = await uploadSupplierLogo(editId, logoFile);
          const { error: e2 } = await supabase.from("suppliers").update({ logo_url: url }).eq("id", editId);
          if (e2) {
            alert("Dados guardados, mas erro ao guardar a URL da logo: " + e2.message);
            return;
          }
          setServerLogoUrl(url);
          setLogoFile(null);
          setLogoObjectUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
          setLogoCleared(false);
        } else if (logoCleared) {
          const { error: e3 } = await supabase.from("suppliers").update({ logo_url: null }).eq("id", editId);
          if (e3) {
            alert("Dados guardados, mas erro ao remover a logo: " + e3.message);
            return;
          }
          setServerLogoUrl(null);
          setLogoCleared(false);
        }
      } else {
        const { data, error } = await supabase.from("suppliers").insert(payload).select("id").single();
        if (error || !data?.id) {
          const hint =
            /status.*schema cache|column.*status/i.test(error?.message ?? "") ?
              "\n\nCrie a coluna status no Supabase (migração 20260225120000 ou 20260426120000_ensure_suppliers_status) e faça Reload schema na API."
            : /logo_url|column.*logo/i.test(error?.message ?? "") ?
              "\n\nExecute a migração 20260427120000_suppliers_logo_and_storage.sql no Supabase e faça Reload schema."
            : "";
          alert("Erro ao salvar: " + (error?.message ?? "Sem id devolvido.") + hint);
          return;
        }
        const newId = data.id as string;
        if (logoFile) {
          const url = await uploadSupplierLogo(newId, logoFile);
          const { error: e2 } = await supabase.from("suppliers").update({ logo_url: url }).eq("id", newId);
          if (e2) {
            alert("Fornecedor criado, mas erro ao enviar a logo: " + e2.message);
            return;
          }
          setServerLogoUrl(url);
          setLogoFile(null);
          setLogoObjectUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao enviar a logo.");
      return;
    } finally {
      setSaving(false);
    }

    alert(editId ? "Fornecedor atualizado com sucesso." : "Fornecedor salvo com sucesso.");
    if (editId) {
      router.push("/fornecedores/cadastrados");
      router.refresh();
    }
  }

  const docRows = [
    "Contrato Social / Estatuto",
    "CNPJ",
    "Inscrição Estadual",
    "Comprovante de Endereço",
    "Outros Documentos (opcional)",
  ];

  return (
    <div className="min-h-screen bg-transparent pb-12 pt-6">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-8">
        {/* Cabeçalho da página */}
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {editId ? "Editar fornecedor" : "Cadastro de Fornecedores"}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Fornecedores <span className="text-gray-400">›</span>{" "}
              {editId ? (
                <>
                  <Link href="/fornecedores/cadastrados" className="font-medium text-gray-600 hover:underline">
                    Cadastrados
                  </Link>{" "}
                  <span className="text-gray-400">›</span> Editar
                </>
              ) : (
                "Cadastro"
              )}
            </p>
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
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-50"
              aria-label="Notificações"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Coluna principal — formulário */}
          <div className="min-w-0 flex-1 space-y-6">
            <div className="rounded-xl border border-gray-200/80 bg-white p-6 shadow-sm sm:p-8">
              <SectionTitle>Dados do Fornecedor</SectionTitle>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="logo-empresa">Logotipo da empresa</Label>
                  <input
                    id="logo-empresa"
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={onLogoFileChange}
                  />
                  <div className="flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-4">
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                      {logoDisplay ? (
                        <img src={logoDisplay} alt="" className="max-h-full max-w-full object-contain p-1" />
                      ) : (
                        <svg className="h-10 w-10 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden>
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
                          <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50"
                        >
                          Escolher imagem
                        </button>
                        {logoDisplay ? (
                          <button
                            type="button"
                            onClick={removeLogo}
                            className="inline-flex items-center rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50"
                          >
                            Remover
                          </button>
                        ) : null}
                      </div>
                      <p className="text-xs text-gray-500">JPG, PNG ou WebP. Tamanho máximo 2 MB.</p>
                    </div>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="razao" required>
                    Razão Social
                  </Label>
                  <input id="razao" className={inputClass} value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="fantasia">Nome Fantasia</Label>
                  <input id="fantasia" className={inputClass} value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="cnpj" required>
                    CNPJ
                  </Label>
                  <input id="cnpj" className={inputClass} value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
                </div>
                <div>
                  <Label htmlFor="ie">Inscrição Estadual</Label>
                  <input id="ie" className={inputClass} value={inscEstadual} onChange={(e) => setInscEstadual(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="im">Inscrição Municipal</Label>
                  <input id="im" className={inputClass} value={inscMunicipal} onChange={(e) => setInscMunicipal(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="ramo">Ramo de Atividade</Label>
                  <div className="relative">
                    <select id="ramo" className={selectClass} style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }} value={ramo} onChange={(e) => setRamo(e.target.value)}>
                      <option value="">Selecione</option>
                      <option value="Comércio de Biomassa">Comércio de Biomassa</option>
                      <option value="Indústria">Indústria</option>
                      <option value="Serviços">Serviços</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="tel" required>
                    Telefone
                  </Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.86.3 1.7.54 2.5a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.58-1.11a2 2 0 0 1 2.11-.45c.8.24 1.64.42 2.5.54A2 2 0 0 1 22 16.92z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <input id="tel" className={`${inputClass} pl-10`} value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="mail" required>
                    E-mail
                  </Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                        <path d="M4 6h16v12H4V6zm0 0 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <input id="mail" type="email" className={`${inputClass} pl-10`} value={emailEmpresa} onChange={(e) => setEmailEmpresa(e.target.value)} />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="web">Website</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                        <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <input id="web" className={`${inputClass} pl-10`} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200/80 bg-white p-6 shadow-sm sm:p-8">
              <SectionTitle>Responsável / Contato Principal</SectionTitle>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="nomeResp" required>
                    Nome Completo
                  </Label>
                  <input id="nomeResp" className={inputClass} value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="cargo">Cargo</Label>
                  <input id="cargo" className={inputClass} value={cargo} onChange={(e) => setCargo(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="telResp" required>
                    Telefone
                  </Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.86.3 1.7.54 2.5a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.58-1.11a2 2 0 0 1 2.11-.45c.8.24 1.64.42 2.5.54A2 2 0 0 1 22 16.92z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <input id="telResp" className={`${inputClass} pl-10`} value={telefoneResp} onChange={(e) => setTelefoneResp(e.target.value)} />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="mailResp" required>
                    E-mail
                  </Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                        <path d="M4 6h16v12H4V6zm0 0 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <input id="mailResp" type="email" className={`${inputClass} pl-10`} value={emailResp} onChange={(e) => setEmailResp(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200/80 bg-white p-6 shadow-sm sm:p-8">
              <SectionTitle>Informações Comerciais</SectionTitle>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="tipo" required>
                    Tipo de Fornecedor
                  </Label>
                  <select id="tipo" className={selectClass} style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }} value={tipoFornecedor} onChange={(e) => setTipoFornecedor(e.target.value)}>
                    <option value="">Selecione</option>
                    <option value="Produtor">Produtor</option>
                    <option value="Distribuidor">Distribuidor</option>
                    <option value="Industrial">Industrial</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="pagamento">Condição de Pagamento</Label>
                  <select id="pagamento" className={selectClass} style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` }} value={condicaoPagamento} onChange={(e) => setCondicaoPagamento(e.target.value)}>
                    <option value="À vista">À vista</option>
                    <option value="15 dias">15 dias</option>
                    <option value="30 dias">30 dias</option>
                    <option value="60 dias">60 dias</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="prazo">Prazo de Entrega Médio</Label>
                  <div className="flex rounded-lg border border-gray-200 bg-white focus-within:border-[#143328] focus-within:ring-1 focus-within:ring-[#143328]/30">
                    <input id="prazo" className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm outline-none" value={prazoEntrega} onChange={(e) => setPrazoEntrega(e.target.value)} placeholder="0" />
                    <span className="flex items-center border-l border-gray-100 bg-gray-50 px-3 text-xs font-medium text-gray-500">dias</span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="volume">Volume Médio Mensal Fornecido</Label>
                  <div className="flex rounded-lg border border-gray-200 bg-white focus-within:border-[#143328] focus-within:ring-1 focus-within:ring-[#143328]/30">
                    <input id="volume" className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm outline-none" value={volumeMensal} onChange={(e) => setVolumeMensal(e.target.value)} placeholder="0" />
                    <span className="flex items-center border-l border-gray-100 bg-gray-50 px-3 text-xs font-medium text-gray-500">ton</span>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="bioFornecida">Tipo de Biomassa Fornecida</Label>
                  <div className="rounded-lg border border-gray-200 bg-white px-2 py-1.5">
                    <div className="mb-2 flex min-h-[28px] flex-wrap gap-2">
                      {tagsBiomassa.length === 0 ? (
                        <span className="self-center text-xs text-gray-400">Nenhum tipo selecionado.</span>
                      ) : (
                        tagsBiomassa.map((t) => (
                          <span key={t} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: primary }}>
                            {t}
                            <button type="button" onClick={() => removeTag(t)} className="ml-0.5 rounded hover:bg-white/20" aria-label={`Remover ${t}`}>
                              ×
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                      <select
                        id="bioFornecida"
                        className={`${selectClass} min-w-0 flex-1`}
                        style={{ backgroundImage: selectChevron }}
                        value={selectedBiomassToAdd}
                        onChange={(e) => setSelectedBiomassToAdd(e.target.value)}
                        disabled={biomassTypesFromConfig.length === 0}
                      >
                        <option value="">Selecione um tipo (cadastrado em Configurações)</option>
                        {biomassTypesFromConfig
                          .filter((b) => !tagsBiomassa.includes(b.name))
                          .map((b) => (
                            <option key={b.id} value={b.name}>
                              {b.name}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={addBiomassFromSelect}
                        disabled={!selectedBiomassToAdd}
                        className="shrink-0 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Adicionar
                      </button>
                    </div>
                    {biomassTypesLoadErr ? <p className="mt-2 text-xs text-red-600">Erro ao carregar tipos: {biomassTypesLoadErr}</p> : null}
                    {!biomassTypesLoadErr && biomassTypesFromConfig.length === 0 ? (
                      <p className="mt-2 text-xs text-gray-600">
                        Nenhum tipo de biomassa na base. Cadastre em{" "}
                        <Link href="/configuracoes" className="font-semibold underline" style={{ color: primary }}>
                          Configurações
                        </Link>
                        .
                      </p>
                    ) : null}
                  </div>
                </div>
                {editId ? (
                  <div className="sm:col-span-2">
                    <Label htmlFor="status-forn">Status</Label>
                    <select
                      id="status-forn"
                      className={`${selectClass} ${statusDb === "inativo" ? "border-red-200 bg-red-50/60 font-medium text-red-800" : ""}`}
                      style={{ backgroundImage: selectChevron }}
                      value={statusDb}
                      onChange={(e) => setStatusDb(e.target.value as "ativo" | "inativo")}
                    >
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </div>
                ) : null}
                <div className="sm:col-span-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <Label htmlFor="obs">Observações</Label>
                    <span className="text-xs text-gray-400">
                      {observacoes.length}/{obsMax}
                    </span>
                  </div>
                  <textarea
                    id="obs"
                    rows={4}
                    maxLength={obsMax}
                    className={`${inputClass} resize-y`}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Observações adicionais…"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pb-2">
              <button
                type="button"
                onClick={() => (editId ? router.push("/fornecedores/cadastrados") : router.back())}
                className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
              >
                {editId ? "Voltar" : "Cancelar"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSalvar}
                className="inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105 disabled:opacity-60"
                style={{ backgroundColor: primary }}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M17 21v-8H7v8M7 3v5h8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {saving ? "Salvando…" : editId ? "Atualizar fornecedor" : "Salvar Fornecedor"}
              </button>
            </div>
          </div>

          {/* Coluna direita */}
          <div className="w-full shrink-0 space-y-6 lg:w-[340px]">
            <div className="rounded-xl border border-gray-200/80 bg-white p-6 shadow-sm">
              <SectionTitle>Endereço</SectionTitle>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="cep" required>
                    CEP
                  </Label>
                  <input
                    id="cep"
                    className={inputClass}
                    value={cep}
                    onChange={(e) => setCep(formatCepMask(e.target.value))}
                    placeholder="00000-000"
                    inputMode="numeric"
                    autoComplete="postal-code"
                  />
                  <p className="mt-1 text-xs text-gray-500">Ao completar 8 dígitos, o endereço e UF/cidade são preenchidos automaticamente (ViaCEP).</p>
                </div>
                <div>
                  <Label htmlFor="log" required>
                    Endereço
                  </Label>
                  <input id="log" className={inputClass} value={endereco} onChange={(e) => setEndereco(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="num" required>
                      Número
                    </Label>
                    <input id="num" className={inputClass} value={numero} onChange={(e) => setNumero(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="comp">Complemento</Label>
                    <input id="comp" className={inputClass} value={complemento} onChange={(e) => setComplemento(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="bairro" required>
                    Bairro
                  </Label>
                  <input id="bairro" className={inputClass} value={bairro} onChange={(e) => setBairro(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="uf" required>
                    UF
                  </Label>
                  <select
                    id="uf"
                    className={selectClass}
                    style={{ backgroundImage: selectChevron }}
                    value={uf}
                    onChange={(e) => {
                      pendingCepRef.current = null;
                      setUf(e.target.value);
                    }}
                  >
                    <option value="">Selecione o UF</option>
                    {UFS_BR.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="cidade" required>
                    Cidade
                  </Label>
                  <select
                    id="cidade"
                    className={selectClass}
                    style={{ backgroundImage: selectChevron }}
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    disabled={!uf || municipiosLoading}
                  >
                    <option value="">
                      {!uf ? "Selecione o UF primeiro" : municipiosLoading ? "A carregar cidades…" : "Selecione a cidade"}
                    </option>
                    {municipios.map((nome) => (
                      <option key={nome} value={nome}>
                        {nome}
                      </option>
                    ))}
                  </select>
                  {municipiosErr ? <p className="mt-1 text-xs text-red-600">{municipiosErr}</p> : null}
                </div>
                <div className="flex gap-3 rounded-lg border border-[#c8e6c9] bg-[#e8f5e9] px-3 py-3 text-sm text-gray-800">
                  <svg className="mt-0.5 h-5 w-5 shrink-0" style={{ color: primary }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="leading-snug">{enderecoPreview}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200/80 bg-white p-6 shadow-sm">
              <SectionTitle>Documentos</SectionTitle>
              <p className="mb-4 text-xs text-gray-600">Anexe os documentos do fornecedor</p>
              <ul className="space-y-3">
                {docRows.map((title, i) => (
                  <li key={title} className="flex gap-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
                    <input ref={(el) => { fileRefs.current[i] = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" />
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-gray-500 shadow-sm ring-1 ring-gray-100">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{title}</p>
                      <p className="text-xs text-gray-500">PDF, JPG ou PNG até 10MB</p>
                    </div>
                    <button type="button" onClick={() => fileRefs.current[i]?.click()} className="shrink-0 self-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50">
                      Selecionar
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-start gap-2 border-t border-gray-100 pt-4 text-xs text-gray-500">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Os documentos são armazenados com segurança
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
