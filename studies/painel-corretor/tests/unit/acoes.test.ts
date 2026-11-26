import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { BaseAns, IndicadoresAns, RedeAns } from "../../lib/ans";
import { converterBase } from "../../lib/catalogo";
import { cidadeValida, filtrarSelecao, habilitadasEfetivas } from "../../lib/selecao";
import type { FiltroCotacao, Grupo } from "../../lib/types";
import { vidasVazias } from "../../lib/types";
import { precoTotal } from "../../lib/utils";

const dir = path.join(process.cwd(), "tests", "fixtures");
const ler = <T>(arq: string): T => JSON.parse(fs.readFileSync(path.join(dir, arq), "utf8"));
const cat = converterBase(ler<BaseAns>("base.json"), {
  rede: ler<RedeAns>("rede.json"),
  indicadores: ler<IndicadoresAns>("indicadores.json"),
});
const filtro: FiltroCotacao = { segmento: "Saúde", modalidade: "PME", cidade: "São Paulo - SP" };
const grupos = (faixa: keyof ReturnType<typeof vidasVazias>, n: number): Grupo[] => [
  { nome: "Geral", vidas: { ...vidasVazias(), [faixa]: n } },
];

test("filtrarSelecao: só segmento/modalidade/cidade e operadoras habilitadas", () => {
  const todas = new Set(cat.operadoras.map((o) => o.id));
  const r = filtrarSelecao(cat, filtro, grupos("29-33", 2), todas);
  assert.ok(r.planos.length > 0);
  for (const p of r.planos) {
    assert.equal(p.segmento, "Saúde");
    assert.equal(p.modalidade, "PME");
  }
  const so = new Set(["ans-326305"]);
  const r2 = filtrarSelecao(cat, filtro, grupos("29-33", 2), so);
  assert.ok(r2.planos.length > 0);
  assert.ok(r2.planos.every((p) => p.operadoraId === "ans-326305"));
  assert.deepEqual(
    r2.operadoras.map((o) => o.id),
    ["ans-326305"],
  );
});

test("filtrarSelecao: plano com faixa sem preço fica fora para aquela distribuição", () => {
  const todas = new Set(cat.operadoras.map((o) => o.id));
  const comNulo = cat.planos.find((p) => p.modalidade === "PME" && Object.values(p.precos).some((v) => v == null));
  const cat2 = comNulo
    ? cat
    : {
        ...cat,
        planos: cat.planos.map((p, i) =>
          i === cat.planos.findIndex((x) => x.modalidade === "PME" && x.cidades.includes("São Paulo - SP"))
            ? { ...p, precos: { ...p.precos, "59-999": null } }
            : p,
        ),
      };
  const alvo = cat2.planos.find(
    (p) =>
      p.modalidade === "PME" &&
      p.segmento === "Saúde" &&
      p.cidades.includes("São Paulo - SP") &&
      Object.entries(p.precos).some(([, v]) => v == null),
  )!;
  assert.ok(alvo, "fixture precisa de um plano PME com faixa nula");
  const faixaNula = Object.entries(alvo.precos).find(([, v]) => v == null)![0] as keyof ReturnType<typeof vidasVazias>;
  const r = filtrarSelecao(cat2, filtro, grupos(faixaNula, 1), todas);
  assert.ok(!r.planos.some((p) => p.id === alvo.id));
});

test("filtrarSelecao: ordena por operadora e preço total crescente; sem lista de cidades no retorno", () => {
  const todas = new Set(cat.operadoras.map((o) => o.id));
  const g = grupos("29-33", 3);
  const r = filtrarSelecao(cat, filtro, g, todas);
  const porOp = new Map<string, number[]>();
  for (const p of r.planos) porOp.set(p.operadoraId, [...(porOp.get(p.operadoraId) ?? []), precoTotal(p, g)]);
  for (const precos of porOp.values())
    assert.deepEqual(
      precos,
      [...precos].sort((a, b) => a - b),
    );
  for (const p of r.planos) assert.deepEqual(p.cidades, ["São Paulo - SP"]);
  // hospitais: só os da rede dos planos devolvidos
  const usados = new Set(r.planos.flatMap((p) => p.rede.map((x) => x.hospitalId)));
  assert.ok(r.hospitais.every((h) => usados.has(h.id)));
});

