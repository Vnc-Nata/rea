"use client";

import { ArrowLeft, ChevronDown, EllipsisVertical, MoreVertical, Plus, PlusCircle, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  deleteCotacao,
  editTitulo,
  onPlanoRemove,
  onPlanoSelect,
  trackCotacao,
  updateCnpj,
  updateFiltro,
  updateGrupo,
} from "@/app/actions";
import type { Cotacao, FiltroCotacao, Hospital, Modalidade, Operadora, Plano, Segmento } from "@/lib/types";
import { FAIXAS, faixaDaIdade, faixaLabel } from "@/lib/types";
import { CIDADES } from "@/lib/seed";
import { cn, idade, numero, precoTotal, tempoRelativo, totalVidas, vidasPorFaixa } from "@/lib/utils";
import { OperadoraLogo } from "./brand";
import { Button, Drawer, Dropdown, DropdownItem, Input, Label, Modal, Select, ToggleGroup, buttonClass, useToast } from "./ui";

interface Props {
  cotacao: Cotacao;
  planos: Plano[];
  operadoras: Operadora[];
  hospitais: Hospital[];
  mensagemPadrao: string;
  drawer?: string;
}

export function CotacaoEditor({ cotacao, planos, operadoras, hospitais, mensagemPadrao, drawer }: Props) {
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();
  const abrir = (d?: string) => router.replace(d ? `${path}?d=${d}` : path, { scroll: false });
  const opMap = useMemo(() => Object.fromEntries(operadoras.map((o) => [o.id, o])), [operadoras]);
  const planoMap = useMemo(() => Object.fromEntries(planos.map((p) => [p.id, p])), [planos]);
  const cenarios = cotacao.cenarios.filter((c) => planoMap[c.planoId]);
  const vidas = totalVidas(cotacao.grupos);

  function linkProposta() {
    return `${window.location.origin}/cotacoes/${cotacao.id}`;
  }
  async function copiar() {
    await navigator.clipboard.writeText(`${mensagemPadrao}\n\n${linkProposta()}`);
    await trackCotacao(cotacao.id);
    toast("Copiado para a área de transferência.");
  }

  return (
    <>
      <div className="mb-12">
        <div className="flex gap-4">
          <Titulo cotacaoId={cotacao.id} value={cotacao.titulo} />
          <div className="-mr-2 ml-auto flex shrink-0 items-center gap-2">
            <button
              onClick={() => abrir("comparativo")}
              className={buttonClass({ variant: "reverse" }, "hidden sm:flex")}
              disabled={!cenarios.length}
            >
              Ver hospitais
            </button>
            <Dropdown
              trigger={
                <Button className="hidden px-3 sm:flex" disabled={!cenarios.length}>
                  <Share2 className="size-4" /> Enviar
                </Button>
              }
            >
              <DropdownItem onClick={copiar}>Copiar mensagem e link</DropdownItem>
              <DropdownItem
                onClick={async () => {
                  await trackCotacao(cotacao.id);
                  window.open(
                    `https://api.whatsapp.com/send?text=${encodeURIComponent(`${mensagemPadrao}\n\n${linkProposta()}`)}`,
                    "_blank",
                  );
                }}
              >
                Enviar por WhatsApp
              </DropdownItem>
              <Link href={`/cotacoes/${cotacao.id}?preview=1`} target="_blank">
                <DropdownItem>Abrir proposta do cliente</DropdownItem>
              </Link>
            </Dropdown>
            <Dropdown
              trigger={
                <Button variant="icon" aria-label="Mais opções">
                  <EllipsisVertical className="h-6" />
                </Button>
              }
            >
              <DropdownItem
                className="text-destructive"
                onClick={() => confirm("Tem certeza? A cotação será excluída.") && deleteCotacao(cotacao.id)}
              >
                <Trash2 className="mr-2 h-4" /> Excluir cotação
              </DropdownItem>
            </Dropdown>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-8 sm:flex-row">
        <div className="flex-1">
          <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,_minmax(210px,_max-content))] sm:justify-start">
            {cenarios.map((c) => {
              const plano = planoMap[c.planoId];
              return (
                <PlanoCard
                  key={c.id}
                  plano={plano}
                  op={opMap[plano.operadoraId]}
                  total={precoTotal(plano, cotacao.grupos)}
                  href={`/cotacoes/${cotacao.id}/cenarios/${c.id}?preview=1`}
                  onHospitais={() => abrir("comparativo")}
                  onRemove={() => onPlanoRemove(cotacao.id, c.id)}
                />
              );
            })}
            <button
              onClick={() => (vidas ? abrir("cenarios") : abrir("distribuicao"))}
              className="group grid min-h-[330px] w-full place-content-center border-4 border-dashed duration-300 animate-in fade-in-25 zoom-in-95 dark:border-background sm:w-[210px]"
            >
              <div className="grid gap-2 text-center text-muted-foreground/75">
                <PlusCircle className="m-auto h-8 opacity-50 transition-all duration-300 group-hover:scale-125" />
                <span className="text-sm">Adicionar Plano</span>
              </div>
            </button>
          </div>
        </div>

        <div className="w-full sm:w-64">
          <aside className="divide-y dark:divide-muted-foreground sm:-mt-4 [&>*]:py-4">
            <div className="grid gap-3 text-foreground/75">
              <button className="flex w-full items-center text-left" onClick={() => abrir("distribuicao")}>
                <Label className="flex-1">Distribuição</Label>
                <Plus className="w-4" />
              </button>
              <button className="flex w-full text-left hover:text-primary" onClick={() => abrir("distribuicao")}>
                <span className="flex-1 truncate">Geral</span>
                <span>{vidas} vidas</span>
              </button>
            </div>
            <div className="grid gap-3 text-foreground/75">
              <Label>CNPJ</Label>
              <input
                defaultValue={cotacao.cnpj}
                placeholder="Não informado"
                onBlur={(e) => updateCnpj(cotacao.id, e.target.value)}
                onChange={(e) => (e.target.value = mascaraCnpj(e.target.value))}
                className="m-0 h-auto w-full border-none bg-transparent p-0 text-base text-inherit placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <div className="grid gap-3 text-foreground/75">
              <Label>Contato</Label>
              <div>Nenhum</div>
            </div>
            <div className="grid gap-3 text-foreground/75">
              <Label>Negócio</Label>
              <div>Nenhum</div>
            </div>
            <Timeline cotacao={cotacao} />
          </aside>
        </div>
      </div>

      <DistribuicaoDialog
        open={drawer === "distribuicao"}
        onClose={() => abrir()}
        cotacao={cotacao}
        onSaved={() => {
          abrir(cenarios.length ? undefined : "cenarios");
        }}
      />
      <SeletorPlanos
        open={drawer === "cenarios"}
        onClose={() => abrir()}
        cotacao={cotacao}
        planos={planos}
        operadoras={operadoras}
      />
      <Comparativo
        open={drawer === "comparativo"}
        onClose={() => abrir()}
        planos={cenarios.map((c) => planoMap[c.planoId])}
        opMap={opMap}
        hospitais={hospitais}
      />
    </>
  );
}

