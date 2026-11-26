import assert from "node:assert/strict";
import { test } from "node:test";
import { congelarPreco, planoDoCenario } from "../../lib/congelar";
import type { Plano } from "../../lib/types";
import { FAIXAS, vidasVazias } from "../../lib/types";
import { precoTotal } from "../../lib/utils";

const plano = (v: number): Plano => ({
  id: "p",
  operadoraId: "o",
  nome: "Plano",
  registroAns: "1",
  segmento: "Saúde",
  modalidade: "PME",
  acomodacao: "Quarto Coletivo",
  coparticipacao: "Sem coparticipação",
  contratacao: "Opcional",
  aceitaMei: true,
  abrangencia: "Nacional",
  cidades: [],
  precos: Object.fromEntries(FAIXAS.map((f) => [f, v])) as Plano["precos"],
  iof: 0.0238,
  origemPreco: "ans",
  rede: [],
  laboratorios: 0,
});

test("preço congelado fica igual mesmo depois que a base muda", () => {
  const grupos = [{ nome: "G", vidas: { ...vidasVazias(), "24-28": 2 } }];
  const cen = { precoCongelado: congelarPreco(plano(100), "2026-11-26T12:00:00.000Z") };
  const depois = plano(130); // base reimportada com outro preço
  assert.equal(precoTotal(planoDoCenario(depois, cen), grupos), precoTotal(plano(100), grupos));
  assert.equal(precoTotal(planoDoCenario(depois, {}), grupos), precoTotal(depois, grupos));
  assert.equal(planoDoCenario(depois, cen).nome, "Plano"); // só o preço vem da fotografia
});
