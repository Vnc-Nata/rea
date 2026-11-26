import test from "node:test";
import assert from "node:assert/strict";
import { lerNumeroBR } from "../../lib/numeros";

test("lerNumeroBR: milhares com ponto, decimal com vírgula ou ponto", () => {
  assert.equal(lerNumeroBR("1.034"), 1034);
  assert.equal(lerNumeroBR("12.345.678"), 12345678);
  assert.equal(lerNumeroBR("1034.8"), 1034.8);
  assert.equal(lerNumeroBR("1034.80"), 1034.8);
  assert.equal(lerNumeroBR("1.034,80"), 1034.8);
  assert.equal(lerNumeroBR("R$ 312,5"), 312.5);
  assert.equal(lerNumeroBR("450"), 450);
  assert.equal(lerNumeroBR("0"), 0);
  assert.equal(lerNumeroBR(" "), null);
  assert.ok(Number.isNaN(lerNumeroBR("1.034.80")));
  assert.ok(Number.isNaN(lerNumeroBR("1034.805")));
  assert.ok(Number.isNaN(lerNumeroBR("abc")));
});
