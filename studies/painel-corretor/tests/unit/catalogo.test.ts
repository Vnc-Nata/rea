import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { BaseAns, IndicadoresAns, RedeAns } from "../../lib/ans";
import { CABECALHO_TABELAS, type TabelaVenda } from "../../lib/tabelas";
import type { Grupo, Plano } from "../../lib/types";
import { FAIXAS, vidasVazias } from "../../lib/types";
import { CORES_GRUPO, aplicarAjustes, catalogo, converterBase, planosDaCidade } from "../../lib/catalogo";
import { rotuloMunicipio, ufDoCodigo } from "../../lib/municipios";
import { precoDisponivel, precoTotal } from "../../lib/utils";
import { readDb } from "../../lib/db";

const dir = path.join(process.cwd(), "tests", "fixtures");
const ler = <T>(arq: string): T => JSON.parse(fs.readFileSync(path.join(dir, arq), "utf8"));
const base = ler<BaseAns>("base.json");
const rede = ler<RedeAns>("rede.json");
const indicadores = ler<IndicadoresAns>("indicadores.json");

const cat = converterBase(base, { rede, indicadores });
const plano = (idAns: string) => cat.planos.find((p) => p.id === `ans-${idAns}`);
const grupos = (faixa: keyof ReturnType<typeof vidasVazias>, n: number): Grupo[] => [
  { nome: "Titulares", vidas: { ...vidasVazias(), [faixa]: n } },
];

test("mapeia contratação, segmento, acomodação e coparticipação", () => {
  for (const pa of base.planos.filter((p) => p.vcm)) {
    const p = plano(pa.id)!;
    assert.ok(p, pa.id);
    const mod = { "Individual ou familiar": "PF", "Coletivo empresarial": "PME", "Coletivo por adesão": "Adesão" }[
      pa.contratacao
    ];
    assert.equal(p.modalidade, mod);
    assert.equal(p.segmento, pa.segmentacaoGrupo === "Exclusivamente Odontológico" ? "Dental" : "Saúde");
    assert.equal(p.acomodacao, pa.acomodacao === "Individual" ? "Quarto Individual" : "Quarto Coletivo");
    assert.equal(p.coparticipacao, pa.fatorModerador !== "Ausente" ? "Com coparticipação" : "Sem coparticipação");
    assert.equal(p.operadoraId, `ans-${pa.registroAns}`);
    assert.equal(p.registroAns, pa.codigoAns);
    assert.equal(p.codigoAns, pa.codigoAns);
    assert.equal(p.origemPreco, "ans");
    assert.equal(p.laboratorios, 0);
  }
  assert.ok(cat.planos.some((p) => p.modalidade === "PF"));
  assert.ok(cat.planos.some((p) => p.modalidade === "Adesão"));
  assert.ok(cat.planos.some((p) => p.segmento === "Dental"));
});

test("cidades com rótulo e lista de cidades do catálogo", () => {
  const amil = plano("1000001")!;
  assert.ok(amil.cidades.includes("São Caetano do Sul - SP"));
  assert.ok(amil.cidades.includes("São Paulo - SP"));
  assert.deepEqual(cat.cidades, ["Belo Horizonte - MG", "Campinas - SP", "São Caetano do Sul - SP", "São Paulo - SP"]);
});

test("plano nacional/estadual sem municípios recebe as cidades das UFs detalhadas em plano.ufs", () => {
  const pa = base.planos.find((p) => p.vcm && p.abrangencia === "Nacional")!;
  const b2: BaseAns = {
    ...base,
    planos: [
      ...base.planos,
      { ...pa, id: "9999991", municipios: [], ufs: ["MG"] },
      { ...pa, id: "9999992", municipios: [], ufs: ["SP", "MG", "RJ"], abrangencia: "Estadual" },
    ],
  };
  const c2 = converterBase(b2, {});
  assert.deepEqual(c2.planos.find((p) => p.id === "ans-9999991")!.cidades, ["Belo Horizonte - MG"]);
  assert.deepEqual(c2.planos.find((p) => p.id === "ans-9999992")!.cidades, [
    "Belo Horizonte - MG",
    "Campinas - SP",
    "São Caetano do Sul - SP",
    "São Paulo - SP",
  ]);
});

