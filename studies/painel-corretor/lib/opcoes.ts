import type { Hospital, OpcoesEnvio, Operadora, Plano } from "./types";

// Regras puras de Opções da proposta (?d=flags): regiões da rede e itens de "Mais informações".

export const ITENS_INFO = [
  { chave: "acomodacao", rotulo: "Acomodação" },
  { chave: "coparticipacao", rotulo: "Coparticipação" },
  { chave: "abrangencia", rotulo: "Abrangência" },
  { chave: "contratacao", rotulo: "Contratação" },
  { chave: "registro", rotulo: "Registro na ANS" },
  { chave: "idss", rotulo: "IDSS da operadora" },
  { chave: "reajuste", rotulo: "Reajuste anual" },
] as const;

export type ItemInfo = (typeof ITENS_INFO)[number];
export type ChaveInfo = ItemInfo["chave"];

/** Regiões distintas dos hospitais da rede dos planos, em ordem alfabética. */
export function regioesDisponiveis(planos: Plano[], hospitais: Hospital[]): string[] {
  const ids = new Set(planos.flatMap((p) => p.rede.map((r) => r.hospitalId)));
  return [...new Set(hospitais.filter((h) => ids.has(h.id)).map((h) => h.regiao))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

/**
 * Itens que a proposta consegue mostrar para esses planos: contratação só existe nos dados fictícios (a ANS não
 * publica) e IDSS/reajuste só quando alguma operadora tem o indicador.
 */
export function itensDisponiveis(planos: Plano[], operadoras: Operadora[]): ItemInfo[] {
  return ITENS_INFO.filter((i) => {
    if (i.chave === "contratacao") return planos.some((p) => p.origemPreco === "ficticio");
    if (i.chave === "idss") return operadoras.some((o) => o.idss != null);
    if (i.chave === "reajuste") return operadoras.some((o) => o.reajuste != null);
    return true;
  });
}

export const mostraRegiao = (o: OpcoesEnvio, regiao: string) => !o.regioes || o.regioes.includes(regiao);
export const mostraItem = (o: OpcoesEnvio, chave: ChaveInfo) => !o.itens || o.itens.includes(chave);

/** Marca/desmarca `v`; com tudo marcado devolve undefined (= todos, inclusive os que aparecerem depois). */
export function alternar(sel: string[] | undefined, v: string, todos: string[]): string[] | undefined {
  const atual = sel ?? todos;
  const novo = atual.includes(v) ? atual.filter((x) => x !== v) : [...atual, v];
  const ordenado = todos.filter((x) => novo.includes(x));
  return ordenado.length === todos.length ? undefined : ordenado;
}

/** "3 regiões", "5 itens": quantos estão marcados (ou o total quando são todos). */
export function rotuloContagem(sel: string[] | undefined, todos: string[], nome: string): string {
  const n = sel ? todos.filter((x) => sel.includes(x)).length : todos.length;
  return `${n} ${nome}`;
}
