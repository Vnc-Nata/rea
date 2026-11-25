"use server";

// Server actions com os mesmos nomes vistos no bundle de referência
// (create, editTitulo, updateCnpj, updateGrupo, onPlanoSelect, onPlanoRemove,
// deleteCotacao, updateComentario, registrarEvento, updatePerfil).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateDb } from "@/lib/db";
import type { Faixa, FiltroCotacao, Perfil } from "@/lib/types";
import { vidasVazias } from "@/lib/types";
import { novoId } from "@/lib/utils";

type Result = { success: true } | { success: false; error: string };

export async function create(formData: FormData) {
  const titulo = String(formData.get("titulo") || "").trim();
  if (!titulo) return;
  const id = updateDb((db) => {
    const agora = new Date().toISOString();
    const id = novoId("cot");
    const vidas = vidasVazias();
    db.cotacoes.unshift({
      id,
      titulo: titulo.slice(0, 50),
      criadaEm: agora,
      criadaPor: db.perfil.usuario,
      cnpj: "",
      grupos: [{ nome: "Geral", vidas }],
      cenarios: [],
      filtro: { segmento: "Saúde", modalidade: "PME", cidade: "São Paulo - SP" },
      eventos: [{ tipo: "Criada", em: agora, por: db.perfil.usuario }],
      visualizacoes: 0,
    });
    return id;
  });
  redirect(`/cotacoes/${id}/edit?d=distribuicao`);
}

export async function editTitulo(cotacaoId: string, titulo: string) {
  updateDb((db) => {
    const c = db.cotacoes.find((c) => c.id === cotacaoId);
    if (c && titulo.trim()) c.titulo = titulo.trim().slice(0, 50);
  });
  revalidatePath(`/cotacoes`);
}

export async function updateCnpj(cotacaoId: string, cnpj: string) {
  updateDb((db) => {
    const c = db.cotacoes.find((c) => c.id === cotacaoId);
    if (c) c.cnpj = cnpj;
  });
}

export async function updateGrupo(cotacaoId: string, vidas: Record<Faixa, number>): Promise<Result> {
  const total = Object.values(vidas).reduce((a, b) => a + b, 0);
  if (total < 1) return { success: false, error: "Informe ao menos uma vida." };
  updateDb((db) => {
    const c = db.cotacoes.find((c) => c.id === cotacaoId);
    if (c) c.grupos = [{ nome: "Geral", vidas }];
  });
  revalidatePath(`/cotacoes/${cotacaoId}/edit`);
  return { success: true };
}

export async function updateFiltro(cotacaoId: string, filtro: FiltroCotacao) {
  updateDb((db) => {
    const c = db.cotacoes.find((c) => c.id === cotacaoId);
    if (c) c.filtro = filtro;
  });
}

export async function onPlanoSelect(cotacaoId: string, planoIds: string[]) {
  updateDb((db) => {
    const c = db.cotacoes.find((c) => c.id === cotacaoId);
    if (!c) return;
    for (const planoId of planoIds) {
      if (c.cenarios.some((x) => x.planoId === planoId)) continue;
      c.cenarios.push({ id: novoId("cen"), planoId, comentario: "" });
      c.eventos.push({ tipo: "Plano adicionado", em: new Date().toISOString(), por: db.perfil.usuario });
    }
  });
  revalidatePath(`/cotacoes/${cotacaoId}/edit`);
}

export async function onPlanoRemove(cotacaoId: string, cenarioId: string) {
  updateDb((db) => {
    const c = db.cotacoes.find((c) => c.id === cotacaoId);
    if (!c) return;
    c.cenarios = c.cenarios.filter((x) => x.id !== cenarioId);
    c.eventos.push({ tipo: "Plano removido", em: new Date().toISOString(), por: db.perfil.usuario });
  });
  revalidatePath(`/cotacoes/${cotacaoId}/edit`);
}

export async function deleteCotacao(cotacaoId: string) {
  updateDb((db) => {
    db.cotacoes = db.cotacoes.filter((c) => c.id !== cotacaoId);
  });
  redirect("/cotacoes");
}

export async function trackCotacao(cotacaoId: string) {
  updateDb((db) => {
    const c = db.cotacoes.find((c) => c.id === cotacaoId);
    if (c) c.eventos.push({ tipo: "Enviada", em: new Date().toISOString(), por: db.perfil.usuario });
  });
  revalidatePath(`/cotacoes/${cotacaoId}/edit`);
}

export async function updateComentario(cotacaoId: string, cenarioId: string, comentario: string) {
  updateDb((db) => {
    const cen = db.cotacoes.find((c) => c.id === cotacaoId)?.cenarios.find((x) => x.id === cenarioId);
    if (cen) cen.comentario = comentario.slice(0, 500);
  });
}

/** Chamado quando o cliente abre a proposta (rota pública /cotacoes/[id]/cenarios/[cenarioId]). */
export async function registrarEvento(cotacaoId: string) {
  updateDb((db) => {
    const c = db.cotacoes.find((c) => c.id === cotacaoId);
    if (!c) return;
    c.visualizacoes += 1;
    c.eventos.push({ tipo: "Visualizada", em: new Date().toISOString(), por: "Cliente" });
  });
}

export async function updatePerfil(perfil: Pick<Perfil, "corretora" | "telefone" | "mensagemPadrao">): Promise<Result> {
  if (!perfil.corretora.trim()) return { success: false, error: "Informe o nome." };
  updateDb((db) => {
    db.perfil = { ...db.perfil, ...perfil };
  });
  revalidatePath("/", "layout");
  return { success: true };
}
