import { notFound } from "next/navigation";
import { Assinatura, CorretoraForm, Equipes, Integracoes, Preferencias, Usuarios } from "@/components/conta-secoes";
import { SECOES } from "@/lib/conta";
import { lerConta } from "@/lib/conta-db";
import { readDb } from "@/lib/db";
import { CIDADES } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function Secao({
  params,
  searchParams,
}: {
  params: Promise<{ secao: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { secao } = await params;
  const { status } = await searchParams;
  if (!SECOES[secao]) notFound();
  const db = readDb();
  const conta = lerConta(db);
  switch (secao) {
    case "corretora":
      return <CorretoraForm conta={conta} cidades={CIDADES} />;
    case "assinatura":
      return <Assinatura conta={conta} />;
    case "usuarios":
      return <Usuarios conta={conta} mostrarInativos={status === "false"} />;
    case "equipes":
      return <Equipes conta={conta} />;
    case "integracoes":
      return <Integracoes conta={conta} />;
    case "preferencias":
      return <Preferencias conta={conta} operadoras={db.operadoras} />;
    default:
      notFound();
  }
}
