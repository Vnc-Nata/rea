import { mediana } from "./comparar";
import type { Faixa, Grupo, Plano } from "./types";
import { FAIXAS, vidasVazias } from "./types";
import { precoDisponivel, precoTotal } from "./utils";

// Rodadas de divergência com o Painel do Corretor: correspondência de planos e métricas. Puro (sem arquivos).

/** Uma observação do Painel: um plano numa cotação (cidade + vidas), com o preço lido depois da animação. */
export interface ObsPainel {
  caso: string;
  cidade: string; // rótulo do catálogo, ex.: "Belo Horizonte - MG"
  perfil: string; // ex.: "24-28:3" ou "34-38:2,00-18:1"
  modalidade: "PME" | "PF" | "Adesão";
  operadora: string; // nome no Painel, ex.: "Amil", "Bradesco Seguros"
  planoPainel: string; // nome exato no Painel, ex.: "Bronze SP Mais"
  acomodacao: "Enfermaria" | "Apartamento";
  copart: "Sem" | "Parcial" | "Completa" | "Com";
  totalPainel: number; // total mensal mostrado pelo Painel
  planoNosso?: string; // id do plano no nosso catálogo, quando a correspondência foi escolhida à mão
}

/** Nome da operadora no Painel → registros ANS (mesmo grupo econômico). */
export const OPERADORAS_PAINEL: Record<string, string[]> = {
  Amil: ["326305"],
  "Bradesco Seguros": ["005711", "421715"],
  Sulamérica: ["006246", "416428"],
  "Porto Seguro": ["000582"],
  Portomed: ["417491"],
  Alice: ["421928"],
  "Hapvida NotreDame SP/RJ": ["359017"],
  "NotreDame SP/RJ": ["359017"],
  Hapvida: ["368253"],
  "Hapvida Minas Gerais": ["348520"],
  "Unimed Belo Horizonte": ["343005"],
  "Seguros Unimed": ["000701"],
};

export function gruposDoPerfil(perfil: string): Grupo[] {
  const vidas = vidasVazias();
  for (const parte of perfil.split(",")) {
    const [faixa, n] = parte.split(":").map((s) => s.trim());
    const f = (FAIXAS as readonly string[]).find((x) => x === faixa || x.startsWith(`${faixa}-`) || x === `${faixa}-999`);
    if (!f || !Number(n)) throw new Error(`perfil inválido: ${perfil}`);
    vidas[f as Faixa] += Number(n);
  }
  return [{ nome: "Geral", vidas }];
}

const ROMANOS: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4", v: "5" };
const tokens = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter(Boolean)
    .map((t) => ROMANOS[t] ?? t);

export interface Correspondencia {
  plano?: Plano;
  candidatos: Plano[];
  confianca: "alta" | "média" | "baixa" | "sem equivalente";
}

/**
 * Plano do nosso catálogo equivalente ao do Painel: mesma operadora, cidade, modalidade, acomodação e
 * coparticipação, e todos os termos do nome do Painel no nome ANS. Entre os candidatos, o de menos termos extras
 * (empate: o mais barato). O preço do Painel nunca entra na escolha, para não enviesar a medição.
 * Confiança: alta = um candidato (ou vários com preço igual, ±1%); média = vários com preços diferentes;
 * baixa = nenhum com o nome completo, escolhido só pelas outras características.
 */
export function corresponder(obs: ObsPainel, planosDaCidade: Plano[], registroDe: (opId: string) => string): Correspondencia {
  const grupos = gruposDoPerfil(obs.perfil);
  const regs = new Set(OPERADORAS_PAINEL[obs.operadora] ?? []);
  const acom = obs.acomodacao === "Apartamento" ? "Quarto Individual" : "Quarto Coletivo";
  const base = planosDaCidade.filter(
    (p) =>
      regs.has(registroDe(p.operadoraId)) &&
      p.segmento === "Saúde" &&
      p.modalidade === obs.modalidade &&
      p.acomodacao === acom &&
      copartCasa(p, obs.copart) &&
      precoDisponivel(p, grupos),
  );
  if (obs.planoNosso) {
    const p = planosDaCidade.find((x) => x.id === obs.planoNosso);
    return { plano: p, candidatos: p ? [p] : [], confianca: p ? "alta" : "sem equivalente" };
  }
  const alvo = tokens(obs.planoPainel);
  const completos = base.filter((p) => {
    const n = tokens(p.nome);
    return alvo.every((t) => n.includes(t));
  });
  const lista = completos.length ? completos : base;
  if (!lista.length) return { candidatos: [], confianca: "sem equivalente" };
  const extras = (p: Plano) => tokens(p.nome).length - alvo.length;
  const ordenada = [...lista].sort(
    (a, b) => extras(a) - extras(b) || precoTotal(a, grupos) - precoTotal(b, grupos),
  );
  const precos = ordenada.map((p) => precoTotal(p, grupos));
  const iguais = Math.max(...precos) <= Math.min(...precos) * 1.01;
  const confianca = !completos.length ? "baixa" : completos.length === 1 || iguais ? "alta" : "média";
  return { plano: ordenada[0], candidatos: ordenada, confianca };
}

