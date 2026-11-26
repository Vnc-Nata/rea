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

// ANS_DIR (relativo a process.cwd()) permite apontar para outra pasta, ex.: tests/fixtures.
const ARQ = path.join(path.resolve(process.cwd(), process.env.ANS_DIR ?? path.join("data", "ans")), "base.json");
let cache: { mtime: number; base: BaseAns } | null = null;

export function lerBaseAns(): BaseAns | null {
  if (!fs.existsSync(ARQ)) return null;
  const mtime = fs.statSync(ARQ).mtimeMs;
  if (!cache || cache.mtime !== mtime) cache = { mtime, base: JSON.parse(fs.readFileSync(ARQ, "utf8")) };
  return cache.base;
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
