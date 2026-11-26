import "server-only";
import fs from "node:fs";
import path from "node:path";
import { lerNumeroBR } from "./numeros";

// Tabelas de venda (preço por faixa etária) lidas de CSVs em data/tabelas (ver README.md de lá).
// Os preços vêm das tabelas comerciais das operadoras, preenchidas à mão ou por importação.

export interface TabelaVenda {
  registro: string; // registro ANS da operadora, 6 dígitos
  codigoAns?: string;
  nomePlano?: string;
  uf?: string;
  municipio?: string; // código IBGE
  modalidade?: "PF" | "PME" | "Adesão";
  vigencia: string; // ISO yyyy-mm-dd
  precos: (number | null)[]; // 10 faixas, na ordem de FAIXAS
  arquivo: string;
  linha: number; // linha do arquivo (1 = cabeçalho)
}

export interface ErroTabela {
  arquivo: string;
  linha: number;
  motivo: string;
}

export const CABECALHO_TABELAS = [
  "registro_operadora",
  "codigo_plano_ans",
  "nome_plano",
  "uf",
  "municipio_ibge",
  "modalidade",
  "vigencia",
  "f00_18",
  "f19_23",
  "f24_28",
  "f29_33",
  "f34_38",
  "f39_43",
  "f44_48",
  "f49_53",
  "f54_58",
  "f59_mais",
] as const;

const COLUNAS_FAIXA = CABECALHO_TABELAS.slice(7);

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function normalizarRegistro(v: string): string {
  const d = v.replace(/\D/g, "").replace(/^0+/, "");
  return d ? d.padStart(6, "0") : "";
}

function parseModalidade(v: string): TabelaVenda["modalidade"] | null | undefined {
  const n = semAcento(v);
  if (!n) return undefined;
  if (n === "pf" || n === "individual") return "PF";
  if (n === "pme" || n === "empresarial") return "PME";
  if (n === "adesao") return "Adesão";
  return null; // inválida
}

function parseVigencia(v: string): string | null {
  const s = v.trim();
  let m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(s);
  let a: string, mes: string, d: string;
  if (m) [, a, mes, d = "01"] = m;
  else if ((m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s))) [, d, mes, a] = m;
  else return null;
  const dt = new Date(Date.UTC(+a, +mes - 1, +d));
  if (dt.getUTCFullYear() !== +a || dt.getUTCMonth() !== +mes - 1 || dt.getUTCDate() !== +d) return null;
  return `${a}-${mes}-${d}`;
}

// "1.034,80" / "1034.80" / "1.034" -> número; "" -> null; inválido -> NaN (mesma regra de lerValorBR)
const parsePreco = lerNumeroBR;

// Divide uma linha CSV com ";" respeitando aspas.
function dividir(linha: string): string[] {
  const out: string[] = [];
  let cur = "";
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') aspas = false;
      else cur += c;
    } else if (c === '"') aspas = true;
    else if (c === ";") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

function lerArquivo(arquivo: string, texto: string, tabelas: TabelaVenda[], erros: ErroTabela[]) {
  const linhas = texto.replace(/^﻿/, "").split(/\r\n|\n|\r/);
  const iCab = linhas.findIndex((l) => l.trim() !== "");
  if (iCab < 0) return;
  const cab = dividir(linhas[iCab]).map((c) => c.toLowerCase());
  const idx: Record<string, number> = {};
  for (const c of CABECALHO_TABELAS) idx[c] = cab.indexOf(c);
  const faltando = CABECALHO_TABELAS.filter((c) => idx[c] < 0);
  if (faltando.length) {
    erros.push({ arquivo, linha: iCab + 1, motivo: `cabeçalho sem as colunas: ${faltando.join(", ")}` });
    return;
  }
  for (let i = iCab + 1; i < linhas.length; i++) {
    if (!linhas[i].trim()) continue;
    const linha = i + 1;
    const cel = dividir(linhas[i]);
    const get = (c: string) => cel[idx[c]] ?? "";
    const registro = normalizarRegistro(get("registro_operadora"));
    if (!registro) {
      erros.push({ arquivo, linha, motivo: "registro_operadora vazio ou inválido" });
      continue;
    }
    const vigencia = parseVigencia(get("vigencia"));
    if (!vigencia) {
      erros.push({ arquivo, linha, motivo: `vigencia inválida: "${get("vigencia")}"` });
      continue;
    }
    const modalidade = parseModalidade(get("modalidade"));
    if (modalidade === null) {
      erros.push({ arquivo, linha, motivo: `modalidade inválida: "${get("modalidade")}"` });
      continue;
    }
    const precos: (number | null)[] = [];
    let ruim: string | null = null;
    for (const c of COLUNAS_FAIXA) {
      const p = parsePreco(get(c));
      if (Number.isNaN(p)) {
        ruim = `preço inválido em ${c}: "${get(c)}"`;
        break;
      }
      precos.push(p);
    }
    if (ruim) {
      erros.push({ arquivo, linha, motivo: ruim });
      continue;
    }
    tabelas.push({
      registro,
      codigoAns: get("codigo_plano_ans").replace(/\D/g, "") || undefined,
      nomePlano: get("nome_plano") || undefined,
      uf: get("uf").toUpperCase() || undefined,
      municipio: get("municipio_ibge") || undefined,
      modalidade,
      vigencia,
      precos,
      arquivo,
      linha,
    });
  }
}

