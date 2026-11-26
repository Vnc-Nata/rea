import test from "node:test";
import assert from "node:assert/strict";
import { diferencaPct, lerValorBR, nomeCasa, sugerirAjuste } from "../../lib/comparar";

test("sugerirAjuste: mediana de painel/nosso", () => {
  const pares = [
    { nosso: 100, painel: 110 },
    { nosso: 200, painel: 190 },
    { nosso: 100, painel: 120 },
  ];
  assert.equal(sugerirAjuste(pares, 0), 10);
});

test("sugerirAjuste: compõe com o ajuste atual", () => {
  assert.equal(sugerirAjuste([{ nosso: 110, painel: 110 }], 10), 10);
});

test("sugerirAjuste: sem pares mantém o ajuste atual", () => {
  assert.equal(sugerirAjuste([], 7.5), 7.5);
});

test("diferencaPct", () => {
  assert.equal(diferencaPct(110, 100), 10);
  assert.equal(diferencaPct(90, 100), -10);
  assert.equal(diferencaPct(90, undefined), null);
});

test("nomeCasa: casa por tokens inteiros", () => {
  assert.equal(nomeCasa("NACIONAL II E CE", "nacional ii"), true);
  assert.equal(nomeCasa("NACIONAL III E CE", "nacional ii"), false);
  assert.equal(nomeCasa("Nacional-II", "nacional ii"), true);
  assert.equal(nomeCasa("AMIL BRONZE SP QC", "bronze"), true);
  assert.equal(nomeCasa("BRONZEADO SP", "bronze"), false);
  assert.equal(nomeCasa("II NACIONAL", "nacional ii"), false);
});

test("lerValorBR", () => {
  assert.equal(lerValorBR("1.234,56"), 1234.56);
  assert.equal(lerValorBR("1234,5"), 1234.5);
  assert.equal(lerValorBR("1234.56"), 1234.56);
  assert.equal(lerValorBR("1.234"), 1234);
  assert.equal(lerValorBR("R$ 537,54"), 537.54);
  assert.equal(lerValorBR(""), null);
  assert.ok(Number.isNaN(lerValorBR("abc")));
  assert.ok(Number.isNaN(lerValorBR("1,2,3")));
});
test("diferencaPct não devolve -0", () => {
  assert.ok(Object.is(diferencaPct(99.99, 100), 0));
});
