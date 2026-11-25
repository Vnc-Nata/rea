import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-8">
      <div className="w-full max-w-xl">
        <p className="text-xs font-semibold text-blue-600">Erro 404</p>
        <h1 className="mt-2 text-3xl font-bold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">Desculpe, a página que você está procurando não existe ou foi removida.</p>
        <div className="mt-6 flex gap-2">
          <ButtonLink href="/cotacoes" variant="outline" className="w-1/2 sm:w-auto">
            <ArrowLeft className="h-4" /> Voltar
          </ButtonLink>
          <ButtonLink href="/" className="w-1/2 sm:w-auto">
            Início
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
