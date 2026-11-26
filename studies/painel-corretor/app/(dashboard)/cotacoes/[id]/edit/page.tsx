import { notFound } from "next/navigation";
import { CotacaoEditor } from "@/components/cotacao-editor";
import { catalogo } from "@/lib/catalogo";
import { readDb } from "@/lib/db";
import { cidadeValida } from "@/lib/selecao";
import type { Plano } from "@/lib/types";

export default async function EditCotacao({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ d?: string }>;
}) {
  const { id } = await params;
  const { d } = await searchParams;
  const db = readDb();
  const cotacao = db.cotacoes.find((c) => c.id === id);
  if (!cotacao) notFound();
  // Só os planos dos cenários vão para o navegador; o seletor busca o resto pela server action.
  const cat = catalogo();
  const porId = new Map(cat.planos.map((p) => [p.id, p]));
  const planos: Plano[] = cotacao.cenarios.flatMap((c) => {
    const p = porId.get(c.planoId);
    return p ? [{ ...p, cidades: [] }] : [];
  });
  const opIds = new Set(planos.map((p) => p.operadoraId));
  const hospIds = new Set(planos.flatMap((p) => p.rede.map((r) => r.hospitalId)));
  const filtro = { ...cotacao.filtro, cidade: cidadeValida(cotacao.filtro.cidade, cat.cidades) };
  return (
    <CotacaoEditor
      cotacao={{ ...cotacao, filtro }}
      planos={planos}
      operadoras={cat.operadoras.filter((o) => opIds.has(o.id))}
      hospitais={cat.hospitais.filter((h) => hospIds.has(h.id))}
      cidades={cat.cidades}
      fonte={cat.fonte}
      mensagemPadrao={db.perfil.mensagemPadrao}
      drawer={d}
    />
  );
}
