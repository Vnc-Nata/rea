import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  lerBaseAns,
  lerIndicadoresAns,
  lerRedeAns,
  mtimeAns,
  dirAns,
  vcmPrincipal,
  type BaseAns,
  type IndicadoresAns,
  type OperadoraAns,
  type PlanoAns,
  type RedeAns,
} from "./ans";
import { mtimeDb, readDb } from "./db";
import { capitalizar, rotuloMunicipio } from "./municipios";
import { CIDADES } from "./seed";
import { lerTabelas, tabelaPara, type TabelaVenda } from "./tabelas";
import {
  FAIXAS,
  type Faixa,
  type FiltroCotacao,
  type Hospital,
  type Modalidade,
  type Operadora,
  type Plano,
  type RedeItem,
} from "./types";

// Única porta de leitura do catálogo (operadoras, planos, hospitais, cidades).
// Com data/ans/base.json: catálogo real da ANS; sem ela: dados fictícios do db.json.
// Preço por vida = tabela de venda (se houver) senão VCM × (1 + ajuste% da operadora).

export interface Catalogo {
  fonte: "ans" | "ficticio";
  geradoEm?: string;
  operadoras: Operadora[];
  planos: Plano[];
  hospitais: Hospital[];
  cidades: string[];
}

export const IOF_SEGURADORA = 0.0238;

export const CORES_GRUPO: Record<string, string> = {
  Amil: "#0047bb",
  "Bradesco Saúde": "#cc092f",
  SulAmérica: "#f47920",
  "Porto Saúde": "#0046c0",
  Alice: "#ff4f6d",
  "Hapvida NotreDame": "#f58220",
};

const MODALIDADES: Record<string, Modalidade> = {
  "individual ou familiar": "PF",
  "coletivo empresarial": "PME",
  "coletivo por adesao": "Adesão",
};