test("seguradora tem IOF 2,38%; não seguradora não tem", () => {
  const brad = cat.operadoras.find((o) => o.id === "ans-005711")!;
  assert.equal(brad.seguradora, true);
  const pb = cat.planos.find((p) => p.operadoraId === "ans-005711")!;
  assert.equal(pb.iof, 0.0238);
  const amil = cat.operadoras.find((o) => o.id === "ans-326305")!;
  assert.ok(!amil.seguradora);
  assert.equal(cat.planos.find((p) => p.operadoraId === "ans-326305")!.iof, undefined);
  const p: Plano = { ...pb, precos: { ...pb.precos, "44-48": 1000 } };
  assert.equal(precoTotal(p, grupos("44-48", 4)), 4095.2);
});

test("operadora: nome curto, sigla, cor do grupo e indicadores", () => {
  const amil = cat.operadoras.find((o) => o.id === "ans-326305")!;
  assert.equal(amil.nome, "Amil");
  assert.equal(amil.sigla, "AM");
  assert.equal(amil.cor, "#0047bb");
  assert.equal(amil.idss, 0.78);
  assert.equal(amil.reajuste, 13.5);
  assert.equal(amil.reajusteAnterior, 11.9);
  assert.equal(cat.operadoras.find((o) => o.id === "ans-005711")!.cor, "#cc092f");
  for (const o of cat.operadoras) {
    assert.ok(!/S\.A\.|LTDA/i.test(o.nome), o.nome);
    assert.equal(o.sigla.length, 2);
  }
});

test("ajuste da operadora multiplica o VCM", () => {
  const c2 = converterBase(base, { ajustes: { "ans-005711": 10 } });
  const pa = base.planos.find((p) => p.registroAns === "005711" && p.vcm)!;
  const vcm = Object.values(pa.vcm!.variantes)[0].precos;
  const p = c2.planos.find((x) => x.id === `ans-${pa.id}`)!;
  assert.equal(p.precos["00-18"], Math.round(vcm[0]! * 1.1 * 100) / 100);
  assert.equal(p.origemPreco, "ans");
  // sem ajuste para outras operadoras
  const pAmil = c2.planos.find((x) => x.id === "ans-1000001")!;
  assert.equal(pAmil.precos["24-28"], 179.18);
});

test("tabela de venda casada substitui o VCM e marca origem/vigência", () => {
  const pa = base.planos.find((p) => p.id === "1000001")!;
  const tabela: TabelaVenda = {
    registro: "326305",
    codigoAns: pa.codigoAns,
    vigencia: "2026-10-01",
    precos: [100, 110, 120, 130, 140, 150, 160, 170, 180, 190],
    arquivo: "t.csv",
    linha: 2,
  };
  const c2 = converterBase(base, { tabelas: [tabela], ajustes: { "ans-326305": 50 } });
  const p = c2.planos.find((x) => x.id === "ans-1000001")!;
  assert.equal(p.origemPreco, "tabela");
  assert.equal(p.vigencia, "2026-10-01");
  assert.equal(p.precos["00-18"], 100);
  assert.equal(p.precos["59-999"], 190);
});

test("plano sem VCM e sem tabela fica fora; faixa nula torna preço indisponível", () => {
  for (const pa of base.planos.filter((p) => !p.vcm)) assert.equal(plano(pa.id), undefined);
  const comNulo = cat.planos.find((p) => p.precos["59-999"] === null)!;
  assert.ok(comNulo);
  assert.equal(precoDisponivel(comNulo, grupos("59-999", 1)), false);
  assert.equal(precoDisponivel(comNulo, grupos("00-18", 1)), true);
});

test("rede: hospitais cnes-<CNES> e serviços H/PS", () => {
  const [idPlano, cnes] = Object.entries(rede.porPlano)[0];
  const p = plano(idPlano)!;
  assert.equal(p.rede.length, cnes.length);
  const h = cat.hospitais.find((x) => x.id === `cnes-${cnes[0]}`)!;
  assert.ok(h);
  const info = rede.hospitais[cnes[0]];
  assert.equal(h.regiao, rotuloMunicipio(info.municipio));
  assert.equal(p.rede[0].servicos, info.urgencia ? "H,PS" : "H");
});

test("rotuloMunicipio e ufDoCodigo", () => {
  assert.equal(rotuloMunicipio("SAO CAETANO DO SUL/SP"), "São Caetano do Sul - SP");
  assert.equal(rotuloMunicipio("BELO HORIZONTE/MG"), "Belo Horizonte - MG");
  assert.equal(rotuloMunicipio("SANTA BARBARA D'OESTE/SP"), "Santa Bárbara d'Oeste - SP");
  assert.equal(ufDoCodigo("354880"), "SP");
  assert.equal(ufDoCodigo("3106200"), "MG");
});

