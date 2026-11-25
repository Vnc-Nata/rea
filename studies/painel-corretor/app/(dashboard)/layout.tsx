import { NavProvider, Sidebar, TopNav } from "@/components/sidebar";
import { readDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { perfil } = readDb();
  return (
    <NavProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-x-hidden">
          <TopNav corretora={perfil.corretora} />
          <div className="container flex flex-1 flex-col p-4 sm:p-8">
            <main className="flex-1">{children}</main>
            <footer className="hidden pt-4 text-sm text-zinc-500 sm:block sm:pt-8">
              Copyright © {new Date().getFullYear()}. Projeto de estudo com dados fictícios, sem vínculo com serviços reais.
            </footer>
          </div>
        </div>
      </div>
    </NavProvider>
  );
}