function mascaraCnpj(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function Titulo({ cotacaoId, value }: { cotacaoId: string; value: string }) {
  const last = useRef(value);
  return (
    <textarea
      name="titulo"
      rows={1}
      maxLength={50}
      defaultValue={value}
      placeholder="Informe um título..."
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v && v !== last.current) {
          last.current = v;
          editTitulo(cotacaoId, v);
        }
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
      className="-mx-1 mr-auto w-full resize-none rounded-md bg-transparent px-1 py-2 text-2xl font-bold leading-7 hover:bg-secondary focus:outline-none sm:truncate sm:text-3xl sm:tracking-tight"
    />
  );
}

function PlanoCard({
  plano,
  op,
  total,
  href,
  onRemove,
  onHospitais,
}: {
  plano: Plano;
  op: Operadora;
  total: number;
  href: string;
  onRemove: () => void;
  onHospitais: () => void;
}) {
  return (
    <div className="group/card relative flex h-full flex-col gap-4 rounded border-2 border-background bg-background text-foreground/70 shadow-sm duration-300 animate-in fade-in-25 zoom-in-95 sm:w-[210px]">
      <div className="absolute right-1 top-2">
        <Dropdown
          trigger={
            <Button variant="icon" aria-label="Opções do plano">
              <MoreVertical className="size-5" />
            </Button>
          }
        >
          <DropdownItem className="text-destructive" onClick={onRemove}>
            Remover plano
          </DropdownItem>
        </Dropdown>
      </div>
      <div className="grid grid-cols-2 p-4 sm:h-full sm:grid-cols-1 sm:space-y-4">
        <div>
          <div className="-mt-2 mb-4 flex h-16 items-center sm:mt-0">
            <OperadoraLogo op={op} className="text-2xl" />
          </div>
          <ul className="flex-1 space-y-0 text-sm">
            <li className="flex items-center gap-1 font-medium text-foreground">
              <span className="truncate">{plano.nome}</span>
              <ChevronDown className="h-4 opacity-50" />
            </li>
            <li>
              {plano.segmento} {plano.modalidade}
            </li>
            <li>{plano.acomodacao === "Quarto Individual" ? "Apartamento" : "Enfermaria"}</li>
            <li>
              {plano.coparticipacao === "Com coparticipação"
                ? `Coparticipação ${plano.percentualCopart ?? ""}%`
                : "Sem coparticipação"}
            </li>
            {plano.rede.length > 0 && (
              <li className="hidden sm:block">
                <button onClick={onHospitais} className="flex items-center gap-1 transition-colors hover:text-primary">
                  <span className="text-primary">{plano.rede.length}</span> Hospitais
                </button>
              </li>
            )}
          </ul>
        </div>
        <div className="flex flex-col sm:gap-4">
          <div className="mt-auto flex items-end justify-end gap-1 sm:justify-normal">
            <span>R$</span>
            <span className="text-2xl font-semibold text-primary">{numero(total)}</span>
            <span className="text-xs">/mês</span>
          </div>
          <Link href={href} target="_blank" className={buttonClass({ variant: "outline" }, "w-32 sm:w-full")}>
            Ver detalhes
          </Link>
        </div>
      </div>
    </div>
  );
}

