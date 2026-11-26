import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  lerBaseAns,
  lerIndicadoresAns,
  lerRedeAns,
  mtimeAns,
  dirAns,
  semErro,
  vcmPrincipal,
  type BaseAns,
  type IndicadoresAns,
  type OperadoraAns,
  type PlanoAns,
  type RedeAns,
} from "./ans";
import { lerConta } from "./conta-db";
import { linhaDoPlano, percentualCopartDoNome, tipoCopartDoNome } from "./linhas";
import { mtimeDb, readDb } from "./db";
import { capitalizar, rotuloMunicipio } from "./municipios";
import { CIDADES } from "./seed";
import { filtrarSelecao, habilitadasEfetivas, type Selecao } from "./selecao";
import { lerTabelas, tabelaPara, type TabelaVenda } from "./tabelas";
import {
  FAIXAS,
  type Faixa,
  type FiltroCotacao,
  type Grupo,
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
  return aplicarAjustes(converterSemAjustes(base, opts), opts.ajustes ?? {});
}

/**
 * Aplica o ajuste % da operadora ao preço "Referência ANS" (VCM). Barato: não reconverte a base, então mudar um
 * ajuste não relê nem reconverte os 140 MB da base real. Sem ajustes devolve o mesmo objeto.
 */
export function aplicarAjustes<C extends { planos: Plano[] }>(conv: C, ajustes: Record<string, number>): C {
  if (!Object.values(ajustes).some((v) => v)) return conv;
  return {
    ...conv,
    planos: conv.planos.map((p) => {
      const aj = ajustes[p.operadoraId];
      if (p.origemPreco !== "ans" || !aj) return p;
      const fator = 1 + aj / 100;
      return {
        ...p,
        precos: Object.fromEntries(FAIXAS.map((f) => [f, p.precos[f] == null ? null : arred(p.precos[f]! * fator)])),
      } as Plano;
    }),
  };
}

function converterSemAjustes(
  base: BaseAns,
  opts: { rede?: RedeAns; indicadores?: IndicadoresAns; tabelas?: TabelaVenda[] },
): Omit<Catalogo, "fonte"> {
  const { rede, indicadores, tabelas = [] } = opts;
  const operadoras = base.operadoras.map((o) => converterOperadora(o, indicadores));
  const opPorRegistro = new Map(operadoras.map((o) => [o.registroAns, o]));

  // Rótulos de município: a base real repete os mesmos ~1.500 nomes milhões de vezes; converte cada um uma vez e
  // ordena as listas pela posição do rótulo na ordem alfabética (localeCompare por plano levava segundos).
  const rotulos = new Map<string, string>();
  const rotulo = (nome: string) => {
    let r = rotulos.get(nome);
    if (r === undefined) rotulos.set(nome, (r = rotuloMunicipio(nome)));
    return r;
  };
  for (const p of base.planos) for (const m of p.municipios) rotulo(m.nome);
  const colacao = new Intl.Collator("pt-BR");
  const posicao = new Map([...new Set(rotulos.values())].sort(colacao.compare).map((r, i) => [r, i] as const));
  const ordenar = (xs: Iterable<string>) =>
    [...new Set(xs)].sort(
      (a, b) => (posicao.get(a) ?? Infinity) - (posicao.get(b) ?? Infinity) || colacao.compare(a, b),
    );

  // Cidades das UFs detalhadas, por UF (para planos sem lista de municípios).
  const porUf = new Map<string, string[]>();
  const ufsDet = new Set(base.ufsDetalhadas);
  for (const rot of posicao.keys()) {
    const uf = rot.slice(-2);
    if (!ufsDet.has(uf)) continue;
    if (!porUf.has(uf)) porUf.set(uf, []);
    porUf.get(uf)!.push(rot);
  }
  // Listas iguais (ex.: todos os planos nacionais) compartilham o mesmo array.
  const listasUf = new Map<string, string[]>();

  // Tabelas por modalidade: uma tabela com modalidade só vale para planos daquela modalidade.
  const tabelasPorMod = new Map<Modalidade, TabelaVenda[]>();
  for (const m of ["PF", "PME", "Adesão"] as Modalidade[])
    tabelasPorMod.set(
      m,
      tabelas.filter((t) => !t.modalidade || t.modalidade === m),
    );

  const servicos = (cnes: string) => (rede?.hospitais[cnes]?.urgencia ? "H,PS" : "H");

  const planos: Plano[] = [];
  const todasCidades = new Set<string>();
  for (const pa of base.planos) {
    const op = opPorRegistro.get(pa.registroAns);
    const modalidade = MODALIDADES[norm(pa.contratacao)];
    if (!op || !modalidade) continue;

    const tabela = tabelas.length
      ? tabelaPara(
          { registroAns: pa.registroAns, codigoAns: pa.codigoAns, nome: pa.nome, ufs: pa.ufs },
          tabelasPorMod.get(modalidade)!,
        )
      : undefined;
    const vcm = vcmPrincipal(pa);
    let precos: Record<Faixa, number | null>;
    let origemPreco: Plano["origemPreco"];
    if (tabela && tabela.precos.some((v) => v != null)) {
      precos = precosDe(tabela.precos);
      origemPreco = "tabela";
    } else if (vcm && vcm.precos.some((v) => v != null)) {
      precos = precosDe(vcm.precos);
      origemPreco = "ans";
    } else continue; // sem preço: fica fora do seletor (aparece na Busca ANS)

    let cidades: string[];
    if (pa.municipios.length) cidades = ordenar(pa.municipios.map((m) => rotulo(m.nome)));
    else {
      const ufs = pa.ufs.length ? pa.ufs : base.ufsDetalhadas;
      const chave = ufs.join(",");
      cidades = listasUf.get(chave) ?? ordenar(ufs.flatMap((uf) => porUf.get(uf) ?? []));
      listasUf.set(chave, cidades);
    }
    for (const c of cidades) todasCidades.add(c);

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
      percentualCopart: norm(pa.fatorModerador) !== "ausente" ? percentualCopartDoNome(pa.nome) : undefined,
      linha: linhaDoPlano(pa.nome),
      tipoCopart: norm(pa.fatorModerador) !== "ausente" ? tipoCopartDoNome(pa.nome, pa.grupo) : undefined,
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
    const rot = rotulo(h.municipio);
    return { id: `cnes-${cnes}`, nome: h.nome, bairro: rot, regiao: rot, uf: h.uf || rot.slice(-2) };
  });

  return {
    geradoEm: base.geradoEm,
    operadoras,
    planos,
    hospitais,
    cidades: ordenar(todasCidades),
  };
}