test("sem base (ANS_DIR vazio) o catálogo é o fictício do db.json", () => {
  const vazio = fs.mkdtempSync(path.join(os.tmpdir(), "ans-vazio-"));
  const antes = process.env.ANS_DIR;
  process.env.ANS_DIR = vazio;
  try {
    const c = catalogo();
    assert.equal(c.fonte, "ficticio");
    const db = readDb();
    assert.deepEqual(
      c.planos.map((p) => p.id),
      db.planos.map((p) => p.id),
    );
    assert.ok(c.planos.every((p) => p.origemPreco === "ficticio"));
    assert.ok(c.operadoras.every((o) => o.sigla.length === 2));
    assert.ok(c.cidades.includes("São Paulo - SP"));
  } finally {
    process.env.ANS_DIR = antes;
  }
});

test("com base em ANS_DIR o catálogo vem da ANS", () => {
  const antes = process.env.ANS_DIR;
  process.env.ANS_DIR = path.relative(process.cwd(), dir);
  try {
    const c = catalogo();
    assert.equal(c.fonte, "ans");
    assert.equal(c.geradoEm, base.geradoEm);
    assert.ok(c.planos.some((p) => p.id === "ans-1000001"));
    assert.ok(c.hospitais.length > 0);
    assert.equal(c.operadoras.find((o) => o.id === "ans-326305")!.idss, 0.78);
    assert.strictEqual(catalogo(), c); // cache
  } finally {
    process.env.ANS_DIR = antes;
  }
});

test("cache estável quando a pasta de tabelas não existe", () => {
  const antes = { ans: process.env.ANS_DIR, tab: process.env.TABELAS_DIR };
  process.env.ANS_DIR = path.relative(process.cwd(), dir);
  process.env.TABELAS_DIR = path.join(os.tmpdir(), "tabelas-que-nao-existem-" + process.pid);
  try {
    const c1 = catalogo();
    assert.equal(c1.fonte, "ans");
    assert.strictEqual(catalogo(), c1);
    assert.strictEqual(catalogo(), c1);
  } finally {
    process.env.ANS_DIR = antes.ans;
    if (antes.tab === undefined) delete process.env.TABELAS_DIR;
    else process.env.TABELAS_DIR = antes.tab;
  }
});

test("base.json corrompida cai no catálogo fictício sem erro", () => {
  const ruim = fs.mkdtempSync(path.join(os.tmpdir(), "ans-ruim-"));
  fs.writeFileSync(path.join(ruim, "base.json"), "{ corrompido");
  const antes = process.env.ANS_DIR;
  const warn = console.warn;
  let avisos = 0;
  console.warn = () => void avisos++;
  process.env.ANS_DIR = ruim;
  try {
    assert.equal(catalogo().fonte, "ficticio");
    assert.equal(catalogo().fonte, "ficticio");
    assert.equal(avisos, 1);
  } finally {
    process.env.ANS_DIR = antes;
    console.warn = warn;
  }
});

test("cores cobrem exatamente os grupos de operadoras-alvo.json", () => {
  const alvo = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "ans", "operadoras-alvo.json"), "utf8")) as {
    grupo: string;
  }[];
  assert.deepEqual(Object.keys(CORES_GRUPO).sort(), alvo.map((g) => g.grupo).sort());
});

test("aplicarAjustes sobre a base convertida = converterBase com ajustes (não reconverte a base)", () => {
  const ajustes = { "ans-005711": 10, "ans-326305": -5.5 };
  const semAjuste = converterBase(base, { rede, indicadores });
  assert.deepEqual(aplicarAjustes(semAjuste, ajustes), converterBase(base, { rede, indicadores, ajustes }));
  assert.strictEqual(aplicarAjustes(semAjuste, {}), semAjuste);
  // a base sem ajuste não é alterada
  assert.deepEqual(semAjuste, converterBase(base, { rede, indicadores }));
});

test("planosDaCidade: índice por cidade igual ao filtro linear", () => {
  for (const cidade of [...cat.cidades, "Atlântida - XX"]) {
    assert.deepEqual(
      planosDaCidade(cat, cidade).map((p) => p.id),
      cat.planos.filter((p) => p.cidades.includes(cidade)).map((p) => p.id),
      cidade,
    );
  }
});

test("hospitais da base ANS levam a UF", () => {
  for (const h of cat.hospitais) assert.match(h.uf ?? "", /^(SP|MG)$/, h.id);
  assert.equal(cat.hospitais.find((h) => h.id === "cnes-2126494")!.uf, "MG");
});

