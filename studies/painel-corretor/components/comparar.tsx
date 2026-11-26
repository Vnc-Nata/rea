"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import {
  aplicarAjuste,
  atualizarValorPainel,
  buscarPlanosPorNome,
  criarComparacao,
  escolherPlanoComparacao,
  excluirComparacao,
  type PlanoBusca,
} from "@/app/actions";
import type { Faixa, Operadora, Plano } from "@/lib/types";
import { FAIXAS, vidasVazias } from "@/lib/types";
import { diferencaPct } from "@/lib/comparar";
import { cn, moeda, numero } from "@/lib/utils";
import { OperadoraLogo, OrigemPreco } from "./brand";
import { Button, Input, Label, Panel, Select, useToast } from "./ui";

export interface Linha {
  id: string;
  titulo: string;
  cidade: string;
  vidas: Record<Faixa, number>;
  valorPainel: number | null;
  plano: Plano | null;
  operadora: Operadora | null;
  nosso: number | null;
}

export interface SugestaoOp {
  operadora: Operadora;
  ajusteAtual: number;
  sugerido: number;
  casos: number;
}

const pct = (v: number) => `${v > 0 ? "+" : ""}${numero(v, 1)}%`;

function lerValor(s: string): number | null {
  const n = Number(s.trim().replace(/\./g, "").replace(",", "."));
  return s.trim() && Number.isFinite(n) && n > 0 ? n : null;
}

