import { Comparar, type Linha, type SugestaoOp } from "@/components/comparar";
import { catalogo, operadoraPorId } from "@/lib/catalogo";
import { sugerirAjuste, type Par } from "@/lib/comparar";
import { comparacoesDoDb, grupoDe } from "@/lib/comparar-db";
import { readDb } from "@/lib/db";
import { lerConta } from "@/lib/conta-db";
import { precoDisponivel, precoTotal } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function CompararPage() {
  const comparacoes = comparacoesDoDb();
  const ajustes = lerConta(readDb()).ajustes ?? {};
  const linhas: Linha[] = comparacoes.map((c) => {
    const plano = c.planoId ? catalogo().planos.find((p) => p.id === c.planoId) : undefined;
    const op = plano ? operadoraPorId(plano.operadoraId) : undefined;
    const g = grupoDe(c.vidas);
    return {
      id: c.id,
      titulo: c.titulo,
      cidade: c.cidade,
      vidas: c.vidas,
      valorPainel: c.valorPainel ?? null,
      plano: plano ? { ...plano, rede: [], cidades: [] } : null,
      operadora: op ?? null,
      nosso: plano && precoDisponivel(plano, g) ? precoTotal(plano, g) : null,
    };
  });
  const porOp = new Map<string, SugestaoOp & { pares: Par[] }>();
  for (const l of linhas) {
    if (!l.operadora || !l.plano || l.nosso == null || l.valorPainel == null) continue;
    const e = porOp.get(l.operadora.id) ?? {
      operadora: l.operadora,
      ajusteAtual: ajustes[l.operadora.id] ?? 0,
      sugerido: 0,
      casos: 0,
      pares: [],
    };
    e.pares.push({ nosso: l.nosso, painel: l.valorPainel });
    porOp.set(l.operadora.id, e);
  }
  const sugestoes: SugestaoOp[] = [...porOp.values()].map(({ pares, ...e }) => ({
    ...e,
    casos: pares.length,
    sugerido: sugerirAjuste(pares, e.ajusteAtual),
  }));
  return <Comparar linhas={linhas} sugestoes={sugestoes} cidades={catalogo().cidades} />;
}
