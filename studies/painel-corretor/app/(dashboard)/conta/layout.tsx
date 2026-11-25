import { ContaMenu } from "@/components/conta-menu";

export default function ContaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Configurações da Conta</h1>
      <div className="flex flex-col rounded-sm bg-background shadow-sm sm:flex-row">
        <ContaMenu />
        <div className="flex-1 border-l p-6">{children}</div>
      </div>
    </>
  );
}
