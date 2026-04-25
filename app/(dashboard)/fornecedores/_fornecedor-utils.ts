export type SupplierRow = {
  id: string;
  name: string;
  region: string | null;
  city: string | null;
  state: string | null;
  contact: string | null;
  phone: string | null;
  email: string | null;
  /** URL pública da logotipo (Storage) */
  logo_url?: string | null;
  /** Valores persistidos: `ativo` | `inativo` | `pendente` (minúsculas) */
  status?: string | null;
  created_at?: string | null;
};

export type RowStatus = "Ativo" | "Pendente" | "Inativo";

const FALLBACK_STATUS_BY_INDEX: RowStatus[] = [
  "Ativo",
  "Ativo",
  "Ativo",
  "Pendente",
  "Ativo",
  "Inativo",
  "Ativo",
  "Ativo",
];

/** Status para UI: coluna `status` no banco ou simulação estável pelo id. */
/** Valor persistido em `suppliers.status` para o controlo Ativo / Inativo (pendente conta como ativo). */
export function statusDbToAtivoInativo(s: SupplierRow | { status?: string | null }): "ativo" | "inativo" {
  const r = s.status?.toLowerCase().trim();
  if (r === "inativo") return "inativo";
  return "ativo";
}

export function getDisplayStatus(s: SupplierRow): RowStatus {
  const raw = s.status?.toLowerCase().trim();
  if (raw === "ativo") return "Ativo";
  if (raw === "inativo") return "Inativo";
  if (raw === "pendente") return "Pendente";
  return FALLBACK_STATUS_BY_INDEX[indexFromSupplierId(s.id)];
}

export function indexFromSupplierId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 8;
}

export function enrichSupplierDisplay(s: SupplierRow, index?: number) {
  const i = index ?? indexFromSupplierId(s.id);
  const tipos = ["Fornecedor", "Fornecedor", "Cooperativa", "Fornecedor", "Fornecedor", "Cooperativa", "Fornecedor", "Fornecedor"];
  const biomass = [
    "Cavaco de Eucalipto",
    "Resíduo Florestal",
    "Pellet de Madeira",
    "Cavaco de Eucalipto",
    "Resíduo Florestal",
    "Cavaco de Eucalipto",
    "Pellet de Madeira",
    "Resíduo Florestal",
  ];
  const condicoes = ["30 dias", "À vista", "15 dias", "30 dias", "60 dias", "30 dias", "15 dias", "30 dias"];
  const status = getDisplayStatus(s);
  const tipo = tipos[i];
  const bio = biomass[i];
  const cnpj = `CNPJ ${String(12_345_678 + i).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}/0001-${String(90 + i).slice(-2)}`;
  return {
    status,
    tipo,
    bio,
    cnpj,
    condicaoPagamento: condicoes[i],
    prazoEntrega: String((i % 5) + 3),
    volumeMensal: String((i % 8) * 120 + 200),
  };
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatPhone(phone: string | null) {
  if (!phone) return "—";
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
