import test from "node:test";
import assert from "node:assert/strict";
import { diferencaPct, sugerirAjuste } from "../../lib/comparar";

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