function Timeline({ cotacao }: { cotacao: Cotacao }) {
  return (
    <div className="pl-4">
      {[...cotacao.eventos].reverse().slice(0, 6).map((e, i) => (
        <div key={i} className="group relative pb-4 pl-2">
          <span className="absolute -left-[13px] top-1.5 size-2 rounded-full bg-primary ring-4 ring-slate-50 dark:ring-background" />
          <span className="absolute -left-[10px] top-4 h-full w-px bg-slate-300 group-last:hidden" />
          <div className="truncate text-sm">
            <span className="font-medium text-primary">{e.tipo}</span>{" "}
            <span className="text-muted-foreground">por {e.por}</span>
          </div>
          <time className="text-xs text-muted-foreground/75" dateTime={e.em} suppressHydrationWarning>
            {tempoRelativo(e.em)}
          </time>
        </div>
      ))}
    </div>
  );
}

function DistribuicaoDialog({
  open,
  onClose,
  cotacao,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  cotacao: Cotacao;
  onSaved: () => void;
}) {
  const [vidas, setVidas] = useState(() => vidasPorFaixa(cotacao.grupos));
  const [aba, setAba] = useState<"faixas" | "nascimentos">("faixas");
  const [datas, setDatas] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const total = FAIXAS.reduce((s, f) => s + vidas[f], 0);

  function converter() {
    const novas = { ...vidas };
    let n = 0;
    for (const linha of datas.split(/[\n,;]+/)) {
      const m = linha.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (!m) continue;
      const ano = m[3].length === 2 ? Number(m[3]) + (Number(m[3]) > 30 ? 1900 : 2000) : Number(m[3]);
      const iso = new Date(ano, Number(m[2]) - 1, Number(m[1])).toISOString();
      const anos = idade(iso);
      if (anos < 0) continue;
      novas[faixaDaIdade(anos)] += 1;
      n += 1;
    }
    setVidas(novas);
    setDatas("");
    setAba("faixas");
    toast(`${n} data(s) convertida(s).`);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Distribuição de vidas"
      description="Informe a quantidade de vidas por faixa etária ou utilize o conversor de datas de nascimento."
      className="max-w-xl"
    >
      <ToggleGroup
        options={["Por faixa etária", "Datas de nascimento"] as const}
        value={aba === "faixas" ? "Por faixa etária" : "Datas de nascimento"}
        onChange={(v) => setAba(v === "Por faixa etária" ? "faixas" : "nascimentos")}
      />
      {aba === "faixas" ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {FAIXAS.map((f) => (
            <label key={f} className="flex items-center justify-between gap-2 text-sm">
              <span>{faixaLabel(f)}</span>
              <Input
                type="number"
                min={0}
                className="h-9 w-20 text-right"
                value={vidas[f] || ""}
                placeholder="0"
                onChange={(e) => setVidas({ ...vidas, [f]: Math.max(0, Number(e.target.value) || 0) })}
              />
            </label>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={datas}
            onChange={(e) => setDatas(e.target.value)}
            rows={6}
            placeholder={"dd/mm/aaaa\n15/03/1988\n02/11/2015"}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            Cole uma lista completa para converter todas as datas de uma só vez.
          </p>
          <Button size="sm" className="ml-auto" onClick={converter}>
            Converter
          </Button>
        </div>
      )}
      <div className="flex items-center justify-between border-t pt-4">
        <span className="text-sm text-muted-foreground">{total} vidas</span>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await updateGrupo(cotacao.id, vidas);
              if (!r.success) return toast(r.error, true);
              onSaved();
            })
          }
        >
          Confirmar
        </Button>
      </div>
    </Modal>
  );
}

