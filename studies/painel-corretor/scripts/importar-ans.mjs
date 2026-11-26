#!/usr/bin/env node
// Importa da base de dados abertos da ANS (dadosabertos.ans.gov.br/FTP/PDA)
// as operadoras, os planos ativos, o VCM por faixa etária, a rede hospitalar e
// os indicadores (IDSS e reajuste). Grava data/ans/base.json, rede.json e indicadores.json.
//
// Uso:
//   npm run importar-ans -- --uf SP,MG           # operadoras de data/ans/operadoras-alvo.json
//   npm run importar-ans -- --uf SP,MG --todas   # todas com plano ativo vendido nessas UFs
//   npm run importar-ans -- --sem-area           # pula a área de comercialização (~1 GB)
//   npm run importar-ans -- --sem-rede           # pula a rede hospitalar (zip de 2,3 GB, lido por partes)
//   npm run importar-ans -- --fonte ./pasta-com-os-arquivos   # usa cópias locais
//
// Sem dependências: usa fetch, zlib e streams do Node 20+.

import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { listarEntradasRemotas, abrirEntradaRemota } from "./zip-remoto.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PASTA = path.join(RAIZ, "data", "ans");
const FONTE_PADRAO = "https://dadosabertos.ans.gov.br/FTP/PDA/";

