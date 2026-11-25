import { readDb } from "@/lib/db";

export default function Home() {
  const { perfil } = readDb();
  return (
    <div className="grid gap-2 rounded-sm bg-background p-4 shadow-sm">
      <h1 className="text-2xl font-bold text-foreground/80">Olá, {perfil.corretora}</h1>
      <h2 className="text-sm font-bold text-foreground/40">Seja bem vindo ao seu painel de multicálculo!</h2>
    </div>
  );
}
