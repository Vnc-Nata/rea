import { notFound } from "next/navigation";
import { CotacaoEditor } from "@/components/cotacao-editor";
import { lerConta } from "@/lib/conta-db";
import { readDb } from "@/lib/db";

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
  return (
    <CotacaoEditor
      cotacao={cotacao}
      planos={db.planos}
      operadoras={db.operadoras}
      hospitais={db.hospitais}
      mensagemPadrao={db.perfil.mensagemPadrao}
      drawer={d}
      operadorasHabilitadas={lerConta(db).operadorasHabilitadas}
    />
  );
}
