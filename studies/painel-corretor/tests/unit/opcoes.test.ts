import test from "node:test";
import assert from "node:assert/strict";
import {
  alternar,
  itensDisponiveis,
  mostraItem,
  mostraRegiao,
  regioesDisponiveis,
  rotuloContagem,
} from "../../lib/opcoes";
import { OPCOES_PADRAO, type Hospital, type Operadora, type Plano } from "../../lib/types";

const h = (id: string, regiao: string): Hospital => ({ id, nome: id, bairro: "", regiao });
const plano = (rede: string[], origemPreco: Plano["origemPreco"] = "ans") =>
  ({ rede: rede.map((hospitalId) => ({ hospitalId, servicos: "H" })), origemPreco }) as unknown as Plano;
const op = (o: Partial<Operadora>) => o as Operadora;

test("regioesDisponiveis: regiões distintas dos hospitais da rede dos planos, em ordem", () => {
  const hosp = [h("a", "Zona Sul"), h("b", "Centro"), h("c", "Zona Sul"), h("d", "ABC")];
  assert.deepEqual(regioesDisponiveis([plano(["a", "b"]), plano(["c"])], hosp), ["Centro", "Zona Sul"]);
  assert.deepEqual(regioesDisponiveis([], hosp), []);
});

test("itensDisponiveis: contratação só com plano fictício; IDSS/reajuste só se alguma operadora tiver", () => {
  const base = ["acomodacao", "coparticipacao", "abrangencia", "registro"];
  assert.deepEqual(
    itensDisponiveis([plano([])], [op({})]).map((i) => i.chave),
    base,
  );
  assert.deepEqual(
    itensDisponiveis([plano([], "ficticio")], [op({ idss: 0.8, reajuste: 10 })]).map((i) => i.chave),
    ["acomodacao", "coparticipacao", "abrangencia", "contratacao", "registro", "idss", "reajuste"],
  );
});

test("mostraRegiao / mostraItem: undefined = todos; lista = só os marcados", () => {
  assert.ok(mostraRegiao(OPCOES_PADRAO, "Centro"));
  assert.ok(mostraRegiao({ ...OPCOES_PADRAO, regioes: ["Centro"] }, "Centro"));
  assert.ok(!mostraRegiao({ ...OPCOES_PADRAO, regioes: ["Centro"] }, "ABC"));
  assert.ok(!mostraRegiao({ ...OPCOES_PADRAO, regioes: [] }, "ABC"));
  assert.ok(mostraItem(OPCOES_PADRAO, "idss"));
  assert.ok(!mostraItem({ ...OPCOES_PADRAO, itens: ["acomodacao"] }, "idss"));
});

test("alternar: desmarcar a partir de todos vira lista; marcar tudo volta a undefined", () => {
  const todos = ["A", "B", "C"];
  assert.deepEqual(alternar(undefined, "B", todos), ["A", "C"]);
  assert.deepEqual(alternar(["A", "C"], "B", todos), undefined);
  assert.deepEqual(alternar(["A"], "A", todos), []);
  assert.deepEqual(alternar(["C"], "A", todos), ["A", "C"]);
});

test("rotuloContagem: selecionados (só os que existem) ou total", () => {
  assert.equal(rotuloContagem(undefined, ["A", "B", "C"], "regiões"), "3 regiões");
  assert.equal(rotuloContagem(["A", "X"], ["A", "B"], "regiões"), "1 região");
  assert.equal(rotuloContagem([], ["A"], "itens"), "0 itens");
});