const ARQ = {
  cadop: "operadoras_de_plano_de_saude_ativas/Relatorio_cadop.csv",
  produtos: "caracteristicas_produtos_saude_suplementar-008/pda-008-caracteristicas_produtos_saude_suplementar.csv",
  vcm: "nota_tecnica_ntrp_vcm_faixa_etaria/nota_tecnica_vcm_faixa_etaria.zip",
  area: "area_comercializacao_planos_ntrp/pda_area_comer_plano_ntrp.csv",
  rede: "produtos_e_prestadores_hospitalares/produtos_e_prestadores_hospitalares.zip",
  idss: "historico_idss-020/pda-020-historico-idss-2016_2025.csv",
  reajuste: "percentuais_de_reajuste_de_agrupamento-055/pda-055-Percentuais_de_Reajuste_de_Agrupamento.csv",
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
  const o = { fonte: FONTE_PADRAO, ufs: [], semArea: false, semRede: false, todas: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fonte") o.fonte = argv[++i];
    else if (a === "--uf")
      o.ufs = argv[++i]
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
    else if (a === "--sem-area") o.semArea = true;
    else if (a === "--sem-rede") o.semRede = true;
    else if (a === "--todas") o.todas = true;
    else if (a === "--saida") o.saida = argv[++i];
    else if (a === "--alvo") o.alvo = argv[++i];
    else if (a === "-h" || a === "--help") {
      console.log(
        fs
          .readFileSync(fileURLToPath(import.meta.url), "utf8")
          .split("\n")
          .slice(1, 14)
          .join("\n"),
      );
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

const remota = (fonte) => /^https?:/i.test(fonte);
/** URL (fonte remota) ou caminho local de um arquivo da PDA. */
const local = (fonte, rel) =>
  remota(fonte) ? new URL(rel, fonte.endsWith("/") ? fonte : fonte + "/").href : path.join(fonte, ...rel.split("/"));

async function abrir(fonte, rel) {
  if (remota(fonte)) {
    const url = local(fonte, rel);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    return Readable.fromWeb(r.body);
  }
  return fs.createReadStream(local(fonte, rel));
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
const mil = (n) => n.toLocaleString("pt-BR");

// ---------- etapas ----------
/** Operadoras ativas do CADOP: só as alvo, ou todas (`todas`), com grupo = nome fantasia/razão social. */
async function operadoras(fonte, alvo, todas) {
  const out = {};
  for await (const { cab, linha } of csv(await abrir(fonte, ARQ.cadop))) {
    const reg = registro(linha[cab.REGISTRO_OPERADORA]);
    if (!reg || (!todas && !alvo.has(reg))) continue;
    out[reg] = {
      registroAns: reg,
      grupo: alvo.get(reg) ?? (linha[cab.NOME_FANTASIA] || linha[cab.RAZAO_SOCIAL]),
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

/** Planos ativos das operadoras lidas (e das alvo, mesmo sem cadastro ativo, como antes). */
async function produtos(fonte, ops, alvo) {
  const out = {};
  for await (const { cab, linha } of csv(await abrir(fonte, ARQ.produtos))) {
    const reg = registro(linha[cab.REGISTRO_OPERADORA]);
    if ((!ops[reg] && !alvo.has(reg)) || linha[cab.SITUACAO_PLANO] !== "Ativo") continue;
    const id = linha[cab.ID_PLANO];
    out[id] = {
      id,
      codigoAns: linha[cab.CD_PLANO],
      nome: linha[cab.NM_PLANO],
      registroAns: reg,
      grupo: ops[reg]?.grupo ?? alvo.get(reg),
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
      const v = (m.variantes[abrg] ??= {
        precos: Array(10).fill(null),
        min: Array(10).fill(null),
        max: Array(10).fill(null),
      });
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

/** Confere que o cabeçalho tem as colunas usadas (achadas sempre pelo nome). */
function exigir(cab, nomes, arq) {
  const faltam = nomes.filter((n) => !(n in cab));
  if (faltam.length) throw new Error(`${arq}: colunas não encontradas no cabeçalho: ${faltam.join(", ")}`);
}

/**
 * Com --todas e --uf: fica só com planos vendidos nessas UFs (pela área de comercialização,
 * abrangência Nacional, ou Estadual sem área listada de operadora sediada nelas) e com as
 * operadoras que têm pelo menos um. Planos e operadoras alvo ficam sempre.
 */
function filtrarPorUf(ops, planos, ufs, alvo) {
  const set = new Set(ufs);
  const cobre = (p) =>
    p.ufs.some((u) => set.has(u)) ||
    /nacional/i.test(p.abrangencia) ||
    (/estadual/i.test(p.abrangencia) && !p.ufs.length && set.has(ops[p.registroAns]?.uf));
  const usadas = new Set(alvo.keys());
  for (const [id, p] of Object.entries(planos)) {
    if (alvo.has(p.registroAns) || cobre(p)) usadas.add(p.registroAns);
    else delete planos[id];
  }
  for (const reg of Object.keys(ops)) if (!usadas.has(reg)) delete ops[reg];
}

/** Rede hospitalar (vínculos ativos) dos planos importados, lendo só os CSVs das UFs pedidas no zip. */
export async function rede(fonte, planos, ufs) {
  const url = local(fonte, ARQ.rede);
  const pedidas = new Set(ufs.map((u) => u.toUpperCase()));
  const entradas = [];
  for (const e of await listarEntradasRemotas(url)) {
    const m = /produtos_prestadores_hospitalares_([A-Z]{2})\.csv$/i.exec(e.nome);
    if (m && pedidas.has(m[1].toUpperCase())) entradas.push({ ...e, uf: m[1].toUpperCase() });
  }
  const faltam = [...pedidas].filter((u) => !entradas.some((e) => e.uf === u));
  if (faltam.length) log(`Rede: UFs sem arquivo no zip: ${faltam.join(", ")}`);

  const hospitais = {};
  const sets = {};
  const COLS = ["ID_PLANO", "CD_CNES", "NM_ESTABELECIMENTO_SAUDE", "DE_CLAS_ESTB_SAUDE", "LG_URGENCIA_EMERGENCIA"];
  for (const e of entradas) {
    log(`Rede ${e.uf}: baixando ${(e.tamanhoComprimido / 1e6).toFixed(0)} MB compactados…`);
    let n = 0;
    let vinculos = 0;
    for await (const { cab, linha } of csv(await abrirEntradaRemota(url, e))) {
      if (++n === 1) exigir(cab, [...COLS, "NM_MUNICIPIO", "SG_UF", "DT_VINCULO_FIM"], e.nome);
      if (n % 1_000_000 === 0) log(`  ${e.uf}: ${mil(n)} linhas lidas, ${mil(vinculos)} vínculos`);
      const id = linha[cab.ID_PLANO];
      if (!planos[id] || linha[cab.DT_VINCULO_FIM]) continue;
      const cnes = linha[cab.CD_CNES];
      if (!cnes) continue;
      const uf = linha[cab.SG_UF];
      hospitais[cnes] ??= {
        nome: linha[cab.NM_ESTABELECIMENTO_SAUDE],
        municipio: `${linha[cab.NM_MUNICIPIO]}/${uf}`,
        uf,
        classe: linha[cab.DE_CLAS_ESTB_SAUDE],
        urgencia: linha[cab.LG_URGENCIA_EMERGENCIA] === "1",
      };
      const s = (sets[id] ??= new Set());
      if (!s.has(cnes)) {
        s.add(cnes);
        vinculos++;
      }
    }
    log(`Rede ${e.uf}: ${mil(n)} linhas, ${mil(vinculos)} vínculos ativos com planos importados`);
  }
  const porPlano = Object.fromEntries(Object.entries(sets).map(([id, s]) => [id, [...s]]));
  return { hospitais, porPlano };
}

/** IDSS mais recente (não "ND") e reajuste dos dois ciclos mais recentes, por registro. */
export async function indicadores(fonte, registros) {
  const porOperadora = {};
  const de = (reg) => (porOperadora[reg] ??= {});

  let colunas = null; // [{ nome, ano }] do IDSS mais recente para o mais antigo
  for await (const { cab, linha } of csv(await abrir(fonte, ARQ.idss))) {
    if (!colunas) {
      exigir(cab, ["REGISTRO_OPERADORA"], ARQ.idss);
      colunas = Object.keys(cab)
        .map((nome) => ({ nome, m: /^IDSS_(\d{4})_\d{4}$/.exec(nome) }))
        .filter((c) => c.m)
        .map((c) => ({ nome: c.nome, ano: Number(c.m[1]) }))
        .sort((a, b) => b.ano - a.ano);
      if (!colunas.length) throw new Error(`${ARQ.idss}: nenhuma coluna IDSS_<ano>_<ano> no cabeçalho`);
    }
    const reg = registro(linha[cab.REGISTRO_OPERADORA]);
    if (!registros.has(reg) || porOperadora[reg]?.idss !== undefined) continue;
    for (const c of colunas) {
      const v = linha[cab[c.nome]];
      const n = v && !/^nd$/i.test(v) ? numero(v) : null;
      if (n === null) continue;
      Object.assign(de(reg), { idss: n, idssAno: c.ano });
      break;
    }
  }

  const ciclos = {}; // reg → Map(ciclo → %)
  let conferido = false;
  for await (const { cab, linha } of csv(await abrir(fonte, ARQ.reajuste))) {
    if (!conferido) {
      exigir(cab, ["REGISTRO_OPERADORA", "CICLO", "PCT_UNICO", "PCT_INT_COM_OBSTET"], ARQ.reajuste);
      conferido = true;
    }
    const reg = registro(linha[cab.REGISTRO_OPERADORA]);
    if (!registros.has(reg)) continue;
    const ciclo = Number(linha[cab.CICLO]);
    const pct = numero(linha[cab.PCT_UNICO]) ?? numero(linha[cab.PCT_INT_COM_OBSTET]);
    if (!Number.isInteger(ciclo) || pct === null) continue;
    const m = (ciclos[reg] ??= new Map());
    if (!m.has(ciclo)) m.set(ciclo, pct);
  }
  for (const [reg, m] of Object.entries(ciclos)) {
    const [atual, anterior] = [...m].sort((a, b) => b[0] - a[0]);
    Object.assign(de(reg), { reajuste: atual[1], ciclo: atual[0] });
    if (anterior) de(reg).reajusteAnterior = anterior[1];
  }
  return { porOperadora };
}

function gravar(arq, dados) {
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, JSON.stringify(dados));
  log(`Gravado ${path.relative(process.cwd(), arq)} (${(fs.statSync(arq).size / 1e6).toFixed(1)} MB)`);
}

// ---------- principal ----------
export async function importar(o) {
  const ufs = o.ufs ?? [];
  const alvoArq = o.alvo ?? path.join(PASTA, "operadoras-alvo.json");
  const lista = JSON.parse(fs.readFileSync(alvoArq, "utf8"));
  const alvo = new Map();
  for (const g of lista) for (const r of g.registros) alvo.set(registro(r), g.grupo);

  log(`Fonte: ${o.fonte}`);
  if (o.todas) {
    if (ufs.length && o.semArea)
      throw new Error("--todas com --uf precisa da área de comercialização (tire --sem-area)");
    if (ufs.length) log(`Todas as operadoras com plano ativo vendido em ${ufs.join(", ")} (mais as ${alvo.size} alvo)`);
    else log("Aviso: --todas sem --uf traz todas as operadoras ativas do país; a base vai ficar muito grande.");
  } else log(`${lista.length} grupos, ${alvo.size} registros ANS`);

  const ops = await operadoras(o.fonte, alvo, o.todas);
  log(`Operadoras lidas do CADOP: ${mil(Object.keys(ops).length)}`);
  const faltando = [...alvo.keys()].filter((r) => !ops[r]);
  if (faltando.length) log(`Registros sem cadastro ativo: ${faltando.join(", ")}`);

  const planos = await produtos(o.fonte, ops, alvo);
  log(`Planos ativos: ${mil(Object.keys(planos).length)}`);

  if (!o.semArea) {
    log("Lendo a área de comercialização (arquivo grande, pode levar alguns minutos)…");
    const comArea = await area(o.fonte, planos, ufs);
    log(`Planos com área de comercialização: ${mil(comArea)}`);
  }

  if (o.todas && ufs.length) {
    filtrarPorUf(ops, planos, ufs, alvo);
    log(`Em ${ufs.join(", ")}: ${mil(Object.keys(ops).length)} operadoras, ${mil(Object.keys(planos).length)} planos`);
  }

  const comVcm = await vcm(o.fonte, planos);
  log(`Planos com VCM por faixa: ${mil(comVcm)}`);

  const base = {
    geradoEm: new Date().toISOString(),
    fonte: o.fonte,
    ufsDetalhadas: ufs,
    faixas: FAIXA_ANS,
    operadoras: Object.values(ops),
    planos: Object.values(planos),
  };
  const saida = o.saida ?? path.join(PASTA, "base.json");
  gravar(saida, base);
  const pasta = path.dirname(saida);

  if (o.semRede) log("Rede hospitalar pulada (--sem-rede)");
  else if (!ufs.length) log("Rede hospitalar pulada: informe as UFs com --uf (o arquivo da ANS tem 2,3 GB)");
  else {
    log(`Lendo a rede hospitalar de ${ufs.join(", ")} (só essas partes do zip são baixadas)…`);
    const r = await rede(o.fonte, planos, ufs);
    log(`Rede: ${mil(Object.keys(r.hospitais).length)} hospitais em ${mil(Object.keys(r.porPlano).length)} planos`);
    gravar(path.join(pasta, "rede.json"), { geradoEm: new Date().toISOString(), ...r });
  }

  log("Lendo IDSS e reajustes…");
  const ind = await indicadores(o.fonte, new Set(Object.keys(ops)));
  log(`Indicadores de ${mil(Object.keys(ind.porOperadora).length)} operadoras`);
  gravar(path.join(pasta, "indicadores.json"), { geradoEm: new Date().toISOString(), ...ind });
  return base;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  importar(args(process.argv.slice(2))).catch((e) => {
    console.error("Falhou:", e.message);
    process.exit(1);
  });
}
