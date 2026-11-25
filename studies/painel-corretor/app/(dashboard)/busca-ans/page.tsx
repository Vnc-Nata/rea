import { AnsHeader, BuscaAnsLista } from "@/components/busca-ans";
import { readDb } from "@/lib/db";

export default function BuscaAns() {
  const { operadoras, planos } = readDb();
  return (
    <>
      <AnsHeader />
      <BuscaAnsLista operadoras={operadoras} planos={planos} />
    </>
  );
}
