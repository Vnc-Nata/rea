import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { lerTabelas, tabelaPara } from "../../lib/tabelas";

const dir = path.join(process.cwd(), "tests", "fixtures", "tabelas");
const { tabelas, erros } = lerTabelas(dir);
const plano = { registroAns: "326305", codigoAns: "", nome: "", ufs: ["SP"] };

test("lê fixture com BOM e vírgula decimal", () => {
  const t = tabelas.find((x) => x.codigoAns === "470123456");
  assert.ok(t);
  assert.equal(t.registro, "326305");
  assert.equal(t.modalidade, "PME");
  assert.equal(t.vigencia, "2026-01-01");
  assert.equal(t.precos.length, 10);
  assert.equal(t.precos[0], 312.5);
  assert.equal(t.precos[2], 400.25);
  assert.equal(t.precos[8], 1034.8);
  assert.equal(t.precos[9], 1500.99);
  assert.equal(t.linha, 2);
  assert.equal(t.arquivo, "a.csv");
});

test("linha sem registro gera erro e é pulada; célula vazia vira null", () => {
  assert.equal(erros.length, 1);
  assert.equal(erros[0].linha, 3);
  assert.equal(erros[0].arquivo, "a.csv");
  assert.ok(!tabelas.some((t) => t.codigoAns === "470999999"));
  assert.equal(tabelas.find((t) => t.vigencia === "2026-03-01")?.precos[1], null);
});

test("casa por código ANS", () => {
  const t = tabelaPara({ ...plano, codigoAns: "470123456", nome: "Outro nome" }, tabelas);
  assert.equal(t?.nomePlano, "Plano Ouro Exemplo");
});

test("casa por nome com acento/caixa diferente e escolhe vigência mais recente", () => {
  const t = tabelaPara({ ...plano, nome: "PLANO PRATA EXEMPLÓ" }, tabelas);
  assert.equal(t?.vigencia, "2026-09-01");
  assert.equal(t?.modalidade, "PF");
});

test("uf da tabela precisa estar nas ufs do plano; ufs vazias aceita", () => {
  assert.equal(tabelaPara({ ...plano, ufs: ["RJ"], nome: "Plano Prata Exemplo" }, tabelas), undefined);
  assert.ok(tabelaPara({ ...plano, ufs: [], nome: "Plano Prata Exemplo" }, tabelas));
});

test("registro diferente não casa por nome", () => {
  assert.equal(tabelaPara({ ...plano, registroAns: "111111", nome: "Plano Prata Exemplo" }, tabelas), undefined);
});

test("diretório inexistente devolve vazio", () => {
  assert.deepEqual(lerTabelas(path.join(dir, "nao-existe")), { tabelas: [], erros: [] });
});
