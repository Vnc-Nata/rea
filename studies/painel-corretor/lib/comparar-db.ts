import "server-only";
import { catalogo } from "./catalogo";
import { readDb, updateDb } from "./db";
import { nomeCasa, resumoVidas } from "./comparar";
import type { Comparacao, Db, Faixa, Plano } from "./types";
import { vidasVazias } from "./types";
import { novoId, precoDisponivel } from "./utils";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function grupoDe(vidas: Record<Faixa, number>) {
  return [{ nome: "Geral", vidas }];
}

function achar(grupo: string, trecho: string, cidade: string, vidas: Record<Faixa, number>): Plano | undefined {
  const cat = catalogo();
  const ops = new Set(cat.operadoras.filter((o) => norm(o.nome).includes(grupo)).map((o) => o.id));
  return cat.planos.find(
    (p) =>
      ops.has(p.operadoraId) &&
      p.segmento === "Saúde" &&
      nomeCasa(p.nome, trecho) &&
      p.cidades.includes(cidade) &&
      precoDisponivel(p, grupoDe(vidas)),
  );
}

const INICIAIS = [
  {
    chave: "amil-bronze",
    titulo: "Amil Bronze",
    grupo: "amil",
    trecho: "bronze",
    cidade: "São Caetano do Sul - SP",
    faixa: "24-28" as Faixa,
    n: 3,
  },
  {
    chave: "bradesco-nacional-ii",
    titulo: "Bradesco Nacional II",
    grupo: "bradesco",
    trecho: "nacional ii",
    cidade: "Belo Horizonte - MG",
    faixa: "44-48" as Faixa,
    n: 4,
  },
];

type Inicial = (typeof INICIAIS)[number];
const vidasDe = (i: Inicial) => ({ ...vidasVazias(), [i.faixa]: i.n });

/**
 * Semeia os dois casos iniciais uma única vez (flag no db; apagá-los não os recria), só com o catálogo da ANS.
 * Casos iniciais que ficaram sem plano são resolvidos de novo quando o catálogo da ANS estiver disponível.
 */
export function comparacoesDoDb(): Comparacao[] {
  const atual = readDb();
  if (catalogo().fonte !== "ans") return atual.comparacoes ?? [];
  // Só grava o db quando algo muda: semente (uma vez) ou um caso inicial que agora encontrou plano.
  const resolvidos = new Map<string, string>();
  for (const c of atual.comparacoes ?? []) {
    const i = !c.planoId && INICIAIS.find((x) => x.chave === c.inicial);
    const id = i ? achar(i.grupo, i.trecho, i.cidade, vidasDe(i))?.id : undefined;
    if (id) resolvidos.set(c.id, id);
  }
  if (atual.comparacoesIniciadas && !resolvidos.size) return atual.comparacoes ?? [];
  return updateDb((db: Db) => {
    if (!db.comparacoesIniciadas) {
      db.comparacoes = [
        ...(db.comparacoes ?? []),
        ...INICIAIS.map((i) => ({
          id: novoId("cmp"),
          titulo: `${i.titulo} · ${i.cidade} · ${resumoVidas(vidasDe(i))}`,
          planoId: achar(i.grupo, i.trecho, i.cidade, vidasDe(i))?.id ?? "",
          cidade: i.cidade,
          vidas: vidasDe(i),
          criadaEm: new Date().toISOString(),
          inicial: i.chave,
        })),
      ];
      db.comparacoesIniciadas = true;
    }
    for (const c of db.comparacoes ?? []) if (!c.planoId && resolvidos.has(c.id)) c.planoId = resolvidos.get(c.id)!;
    return db.comparacoes ?? [];
  });
}

export function tituloComparacao(plano: Plano, operadoraNome: string, cidade: string, vidas: Record<Faixa, number>) {
  return `${operadoraNome} ${plano.nome} · ${cidade} · ${resumoVidas(vidas)}`.slice(0, 120);
}