function copartCasa(p: Plano, c: ObsPainel["copart"]): boolean {
  if (c === "Sem") return p.coparticipacao === "Sem coparticipação";
  if (p.coparticipacao !== "Com coparticipação") return false;
  if (c === "Com" || !p.tipoCopart) return true;
  return p.tipoCopart === c;
}

export interface LinhaResultado extends ObsPainel {
  planoNossoNome?: string;
  codigoAns?: string;
  origem?: string;
  totalNosso?: number;
  vidas: number;
  diferencaPct?: number;
  confianca: Correspondencia["confianca"];
  candidatos: number;
}

export function medir(obs: ObsPainel, c: Correspondencia): LinhaResultado {
  const grupos = gruposDoPerfil(obs.perfil);
  const vidas = FAIXAS.reduce((s, f) => s + grupos[0].vidas[f], 0);
  const totalNosso = c.plano ? precoTotal(c.plano, grupos) : undefined;
  return {
    ...obs,
    planoNossoNome: c.plano?.nome,
    codigoAns: c.plano?.codigoAns,
    origem: c.plano ? (c.plano.origemPreco === "tabela" ? "Tabela de venda" : "Referência ANS") : undefined,
    totalNosso,
    vidas,
    diferencaPct: totalNosso != null ? Math.round(((totalNosso - obs.totalPainel) / obs.totalPainel) * 1000) / 10 : undefined,
    confianca: c.confianca,
    candidatos: c.candidatos.length,
  };
}

export interface Metricas {
  casos: number;
  semEquivalente: number;
  mediana: number;
  media: number;
  p90: number;
  dentro2: number;
  dentro5: number;
  dentro10: number;
}

export function metricas(linhas: LinhaResultado[]): Metricas {
  const d = linhas.filter((l) => l.diferencaPct != null).map((l) => Math.abs(l.diferencaPct!));
  const ord = [...d].sort((a, b) => a - b);
  const pct = (lim: number) => (d.length ? Math.round((d.filter((x) => x <= lim).length / d.length) * 1000) / 10 : 0);
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    casos: linhas.length,
    semEquivalente: linhas.length - d.length,
    mediana: d.length ? r1(mediana(d)) : 0,
    media: d.length ? r1(d.reduce((a, b) => a + b, 0) / d.length) : 0,
    p90: d.length ? r1(ord[Math.min(ord.length - 1, Math.ceil(ord.length * 0.9) - 1)]) : 0,
    dentro2: pct(2),
    dentro5: pct(5),
    dentro10: pct(10),
  };
}

/** Métricas agrupadas por uma chave (operadora, UF, faixa, origem). */
export function metricasPor(linhas: LinhaResultado[], chave: (l: LinhaResultado) => string): [string, Metricas][] {
  const g = new Map<string, LinhaResultado[]>();
  for (const l of linhas) {
    const k = chave(l);
    g.set(k, [...(g.get(k) ?? []), l]);
  }
  return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR")).map(([k, ls]) => [k, metricas(ls)]);
}

/** Ajuste % sugerido pela mediana de painel/nosso, e se a divergência é consistente (desvio padrão < 3 pontos). */
export function calibracao(linhas: LinhaResultado[]): { sugerido: number; desvio: number; consistente: boolean; n: number } {
  const d = linhas.filter((l) => l.diferencaPct != null && l.confianca !== "baixa").map((l) => l.diferencaPct!);
  if (!d.length) return { sugerido: 0, desvio: 0, consistente: false, n: 0 };
  const razoes = linhas
    .filter((l) => l.totalNosso && l.confianca !== "baixa")
    .map((l) => l.totalPainel / l.totalNosso!);
  const media = d.reduce((a, b) => a + b, 0) / d.length;
  const desvio = Math.sqrt(d.reduce((s, x) => s + (x - media) ** 2, 0) / d.length);
  return {
    sugerido: Math.round((mediana(razoes) - 1) * 1000) / 10,
    desvio: Math.round(desvio * 10) / 10,
    consistente: desvio < 3,
    n: d.length,
  };
}
