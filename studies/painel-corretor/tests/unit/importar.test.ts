import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import type { AddressInfo } from "node:net";
import type { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import type { BaseAns } from "../../lib/ans";

// Scripts .mjs sem tipos: importados por caminho em variável (o tsc trata como any).
interface Entrada {
  nome: string;
  offset: number;
  tamanhoComprimido: number;
  tamanho: number;
  metodo: number;
}
interface ZipRemoto {
  listarEntradasRemotas(url: string): Promise<Entrada[]>;
  abrirEntradaRemota(url: string, e: Entrada): Promise<Readable>;
}
interface Rede {
  hospitais: Record<string, { nome: string; municipio: string; uf: string; classe: string; urgencia: boolean }>;
  porPlano: Record<string, string[]>;
}
type Ind = Record<
  string,
  { idss?: number; idssAno?: number; reajuste?: number; reajusteAnterior?: number; ciclo?: number }
>;
interface Importador {
  importar(o: Record<string, unknown>): Promise<BaseAns>;
  rede(fonte: string, planos: Record<string, unknown>, ufs: string[]): Promise<Rede>;
  indicadores(fonte: string, registros: Set<string>): Promise<{ porOperadora: Ind }>;
}
const carregar = <T>(rel: string): Promise<T> => {
  const url = pathToFileURL(path.join(process.cwd(), rel)).href;
  return import(url) as Promise<T>;
};
const zr = carregar<ZipRemoto>("scripts/zip-remoto.mjs");
const imp = carregar<Importador>("scripts/importar-ans.mjs");

const PDA = path.join(process.cwd(), "tests", "fixtures", "pda");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "importar-ans-"));

// ---------- escritor de zip mínimo ----------
interface ArqZip {
  nome: string;
  dados: Buffer;
  metodo: 0 | 8;
}
function zip(arqs: ArqZip[], { zip64 = false, comentario = "" } = {}): Buffer {
  const partes: Buffer[] = [];
  const central: Buffer[] = [];
  let pos = 0;
  const M32 = 0xffffffff;
  const u64 = (n: number) => {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(BigInt(n));
    return b;
  };
  for (const a of arqs) {
    const nome = Buffer.from(a.nome, "utf8");
    const comp = a.metodo === 8 ? zlib.deflateRawSync(a.dados) : a.dados;
    const crc = zlib.crc32(a.dados);
    // Extra local diferente do central (ZIP64 com tamanhos, ou um campo de preenchimento).
    const extraLocal = zip64
      ? Buffer.concat([Buffer.from([1, 0, 16, 0]), u64(a.dados.length), u64(comp.length)])
      : Buffer.concat([Buffer.from([0xfe, 0xca, 5, 0]), Buffer.from("abcde")]);
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0);
    loc.writeUInt16LE(zip64 ? 45 : 20, 4);
    loc.writeUInt16LE(0x0800, 6);
    loc.writeUInt16LE(a.metodo, 8);
    loc.writeUInt32LE(crc, 14);
    loc.writeUInt32LE(zip64 ? M32 : comp.length, 18);
    loc.writeUInt32LE(zip64 ? M32 : a.dados.length, 22);
    loc.writeUInt16LE(nome.length, 26);
    loc.writeUInt16LE(extraLocal.length, 28);
    const offset = pos;
    partes.push(loc, nome, extraLocal, comp);
    pos += loc.length + nome.length + extraLocal.length + comp.length;

    const extraCentral = zip64
      ? Buffer.concat([Buffer.from([1, 0, 24, 0]), u64(a.dados.length), u64(comp.length), u64(offset)])
      : Buffer.alloc(0);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(45, 4);
    c.writeUInt16LE(zip64 ? 45 : 20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(a.metodo, 10);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(zip64 ? M32 : comp.length, 20);
    c.writeUInt32LE(zip64 ? M32 : a.dados.length, 24);
    c.writeUInt16LE(nome.length, 28);
    c.writeUInt16LE(extraCentral.length, 30);
    c.writeUInt32LE(zip64 ? M32 : offset, 42);
    central.push(c, nome, extraCentral);
  }
  const cd = Buffer.concat(central);
  const iniCd = pos;
  partes.push(cd);
  pos += cd.length;
  if (zip64) {
    const r = Buffer.alloc(56);
    r.writeUInt32LE(0x06064b50, 0);
    r.writeBigUInt64LE(44n, 4);
    r.writeUInt16LE(45, 12);
    r.writeUInt16LE(45, 14);
    r.writeBigUInt64LE(BigInt(arqs.length), 24);
    r.writeBigUInt64LE(BigInt(arqs.length), 32);
    r.writeBigUInt64LE(BigInt(cd.length), 40);
    r.writeBigUInt64LE(BigInt(iniCd), 48);
    const l = Buffer.alloc(20);
    l.writeUInt32LE(0x07064b50, 0);
    l.writeBigUInt64LE(BigInt(pos), 8);
    l.writeUInt32LE(1, 16);
    partes.push(r, l);
  }
  const com = Buffer.from(comentario, "utf8");
  const e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0);
  e.writeUInt16LE(zip64 ? 0xffff : arqs.length, 8);
  e.writeUInt16LE(zip64 ? 0xffff : arqs.length, 10);
  e.writeUInt32LE(zip64 ? M32 : cd.length, 12);
  e.writeUInt32LE(zip64 ? M32 : iniCd, 16);
  e.writeUInt16LE(com.length, 20);
  partes.push(e, com);
  return Buffer.concat(partes);
}

