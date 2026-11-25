import { notFound } from "next/navigation";

const TITULOS: Record<string, string> = { contatos: "Contatos", negocios: "Negócios" };

export default async function Crm({ params }: { params: Promise<{ modulo: string }> }) {
  const { modulo } = await params;
  if (!TITULOS[modulo]) notFound();
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{TITULOS[modulo]}</h1>
      <div className="rounded-sm bg-background p-6 text-sm text-muted-foreground shadow-sm">
        No app de referência o CRM (contatos e negócios) é uma aplicação separada, em outro domínio. Ele não foi recriado neste estudo.
      </div>
    </>
  );
}
