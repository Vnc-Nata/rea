import "server-only";
import fs from "node:fs";
import path from "node:path";

// Base gerada por scripts/importar-ans.mjs a partir dos dados abertos da ANS.
// VCM = valor comercial da mensalidade declarado na nota técnica (NTRP) do plano.
// É referência regulatória, não o preço da tabela de venda.

export interface VcmVariante {
  precos: (number | null)[];
  min: (number | null)[];
  max: (number | null)[];
}

export interface PlanoAns {
  id: string;
  codigoAns: string;
  nome: string;
  registroAns: string;
  grupo: string;
  contratacao: string;
  segmentacao: string;
  segmentacaoGrupo: string;
  odontologico: boolean;
  obstetricia: string;
  abrangencia: string;
  fatorModerador: string;
  acomodacao: string;
  livreEscolha: string;
  dataRegistro: string;
  vcm: { nota: string; data: string; atualizadoEm: string; variantes: Record<string, VcmVariante> } | null;
  ufs: string[];
  municipios: { codigo: string; nome: string }[];
}

export interface OperadoraAns {
  registroAns: string;
  grupo: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  modalidade: string;
  uf: string;
}

export interface BaseAns {
  geradoEm: string;
  fonte: string;
  ufsDetalhadas: string[];
  faixas: string[];
  operadoras: OperadoraAns[];
  planos: PlanoAns[];
}

/** Rede hospitalar por plano (rede.json, gerado junto com a base). */
export interface RedeAns {
  geradoEm: string;
  hospitais: Record<string, { nome: string; municipio: string; uf: string; classe: string; urgencia: boolean }>;
  porPlano: Record<string, string[]>; // id do plano → CNES
}

/** IDSS e reajuste por registro de operadora (indicadores.json). */
export interface IndicadoresAns {
  geradoEm: string;
  porOperadora: Record<
    string,
    { idss?: number; idssAno?: number; reajuste?: number; reajusteAnterior?: number; ciclo?: number }
  >;
}

// ANS_DIR (relativo a process.cwd()) permite apontar para outra pasta, ex.: tests/fixtures.
// Resolvido a cada leitura para que testes possam trocar a pasta.
export function dirAns(): string {
  return path.resolve(process.cwd(), process.env.ANS_DIR ?? path.join("data", "ans"));
}

// Cache em globalThis: no Next.js o pré-aquecimento (instrumentation.ts) e as rotas podem usar instâncias
// diferentes deste módulo, e a base real tem 140 MB (não pode ser lida de novo por instância).
const G = globalThis as typeof globalThis & { __jsonAns?: Map<string, { mtime: number; dado: unknown }> };
const cache = (G.__jsonAns ??= new Map());

/** Lê um JSON da pasta da ANS com cache por data de modificação; null se não existir. */
function lerJson<T>(nome: string): T | null {
  const arq = path.join(dirAns(), nome);
  let mtime: number;
  try {
    mtime = fs.statSync(arq).mtimeMs;
  } catch {
    return null;
  }
  const c = cache.get(arq);
  if (c && c.mtime === mtime) return c.dado as T;
  const dado = JSON.parse(fs.readFileSync(arq, "utf8")) as T;
  cache.set(arq, { mtime, dado });
  return dado;
}

/** mtime do arquivo (0 se não existir), para chaves de cache derivadas. */
export function mtimeAns(nome: string): number {
  try {
    return fs.statSync(path.join(dirAns(), nome)).mtimeMs;
  } catch {
    return 0;
  }
}

export function lerBaseAns(): BaseAns | null {
  return lerJson<BaseAns>("base.json");
}

/** Como lerBaseAns, mas não lança: base.json corrompida ou pela metade vira { ilegivel: true }. */
export function lerBaseAnsSegura(): { base: BaseAns | null; ilegivel: boolean } {
  try {
    return { base: lerBaseAns(), ilegivel: false };
  } catch (e) {
    console.warn(`[ans] base.json ilegível em ${dirAns()}.`, e);
    return { base: null, ilegivel: true };
  }
}

/** Lê um arquivo opcional da base (rede, indicadores) sem derrubar a página se estiver ilegível. */
export function semErro<T>(ler: () => T | null): T | null {
  try {
    return ler();
  } catch {
    return null;
  }
}

export function lerRedeAns(): RedeAns | null {
  return lerJson<RedeAns>("rede.json");
}

export function lerIndicadoresAns(): IndicadoresAns | null {
  return lerJson<IndicadoresAns>("indicadores.json");
}

export interface FiltroAns {
  q?: string;
  grupo?: string;
  contratacao?: string;
  acomodacao?: string;
  cobertura?: string; // segmentacaoGrupo
  copart?: string; // "com" | "sem"
  uf?: string;
  municipio?: string;
  vcm?: string; // "1" = só planos com VCM
}

export function filtrarPlanos(base: BaseAns, f: FiltroAns) {
  const q = f.q?.trim().toLowerCase();
  return base.planos.filter((p) => {
    if (f.grupo && p.grupo !== f.grupo) return false;
    if (f.contratacao && p.contratacao !== f.contratacao) return false;
    if (f.acomodacao && p.acomodacao !== f.acomodacao) return false;
    if (f.cobertura && p.segmentacaoGrupo !== f.cobertura) return false;
    if (f.copart === "com" && p.fatorModerador === "Ausente") return false;
    if (f.copart === "sem" && p.fatorModerador !== "Ausente") return false;
    if (f.uf && p.ufs.length && !p.ufs.includes(f.uf)) return false;
    if (f.municipio && !p.municipios.some((m) => m.codigo === f.municipio)) return false;
    if (f.vcm === "1" && !p.vcm) return false;
    if (q && !p.nome.toLowerCase().includes(q) && !p.codigoAns.includes(q)) return false;
    return true;
  });
}

/** Primeira variante de abrangência da nota técnica (a maioria dos planos tem só uma). */
export function vcmPrincipal(p: PlanoAns): (VcmVariante & { abrangencia: string }) | null {
  if (!p.vcm) return null;
  const [abrangencia, v] = Object.entries(p.vcm.variantes)[0] ?? [];
  return v ? { abrangencia, ...v } : null;
}

/** Soma de vidas × VCM por faixa; null se faltar valor em faixa com vidas. */
export function estimativa(p: PlanoAns, vidas: number[]) {
  const v = vcmPrincipal(p);
  if (!v) return null;
  let total = 0;
  for (let i = 0; i < 10; i++) {
    if (!vidas[i]) continue;
    const preco = v.precos[i];
    if (preco == null) return null;
    total += vidas[i] * preco;
  }
  return total;
}

export function opcoes(base: BaseAns) {
  const u = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    grupos: u(base.planos.map((p) => p.grupo)),
    contratacoes: u(base.planos.map((p) => p.contratacao)),
    acomodacoes: u(base.planos.map((p) => p.acomodacao)),
    coberturas: u(base.planos.map((p) => p.segmentacaoGrupo)),
    ufs: u(base.planos.flatMap((p) => p.ufs)),
  };
}