// ---------------------------------------------------------------------------
// Leitura com cache
//
// Os caches ficam em globalThis: no Next.js o instrumentation.ts (pré-aquecimento) e as rotas podem carregar
// instâncias diferentes deste módulo, e o recarregamento em desenvolvimento descartaria um cache do módulo.
// Dois níveis: a base convertida (só muda com base/rede/indicadores/tabelas) e o catálogo final (+ ajustes e
// logos, baratos). Uma escrita no db.json que não muda os ajustes não invalida nada.

interface CacheCatalogo {
  base: { chave: string; conv: Omit<Catalogo, "fonte"> } | null;
  cat: { chave: string; cat: Catalogo } | null;
  ajustes: { mtime: number; ajustes: Record<string, number> } | null;
  baseRuim: string | null; // dir+mtime de uma base.json que não abriu (avisa uma vez)
  versoesTabelas: WeakMap<TabelaVenda[], number>;
  proximaVersao: number;
  indices: WeakMap<Plano[], IndicePlanos>; // índices por lista de planos (ver indice())
}
interface IndicePlanos {
  porCidade: Map<string, Plano[]>;
  porId: Map<string, Plano>;
}
const G = globalThis as typeof globalThis & { __catalogoAns?: CacheCatalogo };
const estado = (G.__catalogoAns ??= {
  base: null,
  cat: null,
  ajustes: null,
  baseRuim: null,
  versoesTabelas: new WeakMap(),
  proximaVersao: 1,
  indices: new WeakMap(),
});
// Um cache criado por uma versão anterior deste módulo (recarga do servidor de desenvolvimento) pode não ter os campos novos.
estado.versoesTabelas ??= new WeakMap();
estado.proximaVersao ??= 1;
estado.indices ??= new WeakMap();

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
  if (!estado.ajustes || estado.ajustes.mtime !== m || m === 0)
    estado.ajustes = { mtime: m, ajustes: readDb().conta?.ajustes ?? {} };
  return estado.ajustes.ajustes;
}

