#!/usr/bin/env node
// Importa da base de dados abertos da ANS (dadosabertos.ans.gov.br/FTP/PDA)
// as operadoras, os planos ativos e o VCM por faixa etária das operadoras
// listadas em data/ans/operadoras-alvo.json. Grava data/ans/base.json.
//
// Uso:
//   npm run importar-ans                 # todas as UFs (só a lista de UFs por plano)
//   npm run importar-ans -- --uf SP,RJ   # guarda também os municípios dessas UFs
//   npm run importar-ans -- --sem-area   # pula a área de comercialização (arquivo de ~1 GB)
//   npm run importar-ans -- --fonte ./pasta-com-os-arquivos   # usa cópias locais
//
// Sem dependências: usa fetch, zlib e streams do Node 20+.

import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PASTA = path.join(RAIZ, "data", "ans");
const FONTE_PADRAO = "https://dadosabertos.ans.gov.br/FTP/PDA/";

const ARQ = {
  cadop: "operadoras_de_plano_de_saude_ativas/Relatorio_cadop.csv",
  produtos: "caracteristicas_produtos_saude_suplementar-008/pda-008-caracteristicas_produtos_saude_suplementar.csv",
  vcm: "nota_tecnica_ntrp_vcm_faixa_etaria/nota_tecnica_vcm_faixa_etaria.zip",
  area: "area_comercializacao_planos_ntrp/pda_area_comer_plano_ntrp.csv",
};

// "00 a 18 anos" … "59 anos ou mais" → índice 0…9 (mesma ordem de FAIXAS em lib/types.ts)
const FAIXA_ANS = [
  "00 a 18 anos",
  "19 a 23 anos",
  "24 a 28 anos",
  "29 a 33 anos",
  "34 a 38 anos",
  "39 a 43 anos",
  "44 a 48 anos",
  "49 a 53 anos",
  "54 a 58 anos",
  "59 anos ou mais",
];

// ---------- argumentos ----------
function args(argv) {
  const o = { fonte: FONTE_PADRAO, ufs: [], semArea: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fonte") o.fonte = argv[++i];
    else if (a === "--uf") o.ufs = argv[++i].split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    else if (a === "--sem-area") o.semArea = true;
    else if (a === "--saida") o.saida = argv[++i];
    else if (a === "--alvo") o.alvo = argv[++i];
    else if (a === "-h" || a === "--help") {
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 12).join("\n"));
      process.exit(0);
    }
  }
  return o;
}

// ---------- utilitários ----------
export const registro = (s) => {
  const d = String(s ?? "").replace(/\D/g, "");
  return d ? d.replace(/^0+/, "").padStart(6, "0") : "";
};

