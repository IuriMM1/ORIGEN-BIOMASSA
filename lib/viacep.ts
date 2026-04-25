export type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

/** Apenas dígitos; deve ter 8 caracteres. */
export async function fetchViaCep(cepDigits: string, signal?: AbortSignal): Promise<ViaCepResponse | null> {
  const d = cepDigits.replace(/\D/g, "");
  if (d.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal });
  if (!res.ok) return null;
  const data = (await res.json()) as ViaCepResponse;
  if (data?.erro) return null;
  return data;
}

export function formatCepMask(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}
