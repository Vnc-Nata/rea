"use server";

// Server actions com os mesmos nomes vistos no bundle de referência
// (create, editTitulo, updateCnpj, updateGrupo, onPlanoSelect, onPlanoRemove,
// deleteCotacao, updateComentario, registrarEvento, updatePerfil).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { catalogo, operadoraPorId, planoPorId, registrosAlvo } from "@/lib/catalogo";
import { grupoDe, tituloComparacao } from "@/lib/comparar-db";
import { readDb, updateDb } from "@/lib/db";
import { contaPadrao, lerConta } from "@/lib/conta-db";
import { CIDADE_PADRAO, cidadeValida, filtrarSelecao, habilitadasEfetivas, type Selecao } from "@/lib/selecao";
import type { Conta, Db, Faixa, FiltroCotacao, Grupo, OpcoesEnvio, Perfil, Usuario } from "@/lib/types";
import { vidasVazias } from "@/lib/types";
import { novoId, precoDisponivel } from "@/lib/utils";

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
      filtro: { segmento: "Saúde", modalidade: "PME", cidade: cidadeValida(CIDADE_PADRAO, catalogo().cidades) },
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

/**
 * Planos do catálogo para o seletor: filtro da cotação, só com preço nas faixas que têm vidas,
 * só operadoras habilitadas na conta (ou todas com `todas`). Não envia o catálogo inteiro.
 */
