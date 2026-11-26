import { lerNumeroBR } from "./numeros";
import { FAIXAS, type Faixa } from "./types";

// Regras puras da tela "Comparar com o Painel".

export interface Par {
  nosso: number;
  painel: number;
}

export function mediana(valores: number[]): number {
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** (nosso − painel) / painel × 100; null sem valor do Painel. */
export function diferencaPct(nosso: number, painel: number | undefined): number | null {
  if (!painel || painel <= 0) return null;
  const d = ((nosso - painel) / painel) * 100;
  return Math.round(d * 10) / 10 || 0;
}

/**
 * Ajuste % sugerido para a operadora: ((1 + ajusteAtual/100) × mediana(painel/nosso) − 1) × 100, 1 casa.
 * "nosso" já inclui o ajuste atual, por isso ele entra no fator. Sem pares, mantém o ajuste atual.
 */
export function sugerirAjuste(pares: Par[], ajusteAtual: number): number {
  const validos = pares.filter((p) => p.nosso > 0 && p.painel > 0);
  if (!validos.length) return ajusteAtual;
  const m = mediana(validos.map((p) => p.painel / p.nosso));
  return Math.round(((1 + ajusteAtual / 100) * m - 1) * 1000) / 10 || 0;
}

const tokens = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** O nome contém os tokens de `trecho` consecutivos (ex.: "nacional ii" não casa com "NACIONAL III"). */
export function nomeCasa(nome: string, trecho: string): boolean {
  const n = tokens(nome);
  const t = tokens(trecho);
  if (!t.length) return false;
  return n.some((_, i) => t.every((x, j) => n[i + j] === x));
}

/** Ex.: "3 vidas 24-28", "5 vidas". */
export function resumoVidas(vidas: Record<Faixa, number>): string {
  const usadas = FAIXAS.filter((f) => vidas[f] > 0);
  const total = usadas.reduce((s, f) => s + vidas[f], 0);
  return `${total} ${total === 1 ? "vida" : "vidas"}${usadas.length === 1 ? ` ${usadas[0]}` : ""}`;
}

/** Valor em pt-BR: com vírgula, pontos são milhares; sem vírgula, um ponto final seguido de 1-2 dígitos é decimal. */
export function lerValorBR(entrada: string): number | null {
  const v = lerNumeroBR(entrada);
  if (v === null) return null;
  return v > 0 ? v : NaN;
}