export function Comparar({
  linhas,
  sugestoes,
  cidades,
}: {
  linhas: Linha[];
  sugestoes: SugestaoOp[];
  cidades: string[];
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <>
      <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Comparar com o Painel</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Digite o total que o Painel mostra para o mesmo caso. A diferença indica quanto o nosso valor está acima (+) ou
        abaixo (−) do Painel.
      </p>
      <div className="grid gap-6">
        <div className="overflow-x-auto rounded-sm bg-background shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left text-muted-foreground">
                <th className="h-12 px-4 font-medium">Caso</th>
                <th className="h-12 px-4 font-medium">Operadora</th>
                <th className="h-12 px-4 text-right font-medium">Nosso valor</th>
                <th className="h-12 w-44 px-4 font-medium">Valor no Painel</th>
                <th className="h-12 px-4 text-right font-medium">Diferença</th>
                <th className="h-12 w-12" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <LinhaCaso key={l.id} l={l} />
              ))}
              {!linhas.length && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Nenhum caso. Adicione um abaixo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Panel className="p-4">
          <h2 className="mb-3 font-semibold">Ajuste sugerido por operadora</h2>
          {sugestoes.length ? (
            <ul className="grid gap-3">
              {sugestoes.map((s) => (
                <li
                  key={s.operadora.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2"
                  data-ajuste={s.operadora.id}
                >
                  <OperadoraLogo op={s.operadora} />
                  <span className="text-sm text-muted-foreground">
                    atual {pct(s.ajusteAtual)} · {s.casos} {s.casos === 1 ? "caso" : "casos"}
                  </span>
                  <span className="ml-auto text-sm font-medium">Sugerido {pct(s.sugerido)}</span>
                  <Button
                    size="sm"
                    disabled={pending || s.sugerido === s.ajusteAtual}
                    onClick={() =>
                      start(async () => {
                        const r = await aplicarAjuste(s.operadora.id, s.sugerido);
                        toast(r.success ? "Ajuste aplicado." : r.error, !r.success);
                      })
                    }
                  >
                    Aplicar ajuste
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Informe o valor do Painel em algum caso para ver a sugestão.
            </p>
          )}
        </Panel>

        <NovoCaso cidades={cidades} />
      </div>
    </>
  );
}

function LinhaCaso({ l }: { l: Linha }) {
  const toast = useToast();
  const [valor, setValor] = useState(l.valorPainel != null ? numero(l.valorPainel) : "");
  const [, start] = useTransition();
  const dif = l.nosso != null ? diferencaPct(l.nosso, l.valorPainel ?? undefined) : null;
  const salvar = () => {
    const n = lerValor(valor);
    if ((n ?? null) === l.valorPainel) return;
    start(async () => {
      await atualizarValorPainel(l.id, n);
    });
  };
  return (
    <tr className="border-b last:border-0" data-caso={l.id}>
      <td className="p-4 align-top">
        <div>{l.titulo}</div>
        {!l.plano && <EscolherPlano id={l.id} cidade={l.cidade} vidas={l.vidas} />}
      </td>
      <td className="p-4 align-top">{l.operadora ? <OperadoraLogo op={l.operadora} /> : "-"}</td>
      <td className="p-4 text-right align-top">
        {l.nosso != null ? (
          <div className="grid justify-items-end">
            <span className="font-medium">{moeda(l.nosso)}</span>
            {l.plano && <OrigemPreco plano={l.plano} />}
          </div>
        ) : (
          <span className="text-muted-foreground">{l.plano ? "sem preço" : "-"}</span>
        )}
      </td>
      <td className="p-4 align-top">
        <Input
          aria-label={`Valor no Painel: ${l.titulo}`}
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={salvar}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
      </td>
      <td
        className={cn(
          "p-4 text-right align-top font-medium",
          dif == null ? "text-muted-foreground" : dif > 0 ? "text-red-600" : "text-emerald-600",
        )}
        data-diferenca
      >
        {dif == null ? "-" : pct(dif)}
      </td>
      <td className="p-2 align-top">
        <Button
          variant="icon"
          aria-label="Excluir caso"
          onClick={() =>
            start(async () => {
              await excluirComparacao(l.id);
              toast("Caso excluído.");
            })
          }
        >
          <Trash2 className="h-4" />
        </Button>
      </td>
    </tr>
  );
}

function BuscaPlano({
  cidade,
  vidas,
  onEscolher,
}: {
  cidade: string;
  vidas: Record<Faixa, number>;
  onEscolher: (p: PlanoBusca) => void;
}) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<PlanoBusca[]>([]);
  return (
    <div className="grid gap-1">
      <Input
        placeholder="Buscar plano pelo nome"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          buscarPlanosPorNome(cidade, e.target.value, vidas).then(setRes);
        }}
      />
      {res.length > 0 && (
        <ul className="max-h-48 overflow-auto rounded-md border text-sm">
          {res.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  onEscolher(p);
                  setQ("");
                  setRes([]);
                }}
              >
                {p.operadora} · {p.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EscolherPlano({ id, cidade, vidas }: { id: string; cidade: string; vidas: Record<Faixa, number> }) {
  const toast = useToast();
  return (
    <div className="mt-2 grid max-w-sm gap-1">
      <span className="text-xs text-amber-600">Plano não encontrado no catálogo. Escolha um:</span>
      <BuscaPlano
        cidade={cidade}
        vidas={vidas}
        onEscolher={async (p) => {
          const r = await escolherPlanoComparacao(id, p.id);
          if (!r.success) toast(r.error, true);
        }}
      />
    </div>
  );
}

function NovoCaso({ cidades }: { cidades: string[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [cidade, setCidade] = useState(cidades.includes("São Paulo - SP") ? "São Paulo - SP" : (cidades[0] ?? ""));
  const [vidas, setVidas] = useState<Record<Faixa, number>>(vidasVazias());
  const [plano, setPlano] = useState<PlanoBusca | null>(null);
  const [painel, setPainel] = useState("");
  const criar = () =>
    start(async () => {
      if (!plano) return toast("Escolha um plano.", true);
      const r = await criarComparacao({ planoId: plano.id, cidade, vidas, valorPainel: lerValor(painel) ?? undefined });
      toast(r.success ? "Caso adicionado." : r.error, !r.success);
      if (r.success) {
        setPlano(null);
        setPainel("");
        setVidas(vidasVazias());
      }
    });
  return (
    <Panel className="grid gap-4 p-4">
      <h2 className="font-semibold">Novo caso</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1">
          <Label>Cidade</Label>
          <Select
            value={cidade}
            onChange={(e) => {
              setCidade(e.target.value);
              setPlano(null);
            }}
          >
            {cidades.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1">
          <Label>Valor no Painel (opcional)</Label>
          <Input inputMode="decimal" placeholder="R$ 0,00" value={painel} onChange={(e) => setPainel(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-1">
        <Label>Vidas por faixa etária</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {FAIXAS.map((f) => (
            <label key={f} className="grid gap-0.5 text-xs text-muted-foreground">
              {f.replace("-999", "+")}
              <Input
                type="number"
                min={0}
                value={vidas[f] || ""}
                onChange={(e) => {
                  setVidas({ ...vidas, [f]: Math.max(0, Math.floor(Number(e.target.value) || 0)) });
                  setPlano(null);
                }}
              />
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-1">
        <Label>Plano</Label>
        {plano ? (
          <div className="flex items-center gap-2 text-sm">
            <span>
              {plano.operadora} · {plano.nome}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPlano(null)}>
              Trocar
            </Button>
          </div>
        ) : (
          <BuscaPlano cidade={cidade} vidas={vidas} onEscolher={setPlano} />
        )}
        <span className="text-xs text-muted-foreground">
          Preencha as vidas antes: só aparecem planos com preço para as faixas informadas.
        </span>
      </div>
      <div>
        <Button onClick={criar} disabled={pending}>
          <Plus className="h-4" /> Adicionar caso
        </Button>
      </div>
    </Panel>
  );
}
