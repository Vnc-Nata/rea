import { notFound } from "next/navigation";
import { SECOES } from "@/lib/conta";

export default async function Secao({ params }: { params: Promise<{ secao: string }> }) {
  const { secao } = await params;
  const titulo = SECOES[secao];
  if (!titulo) notFound();
  return (
    <>
      <h2 className="mb-2 text-lg font-semibold">{titulo}</h2>
      <p className="text-sm text-muted-foreground">
        Esta seção existe no app de referência, mas não foi recriada neste estudo.
      </p>
    </>
  );
}
