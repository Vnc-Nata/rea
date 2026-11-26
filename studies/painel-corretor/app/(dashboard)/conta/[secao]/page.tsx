import { notFound } from "next/navigation";
import { Assinatura, CorretoraForm, Equipes, Integracoes, Preferencias, Usuarios } from "@/components/conta-secoes";
import { SECOES } from "@/lib/conta";
import { lerConta } from "@/lib/conta-db";
import { catalogo, registrosAlvo } from "@/lib/catalogo";
import { readDb } from "@/lib/db";
import { habilitadasEfetivas } from "@/lib/selecao";
import { lerTabelas } from "@/lib/tabelas";

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
      return <CorretoraForm conta={conta} cidades={catalogo().cidades} />;
    case "assinatura":
      return <Assinatura conta={conta} />;
    case "usuarios":
      return <Usuarios conta={conta} mostrarInativos={status === "false"} />;
    case "equipes":
      return <Equipes conta={conta} />;
    case "integracoes":
      return <Integracoes conta={conta} />;
    case "preferencias": {
      const cat = catalogo();
      const habilitadas = habilitadasEfetivas(conta.operadorasHabilitadas, cat.fonte, cat.operadoras, registrosAlvo());
      return (
        <Preferencias
          conta={conta}
          operadoras={cat.operadoras}
          habilitadas={habilitadas}
          fonte={cat.fonte}
          errosTabelas={lerTabelas().erros}
        />
      );
    }
    default:
      notFound();
  }
}