async function texto(s: Readable) {
  const partes: Buffer[] = [];
  for await (const c of s) partes.push(c as Buffer);
  return Buffer.concat(partes).toString("utf8");
}

// ---------- fixtures geradas ----------
const CAB_REDE =
  "ID_REDE;REGISTRO_OPERADORA;NO_RAZAO;GR_MODALIDADE;DE_PORTE;ID_PLANO;CD_PLANO;TP_VIGENCIA_PLANO;CONTRATACAO;DE_TIPO_CONTRATACAO;DE_TIPO_MODALIDADE_FINM;SEGMENTACAO_ASSISTENCIAL;DE_TIPO_ABRANGENCIA_GEOGRAFICA;LG_FATOR_MODERADOR;DE_SITUACAO_PRINCIPAL;CD_SITUACAO_PLANO;ID_ESTABELECIMENTO_SAUDE;CD_CNPJ_ESTB_SAUDE;CD_CNES;NM_ESTABELECIMENTO_SAUDE;DE_CLAS_ESTB_SAUDE;LG_URGENCIA_EMERGENCIA;DE_TIPO_PRESTADOR;DE_TIPO_CONTRATO;DE_DISPONIBILIDADE;CD_MUNICIPIO;NM_MUNICIPIO;SG_UF;DT_VINCULO_INICIO;DT_VINCULO_FIM;NM_REGIAO;DT_ATUALIZACAO";
const linhaRede = (idPlano: string, cnes: string, nome: string, urg: string, fim: string, mun: string, uf: string) =>
  [
    "1",
    "326305",
    "X",
    "Y",
    "Z",
    idPlano,
    "4",
    "P",
    "C",
    "D",
    "M",
    "S",
    "A",
    "N",
    "Ativo",
    "1",
    "9",
    "000",
    cnes,
    nome,
    "Hospital Geral",
    urg,
    "Próprio",
    "Direto",
    "Total",
    "355030",
    mun,
    uf,
    "2020-01-01",
    fim,
    "Sudeste",
    "2026-11-01",
  ]
    .map((v) => `"${v}"`)
    .join(";");

const csvSP = [
  CAB_REDE,
  linhaRede("1001", "2077485", "HOSPITAL A", "1", "", "SAO PAULO", "SP"),
  linhaRede("1001", "9999999", "HOSPITAL ENCERRADO", "1", "2025-01-01", "SAO PAULO", "SP"),
  linhaRede("3001", "2078015", "HOSPITAL B", "0", "", "SAO PAULO", "SP"),
  linhaRede("3001", "2077485", "HOSPITAL A", "1", "", "SAO PAULO", "SP"),
  linhaRede("8888", "1234567", "HOSPITAL DE OUTRO PLANO", "1", "", "SAO PAULO", "SP"),
].join("\n");
const csvRJ = [CAB_REDE, linhaRede("1002", "3000001", "HOSPITAL RJ", "1", "", "RIO DE JANEIRO", "RJ")].join("\n");

const zipRede = (zip64 = false) =>
  zip(
    [
      { nome: "produtos_prestadores_hospitalares_RJ.csv", dados: Buffer.from(csvRJ), metodo: 0 },
      { nome: "produtos_prestadores_hospitalares_SP.csv", dados: Buffer.from(csvSP), metodo: 8 },
    ],
    { zip64, comentario: "zip de teste" },
  );

