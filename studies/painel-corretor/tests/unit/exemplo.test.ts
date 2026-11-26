import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { BaseAns } from "../../lib/ans";

const dir = path.join(process.cwd(), "tests", "fixtures");
const ler = <T>(arq: string): T => JSON.parse(fs.readFileSync(path.join(dir, arq), "utf8"));
const base = ler<BaseAns>("base.json");

test("base de exemplo tem 6 operadoras e fonte exemplo", () => {
  assert.equal(base.fonte, "exemplo");
  assert.equal(base.operadoras.length, 6);
});

test("base de exemplo tem >= 50 planos, todos com vcm exceto 2", () => {
  assert.ok(base.planos.length >= 50);
  assert.equal(base.planos.filter((p) => !p.vcm).length, 2);
});

test("base de exemplo cobre municípios de SP e MG", () => {
  const nomes = new Set(base.planos.flatMap((p) => p.municipios.map((m) => m.nome)));
  for (const m of ["SAO PAULO/SP", "SAO CAETANO DO SUL/SP", "BELO HORIZONTE/MG", "CAMPINAS/SP"])
    assert.ok(nomes.has(m), m);
  assert.deepEqual(base.ufsDetalhadas, ["SP", "MG"]);
});

test("planos usados nas telas de comparação existem com VCM esperado", () => {
  const amil = base.planos.find(
    (p) => p.grupo === "Amil" && p.nome.includes("BRONZE") && p.municipios.some((m) => m.codigo === "354880"),
  );
  assert.equal(Object.values(amil!.vcm!.variantes)[0].precos[2], 179.18);
  const brad = base.planos.find(
    (p) =>
      p.grupo === "Bradesco Saúde" && p.nome.includes("NACIONAL II") && p.municipios.some((m) => m.codigo === "310620"),
  );
  assert.equal(Object.values(brad!.vcm!.variantes)[0].precos[6], 954.22);
});

test("variantes múltiplas e faixa 59+ nula existem", () => {
  assert.ok(base.planos.some((p) => p.vcm && Object.keys(p.vcm.variantes).length === 2));
  assert.ok(base.planos.some((p) => p.vcm && Object.values(p.vcm.variantes).some((v) => v.precos[9] === null)));
});

test("rede e indicadores referenciam planos e operadoras da base", () => {
  const rede = ler<{ hospitais: Record<string, unknown>; porPlano: Record<string, string[]> }>("rede.json");
  assert.equal(Object.keys(rede.hospitais).length, 8);
  const ids = new Set(base.planos.map((p) => p.id));
  for (const [id, cnes] of Object.entries(rede.porPlano)) {
    assert.ok(ids.has(id));
    for (const c of cnes) assert.ok(c in rede.hospitais);
  }
  const ind = ler<{ porOperadora: Record<string, { idss?: number }> }>("indicadores.json");
  for (const o of base.operadoras) {
    const i = ind.porOperadora[o.registroAns];
    assert.ok(i && i.idss! >= 0 && i.idss! <= 1);
  }
});
