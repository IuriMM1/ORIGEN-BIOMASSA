/** Sigla UF → id do estado na API de localidades do IBGE. */
export const UF_IBGE_ID: Record<string, number> = {
  RO: 11,
  AC: 12,
  AM: 13,
  RR: 14,
  PA: 15,
  AP: 16,
  TO: 17,
  MA: 21,
  PI: 22,
  CE: 23,
  RN: 24,
  PB: 25,
  PE: 26,
  AL: 27,
  SE: 28,
  BA: 29,
  MG: 31,
  ES: 32,
  RJ: 33,
  SP: 35,
  PR: 41,
  SC: 42,
  RS: 43,
  MS: 50,
  MT: 51,
  GO: 52,
  DF: 53,
};

export const UFS_BR = Object.keys(UF_IBGE_ID).sort() as readonly string[];

type IbgeMunicipio = { nome: string };

/** Lista completa de municípios do estado (ordenada por nome). */
export async function fetchMunicipiosByUf(ufSigla: string, signal?: AbortSignal): Promise<string[]> {
  const id = UF_IBGE_ID[ufSigla.toUpperCase()];
  if (id == null) return [];
  const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${id}/municipios`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`IBGE: ${res.status}`);
  const data = (await res.json()) as IbgeMunicipio[];
  if (!Array.isArray(data)) return [];
  return data
    .map((m) => m.nome?.trim())
    .filter((n): n is string => Boolean(n))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}
