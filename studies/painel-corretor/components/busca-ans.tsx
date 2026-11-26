"use client";

import { ArrowLeft, ArrowRight, Filter, Search, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Hospital, Modalidade, Operadora, Plano } from "@/lib/types";
import { FAIXAS, faixaLabel } from "@/lib/types";
import { cn, moeda } from "@/lib/utils";
import { Input, Panel, Select, ToggleGroup } from "./ui";

export function AnsHeader() {
  return (
    <div className="mb-6 flex items-start">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Busca ANS</h1>
        <p className="text-sm text-muted-foreground">Consulta de operadoras e planos (base fictícia para estudo)</p>
      </div>
      <div className="ml-auto rounded-md bg-teal-600 px-3 py-1 text-lg font-black italic text-white">ANS</div>
    </div>
  );
}

export function BuscaAnsLista({
  operadoras,
  planos,
  cidades,
}: {
  operadoras: Operadora[];
  planos: Plano[];
  cidades: string[];
}) {
  const [q, setQ] = useState("");
  const [modalidade, setModalidade] = useState<Modalidade>("PME");
  const [cidade, setCidade] = useState("São Paulo - SP");
  const [acomodacao, setAcomodacao] = useState("");
  const lista = operadoras.filter(
    (o) =>
      (o.nome.toLowerCase().includes(q.toLowerCase()) || o.registroAns.includes(q)) &&
      planos.some(
        (p) =>
          p.operadoraId === o.id &&
          p.modalidade === modalidade &&
          p.cidades.includes(cidade) &&
          (!acomodacao || p.acomodacao === acomodacao),
      ),
  );
  return (
    <Panel className="flex flex-col gap-8 p-6 sm:flex-row">
      <div className="space-y-4 sm:w-[230px]">
        <div className="flex items-center gap-2 font-medium">
          <Filter className="h-4" /> Filtros
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 text-muted-foreground" />
          <Input placeholder="Nome ou código ANS..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ToggleGroup options={["PF", "PME", "Adesão"] as const} value={modalidade} onChange={setModalidade} />
        <Select value={cidade} onChange={(e) => setCidade(e.target.value)}>
          {cidades.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select value={acomodacao} onChange={(e) => setAcomodacao(e.target.value)}>
          <option value="">Qualquer acomodação...</option>
          <option>Quarto Coletivo</option>
          <option>Quarto Individual</option>
        </Select>
      </div>
      <div className="flex-1 space-y-3">
        <div className="flex justify-end">
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
            {lista.length} operadoras encontradas
          </span>
        </div>
        {lista.map((o) => (
          <Link
            key={o.id}
            href={`/busca-ans/${o.registroAns}?modalidade=${encodeURIComponent(modalidade)}`}
            className="flex items-center gap-4 rounded-md border p-4 transition-shadow hover:shadow-sm"
          >
            <span className="rounded bg-blue-50 px-2 py-1 font-mono text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-200">
              {o.registroAns}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium uppercase">{o.nome}</div>
              <div className="truncate text-xs text-muted-foreground">{o.razaoSocial}</div>
            </div>
            <span className="text-sm font-medium text-primary">Ver Planos</span>
          </Link>
        ))}
        {!lista.length && (
          <p className="p-8 text-center text-sm text-muted-foreground">Não encontramos planos que correspondam aos critérios de busca.</p>
        )}
      </div>
    </Panel>
  );
}

export function BuscaAnsDetalhe({ op, planos, hospitais }: { op: Operadora; planos: Plano[]; hospitais: Hospital[] }) {
  const [planoId, setPlanoId] = useState(planos[0]?.id);
  const [aba, setAba] = useState<"Preços" | "Abrangência" | "Rede Credenciada">("Preços");
  const plano = planos.find((p) => p.id === planoId) ?? planos[0];
  const diff = (op.reajuste ?? 0) - (op.reajusteAnterior ?? 0);
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="space-y-4 sm:w-[300px]">
        <Panel className="space-y-4 p-4">
          <Link href="/busca-ans" className="flex items-center gap-2 font-medium">
            <ArrowLeft className="h-4" /> {op.nome}
          </Link>
          <p className="text-xs text-muted-foreground">Registro ANS: {op.registroAns}</p>
          <Select value={plano?.id} onChange={(e) => setPlanoId(e.target.value)}>
            {planos.map((p) => (
              <option key={p.id} value={p.id}>
                {op.nome} {p.nome} [{p.modalidade}]
              </option>
            ))}
          </Select>
        </Panel>
        <Panel className="space-y-3 p-4">
          <div className="font-medium">IDSS</div>
          <p className="truncate text-xs text-muted-foreground">Índice de Desempenho da Saúde Suplementar</p>
          <div className="text-2xl font-bold text-primary">{op.idss != null ? op.idss.toFixed(4) : "—"}</div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-yellow-400" style={{ width: `${(op.idss ?? 0) * 100}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            Clique para ver detalhes <ArrowRight className="h-4" />
          </div>
        </Panel>
        <Panel className="space-y-3 p-4">
          <div className="font-medium">Reajuste Anual</div>
          <div className="flex items-end">
            <div>
              <div className="text-2xl font-bold text-primary">
                {op.reajuste != null ? `${op.reajuste.toFixed(1)}%` : "—"}
              </div>
              <div className="text-xs text-muted-foreground">Índice atual</div>
            </div>
            <div className={cn("ml-auto text-right text-xs", diff <= 0 ? "text-emerald-600" : "text-red-600")}>
              <div className="flex items-center gap-1">
                {diff <= 0 ? <TrendingDown className="h-4" /> : <TrendingUp className="h-4" />}
                {Math.abs(diff).toFixed(1)}%
              </div>
              <div className="text-muted-foreground">vs ano anterior</div>
            </div>
          </div>
        </Panel>
      </div>
      {plano && (
        <Panel className="flex-1 p-6">
          <div className="flex items-start gap-4">
            <div>
              <h2 className="text-xl font-semibold">
                {op.nome} {plano.nome}
              </h2>
              <p className="text-sm text-muted-foreground">{op.razaoSocial}</p>
            </div>
            <span className="ml-auto bg-black px-1.5 py-0.5 text-sm font-bold text-white">ANS nº {plano.registroAns}</span>
          </div>
          <div className="mt-6 flex gap-2 border-b">
            {(["Preços", "Abrangência", "Rede Credenciada"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setAba(t)}
                className={cn("px-4 py-2 text-sm font-medium", aba === t ? "border-b-2 border-primary text-primary" : "text-foreground/60")}
              >
                {t}
              </button>
            ))}
          </div>
          {aba === "Preços" && (
            <>
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="p-2 text-left font-medium">Faixa Etária</th>
                    <th className="p-2 text-center font-medium">Mensalidade</th>
                    <th className="p-2 text-center font-medium">Valor Máximo</th>
                  </tr>
                </thead>
                <tbody>
                  {FAIXAS.map((f) => (
                    <tr key={f} className="border-t">
                      <td className="p-2">{faixaLabel(f)}</td>
                      <td className="p-2 text-center">{plano.precos[f] != null ? moeda(plano.precos[f]!) : "—"}</td>
                      <td className="p-2 text-center">
                        {plano.precos[f] != null ? moeda(plano.precos[f]! * 1.3) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 rounded-md bg-blue-50 p-4 text-xs text-foreground/80 dark:bg-blue-950">
                <strong className="text-primary">Nota:</strong> valores fictícios, gerados apenas para estudo do layout.
              </p>
            </>
          )}
          {aba === "Abrangência" && (
            <div className="mt-4 space-y-2 text-sm">
              <p>
                Abrangência <strong>{plano.abrangencia.toLowerCase()}</strong>. Comercializado em:
              </p>
              <ul className="list-inside list-disc text-muted-foreground">
                {plano.cidades.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {aba === "Rede Credenciada" && (
            <ul className="mt-4 divide-y text-sm">
              {plano.rede.map((r) => {
                const h = hospitais.find((x) => x.id === r.hospitalId)!;
                return (
                  <li key={r.hospitalId} className="flex py-2">
                    <div>
                      <div>{h.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {h.bairro} · {h.regiao}
                      </div>
                    </div>
                    <span className="ml-auto text-muted-foreground">{r.servicos}</span>
                  </li>
                );
              })}
              {!plano.rede.length && <li className="py-2 text-muted-foreground">Não se aplica.</li>}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}
