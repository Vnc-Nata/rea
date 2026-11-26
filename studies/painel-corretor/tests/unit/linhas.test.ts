import assert from "node:assert/strict";
import { test } from "node:test";
import { linhaDoPlano, percentualCopartDoNome } from "../../lib/linhas";

test("linha: primeiro termo depois da marca, nomes reais da ANS", () => {
  const casos: [string, string][] = [
    ["Amil Empresarial Bronze SP Mais I QC Copart S/Obst", "Bronze"],
    ["Amil Empresarial Prata QP", "Prata"],
    ["Amil Empresarial Ouro QC R", "Ouro"],
    ["Amil Empresarial Platinum Mais QP R", "Platinum"],
    ["Amil Black II QP R copart PJTA", "Black"],
    ["Amil 400 QP Nacional R Copart PJCE", "Linha 400"],
    ["Amil Fácil S80 QC SP RJ DF PR PE GM Copart PJ", "Fácil"],
    ["Bradesco Saúde Top Nacional 2 E CE A", "Top"],
    ["Bradesco Saúde Nacional 2 E CE C", "Nacional"],
    ["Bradesco Saúde Efetivo IV E CE copart", "Efetivo"],
    ["Bradesco Saúde Top NPlus Q CE A", "Top"],
    ["Bradesco Saúde Nplus Q CE", "Nacional Plus"],
    ["Bradesco Saúde 1+ E CE", "Linha 1+"],
    ["Clássico 100 PME/Empresarial Trad.15 AH QC", "Clássico"],
    ["BRONZE BRASIL I E COPAR EMP", "Bronze"],
    ["ND PRATA MAX CE AHO CCF APTO RP", "Prata"],
    ["NOSSO PLANO INTEGRADO NDI CE APTO", "Nosso Plano"],
    ["SMART 200 ABC CE ENF", "Smart"],
    ["Amil", "Outros"],
  ];
  for (const [nome, linha] of casos) assert.equal(linhaDoPlano(nome), linha, nome);
});

test("percentual de coparticipação só quando escrito no nome", () => {
  assert.equal(percentualCopartDoNome("Plano X Copart 30% QC"), 30);
  assert.equal(percentualCopartDoNome("Amil Bronze SP QC Copart"), undefined);
  assert.equal(percentualCopartDoNome("Plano 100% Nacional"), undefined);
});
