import { ProdutosGrid } from "@/components/produtos";
import { readDb } from "@/lib/db";

export default function Produtos() {
  const { operadoras, planos } = readDb();
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Produtos</h1>
      <ProdutosGrid operadoras={operadoras} planos={planos} />
    </>
  );
}