// O preço da tabela vale para o plano em todas as cidades dele (uf/município só restringem o casamento). Linhas
// do mesmo plano com a mesma vigência (ex.: uma por cidade) não se somam: tabelaPara usa a primeira. Avisa.
function avisarRepetidas(tabelas: TabelaVenda[], erros: ErroTabela[]) {
  const primeira = new Map<string, TabelaVenda>();
  for (const t of tabelas) {
    const plano = t.codigoAns ? `c:${t.codigoAns}` : t.nomePlano ? `n:${t.registro}:${semAcento(t.nomePlano)}` : "";
    if (!plano) continue;
    const chave = `${plano}|${t.vigencia}`;
    const p = primeira.get(chave);
    if (!p) {
      primeira.set(chave, t);
      continue;
    }
    const onde = p.arquivo === t.arquivo ? `linha ${p.linha}` : `${p.arquivo}, linha ${p.linha}`;
    erros.push({
      arquivo: t.arquivo,
      linha: t.linha,
      motivo: `várias linhas para o mesmo plano e vigência; usada a primeira (${onde})`,
    });
  }
}

const cache = new Map<string, { chave: string; r: { tabelas: TabelaVenda[]; erros: ErroTabela[] } }>();
// Mesmo objeto sempre que a pasta não existe: quem usa a identidade como chave de cache não reconstrói à toa.
const VAZIO: { tabelas: TabelaVenda[]; erros: ErroTabela[] } = Object.freeze({
  tabelas: Object.freeze([]) as unknown as TabelaVenda[],
  erros: Object.freeze([]) as unknown as ErroTabela[],
});

export function lerTabelas(dir?: string): { tabelas: TabelaVenda[]; erros: ErroTabela[] } {
  const base = dir ?? process.env.TABELAS_DIR ?? path.join(process.cwd(), "data", "tabelas");
  let nomes: string[];
  try {
    nomes = fs
      .readdirSync(base)
      .filter((n) => n.toLowerCase().endsWith(".csv"))
      .sort();
  } catch {
    return VAZIO;
  }
  const stats = nomes.map((n) => {
    const s = fs.statSync(path.join(base, n));
    return `${n}:${s.mtimeMs}:${s.size}`;
  });
  const chave = stats.join("|");
  const c = cache.get(base);
  if (c && c.chave === chave) return c.r;
  const tabelas: TabelaVenda[] = [];
  const erros: ErroTabela[] = [];
  for (const n of nomes) lerArquivo(n, fs.readFileSync(path.join(base, n), "utf8"), tabelas, erros);
  avisarRepetidas(tabelas, erros);
  const r = { tabelas, erros };
  cache.set(base, { chave, r });
  return r;
}

export function tabelaPara(
  p: { registroAns: string; codigoAns: string; nome: string; ufs: string[] },
  tabelas: TabelaVenda[],
): TabelaVenda | undefined {
  const ufOk = (t: TabelaVenda) => !t.uf || p.ufs.length === 0 || p.ufs.includes(t.uf);
  const maisRecente = (l: TabelaVenda[]) =>
    l.reduce<TabelaVenda | undefined>((a, t) => (!a || t.vigencia > a.vigencia ? t : a), undefined);
  const cod = p.codigoAns.replace(/\D/g, "");
  if (cod) {
    const t = maisRecente(tabelas.filter((t) => t.codigoAns === cod && ufOk(t)));
    if (t) return t;
  }
  const nome = semAcento(p.nome);
  const reg = normalizarRegistro(p.registroAns);
  if (!nome || !reg) return undefined;
  return maisRecente(
    tabelas.filter((t) => t.registro === reg && !!t.nomePlano && semAcento(t.nomePlano) === nome && ufOk(t)),
  );
}