/** base.json, ou null se não existir ou estiver corrompida (aviso no log, catálogo fictício). */
function lerBaseSegura(): BaseAns | null {
  const id = `${dirAns()}:${mtimeAns("base.json")}`;
  if (estado.baseRuim === id) return null;
  try {
    return lerBaseAns();
  } catch (e) {
    estado.baseRuim = id;
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
  // Base já convertida e arquivos sem mudança: não relê nem a base (a leitura de 140 MB fica para a conversão).
  const chaveBase = JSON.stringify([
    dirAns(),
    mtimeAns("base.json"),
    mtimeAns("rede.json"),
    mtimeAns("indicadores.json"),
    tabelasVersao(lerTabelas().tabelas),
  ]);
  if (estado.base?.chave !== chaveBase) {
    estado.base = null;
    estado.cat = null;
    const base = mtimeAns("base.json") ? lerBaseSegura() : null;
    if (!base) return catalogoFicticio();
    const t0 = Date.now();
    const conv = converterSemAjustes(base, {
      rede: semErro(lerRedeAns) ?? undefined,
      indicadores: semErro(lerIndicadoresAns) ?? undefined,
      tabelas: lerTabelas().tabelas,
    });
    estado.base = { chave: chaveBase, conv };
    if (conv.planos.length > 5000)
      console.log(`[catalogo] base ANS convertida em ${Date.now() - t0} ms (${conv.planos.length} planos).`);
  }
  const ajustes = lerAjustes();
  const chave = JSON.stringify([chaveBase, mtime(DIR_LOGOS()), ajustes]);
  if (estado.cat?.chave === chave) return estado.cat.cat;
  const conv = aplicarAjustes(estado.base.conv, ajustes);
  const cat: Catalogo = {
    fonte: "ans",
    ...conv,
    operadoras: conv.operadoras.map((o) => ({ ...o, logo: logoDe(o.registroAns) })),
  };
  estado.cat = { chave, cat };
  return cat;
}

// lerTabelas devolve o mesmo array (cache global) enquanto os CSVs não mudam; a identidade vira um número de
// versão. Sem tabelas (pasta ausente ou vazia) a versão é sempre 0.
function tabelasVersao(t: TabelaVenda[]): number {
  if (!t.length) return 0;
  let v = estado.versoesTabelas.get(t);
  if (!v) estado.versoesTabelas.set(t, (v = estado.proximaVersao++));
  return v;
}

// Índices por cidade e por id, calculados uma vez por lista de planos (a lista muda só quando o catálogo muda).
// Ficam em `estado` (globalThis) para que o índice do pré-aquecimento valha para as rotas.
function indice(planos: Plano[]): IndicePlanos {
  let i = estado.indices.get(planos);
  if (!i) {
    const porCidade = new Map<string, Plano[]>();
    for (const p of planos)
      for (const c of p.cidades) {
        const l = porCidade.get(c);
        if (l) l.push(p);
        else porCidade.set(c, [p]);
      }
    i = { porCidade, porId: new Map(planos.map((p) => [p.id, p])) };
    estado.indices.set(planos, i);
  }
  return i;
}

/** Planos comercializados na cidade (rótulo "Cidade - UF"), na ordem do catálogo. */
export function planosDaCidade(cat: { planos: Plano[] }, cidade: string): Plano[] {
  return indice(cat.planos).porCidade.get(cidade) ?? [];
}

/** Planos do catálogo para o filtro da cotação (segmento, modalidade e cidade). */
export function planosPara(f: FiltroCotacao): Plano[] {
  return planosDaCidade(catalogo(), f.cidade).filter((p) => p.segmento === f.segmento && p.modalidade === f.modalidade);
}

/**
 * Planos do catálogo para o seletor (server action buscarPlanos): filtro da cotação, só com preço nas faixas que
 * têm vidas, só operadoras habilitadas na conta (ou todas com `todas`). Não envia o catálogo inteiro.
 */
export function selecaoPlanos(filtro: FiltroCotacao, grupos: Grupo[], opts: { todas?: boolean } = {}): Selecao {
  const cat = catalogo();
  const habilitadas = opts.todas
    ? cat.operadoras.map((o) => o.id)
    : habilitadasEfetivas(lerConta(readDb()).operadorasHabilitadas, cat.fonte, cat.operadoras, registrosAlvo());
  return filtrarSelecao({ ...cat, planos: planosDaCidade(cat, filtro.cidade) }, filtro, grupos, new Set(habilitadas));
}

/** Pré-aquece o catálogo e o índice por cidade (instrumentation.ts, ao subir o servidor). */
export function preaquecerCatalogo(): void {
  const t0 = Date.now();
  const cat = catalogo();
  planosDaCidade(cat, cat.cidades[0] ?? "");
  if (cat.fonte === "ans") console.log(`[catalogo] pré-aquecido em ${Date.now() - t0} ms.`);
}

let cacheAlvo: { mtime: number; registros: string[] } | null = null;

/** Registros de data/ans/operadoras-alvo.json (habilitadas por padrão no catálogo ANS). */
export function registrosAlvo(): string[] {
  const arq = path.join(process.cwd(), "data", "ans", "operadoras-alvo.json");
  const m = mtime(arq);
  if (cacheAlvo?.mtime === m) return cacheAlvo.registros;
  let registros: string[] = [];
  try {
    const lista = JSON.parse(fs.readFileSync(arq, "utf8")) as { registros: string[] }[];
    registros = lista.flatMap((g) => g.registros);
  } catch {
    registros = [];
  }
  cacheAlvo = { mtime: m, registros };
  return registros;
}

export function planoPorId(id: string): Plano | undefined {
  return indice(catalogo().planos).porId.get(id);
}

export function operadoraPorId(id: string): Operadora | undefined {
  return catalogo().operadoras.find((o) => o.id === id);
}