const FILTROS = {
  acomodacao: ["Quarto Coletivo", "Quarto Individual"],
  coparticipacao: ["Com coparticipação", "Sem coparticipação"],
  contratacao: ["Opcional", "Compulsória"],
} as const;

function SeletorPlanos({
  open,
  onClose,
  cotacao,
  planos,
  operadoras,
}: {
  open: boolean;
  onClose: () => void;
  cotacao: Cotacao;
  planos: Plano[];
  operadoras: Operadora[];
}) {
  const [filtro, setFiltro] = useState<FiltroCotacao>(cotacao.filtro);
  const [extra, setExtra] = useState<{ mei?: boolean; acomodacao?: string; coparticipacao?: string; contratacao?: string }>(
    {},
  );
  const [opSel, setOpSel] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const jaNaCotacao = new Set(cotacao.cenarios.map((c) => c.planoId));

  const filtrados = planos.filter(
    (p) =>
      p.segmento === filtro.segmento &&
      p.modalidade === filtro.modalidade &&
      p.cidades.includes(filtro.cidade) &&
      (!extra.mei || p.aceitaMei) &&
      (!extra.acomodacao || p.acomodacao === extra.acomodacao) &&
      (!extra.coparticipacao || p.coparticipacao === extra.coparticipacao) &&
      (!extra.contratacao || p.contratacao === extra.contratacao),
  );
  const ops = operadoras.filter((o) => filtrados.some((p) => p.operadoraId === o.id));
  const op = ops.find((o) => o.id === opSel);

  function set<K extends keyof FiltroCotacao>(k: K, v: FiltroCotacao[K]) {
    const f = { ...filtro, [k]: v };
    setFiltro(f);
    setOpSel(null);
    updateFiltro(cotacao.id, f);
  }
  const toggleExtra = (k: keyof typeof extra, v: string | boolean) =>
    setExtra((e) => ({ ...e, [k]: e[k] === v ? undefined : v }));

  return (
    <Drawer open={open} onClose={onClose}>
      <div className="mb-6 flex flex-col pr-6 sm:flex-row">
        <div className="mx-1">
          <h2 className="text-lg font-semibold">Quais planos deseja comparar?</h2>
          <p className="text-sm text-muted-foreground">
            Selecione os planos de acordo com a região e preferências do seu cliente.
          </p>
        </div>
      </div>
      <div className="relative overflow-y-auto pr-6">
        <div className="relative flex gap-12 pb-24">
          <div className="ml-1 hidden w-[230px] shrink-0 space-y-4 sm:block">
            <ToggleGroup options={["Saúde", "Dental"] as const} value={filtro.segmento} onChange={(v: Segmento) => set("segmento", v)} />
            <ToggleGroup
              options={["PF", "PME", "Adesão"] as const}
              value={filtro.modalidade}
              onChange={(v: Modalidade) => set("modalidade", v)}
            />
            <Select value={filtro.cidade} onChange={(e) => set("cidade", e.target.value)}>
              {CIDADES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            {filtro.modalidade === "PME" && (
              <FiltroLista titulo="MEI" itens={["Aceita MEI"]} ativo={extra.mei ? "Aceita MEI" : undefined} onClick={() => toggleExtra("mei", true)} />
            )}
            <FiltroLista titulo="Acomodação" itens={FILTROS.acomodacao} ativo={extra.acomodacao} onClick={(v) => toggleExtra("acomodacao", v)} />
            <FiltroLista
              titulo="Coparticipação"
              itens={FILTROS.coparticipacao}
              ativo={extra.coparticipacao}
              onClick={(v) => toggleExtra("coparticipacao", v)}
            />
            <FiltroLista titulo="Contratação" itens={FILTROS.contratacao} ativo={extra.contratacao} onClick={(v) => toggleExtra("contratacao", v)} />
          </div>

          <div className="flex-1">
            {!op ? (
              ops.length ? (
                <div className="grid grid-cols-[repeat(auto-fit,_minmax(124px,_max-content))] justify-center gap-4">
                  {ops.map((o) => {
                    const n = selecionados.filter((id) => planos.find((p) => p.id === id)?.operadoraId === o.id).length;
                    return (
                      <button key={o.id} onClick={() => setOpSel(o.id)} className="relative">
                        <div className="grid h-24 w-32 place-items-center rounded border p-4 duration-300 animate-in fade-in-25 hover:shadow-sm">
                          <OperadoraLogo op={o} className="text-lg leading-tight" />
                        </div>
                        {n > 0 && (
                          <span className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">
                            {n}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  Não conseguimos localizar nenhum plano disponível. Por favor, confira as opções de filtro e tente novamente.
                </p>
              )
            ) : (
              <div className="space-y-4">
                <button onClick={() => setOpSel(null)} className="flex items-center gap-2 text-sm text-primary">
                  <ArrowLeft className="h-4" /> Todas as operadoras
                </button>
                <OperadoraLogo op={op} className="text-3xl" />
                <div className="divide-y rounded border">
                  {filtrados
                    .filter((p) => p.operadoraId === op.id)
                    .map((p) => {
                      const ja = jaNaCotacao.has(p.id);
                      const sel = selecionados.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={cn("flex cursor-pointer items-center gap-4 p-4 hover:bg-muted/50", ja && "opacity-50")}
                        >
                          <input
                            type="checkbox"
                            disabled={ja}
                            checked={sel || ja}
                            onChange={() =>
                              setSelecionados((s) => (sel ? s.filter((x) => x !== p.id) : [...s, p.id]))
                            }
                            className="size-4 accent-[hsl(var(--primary))]"
                          />
                          <div className="flex-1">
                            <div className="font-medium">{p.nome}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.acomodacao} · {p.coparticipacao}
                              {p.percentualCopart ? ` ${p.percentualCopart}%` : ""} · {p.abrangencia} · {p.rede.length} hospitais
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs">R$ </span>
                            <span className="text-lg font-semibold text-primary">{numero(precoTotal(p, cotacao.grupos))}</span>
                            <div className="text-xs text-muted-foreground">{ja ? "já na cotação" : "/mês"}</div>
                          </div>
                        </label>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="absolute bottom-4 right-4 flex items-center gap-4">
        {selecionados.length > 0 && <span className="text-sm text-muted-foreground">{selecionados.length} selecionado(s)</span>}
        <Button
          disabled={!selecionados.length || pending}
          onClick={() =>
            start(async () => {
              await onPlanoSelect(cotacao.id, selecionados);
              setSelecionados([]);
              setOpSel(null);
              onClose();
            })
          }
        >
          Continuar
        </Button>
      </div>
    </Drawer>
  );
}

function FiltroLista({
  titulo,
  itens,
  ativo,
  onClick,
}: {
  titulo: string;
  itens: readonly string[];
  ativo?: string;
  onClick: (v: string) => void;
}) {
  return (
    <div className="px-2 animate-in fade-in-0">
      <div className="mb-2 text-sm font-medium">{titulo}</div>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {itens.map((i) => (
          <li key={i}>
            <button onClick={() => onClick(i)} className={cn("hover:text-foreground", ativo === i && "font-semibold text-primary")}>
              {i}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Comparativo({
  open,
  onClose,
  planos,
  opMap,
  hospitais,
}: {
  open: boolean;
  onClose: () => void;
  planos: Plano[];
  opMap: Record<string, Operadora>;
  hospitais: Hospital[];
}) {
  const [q, setQ] = useState("");
  const usados = hospitais.filter(
    (h) => planos.some((p) => p.rede.some((r) => r.hospitalId === h.id)) && h.nome.toLowerCase().includes(q.toLowerCase()),
  );
  const regioes = [...new Set(usados.map((h) => h.regiao))];
  return (
    <Modal open={open} onClose={onClose} className="max-h-[90vh] max-w-5xl grid-rows-[auto,1fr] overflow-hidden">
      <div className="flex items-center gap-4 pr-8">
        <button onClick={onClose} className="flex items-center gap-2 font-medium">
          <ArrowLeft className="h-4" /> Rede credenciada
        </button>
        <Input placeholder="Procurar..." value={q} onChange={(e) => setQ(e.target.value)} className="ml-auto h-9 w-48" />
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background">
            <tr>
              <th className="w-56" />
              {planos.map((p) => (
                <th key={p.id} className="p-4 text-center font-normal">
                  <OperadoraLogo op={opMap[p.operadoraId]} className="text-xl" />
                  <div className="mt-2 text-xs text-foreground">{p.nome}</div>
                  <div className="text-xs text-muted-foreground">{p.acomodacao === "Quarto Individual" ? "Quarto" : "Enfermaria"}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {regioes.map((r) => (
              <RegiaoRows key={r} regiao={r} hospitais={usados.filter((h) => h.regiao === r)} planos={planos} />
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-xs text-muted-foreground">
          H: internação · PS: pronto-socorro · PSA: pronto-socorro adulto · M: maternidade · ¹ atendimento com restrições.
        </p>
      </div>
    </Modal>
  );
}

function RegiaoRows({ regiao, hospitais, planos }: { regiao: string; hospitais: Hospital[]; planos: Plano[] }) {
  return (
    <>
      <tr>
        <td colSpan={planos.length + 1} className="pt-3 text-xs text-blue-600">
          📍 {regiao}
        </td>
      </tr>
      {hospitais.map((h) => (
        <tr key={h.id} className="border-b">
          <td className="px-4 py-2">
            <div>{h.nome}</div>
            <div className="text-xs text-muted-foreground">{h.bairro}</div>
          </td>
          {planos.map((p) => (
            <td key={p.id} className="bg-muted/60 px-4 py-2 text-center">
              {p.rede.find((x) => x.hospitalId === h.id)?.servicos ?? "-"}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

