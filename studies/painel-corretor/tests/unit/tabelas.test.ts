import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CABECALHO_TABELAS, lerTabelas, normalizarRegistro, tabelaPara } from "../../lib/tabelas";

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

test("normalizarRegistro tira zeros à esquerda e completa até 6 dígitos", () => {
  assert.equal(normalizarRegistro("0005711"), "005711");
  assert.equal(normalizarRegistro("5711"), "005711");
  assert.equal(normalizarRegistro("32.630-5"), "326305");
  assert.equal(normalizarRegistro("000000"), "");
});

test('preço "1.034" sem vírgula é milhar; "1034.8" é decimal', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "tab-"));
  fs.writeFileSync(
    path.join(d, "x.csv"),
    `${CABECALHO_TABELAS.join(";")}\n326305;470000001;P;SP;;PME;2026-01-01;1.034;1034.8;;;;;;;;\n`,
  );
  const r = lerTabelas(d);
  assert.deepEqual(r.erros, []);
  assert.equal(r.tabelas[0].precos[0], 1034);
  assert.equal(r.tabelas[0].precos[1], 1034.8);
});

test("várias linhas para o mesmo plano e vigência geram aviso", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "tab-"));
  const f = (cod: string, nome: string, uf: string, mun: string, vig: string) =>
    `326305;${cod};${nome};${uf};${mun};PME;${vig};100;;;;;;;;;`;
  fs.writeFileSync(
    path.join(d, "x.csv"),
    [
      CABECALHO_TABELAS.join(";"),
      f("470000001", "Ouro", "SP", "3550308", "2026-01-01"),
      f("470000001", "Ouro", "SP", "3509502", "2026-01-01"),
      f("470000001", "Ouro", "SP", "", "2026-02-01"),
      f("", "Prata Ex", "SP", "", "2026-01-01"),
      f("", "PRATA EX", "RJ", "", "2026-01-01"),
      f("", "Bronze", "SP", "", "2026-01-01"),
    ].join("\n"),
  );
  const r = lerTabelas(d);
  assert.equal(r.tabelas.length, 6);
  assert.deepEqual(
    r.erros.map((e) => [e.linha, e.motivo]),
    [
      [3, "várias linhas para o mesmo plano e vigência; usada a primeira (linha 2)"],
      [6, "várias linhas para o mesmo plano e vigência; usada a primeira (linha 5)"],
    ],
  );
});