const ABRANGENCIAS: Record<string, Plano["abrangencia"]> = {
  municipal: "Municipal",
  "grupo de municipios": "Grupo de municípios",
  estadual: "Estadual",
  "grupo de estados": "Estadual",
  nacional: "Nacional",
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const arred = (v: number) => Math.round(v * 100) / 100;

/** Nome curto: nome fantasia (ou grupo, ou razão social) em caixa título, sem "S.A."/"LTDA". */
function nomeCurto(o: OperadoraAns): string {
  const bruto = o.nomeFantasia || o.grupo || o.razaoSocial;
  const limpo = bruto
    .replace(/\b(S\/A|S\.\s?A\.?|LTDA\.?|EIRELI)(?=\s|$|\.)/gi, "")
    .replace(/[\s.,-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return capitalizar(limpo || bruto);
}

function sigla(nome: string): string {
  const letras = nome.normalize("NFD").replace(/[^A-Za-z]/g, "");
  return (letras.slice(0, 2) || "??").toUpperCase().padEnd(2, letras.charAt(0).toUpperCase() || "?");
}

/** Cor estável derivada do registro (HSL → hex), para operadoras fora dos 6 grupos. */
function corDoRegistro(registro: string): string {
  let h = 0;
  for (const c of registro) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  const s = 0.65;
  const l = 0.42;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

function converterOperadora(o: OperadoraAns, indicadores?: IndicadoresAns): Operadora {
  const nome = nomeCurto(o);
  const ind = indicadores?.porOperadora[o.registroAns];
  return {
    id: `ans-${o.registroAns}`,
    nome,
    razaoSocial: o.razaoSocial,
    registroAns: o.registroAns,
    cor: (o.grupo && CORES_GRUPO[o.grupo]) || corDoRegistro(o.registroAns),
    sigla: sigla(nome),
    seguradora: /seguradora/i.test(o.modalidade ?? "") || undefined,
    idss: ind?.idss,
    reajuste: ind?.reajuste,
    reajusteAnterior: ind?.reajusteAnterior,
  };
}

function precosDe(lista: (number | null)[], fator = 1): Record<Faixa, number | null> {
  return Object.fromEntries(
    FAIXAS.map((f, i) => {
      const v = lista[i];
      return [f, v == null ? null : arred(v * fator)];
    }),
  ) as Record<Faixa, number | null>;
}

/** Converte a base ANS nos tipos usados pelas telas. Pura: não lê arquivos. */
export function converterBase(
  base: BaseAns,
  opts: {
    rede?: RedeAns;
    indicadores?: IndicadoresAns;
    tabelas?: TabelaVenda[];
    ajustes?: Record<string, number>;
  },
): Omit<Catalogo, "fonte"> {
  const { rede, indicadores, tabelas = [], ajustes = {} } = opts;
  const operadoras = base.operadoras.map((o) => converterOperadora(o, indicadores));
  const opPorRegistro = new Map(operadoras.map((o) => [o.registroAns, o]));

  // Cidades das UFs detalhadas, por UF (para planos sem lista de municípios).
  const porUf = new Map<string, Set<string>>();
  const ufsDet = new Set(base.ufsDetalhadas);
  for (const p of base.planos)
    for (const m of p.municipios) {
      const rot = rotuloMunicipio(m.nome);
      const uf = rot.slice(-2);
      if (!ufsDet.has(uf)) continue;
      if (!porUf.has(uf)) porUf.set(uf, new Set());
      porUf.get(uf)!.add(rot);
    }
  const ordenar = (xs: Iterable<string>) => [...new Set(xs)].sort((a, b) => a.localeCompare(b, "pt-BR"));

  // Tabelas por modalidade: uma tabela com modalidade só vale para planos daquela modalidade.
  const tabelasPorMod = new Map<Modalidade, TabelaVenda[]>();
  for (const m of ["PF", "PME", "Adesão"] as Modalidade[])
    tabelasPorMod.set(
      m,
      tabelas.filter((t) => !t.modalidade || t.modalidade === m),
    );

  const servicos = (cnes: string) => (rede?.hospitais[cnes]?.urgencia ? "H,PS" : "H");

  const planos: Plano[] = [];
  for (const pa of base.planos) {
    const op = opPorRegistro.get(pa.registroAns);
    const modalidade = MODALIDADES[norm(pa.contratacao)];
    if (!op || !modalidade) continue;

    const tabela = tabelaPara(
      { registroAns: pa.registroAns, codigoAns: pa.codigoAns, nome: pa.nome, ufs: pa.ufs },
      tabelasPorMod.get(modalidade)!,
    );
    const vcm = vcmPrincipal(pa);
    let precos: Record<Faixa, number | null>;
    let origemPreco: Plano["origemPreco"];
    if (tabela && tabela.precos.some((v) => v != null)) {
      precos = precosDe(tabela.precos);
      origemPreco = "tabela";
    } else if (vcm && vcm.precos.some((v) => v != null)) {
      precos = precosDe(vcm.precos, 1 + (ajustes[op.id] ?? 0) / 100);
      origemPreco = "ans";
    } else continue; // sem preço: fica fora do seletor (aparece na Busca ANS)

    let cidades = ordenar(pa.municipios.map((m) => rotuloMunicipio(m.nome)));
    if (!cidades.length) {
      const ufs = pa.ufs.length ? pa.ufs : base.ufsDetalhadas;
      cidades = ordenar(ufs.flatMap((uf) => [...(porUf.get(uf) ?? [])]));
    }

    const redeItens: RedeItem[] = (rede?.porPlano[pa.id] ?? [])
      .filter((c) => rede?.hospitais[c])
      .map((c) => ({ hospitalId: `cnes-${c}`, servicos: servicos(c) }));

    planos.push({
      id: `ans-${pa.id}`,
      operadoraId: op.id,
      nome: pa.nome,
      registroAns: pa.codigoAns,
      codigoAns: pa.codigoAns,
      segmento: pa.odontologico || norm(pa.segmentacaoGrupo).includes("odontologico") ? "Dental" : "Saúde",
      modalidade,
      acomodacao: norm(pa.acomodacao) === "individual" ? "Quarto Individual" : "Quarto Coletivo",
      coparticipacao: norm(pa.fatorModerador) !== "ausente" ? "Com coparticipação" : "Sem coparticipação",
      contratacao: "Opcional", // a ANS não publica; mantido neutro
      aceitaMei: modalidade === "PME",
      abrangencia: ABRANGENCIAS[norm(pa.abrangencia)] ?? "Nacional",
      cidades,
      precos,
      iof: op.seguradora ? IOF_SEGURADORA : undefined,
      origemPreco,
      vigencia: origemPreco === "tabela" ? tabela!.vigencia : undefined,
      variante: origemPreco === "ans" ? vcm!.abrangencia : undefined,
      rede: redeItens,
      laboratorios: 0,
    });
  }

  const hospitais: Hospital[] = Object.entries(rede?.hospitais ?? {}).map(([cnes, h]) => {
    const rot = rotuloMunicipio(h.municipio);
    return { id: `cnes-${cnes}`, nome: h.nome, bairro: rot, regiao: rot };
  });

  return {
    geradoEm: base.geradoEm,
    operadoras,
    planos,
    hospitais,
    cidades: ordenar(planos.flatMap((p) => p.cidades)),
  };
}

// ---------------------------------------------------------------------------
// Leitura com cache

let cache: { chave: string; cat: Catalogo } | null = null;
let cacheAjustes: { mtime: number; ajustes: Record<string, number> } | null = null;
let baseRuim: string | null = null; // dir+mtime de uma base.json que não abriu (avisa uma vez)

const DIR_LOGOS = () => path.join(process.cwd(), "public", "logos");

function mtime(arq: string): number {
  try {
    return fs.statSync(arq).mtimeMs;
  } catch {
    return 0;
  }
}

/** Ajustes por operadora (Conta.ajustes); só relê o db.json quando o mtime muda. */
function lerAjustes(): Record<string, number> {
  const m = mtimeDb();
  if (!cacheAjustes || cacheAjustes.mtime !== m || m === 0)
    cacheAjustes = { mtime: m, ajustes: readDb().conta?.ajustes ?? {} };
  return cacheAjustes.ajustes;
}

/** base.json, ou null se não existir ou estiver corrompida (aviso no log, catálogo fictício). */
function lerBaseSegura(): BaseAns | null {
  const id = `${dirAns()}:${mtimeAns("base.json")}`;
  if (baseRuim === id) return null;
  try {
    return lerBaseAns();
  } catch (e) {
    baseRuim = id;
    console.warn(`[catalogo] base.json ilegível em ${dirAns()}; usando dados fictícios.`, e);
    return null;
  }
}

function logoDe(registro: string): string | undefined {
  const arq = path.join(DIR_LOGOS(), `${registro}.png`);
  return fs.existsSync(arq) ? `/logos/${registro}.png` : undefined;
}

function catalogoFicticio(): Catalogo {
  const db = readDb();
  return {
    fonte: "ficticio",
    // db.json antigos não têm sigla/origemPreco
    operadoras: db.operadoras.map((o) => ({ ...o, sigla: o.sigla || o.nome.slice(0, 2).toUpperCase() })),
    planos: db.planos.map((p) => ({ ...p, origemPreco: p.origemPreco ?? "ficticio" })),
    hospitais: db.hospitais,
    cidades: [...CIDADES],
  };
}

/** Catálogo atual (ANS se houver base.json, senão fictício). Cache por mtime dos arquivos + ajustes. */
export function catalogo(): Catalogo {
  const base = lerBaseSegura();
  if (!base) {
    cache = null;
    return catalogoFicticio();
  }
  const ajustes = lerAjustes();
  const { tabelas } = lerTabelas();
  const chave = JSON.stringify([
    dirAns(),
    mtimeAns("base.json"),
    mtimeAns("rede.json"),
    mtimeAns("indicadores.json"),
    tabelasVersao(tabelas),
    mtime(DIR_LOGOS()),
    ajustes,
  ]);
  if (cache && cache.chave === chave) return cache.cat;
  const conv = converterBase(base, {
    rede: lerRedeAns() ?? undefined,
    indicadores: lerIndicadoresAns() ?? undefined,
    tabelas,
    ajustes,
  });
  const cat: Catalogo = {
    fonte: "ans",
    ...conv,
    operadoras: conv.operadoras.map((o) => ({ ...o, logo: logoDe(o.registroAns) })),
  };
  cache = { chave, cat };
  return cat;
}

// lerTabelas devolve o mesmo array enquanto os CSVs não mudam; a identidade vira um número de versão.
const versoes = new WeakMap<TabelaVenda[], number>();
let proximaVersao = 1;
function tabelasVersao(t: TabelaVenda[]): number {
  let v = versoes.get(t);
  if (!v) versoes.set(t, (v = proximaVersao++));
  return v;
}

/** Planos do catálogo para o filtro da cotação (segmento, modalidade e cidade). */
export function planosPara(f: FiltroCotacao): Plano[] {
  return catalogo().planos.filter(
    (p) => p.segmento === f.segmento && p.modalidade === f.modalidade && p.cidades.includes(f.cidade),
  );
}

export function planoPorId(id: string): Plano | undefined {
  return catalogo().planos.find((p) => p.id === id);
}

export function operadoraPorId(id: string): Operadora | undefined {
  return catalogo().operadoras.find((o) => o.id === id);
}