/** Divide uma linha CSV com ";" e aspas duplas. */
export function campos(linha) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (q && linha[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === ";" && !q) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

const numero = (s) => {
  if (!s) return null;
  const t = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const dataBr = (s) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s ?? "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (s ?? "").slice(0, 10);
};

async function abrir(fonte, rel) {
  if (/^https?:/i.test(fonte)) {
    const url = new URL(rel, fonte.endsWith("/") ? fonte : fonte + "/");
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    return Readable.fromWeb(r.body);
  }
  return fs.createReadStream(path.join(fonte, rel));
}

async function baixar(fonte, rel) {
  const chunks = [];
  for await (const c of await abrir(fonte, rel)) chunks.push(c);
  return Buffer.concat(chunks);
}

/** Lê um stream de texto linha a linha, devolvendo { cab, linha } já divididos. */
async function* csv(stream) {
  let resto = "";
  let cab = null;
  const dec = new TextDecoder("utf-8");
  for await (const chunk of stream) {
    const partes = (resto + dec.decode(chunk, { stream: true })).split("\n");
    resto = partes.pop();
    for (const p of partes) {
      const l = p.replace(/\r$/, "");
      if (!l) continue;
      if (!cab) {
        cab = Object.fromEntries(campos(l.replace(/^﻿/, "")).map((h, i) => [h, i]));
        continue;
      }
      yield { cab, linha: campos(l) };
    }
  }
  if (resto.trim() && cab) yield { cab, linha: campos(resto.replace(/\r$/, "")) };
}

/** Lista as entradas de um .zip (diretório central) e devolve streams descompactados. */
export function* entradasZip(buf) {
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error("zip inválido");
  const n = buf.readUInt16LE(e + 10);
  let p = buf.readUInt32LE(e + 16);
  for (let i = 0; i < n; i++) {
    const metodo = buf.readUInt16LE(p + 10);
    const csz = buf.readUInt32LE(p + 20);
    const nl = buf.readUInt16LE(p + 28);
    const xl = buf.readUInt16LE(p + 30);
    const cl = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const nome = buf.subarray(p + 46, p + 46 + nl).toString("utf8");
    p += 46 + nl + xl + cl;
    const ini = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    const dados = buf.subarray(ini, ini + csz);
    const stream = metodo === 0 ? Readable.from([dados]) : Readable.from([dados]).pipe(zlib.createInflateRaw());
    yield { nome, stream };
  }
}

const log = (...a) => console.log("•", ...a);

// ---------- etapas ----------
async function operadoras(fonte, alvo) {
  const out = {};
  for await (const { cab, linha } of csv(await abrir(fonte, ARQ.cadop))) {
    const reg = registro(linha[cab.REGISTRO_OPERADORA]);
    if (!alvo.has(reg)) continue;
    out[reg] = {
      registroAns: reg,
      grupo: alvo.get(reg),
      cnpj: linha[cab.CNPJ],
      razaoSocial: linha[cab.RAZAO_SOCIAL],
      nomeFantasia: linha[cab.NOME_FANTASIA] || null,
      modalidade: linha[cab.MODALIDADE],
      uf: linha[cab.UF],
      dataRegistro: linha[cab.DATA_REGISTRO_ANS],
    };
  }
  return out;
}

async function produtos(fonte, alvo) {
  const out = {};
  for await (const { cab, linha } of csv(await abrir(fonte, ARQ.produtos))) {
    const reg = registro(linha[cab.REGISTRO_OPERADORA]);
    if (!alvo.has(reg) || linha[cab.SITUACAO_PLANO] !== "Ativo") continue;
    const id = linha[cab.ID_PLANO];
    out[id] = {
      id,
      codigoAns: linha[cab.CD_PLANO],
      nome: linha[cab.NM_PLANO],
      registroAns: reg,
      grupo: alvo.get(reg),
      contratacao: linha[cab.CONTRATACAO],
      segmentacao: linha[cab.SGMT_ASSISTENCIAL],
      segmentacaoGrupo: linha[cab.GR_SGMT_ASSISTENCIAL],
      odontologico: linha[cab.LG_ODONTOLOGICO] === "1",
      obstetricia: linha[cab.OBSTETRICIA],
      abrangencia: linha[cab.ABRANGENCIA_COBERTURA],
      fatorModerador: linha[cab.FATOR_MODERADOR],
      acomodacao: linha[cab.ACOMODACAO_HOSPITALAR],
      livreEscolha: linha[cab.LIVRE_ESCOLHA],
      dataRegistro: linha[cab.DT_REGISTRO_PLANO],
      vcm: null,
      ufs: [],
      municipios: [],
    };
  }
  return out;
}

/** Guarda, por plano, a nota técnica mais recente (por data da NTRP), com uma variante por abrangência. */
async function vcm(fonte, planos) {
  const buf = await baixar(fonte, ARQ.vcm);
  const melhor = {}; // id → { nota, data, variantes: { abrg → { precos[10], min[10], max[10] } } }
  for (const { stream } of entradasZip(buf)) {
    for await (const { cab, linha } of csv(stream)) {
      const id = linha[cab.ID_PLANO];
      if (!planos[id]) continue;
      const f = FAIXA_ANS.indexOf(linha[cab.FAIXA_ETARIA]);
      if (f < 0) continue;
      const data = dataBr(linha[cab.DT_NTRP]);
      const nota = linha[cab.CD_NOTA];
      const cur = melhor[id];
      if (!cur || data > cur.data || (data === cur.data && Number(nota) > Number(cur.nota)))
        melhor[id] = { nota, data, atualizadoEm: dataBr(linha[cab.DT_ATUALIZACAO]), variantes: {} };
      const m = melhor[id];
      if (m.nota !== nota) continue;
      const abrg = linha[cab.ID_ABRG] || "UNICA";
      const v = (m.variantes[abrg] ??= { precos: Array(10).fill(null), min: Array(10).fill(null), max: Array(10).fill(null) });
      v.precos[f] = numero(linha[cab.VL_COMERCIAL_MENSALIDADE]);
      v.min[f] = numero(linha[cab.VCM_MINIMO]);
      v.max[f] = numero(linha[cab.VCM_MAXIMO]);
    }
  }
  for (const [id, m] of Object.entries(melhor)) planos[id].vcm = m;
  return Object.keys(melhor).length;
}

async function area(fonte, planos, ufs) {
  const filtroUf = new Set(ufs);
  const u = {};
  const mun = {};
  for await (const { cab, linha } of csv(await abrir(fonte, ARQ.area))) {
    const id = linha[cab.ID_PLANO];
    if (!planos[id]) continue;
    const uf = linha[cab.SG_UF];
    (u[id] ??= new Set()).add(uf);
    if (filtroUf.has(uf)) (mun[id] ??= new Map()).set(linha[cab.CD_MUNICIPIO], `${linha[cab.NM_MUNICIPIO_X]}/${uf}`);
  }
  for (const id of Object.keys(u)) {
    planos[id].ufs = [...u[id]].sort();
    planos[id].municipios = mun[id] ? [...mun[id]].map(([codigo, nome]) => ({ codigo, nome })) : [];
  }
  return Object.keys(u).length;
}

// ---------- principal ----------
export async function importar(o) {
  const alvoArq = o.alvo ?? path.join(PASTA, "operadoras-alvo.json");
  const lista = JSON.parse(fs.readFileSync(alvoArq, "utf8"));
  const alvo = new Map();
  for (const g of lista) for (const r of g.registros) alvo.set(registro(r), g.grupo);

  log(`Fonte: ${o.fonte}`);
  log(`${lista.length} grupos, ${alvo.size} registros ANS`);

  const ops = await operadoras(o.fonte, alvo);
  log(`Operadoras encontradas no CADOP: ${Object.keys(ops).length}`);
  const faltando = [...alvo.keys()].filter((r) => !ops[r]);
  if (faltando.length) log(`Registros sem cadastro ativo: ${faltando.join(", ")}`);

  const planos = await produtos(o.fonte, alvo);
  log(`Planos ativos: ${Object.keys(planos).length}`);

  const comVcm = await vcm(o.fonte, planos);
  log(`Planos com VCM por faixa: ${comVcm}`);

  if (!o.semArea) {
    log("Lendo a área de comercialização (arquivo grande, pode levar alguns minutos)…");
    const comArea = await area(o.fonte, planos, o.ufs);
    log(`Planos com área de comercialização: ${comArea}`);
  }

  const base = {
    geradoEm: new Date().toISOString(),
    fonte: o.fonte,
    ufsDetalhadas: o.ufs,
    faixas: FAIXA_ANS,
    operadoras: Object.values(ops),
    planos: Object.values(planos),
  };
  const saida = o.saida ?? path.join(PASTA, "base.json");
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  fs.writeFileSync(saida, JSON.stringify(base));
  log(`Gravado ${path.relative(process.cwd(), saida)} (${(fs.statSync(saida).size / 1e6).toFixed(1)} MB)`);
  return base;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  importar(args(process.argv.slice(2))).catch((e) => {
    console.error("Falhou:", e.message);
    process.exit(1);
  });
}
