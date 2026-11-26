import assert from "node:assert/strict";
import { test } from "node:test";
import { calibracao, corresponder, gruposDoPerfil, medir, metricas, type ObsPainel } from "../../lib/divergencia";
import type { Plano } from "../../lib/types";
import { FAIXAS } from "../../lib/types";

const precos = (v: number) => Object.fromEntries(FAIXAS.map((f) => [f, v])) as Plano["precos"];
const plano = (id: string, nome: string, preco: number, extra: Partial<Plano> = {}): Plano => ({
  id,
  operadoraId: "ans-326305",
  nome,
  registroAns: id,
  segmento: "Saúde",
  modalidade: "PME",
  acomodacao: "Quarto Coletivo",
  coparticipacao: "Com coparticipação",
  contratacao: "Opcional",
  aceitaMei: true,
  abrangencia: "Grupo de municípios",
  cidades: ["São Caetano do Sul - SP"],
  precos: precos(preco),
  origemPreco: "ans",
  rede: [],
  laboratorios: 0,
  ...extra,
});
const obs = (o: Partial<ObsPainel>): ObsPainel => ({
  caso: "1",
  cidade: "São Caetano do Sul - SP",
  perfil: "24-28:3",
  modalidade: "PME",
  operadora: "Amil",
  planoPainel: "Bronze SP",
  acomodacao: "Enfermaria",
  copart: "Parcial",
  totalPainel: 708.78,
  ...o,
});
const reg = () => "326305";

test("perfil de vidas: faixa única, mista e 59+", () => {
  assert.equal(gruposDoPerfil("24-28:3")[0].vidas["24-28"], 3);
  const m = gruposDoPerfil("34-38:2,00-18:1")[0].vidas;
  assert.equal(m["34-38"] + m["00-18"], 3);
  assert.equal(gruposDoPerfil("59:2")[0].vidas["59-999"], 2);
  assert.throws(() => gruposDoPerfil("99-1:2"));
});

test("correspondência: todos os termos do nome, copart parcial, menos termos extras", () => {
  const planos = [
    plano("a", "Amil PJ Bronze SP QC Copart TP", 238.9, { tipoCopart: "Parcial" }),
    plano("b", "Amil PJ Bronze SP QC Copart", 179.18, { tipoCopart: "Completa" }),
    plano("c", "Amil PJ Bronze SP Mais I QC Copart TP", 289.16, { tipoCopart: "Parcial" }),
    plano("d", "Amil PJ Bronze SP QP Copart TP", 300, { tipoCopart: "Parcial", acomodacao: "Quarto Individual" }),
  ];
  const c = corresponder(obs({}), planos, reg);
  assert.equal(c.plano?.id, "a"); // "Bronze SP" casa a e c; a tem menos termos extras
  assert.equal(c.confianca, "média");
  const r = medir(obs({}), c);
  assert.equal(r.totalNosso, 716.7);
  assert.equal(r.diferencaPct, 1.1);
});

test("sem candidato na operadora vira 'sem equivalente'; planoNosso força a escolha", () => {
  const planos = [plano("a", "Amil PJ Bronze SP QC Copart TP", 238.9, { tipoCopart: "Parcial" })];
  assert.equal(corresponder(obs({ operadora: "Alice" }), planos, reg).confianca, "sem equivalente");
  assert.equal(corresponder(obs({ planoNosso: "a", planoPainel: "x" }), planos, reg).plano?.id, "a");
});

test("métricas e calibração", () => {
  const base = { candidatos: 1, vidas: 1, confianca: "alta" as const };
  const ls = [1, -2, 4, 10, -1].map((d, i) => ({
    ...obs({ caso: String(i), totalPainel: 100 }),
    ...base,
    totalNosso: 100 + d,
    diferencaPct: d,
  }));
  const m = metricas(ls);
  assert.equal(m.mediana, 2);
  assert.equal(m.dentro2, 60);
  assert.equal(m.dentro5, 80);
  assert.equal(m.p90, 10);
  const c = calibracao(ls);
  assert.equal(c.consistente, false); // desvio ≈ 4,2 pts
  assert.equal(c.sugerido, -1); // mediana de painel/nosso = 100/101
});
