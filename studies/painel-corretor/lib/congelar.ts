import type { Cenario, Plano } from "./types";

// Preço congelado da proposta (Opções › Congelar preços): o cenário guarda os preços por faixa e o IOF do dia em
// que foi congelado, e a proposta, os cards e o total usam esses valores até a validade, mesmo que a base mude.

/** Plano com os preços congelados do cenário (se houver); senão o próprio plano. */
export function planoDoCenario(plano: Plano, cen: Pick<Cenario, "precoCongelado">): Plano {
  const pc = cen.precoCongelado;
  return pc ? { ...plano, precos: pc.precos, iof: pc.iof } : plano;
}

/** Fotografia dos preços atuais do plano, para gravar no cenário. */
export function congelarPreco(plano: Plano, em = new Date().toISOString()): NonNullable<Cenario["precoCongelado"]> {
  return { precos: { ...plano.precos }, iof: plano.iof, em };
}