const CAB_VCM =
  "ID_PLANO;CD_NOTA;DT_NTRP;DT_ATUALIZACAO;ID_ABRG;FAIXA_ETARIA;VL_COMERCIAL_MENSALIDADE;VCM_MINIMO;VCM_MAXIMO";
const zipVcm = () =>
  zip([
    {
      nome: "nota_tecnica_vcm_faixa_etaria.csv",
      dados: Buffer.from(
        [
          CAB_VCM,
          "1001;1;01/01/2026;02/01/2026;1;00 a 18 anos;200,50;150,00;250,00",
          "3001;7;01/02/2026;02/02/2026;;00 a 18 anos;100,00;90,00;110,00",
        ].join("\n"),
      ),
      metodo: 8,
    },
  ]);

/** Pasta de fonte: cópia de tests/fixtures/pda + zips gerados. */
function fonteCompleta() {
  const d = tmp();
  fs.cpSync(PDA, d, { recursive: true });
  fs.mkdirSync(path.join(d, "produtos_e_prestadores_hospitalares"));
  fs.writeFileSync(
    path.join(d, "produtos_e_prestadores_hospitalares", "produtos_e_prestadores_hospitalares.zip"),
    zipRede(),
  );
  fs.mkdirSync(path.join(d, "nota_tecnica_ntrp_vcm_faixa_etaria"));
  fs.writeFileSync(path.join(d, "nota_tecnica_ntrp_vcm_faixa_etaria", "nota_tecnica_vcm_faixa_etaria.zip"), zipVcm());
  const alvo = path.join(d, "alvo.json");
  fs.writeFileSync(alvo, JSON.stringify([{ grupo: "Amil", registros: ["326305"] }]));
  return { d, alvo };
}

// ---------- zip remoto ----------
test("lista o diretório central de um zip local e lê entradas deflate e stored", async () => {
  const { listarEntradasRemotas, abrirEntradaRemota } = await zr;
  const arq = path.join(tmp(), "rede.zip");
  fs.writeFileSync(arq, zipRede());
  const es = await listarEntradasRemotas(arq);
  assert.deepEqual(
    es.map((e) => [e.nome, e.metodo]),
    [
      ["produtos_prestadores_hospitalares_RJ.csv", 0],
      ["produtos_prestadores_hospitalares_SP.csv", 8],
    ],
  );
  assert.equal(es[0].offset, 0);
  assert.equal(es[0].tamanhoComprimido, Buffer.byteLength(csvRJ));
  assert.equal(await texto(await abrirEntradaRemota(arq, es[0])), csvRJ);
  assert.equal(await texto(await abrirEntradaRemota(arq, es[1])), csvSP);
});

