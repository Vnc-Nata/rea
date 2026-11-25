import { Mail, MessageCircle } from "lucide-react";
import { ThemeSwitch } from "@/components/theme";
import { readDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Layout público da proposta (visto pelo cliente final), sem a barra lateral do painel.
export default function PropostaLayout({ children }: { children: React.ReactNode }) {
  const { perfil } = readDb();
  const tel = perfil.telefone.replace(/\D/g, "");
  const contatos = (
    <ul className="flex gap-3">
      <li>
        <a className="text-gray-400 hover:text-primary" href={`mailto:${perfil.email}?subject=Mais informações`} aria-label="E-mail">
          <Mail className="h-6" />
        </a>
      </li>
      <li>
        <a
          className="text-gray-400 hover:text-primary"
          href={`https://api.whatsapp.com/send?phone=55${tel}&text=${encodeURIComponent(`Olá, ${perfil.usuario}!`)}`}
          aria-label="WhatsApp"
        >
          <MessageCircle className="h-6" />
        </a>
      </li>
    </ul>
  );
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="bg-background">
        <div className="container relative flex items-center p-6 px-8">
          <div className="text-xl font-extrabold uppercase tracking-tight text-primary dark:text-white">{perfil.corretora}</div>
          <div className="ml-auto hidden sm:flex">{contatos}</div>
        </div>
      </header>
      <div className="container m-auto flex-1">
        <div className="p-4 lg:p-8">{children}</div>
      </div>
      <footer className="bg-slate-200/40 dark:bg-background">
        <div className="container grid grid-cols-1 gap-4 p-6 px-8 text-center sm:grid-cols-2 sm:text-left">
          <div className="grid gap-1 text-foreground/70">
            <div className="font-semibold uppercase">{perfil.corretora}</div>
            <p className="text-xs">
              Informativo referencial: valores e condições fictícios, gerados para estudo. Não constituem oferta.
            </p>
          </div>
          <div className="flex place-content-center items-center gap-4 sm:justify-end">
            <div className="sm:hidden">{contatos}</div>
            <ThemeSwitch />
          </div>
        </div>
      </footer>
    </div>
  );
}