export async function buscarPlanos(
  filtro: FiltroCotacao,
  grupos: Grupo[],
  opts: { todas?: boolean } = {},
): Promise<Selecao> {
  const cat = catalogo();
  const habilitadas = opts.todas
    ? cat.operadoras.map((o) => o.id)
    : habilitadasEfetivas(lerConta(readDb()).operadorasHabilitadas, cat.fonte, cat.operadoras, registrosAlvo());
  return filtrarSelecao(cat, filtro, grupos, new Set(habilitadas));
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

// ---------- Opções, duplicar, destacar, contato/negócio ----------

export async function updateOpcoes(cotacaoId: string, opcoes: OpcoesEnvio) {
  updateDb((db) => {
    const c = db.cotacoes.find((c) => c.id === cotacaoId);
    if (c) c.opcoes = opcoes;
  });
  revalidatePath(`/cotacoes/${cotacaoId}/edit`);
}

export async function duplicateCotacao(cotacaoId: string) {
  const id = updateDb((db) => {
    const c = db.cotacoes.find((c) => c.id === cotacaoId);
    if (!c) return null;
    const agora = new Date().toISOString();
    const id = novoId("cot");
    db.cotacoes.unshift({
      ...structuredClone(c),
      id,
      titulo: `${c.titulo} (cópia)`.slice(0, 50),
      criadaEm: agora,
      criadaPor: db.perfil.usuario,
      cenarios: c.cenarios.map((x) => ({ ...x, id: novoId("cen") })),
      eventos: [{ tipo: "Duplicada", em: agora, por: db.perfil.usuario }],
      visualizacoes: 0,
    });
    return id;
  });
  if (id) redirect(`/cotacoes/${id}/edit`);
}

export async function onPlanoDestaque(cotacaoId: string, cenarioId: string) {
  updateDb((db) => {
    const cen = db.cotacoes.find((c) => c.id === cotacaoId)?.cenarios.find((x) => x.id === cenarioId);
    if (cen) cen.destaque = !cen.destaque;
  });
  revalidatePath(`/cotacoes/${cotacaoId}/edit`);
}

export async function linkContato(cotacaoId: string, contato: string) {
  updateDb((db) => {
    const c = db.cotacoes.find((c) => c.id === cotacaoId);
    if (c) c.contato = contato.trim().slice(0, 80) || undefined;
  });
  revalidatePath(`/cotacoes/${cotacaoId}/edit`);
}

export async function linkNegocio(cotacaoId: string, negocio: string) {
  updateDb((db) => {
    const c = db.cotacoes.find((c) => c.id === cotacaoId);
    if (c) c.negocio = negocio.trim().slice(0, 80) || undefined;
  });
  revalidatePath(`/cotacoes/${cotacaoId}/edit`);
}

// ---------- Configurações da conta ----------

function comConta<T>(fn: (conta: Conta, db: Db) => T): T {
  return updateDb((db) => {
    db.conta ??= contaPadrao(db);
    return fn(db.conta, db);
  });
}

export async function updateCorretora(dados: Conta["corretora"]): Promise<Result> {
  if (!dados.nome.trim()) return { success: false, error: "Informe o nome da corretora." };
  comConta((conta, db) => {
    conta.corretora = { ...dados, nome: dados.nome.trim() };
    db.perfil.corretora = conta.corretora.nome;
  });
  revalidatePath("/", "layout");
  return { success: true };
}

export async function addLicencas(qtd: number) {
  comConta((conta) => {
    conta.licencas = Math.max(1, conta.licencas + Math.floor(qtd));
  });
  revalidatePath("/conta/assinatura");
}

export async function convidarUsuario(nome: string, email: string, equipeId?: string): Promise<Result> {
  if (!nome.trim() || !/^\S+@\S+\.\S+$/.test(email)) return { success: false, error: "Informe nome e e-mail válidos." };
  const r = comConta((conta): Result => {
    if (conta.usuarios.filter((u) => u.ativo).length >= conta.licencas)
      return { success: false, error: "Todas as licenças estão em uso. Adicione novas licenças." };
    if (conta.usuarios.some((u) => u.email === email)) return { success: false, error: "E-mail já cadastrado." };
    conta.usuarios.push({
      id: novoId("usr"),
      nome: nome.trim(),
      email,
      perfil: "Usuário",
      equipeId: equipeId || undefined,
      ativo: true,
    });
    return { success: true };
  });
  revalidatePath("/conta/usuarios");
  return r;
}

export async function updateUsuario(id: string, dados: Partial<Pick<Usuario, "perfil" | "equipeId" | "ativo">>) {
  comConta((conta) => {
    const u = conta.usuarios.find((u) => u.id === id);
    if (u) Object.assign(u, dados);
  });
  revalidatePath("/conta/usuarios");
}

export async function criarEquipe(nome: string): Promise<Result> {
  if (!nome.trim()) return { success: false, error: "Informe o nome da equipe." };
  comConta((conta) => {
    conta.equipes.push({ id: novoId("eq"), nome: nome.trim().slice(0, 40) });
  });
  revalidatePath("/conta/equipes");
  return { success: true };
}

export async function excluirEquipe(id: string) {
  comConta((conta) => {
    conta.equipes = conta.equipes.filter((e) => e.id !== id);
    for (const u of conta.usuarios) if (u.equipeId === id) u.equipeId = undefined;
  });
  revalidatePath("/conta/equipes");
}

export async function gerarChaveApi() {
  const chave = comConta((conta) => {
    conta.apiKey = `pm_estudo_${crypto.randomUUID().replace(/-/g, "")}`;
    return conta.apiKey;
  });
  revalidatePath("/conta/integracoes");
  return chave;
}

export async function updatePreferencias(operadorasHabilitadas: string[], maisInfoRelevantes: boolean) {
  comConta((conta) => {
    conta.operadorasHabilitadas = operadorasHabilitadas;
    conta.maisInfoRelevantes = maisInfoRelevantes;
  });
  revalidatePath("/", "layout");
}

/** Ajuste % sobre o VCM da operadora (Conta.ajustes); 0 remove o ajuste. */
export async function aplicarAjuste(operadoraId: string, pct: number): Promise<Result> {
  if (!Number.isFinite(pct) || pct <= -100 || pct > 500)
    return { success: false, error: "Informe um ajuste maior que -100% e de até 500%." };
  const v = Math.round(pct * 100) / 100;
  comConta((conta) => {
    const ajustes = { ...(conta.ajustes ?? {}) };
    if (v === 0) delete ajustes[operadoraId];
    else ajustes[operadoraId] = v;
    conta.ajustes = ajustes;
  });
  revalidatePath("/", "layout");
  return { success: true };
}

// ---------- Comparar com o Painel ----------

export interface PlanoBusca {
  id: string;
  nome: string;
  operadora: string;
}

/** Até 20 planos de saúde da cidade cujo nome contém o texto (sem acento/caixa) e que têm preço para as vidas. */
export async function buscarPlanosPorNome(
  cidade: string,
  texto: string,
  vidas: Record<Faixa, number>,
): Promise<PlanoBusca[]> {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = norm(texto.trim());
  if (!q) return [];
  const cat = catalogo();
  const ops = new Map(cat.operadoras.map((o) => [o.id, o.nome]));
  const out: PlanoBusca[] = [];
  for (const p of cat.planos) {
    if (p.segmento !== "Saúde" || !p.cidades.includes(cidade)) continue;
    if (!norm(`${ops.get(p.operadoraId) ?? ""} ${p.nome}`).includes(q)) continue;
    if (!precoDisponivel(p, grupoDe(vidas))) continue;
    out.push({ id: p.id, nome: p.nome, operadora: ops.get(p.operadoraId) ?? "" });
    if (out.length === 20) break;
  }
  return out;
}

export async function criarComparacao(dados: {
  planoId: string;
  cidade: string;
  vidas: Record<Faixa, number>;
  valorPainel?: number;
}): Promise<Result> {
  const plano = planoPorId(dados.planoId);
  if (!plano) return { success: false, error: "Escolha um plano." };
  if (!plano.cidades.includes(dados.cidade))
    return { success: false, error: "O plano não é comercializado nesta cidade." };
  if (Object.values(dados.vidas).reduce((a, b) => a + b, 0) < 1)
    return { success: false, error: "Informe ao menos uma vida." };
  if (!precoDisponivel(plano, grupoDe(dados.vidas)))
    return { success: false, error: "O plano não tem preço para alguma faixa informada." };
  const titulo = tituloComparacao(plano, operadoraPorId(plano.operadoraId)?.nome ?? "", dados.cidade, dados.vidas);
  const valor = dados.valorPainel && dados.valorPainel > 0 ? Math.round(dados.valorPainel * 100) / 100 : undefined;
  updateDb((db) => {
    db.comparacoes = [
      ...(db.comparacoes ?? []),
      {
        id: novoId("cmp"),
        titulo,
        planoId: plano.id,
        cidade: dados.cidade,
        vidas: dados.vidas,
        valorPainel: valor,
        criadaEm: new Date().toISOString(),
      },
    ];
    db.comparacoesIniciadas = true;
  });
  revalidatePath("/comparar");
  return { success: true };
}

/** Define o plano de um caso que ficou sem plano (plano não achado no catálogo). */
export async function escolherPlanoComparacao(id: string, planoId: string): Promise<Result> {
  const plano = planoPorId(planoId);
  if (!plano) return { success: false, error: "Escolha um plano." };
  updateDb((db) => {
    const c = db.comparacoes?.find((c) => c.id === id);
    if (c) c.planoId = plano.id;
  });
  revalidatePath("/comparar");
  return { success: true };
}

export async function atualizarValorPainel(id: string, valor: number | null) {
  updateDb((db) => {
    const c = db.comparacoes?.find((c) => c.id === id);
    if (!c) return;
    c.valorPainel = valor != null && Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) / 100 : undefined;
  });
  revalidatePath("/comparar");
}

export async function excluirComparacao(id: string) {
  updateDb((db) => {
    db.comparacoes = (db.comparacoes ?? []).filter((c) => c.id !== id);
    db.comparacoesIniciadas = true;
  });
  revalidatePath("/comparar");
}
