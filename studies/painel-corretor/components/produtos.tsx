"use client";

import { ArrowLeft, ChevronDown, Printer, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Hospital, Modalidade, Operadora, Plano, Segmento } from "@/lib/types";
import { FAIXAS, faixaLabel } from "@/lib/types";
import { CIDADES } from "@/lib/seed";
import { cn, moeda } from "@/lib/utils";
import { OperadoraLogo } from "./brand";
import { Button, Input, Panel, Select, ToggleGroup } from "./ui";

export function ProdutosGrid({ operadoras, planos }: { operadoras: Operadora[]; planos: Plano[] }) {
  const [q, setQ] = useState("");
  const [segmento, setSegmento] = useState<Segmento>("Saúde");
  const [modalidade, setModalidade] = useState<Modalidade>("PME");
  const [cidade, setCidade] = useState("São Paulo - SP");
  const [acomodacao, setAcomodacao] = useState("");
  const [copart, setCopart] = useState("");
  const ok = (p: Plano) =>
    p.segmento === segmento &&
    p.modalidade === modalidade &&
    p.cidades.includes(cidade) &&
    (!acomodacao || p.acomodacao === acomodacao) &&
    (!copart || p.coparticipacao === copart) &&
    (!q || p.nome.toLowerCase().includes(q.toLowerCase()));
  const ops = operadoras.filter((o) => planos.some((p) => p.operadoraId === o.id && ok(p)));
  const qs = new URLSearchParams({ modalidade, segmento, cidade }).toString();
  const Lista = ({ titulo, itens, v, set }: { titulo: string; itens: string[]; v: string; set: (s: string) => void }) => (
    <div className="px-1">
      <div className="mb-2 text-sm font-medium">{titulo}</div>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {itens.map((i) => (
          <li key={i}>
            <button onClick={() => set(v === i ? "" : i)} className={cn("hover:text-foreground", v === i && "font-semibold text-primary")}>
              {i}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <Panel className="flex flex-col gap-8 p-6 sm:flex-row">
      <div className="space-y-4 sm:w-[230px]">
        <Input placeholder="Procurar um plano..." value={q} onChange={(e) => setQ(e.target.value)} />
        <ToggleGroup options={["Saúde", "Dental"] as const} value={segmento} onChange={setSegmento} />
        <ToggleGroup options={["PF", "PME", "Adesão"] as const} value={modalidade} onChange={setModalidade} />
        <Select value={cidade} onChange={(e) => setCidade(e.target.value)}>
          {CIDADES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Lista titulo="Acomodação" itens={["Quarto Coletivo", "Quarto Individual"]} v={acomodacao} set={setAcomodacao} />
        <Lista titulo="Coparticipação" itens={["Com coparticipação", "Sem coparticipação"]} v={copart} set={setCopart} />
      </div>
      <div className="flex-1">
        <div className="grid grid-cols-[repeat(auto-fill,_minmax(140px,_1fr))] gap-4">
          {ops.map((o) => (
            <Link
              key={o.id}
              href={`/produtos/${o.id}?${qs}`}
              className="grid h-24 place-items-center rounded border p-4 text-center duration-300 animate-in fade-in-25 hover:shadow-sm"
            >
              <OperadoraLogo op={o} className="text-lg leading-tight" />
            </Link>
          ))}
        </div>
        {!ops.length && <p className="text-center text-sm text-muted-foreground">Nenhum produto encontrado com esses filtros.</p>}
      </div>
    </Panel>
  );
}

export function ProdutoDetalhe({
  op,
  planos,
  hospitais,
  titulo,
}: {
  op: Operadora;
  planos: Plano[];
  hospitais: Hospital[];
  titulo: string;
}) {
  const [aba, setAba] = useState<"Preços" | "Rede credenciada" | "Mais informações">("Preços");
  const [aberto, setAberto] = useState<string | null>(null);
  const rede = hospitais.filter((h) => planos.some((p) => p.rede.some((r) => r.hospitalId === h.id)));
  return (
    <>
      <Link href="/produtos" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground print:hidden">
        <ArrowLeft className="h-4" /> Produtos
      </Link>
      <div className="mb-8 flex items-start">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{op.nome}</h1>
          <p className="text-sm text-muted-foreground">{titulo}</p>
        </div>
        <div className="ml-auto grid h-20 w-40 place-items-center rounded bg-background shadow-sm">
          <OperadoraLogo op={op} className="text-2xl" />
        </div>
      </div>
      <div className="mb-2 flex items-center gap-4 border-b print:hidden">
        {(["Preços", "Rede credenciada", "Mais informações"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setAba(t)}
            className={cn("py-2 text-sm font-medium", aba === t ? "border-b-2 border-indigo-500 text-indigo-600" : "text-foreground/70")}
          >
            {t}
          </button>
        ))}
        <Button variant="reverse" size="sm" className="ml-auto" onClick={() => window.print()}>
          <Printer className="h-4" /> Imprimir
        </Button>
      </div>
      <Panel className="divide-y p-4">
        {aba === "Preços" &&
          planos.map((p) => (
            <div key={p.id} className="py-3">
              <button className="flex w-full items-center text-left" onClick={() => setAberto(aberto === p.id ? null : p.id)}>
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {p.nome} | {p.acomodacao} | {p.abrangencia}
                  </div>
                  <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3" /> {p.modalidade === "PME" ? "2 a 29 vidas" : "1 vida ou mais"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Wallet className="h-3" />
                      {p.coparticipacao === "Com coparticipação" ? `Coparticipação ${p.percentualCopart}%` : "Sem coparticipação"}
                    </span>
                  </div>
                </div>
                <ChevronDown className={cn("h-4 transition-transform", aberto === p.id && "rotate-180")} />
              </button>
              {(
                <table className={cn("mt-3 w-full text-sm animate-in fade-in-0 print:table", aberto !== p.id && "hidden")}>
                  <tbody>
                    {FAIXAS.map((f) => (
                      <tr key={f} className="border-t">
                        <td className="py-1.5">{faixaLabel(f)}</td>
                        <td className="py-1.5 text-right">{moeda(p.precos[f])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        {aba === "Rede credenciada" &&
          rede.map((h) => (
            <div key={h.id} className="flex py-2 text-sm">
              <div>
                <div>{h.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {h.bairro} · {h.regiao}
                </div>
              </div>
              <div className="ml-auto text-xs text-muted-foreground">
                {planos.filter((p) => p.rede.some((r) => r.hospitalId === h.id)).length} de {planos.length} planos
              </div>
            </div>
          ))}
        {aba === "Mais informações" && (
          <div className="space-y-2 py-2 text-sm text-muted-foreground">
            <p>Razão social: {op.razaoSocial}</p>
            <p>Registro (fictício): {op.registroAns}</p>
            <p>IDSS: {op.idss.toFixed(4)} · Reajuste anual: {op.reajuste.toFixed(1)}%</p>
            <p>Carências, documentos e regras de contratação seriam exibidos aqui.</p>
          </div>
        )}
      </Panel>
    </>
  );
}