const DB = path.join(process.cwd(), "data", "db.json");

/** Roda `fn` com ANS_DIR/TABELAS_DIR de teste e devolve o db.json (conteúdo e datas) ao estado original. */
function comAmbiente(tabelasDir: string, fn: () => void) {
  const antes = { ans: process.env.ANS_DIR, tab: process.env.TABELAS_DIR };
  readDb(); // garante que o db.json existe
  const conteudo = fs.readFileSync(DB);
  const st = fs.statSync(DB);
  process.env.ANS_DIR = path.relative(process.cwd(), dir);
  process.env.TABELAS_DIR = tabelasDir;
  try {
    fn();
  } finally {
    fs.writeFileSync(DB, conteudo);
    fs.utimesSync(DB, st.atime, st.mtime);
    if (antes.ans === undefined) delete process.env.ANS_DIR;
    else process.env.ANS_DIR = antes.ans;
    if (antes.tab === undefined) delete process.env.TABELAS_DIR;
    else process.env.TABELAS_DIR = antes.tab;
  }
}

test("catálogo não é reconstruído por escrita no db.json que não muda os ajustes", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tab-vazia-"));
  comAmbiente(tmp, () => {
    const c1 = catalogo();
    // reescreve o db.json com o mesmo conteúdo e data no futuro: mtime muda, ajustes não
    fs.writeFileSync(DB, fs.readFileSync(DB));
    const futuro = new Date(Date.now() + 5000);
    fs.utimesSync(DB, futuro, futuro);
    assert.strictEqual(catalogo(), c1);
  });
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("catálogo é reconstruído quando um ajuste muda (preços ANS mudam; ao desfazer, voltam)", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tab-vazia-"));
  comAmbiente(tmp, () => {
    // Parte de "sem ajustes": o db.json real pode já ter ajustes salvos pela equipe.
    const db = readDb();
    db.conta = { ...db.conta, ajustes: {} } as typeof db.conta;
    fs.writeFileSync(DB, JSON.stringify(db));
    const c1 = catalogo();
    const antes = c1.planos.find((p) => p.origemPreco === "ans" && p.operadoraId === "ans-326305")!;
    assert.ok(antes);
    db.conta = { ...db.conta, ajustes: { "ans-326305": 10 } } as typeof db.conta;
    fs.writeFileSync(DB, JSON.stringify(db));
    const c2 = catalogo();
    assert.notStrictEqual(c2, c1);
    const depois = c2.planos.find((p) => p.id === antes.id)!;
    const f = FAIXAS.find((x) => antes.precos[x] != null)!;
    assert.ok(depois.precos[f]! > antes.precos[f]!, "preço sobe com ajuste de +10%");
    // outra operadora não muda
    const outro = c1.planos.find((p) => p.operadoraId !== "ans-326305" && p.origemPreco === "ans")!;
    assert.deepEqual(c2.planos.find((p) => p.id === outro.id)!.precos, outro.precos);
    // desfaz o ajuste
    db.conta = { ...db.conta, ajustes: {} } as typeof db.conta;
    fs.writeFileSync(DB, JSON.stringify(db));
    assert.deepEqual(catalogo().planos.find((p) => p.id === antes.id)!.precos, antes.precos);
  });
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("catálogo é reconstruído quando uma tabela de venda (CSV) muda", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tab-venda-"));
  comAmbiente(tmp, () => {
    const id = "ans-1000001";
    const preco = () => catalogo().planos.find((p) => p.id === id)!;
    const sem = preco();
    assert.equal(sem.origemPreco, "ans");
    const csv = (valor: string) =>
      `${CABECALHO_TABELAS.join(";")}\n326305;400001013;Plano Tabela;SP;;PME;2026-01-01;${Array(10).fill(valor).join(";")}\n`;
    const arq = path.join(tmp, "t.csv");
    fs.writeFileSync(arq, csv("111,11"));
    const c1 = preco();
    assert.equal(c1.origemPreco, "tabela");
    assert.equal(c1.precos["24-28"], 111.11);
    // mesma tabela: sem reconstrução
    assert.strictEqual(preco(), c1);
    // CSV alterado (tamanho diferente): preços novos
    fs.writeFileSync(arq, csv("222,2"));
    assert.equal(preco().precos["24-28"], 222.2);
    // CSV removido: volta ao preço ANS
    fs.rmSync(arq);
    assert.deepEqual(preco().precos, sem.precos);
  });
  fs.rmSync(tmp, { recursive: true, force: true });
});