test("lê zip ZIP64 por HTTP Range sem baixar o arquivo inteiro", async () => {
  const { listarEntradasRemotas, abrirEntradaRemota } = await zr;
  const buf = zipRede(true);
  const pedidos: string[] = [];
  const srv = http.createServer((req, res) => {
    const m = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range ?? "");
    if (!m) {
      res.writeHead(200, { "Content-Length": buf.length });
      return res.end(buf);
    }
    pedidos.push(req.headers.range!);
    const ini = Number(m[1]);
    const fim = Math.min(Number(m[2]), buf.length - 1);
    res.writeHead(206, { "Content-Range": `bytes ${ini}-${fim}/${buf.length}`, "Content-Length": fim - ini + 1 });
    res.end(buf.subarray(ini, fim + 1));
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  try {
    const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/rede.zip`;
    const es = await listarEntradasRemotas(url);
    assert.deepEqual(
      es.map((e) => e.nome),
      ["produtos_prestadores_hospitalares_RJ.csv", "produtos_prestadores_hospitalares_SP.csv"],
    );
    assert.equal(es[1].tamanho, Buffer.byteLength(csvSP));
    assert.equal(await texto(await abrirEntradaRemota(url, es[1])), csvSP);
    assert.ok(pedidos.length > 0 && pedidos.every((p) => p.startsWith("bytes=")));
  } finally {
    srv.close();
  }
});

// ---------- etapas do importador ----------
test("rede: só UFs pedidas, só vínculos ativos e só planos importados", async () => {
  const { rede } = await imp;
  const { d } = fonteCompleta();
  const r = await rede(d, { "1001": {}, "1002": {}, "3001": {} }, ["SP"]);
  assert.deepEqual(r.porPlano, { "1001": ["2077485"], "3001": ["2078015", "2077485"] });
  assert.deepEqual(Object.keys(r.hospitais).sort(), ["2077485", "2078015"]);
  assert.deepEqual(r.hospitais["2077485"], {
    nome: "HOSPITAL A",
    municipio: "SAO PAULO/SP",
    uf: "SP",
    classe: "Hospital Geral",
    urgencia: true,
  });
  assert.equal(r.hospitais["2078015"].urgencia, false);
});

test("indicadores: IDSS mais recente não-ND e reajuste dos 2 ciclos mais recentes", async () => {
  const { indicadores } = await imp;
  const { porOperadora } = await indicadores(PDA, new Set(["326305", "222222", "333333", "444444"]));
  assert.deepEqual(porOperadora["326305"], {
    idss: 0.7812,
    idssAno: 2024,
    reajuste: 13.5,
    reajusteAnterior: 11.9,
    ciclo: 2026,
  });
  assert.deepEqual(porOperadora["222222"], { reajuste: 7, ciclo: 2025 });
  assert.deepEqual(porOperadora["333333"], { idss: 0.8543, idssAno: 2025 });
  assert.equal(porOperadora["444444"], undefined);
  assert.equal(porOperadora["111111"], undefined);
});

test("importar sem --todas: só operadoras alvo, grava base, rede e indicadores", async () => {
  const { importar } = await imp;
  const { d, alvo } = fonteCompleta();
  const saida = path.join(d, "saida", "base.json");
  const base = await importar({ fonte: d, ufs: ["SP"], alvo, saida });
  assert.deepEqual(
    base.operadoras.map((o) => o.registroAns),
    ["326305"],
  );
  assert.deepEqual(base.planos.map((p) => p.id).sort(), ["1001", "1002"]);
  const p = base.planos.find((x) => x.id === "1001")!;
  assert.equal(p.vcm!.variantes["1"].precos[0], 200.5);
  assert.deepEqual(p.municipios.map((m) => m.nome).sort(), ["SAO CAETANO DO SUL/SP", "SAO PAULO/SP"]);
  const rede = JSON.parse(fs.readFileSync(path.join(d, "saida", "rede.json"), "utf8"));
  assert.ok(rede.geradoEm);
  assert.deepEqual(rede.porPlano, { "1001": ["2077485"] });
  const ind = JSON.parse(fs.readFileSync(path.join(d, "saida", "indicadores.json"), "utf8"));
  assert.deepEqual(Object.keys(ind.porOperadora), ["326305"]);
});

test("importar --todas --uf SP: operadoras com plano ativo na UF (área, Nacional ou Estadual)", async () => {
  const { importar } = await imp;
  const { d, alvo } = fonteCompleta();
  const saida = path.join(d, "saida", "base.json");
  const base = await importar({ fonte: d, ufs: ["SP"], alvo, saida, todas: true });
  assert.deepEqual(base.operadoras.map((o) => o.registroAns).sort(), ["222222", "326305", "333333", "444444"]);
  const paulista = base.operadoras.find((o) => o.registroAns === "222222")!;
  assert.equal(paulista.grupo, "OPERADORA PAULISTA LTDA");
  assert.equal(paulista.modalidade, "Medicina de Grupo");
  assert.equal(base.operadoras.find((o) => o.registroAns === "326305")!.grupo, "Amil");
  assert.equal(base.operadoras.find((o) => o.registroAns === "333333")!.grupo, "NACIONAL");
  assert.deepEqual(base.planos.map((p) => p.id).sort(), ["1001", "1002", "3001", "4001", "5001"]);
  assert.equal(base.planos.find((p) => p.id === "3001")!.vcm!.variantes.UNICA.precos[0], 100);
  const rede = JSON.parse(fs.readFileSync(path.join(d, "saida", "rede.json"), "utf8"));
  assert.deepEqual(rede.porPlano["3001"], ["2078015", "2077485"]);
  const ind = JSON.parse(fs.readFileSync(path.join(d, "saida", "indicadores.json"), "utf8"));
  assert.deepEqual(Object.keys(ind.porOperadora).sort(), ["222222", "326305", "333333"]);
});

test("importar --sem-rede não grava rede.json", async () => {
  const { importar } = await imp;
  const { d, alvo } = fonteCompleta();
  const saida = path.join(d, "saida", "base.json");
  await importar({ fonte: d, ufs: ["SP"], alvo, saida, semRede: true });
  assert.equal(fs.existsSync(path.join(d, "saida", "rede.json")), false);
  assert.equal(fs.existsSync(path.join(d, "saida", "indicadores.json")), true);
});