test("filtrarSelecao: cidade inexistente devolve listas vazias", () => {
  const todas = new Set(cat.operadoras.map((o) => o.id));
  const r = filtrarSelecao(cat, { ...filtro, cidade: "Atlântida - XX" }, grupos("29-33", 1), todas);
  assert.deepEqual(r, { planos: [], operadoras: [], hospitais: [] });
});

test("habilitadasEfetivas: conta > alvo (ANS) > todas", () => {
  const ids = cat.operadoras.map((o) => o.id);
  assert.deepEqual(habilitadasEfetivas(["ans-326305"], "ans", cat.operadoras, ["005711"]), ["ans-326305"]);
  assert.deepEqual(habilitadasEfetivas([], "ans", cat.operadoras, ["005711", "999999"]), ["ans-005711"]);
  assert.deepEqual(habilitadasEfetivas([], "ans", cat.operadoras, ["999999"]), ids);
  assert.deepEqual(habilitadasEfetivas(undefined, "ficticio", cat.operadoras, ["005711"]), ids);
});

test("habilitadasEfetivas: ids da conta fora do catálogo são ignorados", () => {
  const ids = cat.operadoras.map((o) => o.id);
  assert.deepEqual(habilitadasEfetivas(["op-aurora", "op-vitalis"], "ans", cat.operadoras, ["005711"]), ["ans-005711"]);
  assert.deepEqual(habilitadasEfetivas(["op-aurora", "ans-326305"], "ans", cat.operadoras, ["005711"]), ["ans-326305"]);
  assert.deepEqual(habilitadasEfetivas(["op-aurora"], "ficticio", cat.operadoras, []), ids);
});

test("cidadeValida: mantém se existe, senão São Paulo - SP, senão a primeira", () => {
  assert.equal(cidadeValida("Campinas - SP", cat.cidades), "Campinas - SP");
  assert.equal(cidadeValida("Goiânia - GO", cat.cidades), "São Paulo - SP");
  assert.equal(cidadeValida("Goiânia - GO", ["Belo Horizonte - MG"]), "Belo Horizonte - MG");
  assert.equal(cidadeValida("x", []), "São Paulo - SP");
});

test("filtrarSelecao: hospitais só da UF da cidade do filtro (planos nacionais têm rede em outras UFs)", () => {
  const todas = new Set(cat.operadoras.map((o) => o.id));
  const bh = filtrarSelecao(cat, { ...filtro, cidade: "Belo Horizonte - MG" }, grupos("29-33", 1), todas);
  assert.ok(
    bh.planos.some((p) =>
      p.rede.some(
        (r) =>
          r.hospitalId.startsWith("cnes-") && !r.hospitalId.includes("2126494") && !r.hospitalId.includes("2695324"),
      ),
    ),
  );
  assert.ok(bh.hospitais.length > 0);
  assert.ok(
    bh.hospitais.every((h) => h.uf === "MG"),
    JSON.stringify(bh.hospitais),
  );
  const sp = filtrarSelecao(cat, filtro, grupos("29-33", 1), todas);
  assert.ok(sp.hospitais.length > 0 && sp.hospitais.every((h) => h.uf === "SP"));
  // ordem alfabética
  const nomes = sp.hospitais.map((h) => h.nome);
  assert.deepEqual(
    nomes,
    [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")),
  );
});

test("filtrarSelecao: base fictícia (hospitais sem UF) mantém todos os hospitais da rede", () => {
  const hosp = [
    { id: "h1", nome: "Hospital B", bairro: "Centro", regiao: "São Paulo - Centro" },
    { id: "h2", nome: "Hospital A", bairro: "Savassi", regiao: "Belo Horizonte" },
  ];
  const p = {
    ...cat.planos.find(
      (x) => x.cidades.includes("São Paulo - SP") && x.modalidade === "PME" && x.segmento === "Saúde",
    )!,
  };
  const c = {
    planos: [
      {
        ...p,
        rede: [
          { hospitalId: "h1", servicos: "H" },
          { hospitalId: "h2", servicos: "H" },
        ],
      },
    ],
    operadoras: cat.operadoras,
    hospitais: hosp,
  };
  const r = filtrarSelecao(c, filtro, grupos("29-33", 1), new Set(cat.operadoras.map((o) => o.id)));
  assert.deepEqual(r.hospitais.map((h) => h.id).sort(), ["h1", "h2"]);
});
