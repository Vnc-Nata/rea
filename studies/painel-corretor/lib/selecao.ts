import type { FiltroCotacao, Grupo, Hospital, Operadora, Plano } from "./types";
import { precoDisponivel, precoTotal } from "./utils";

// Regras puras do seletor de planos (usadas pela server action buscarPlanos e por Produtos).

export const CIDADE_PADRAO = "São Paulo - SP";

export interface Selecao {
  planos: Plano[];
  operadoras: Operadora[];
  hospitais: Hospital[];
}

/**
 * Planos do filtro com preço para as faixas que têm vidas, só de operadoras habilitadas.
 * Ordem: operadoras na ordem do catálogo; dentro de cada uma, preço total crescente.
 * `cidades` de cada plano vira só a cidade do filtro (planos nacionais teriam centenas).
 */
export function filtrarSelecao(
  cat: Selecao,
  filtro: FiltroCotacao,
  grupos: Grupo[],
  habilitadas: Set<string>,
): Selecao {
  const planos = cat.planos
    .filter(
      (p) =>
        habilitadas.has(p.operadoraId) &&
        p.segmento === filtro.segmento &&
        p.modalidade === filtro.modalidade &&
        p.cidades.includes(filtro.cidade) &&
        precoDisponivel(p, grupos),
    )
    .map((p) => ({ p: { ...p, cidades: [filtro.cidade] }, total: precoTotal(p, grupos) }));
  const ordemOp = new Map(cat.operadoras.map((o, i) => [o.id, i]));
  planos.sort((a, b) => ordemOp.get(a.p.operadoraId)! - ordemOp.get(b.p.operadoraId)! || a.total - b.total);
  const usadasOp = new Set(planos.map((x) => x.p.operadoraId));
  const usadosHosp = new Set(planos.flatMap((x) => x.p.rede.map((r) => r.hospitalId)));
  return {
    planos: planos.map((x) => x.p),
    operadoras: cat.operadoras.filter((o) => usadasOp.has(o.id)),
    hospitais: cat.hospitais.filter((h) => usadosHosp.has(h.id)),
  };
}

/**
 * Operadoras habilitadas de fato: a lista da conta, só com ids do catálogo atual (uma lista salva com
 * ids fictícios não vale no catálogo ANS); vazia → no catálogo ANS, as operadoras-alvo
 * (data/ans/operadoras-alvo.json) presentes no catálogo; senão todas.
 */
export function habilitadasEfetivas(
  daConta: string[] | undefined,
  fonte: "ans" | "ficticio",
  operadoras: Operadora[],
  registrosAlvo: string[],
): string[] {
  const todas = operadoras.map((o) => o.id);
  const ids = new Set(todas);
  const validas = (daConta ?? []).filter((id) => ids.has(id));
  if (validas.length) return validas;
  if (fonte !== "ans") return todas;
  const alvo = new Set(registrosAlvo);
  const doAlvo = operadoras.filter((o) => alvo.has(o.registroAns)).map((o) => o.id);
  return doAlvo.length ? doAlvo : todas;
}

/** Cidade do filtro se existe no catálogo; senão "São Paulo - SP" (se houver) ou a primeira. */
export function cidadeValida(cidade: string, cidades: string[]): string {
  if (cidades.includes(cidade)) return cidade;
  if (!cidades.length || cidades.includes(CIDADE_PADRAO)) return CIDADE_PADRAO;
  return cidades[0];
}
