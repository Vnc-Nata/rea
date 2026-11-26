import "server-only";
import { catalogo } from "./catalogo";
import { readDb, updateDb } from "./db";
import { resumoVidas } from "./comparar";
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
      norm(p.nome).includes(trecho) &&
      p.cidades.includes(cidade) &&
      precoDisponivel(p, grupoDe(vidas)),
  );
}

function casoInicial(titulo: string, plano: Plano | undefined, cidade: string, faixa: Faixa, n: number): Comparacao {
  return {
    id: novoId("cmp"),
    titulo,
    planoId: plano?.id ?? "",
    cidade,
    vidas: { ...vidasVazias(), [faixa]: n },
    criadaEm: new Date().toISOString(),
  };
}

/** Semeia os dois casos iniciais uma única vez (flag no db); apagá-los não os recria. */
export function comparacoesDoDb(): Comparacao[] {
  const atual = readDb();
  if (atual.comparacoesIniciadas) return atual.comparacoes ?? [];
  return updateDb((db: Db) => {
    if (!db.comparacoesIniciadas) {
      const c1 = "São Caetano do Sul - SP";
      const c2 = "Belo Horizonte - MG";
      const v1 = { ...vidasVazias(), "24-28": 3 };
      const v2 = { ...vidasVazias(), "44-48": 4 };
      db.comparacoes = [
        ...(db.comparacoes ?? []),
        casoInicial(`Amil Bronze · ${c1} · 3 vidas 24-28`, achar("amil", "bronze", c1, v1), c1, "24-28", 3),
        casoInicial(
          `Bradesco Nacional II · ${c2} · 4 vidas 44-48`,
          achar("bradesco", "nacional ii", c2, v2),
          c2,
          "44-48",
          4,
        ),
      ];
      db.comparacoesIniciadas = true;
    }
    return db.comparacoes ?? [];
  });
}

export function tituloComparacao(plano: Plano, operadoraNome: string, cidade: string, vidas: Record<Faixa, number>) {
  return `${operadoraNome} ${plano.nome} · ${cidade} · ${resumoVidas(vidas)}`.slice(0, 120);
}
