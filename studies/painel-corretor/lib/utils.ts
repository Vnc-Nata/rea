import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Faixa, Grupo, Plano } from "./types";
import { FAIXAS } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function numero(v: number, decimals = 2) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}

export function moeda(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
export function tempoRelativo(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "agora mesmo";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return rtf.format(Math.round(diff / (86400 * 30)), "month");
}

export function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function totalVidas(grupos: Grupo[]) {
  return grupos.reduce((s, g) => s + FAIXAS.reduce((a, f) => a + (g.vidas[f] || 0), 0), 0);
}

export function vidasPorFaixa(grupos: Grupo[]) {
  const out = {} as Record<Faixa, number>;
  for (const f of FAIXAS) out[f] = grupos.reduce((s, g) => s + (g.vidas[f] || 0), 0);
  return out;
}

export function precoTotal(plano: Plano, grupos: Grupo[]) {
  const v = vidasPorFaixa(grupos);
  return FAIXAS.reduce((s, f) => s + v[f] * plano.precos[f], 0);
}

export function idade(dataIso: string) {
  const d = new Date(dataIso);
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a -= 1;
  return a;
}

export function novoId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
