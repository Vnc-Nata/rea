"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Copy,
  EllipsisVertical,
  Mail,
  MessageCircle,
  MoreVertical,
  Plus,
  PlusCircle,
  Printer,
  Settings2,
  Share2,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  buscarPlanos,
  deleteCotacao,
  duplicateCotacao,
  editTitulo,
  linkContato,
  linkNegocio,
  onPlanoDestaque,
  onPlanoRemove,
  onPlanoSelect,
  trackCotacao,
  updateCnpj,
  updateFiltro,
  updateGrupo,
  updateOpcoes,
} from "@/app/actions";
import type { Selecao } from "@/lib/selecao";
import type { Cotacao, FiltroCotacao, Hospital, Modalidade, Operadora, Plano, Segmento } from "@/lib/types";
import { FAIXAS, OPCOES_PADRAO, faixaDaIdade, faixaLabel } from "@/lib/types";
import type { OpcoesEnvio } from "@/lib/types";
import { cn, idade, numero, precoDisponivel, precoTotal, tempoRelativo, totalVidas, vidasPorFaixa } from "@/lib/utils";
import { OperadoraIcone, OperadoraLogo, OrigemPreco } from "./brand";
import {
  Button,
  Drawer,
  Dropdown,
  DropdownItem,
  Input,
  Label,
  Modal,
  Select,
  ToggleGroup,
  buttonClass,
  useToast,
} from "./ui";

interface Props {
  cotacao: Cotacao;
  /** Só os planos dos cenários (o seletor busca os demais com buscarPlanos). */
  planos: Plano[];
  operadoras: Operadora[];
  hospitais: Hospital[];
  cidades: string[];
  fonte: "ans" | "ficticio";
  mensagemPadrao: string;
  drawer?: string;
}

export function CotacaoEditor({
  cotacao,
  planos,
  operadoras,
  hospitais,
  cidades,
  fonte,
  mensagemPadrao,
  drawer,
}: Props) {
  const router = useRouter();
  const path = usePathname();
  const abrir = (d?: string) => router.replace(d ? `${path}?d=${d}` : path, { scroll: false });
  const opMap = useMemo(() => Object.fromEntries(operadoras.map((o) => [o.id, o])), [operadoras]);
  const planoMap = useMemo(() => Object.fromEntries(planos.map((p) => [p.id, p])), [planos]);
  // Cenários cujo plano saiu do catálogo (ex.: cotação antiga com dados fictícios) viram "Plano indisponível".
  const cenarios = cotacao.cenarios.filter((c) => planoMap[c.planoId] && opMap[planoMap[c.planoId].operadoraId]);
  const vidas = totalVidas(cotacao.grupos);

  function imprimir() {
    window.open(`/cotacoes/${cotacao.id}?preview=1&print=1`, "_blank");
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
            <Button className="hidden px-3 sm:flex" disabled={!cenarios.length} onClick={() => abrir("share")}>
              <Share2 className="size-4" /> Enviar
            </Button>
            <Dropdown
              trigger={
                <Button variant="icon" aria-label="Mais opções">
                  <EllipsisVertical className="h-6" />
                </Button>
              }
            >
              <DropdownItem onClick={() => abrir("share")}>
                <Share2 className="mr-2 h-4" /> Compartilhar
              </DropdownItem>
              <DropdownItem onClick={imprimir}>
                <Printer className="mr-2 h-4" /> Imprimir
              </DropdownItem>
              <DropdownItem onClick={() => abrir("flags")}>
                <Settings2 className="mr-2 h-4" /> Opções
              </DropdownItem>
              <DropdownItem onClick={() => duplicateCotacao(cotacao.id)}>
                <Copy className="mr-2 h-4" /> Duplicar
              </DropdownItem>
              <DropdownItem
                className="text-destructive"
                onClick={() => confirm("Tem certeza? A cotação será excluída.") && deleteCotacao(cotacao.id)}
              >
                <Trash2 className="mr-2 h-4" /> Excluir
              </DropdownItem>
            </Dropdown>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-8 sm:flex-row">
        <div className="flex-1">
          <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,_minmax(210px,_max-content))] sm:justify-start">
            {cotacao.cenarios.map((c) => {
              const plano = planoMap[c.planoId];
              if (!plano || !opMap[plano.operadoraId])
                return <PlanoIndisponivel key={c.id} onRemove={() => onPlanoRemove(cotacao.id, c.id)} />;
              return (
                <PlanoCard
                  key={c.id}
                  plano={plano}
                  op={opMap[plano.operadoraId]}
                  total={precoDisponivel(plano, cotacao.grupos) ? precoTotal(plano, cotacao.grupos) : null}
                  href={`/cotacoes/${cotacao.id}/cenarios/${c.id}?preview=1`}
                  onHospitais={() => abrir("comparativo")}
                  onRemove={() => onPlanoRemove(cotacao.id, c.id)}
                  destaque={!!c.destaque}
                  onDestaque={() => onPlanoDestaque(cotacao.id, c.id)}
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
              <CampoLivre value={cotacao.contato} onSave={(v) => linkContato(cotacao.id, v)} />
            </div>
            <div className="grid gap-3 text-foreground/75">
              <Label>Negócio</Label>
              <CampoLivre value={cotacao.negocio} onSave={(v) => linkNegocio(cotacao.id, v)} />
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
        cidades={cidades}
        fonte={fonte}
      />
      <CompartilharDialog
        open={drawer === "share"}
        onClose={() => abrir()}
        cotacao={cotacao}
        mensagemPadrao={mensagemPadrao}
        onImprimir={imprimir}
      />
      <OpcoesDialog open={drawer === "flags"} onClose={() => abrir()} cotacao={cotacao} />
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
  destaque,
  onDestaque,
}: {
  plano: Plano;
  op: Operadora;
  /** null quando falta preço em alguma faixa com vidas. */
  total: number | null;
  href: string;
  onRemove: () => void;
  onHospitais: () => void;
  destaque: boolean;
  onDestaque: () => void;
}) {
  return (
    <div
      className={cn(
        "group/card relative flex h-full flex-col gap-4 rounded border-2 bg-background text-foreground/70 shadow-sm duration-300 animate-in fade-in-25 zoom-in-95 sm:w-[210px]",
        destaque ? "border-primary" : "border-background",
      )}
    >
      {destaque && (
        <span className="absolute -top-3 left-3 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
          <Star className="size-3" /> Recomendado
        </span>
      )}
      <div className="absolute right-1 top-2">
        <Dropdown
          trigger={
            <Button variant="icon" aria-label="Opções do plano">
              <MoreVertical className="size-5" />
            </Button>
          }
        >
          <DropdownItem onClick={onDestaque}>{destaque ? "Remover destaque" : "Destacar"}</DropdownItem>
          <DropdownItem className="text-destructive" onClick={onRemove}>
            Remover
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
            <li>{rotuloCopart(plano)}</li>
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
          {total == null ? (
            <div className="mt-auto text-sm text-muted-foreground">Preço indisponível para esta distribuição</div>
          ) : (
            <div className="mt-auto flex items-end justify-end gap-1 sm:justify-normal">
              <span>R$</span>
              <span className="text-2xl font-semibold text-primary">{numero(total)}</span>
              <span className="text-xs">/mês</span>
            </div>
          )}
          <OrigemPreco plano={plano} />
          <Link href={href} target="_blank" className={buttonClass({ variant: "outline" }, "w-32 sm:w-full")}>
            Ver detalhes
          </Link>
        </div>
      </div>
    </div>
  );
}

function rotuloCopart(p: Plano) {
  if (p.coparticipacao !== "Com coparticipação") return "Sem coparticipação";
  return p.percentualCopart != null ? `Coparticipação ${p.percentualCopart}%` : "Com coparticipação";
}

function PlanoIndisponivel({ onRemove }: { onRemove: () => void }) {
  return (
    <div className="flex min-h-[330px] flex-col items-center justify-center gap-3 rounded border-2 border-dashed bg-background p-4 text-center text-sm text-muted-foreground sm:w-[210px]">
      <AlertTriangle className="size-6 text-amber-500" />
      <div className="font-medium text-foreground">Plano indisponível</div>
      <p className="text-xs">Este plano não está mais no catálogo atual.</p>
      <Button variant="outline" size="sm" onClick={onRemove}>
        <Trash2 className="size-4" /> Remover
      </Button>
    </div>
  );
}

function Timeline({ cotacao }: { cotacao: Cotacao }) {
  return (
    <div className="pl-4">
      {[...cotacao.eventos]
        .reverse()
        .slice(0, 6)
        .map((e, i) => (
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
                onChange={(e) =>
                  setVidas({
                    ...vidas,
                    [f]: Math.max(0, Number(e.target.value) || 0),
                  })
                }
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

const PERFIS = ["Indiferente", "Econômico", "Intermediário", "Premium"] as const;
type Perfil = (typeof PERFIS)[number];

const FILTROS = {
  acomodacao: ["Quarto Coletivo", "Quarto Individual"],
  coparticipacao: ["Com coparticipação", "Sem coparticipação"],
  contratacao: ["Opcional", "Compulsória"],
} as const;

function SeletorPlanos({
  open,
  onClose,
  cotacao,
  cidades,
  fonte,
}: {
  open: boolean;
  onClose: () => void;
  cotacao: Cotacao;
  cidades: string[];
  fonte: "ans" | "ficticio";
}) {
  const [perfil, setPerfil] = useState<Perfil>("Indiferente");
  const [faixaValor, setFaixaValor] = useState<{ min?: number; max?: number }>({});
  const [hospPref, setHospPref] = useState<string[]>([]);
  const [filtro, setFiltro] = useState<FiltroCotacao>(cotacao.filtro);
  const [extra, setExtra] = useState<{
    mei?: boolean;
    acomodacao?: string;
    coparticipacao?: string;
    contratacao?: string;
  }>({});
  const [opSel, setOpSel] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [todas, setTodas] = useState(false);
  const [dados, setDados] = useState<Selecao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [pending, start] = useTransition();
  const jaNaCotacao = new Set(cotacao.cenarios.map((c) => c.planoId));
  // A ANS não publica tipo de contratação nem aceitação de MEI: esses filtros só existem nos dados fictícios.
  const filtrosFicticios = fonte === "ficticio";

  // Busca no servidor ao abrir e a cada mudança de segmento, modalidade, cidade ou distribuição de vidas.
  const gruposJson = JSON.stringify(cotacao.grupos);
  useEffect(() => {
    if (!open) return;
    let ativo = true;
    setCarregando(true);
    buscarPlanos(filtro, JSON.parse(gruposJson), { todas })
      .then((r) => ativo && setDados(r))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [open, filtro, gruposJson, todas]);

  const planos = dados?.planos ?? [];
  const operadoras = dados?.operadoras ?? [];
  const hospitais = dados?.hospitais ?? [];
  const base = planos.filter(
    (p) =>
      (!filtrosFicticios || !extra.mei || p.aceitaMei) &&
      (!extra.acomodacao || p.acomodacao === extra.acomodacao) &&
      (!extra.coparticipacao || p.coparticipacao === extra.coparticipacao) &&
      (!filtrosFicticios || !extra.contratacao || p.contratacao === extra.contratacao),
  );
  const totais = new Map(base.map((p) => [p.id, precoTotal(p, cotacao.grupos)]));
  // Perfil do cliente: divide os planos da região em terços pelo preço total.
  const ordenados = [...totais.values()].sort((a, b) => a - b);
  const corte1 = ordenados[Math.floor(ordenados.length / 3)] ?? 0;
  const corte2 = ordenados[Math.floor((ordenados.length * 2) / 3)] ?? 0;
  const perfilDe = (v: number): Perfil => (v < corte1 ? "Econômico" : v < corte2 ? "Intermediário" : "Premium");
  const hospDisponiveis = hospitais.filter((h) => base.some((p) => p.rede.some((r) => r.hospitalId === h.id)));
  const filtrados = base.filter((p) => {
    const v = totais.get(p.id)!;
    return (
      (perfil === "Indiferente" || perfilDe(v) === perfil) &&
      (faixaValor.min == null || v >= faixaValor.min) &&
      (faixaValor.max == null || v <= faixaValor.max) &&
      hospPref.every((h) => p.rede.some((r) => r.hospitalId === h))
    );
  });
  const ops = operadoras.filter((o) => filtrados.some((p) => p.operadoraId === o.id));
  const op = ops.find((o) => o.id === opSel);
  const operadoraDoPlano = new Map(planos.map((p) => [p.id, p.operadoraId]));

  function set<K extends keyof FiltroCotacao>(k: K, v: FiltroCotacao[K]) {
    const f = { ...filtro, [k]: v };
    setFiltro(f);
    setOpSel(null);
    // Planos e hospitais de outra região/modalidade não valem mais.
    setSelecionados([]);
    setHospPref([]);
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
            <ToggleGroup
              options={["Saúde", "Dental"] as const}
              value={filtro.segmento}
              onChange={(v: Segmento) => set("segmento", v)}
            />
            <ToggleGroup
              options={["PF", "PME", "Adesão"] as const}
              value={filtro.modalidade}
              onChange={(v: Modalidade) => set("modalidade", v)}
            />
            <SeletorCidade cidades={cidades} value={filtro.cidade} onChange={(c) => set("cidade", c)} />
            {filtrosFicticios && filtro.modalidade === "PME" && (
              <FiltroLista
                titulo="MEI"
                itens={["Aceita MEI"]}
                ativo={extra.mei ? "Aceita MEI" : undefined}
                onClick={() => toggleExtra("mei", true)}
              />
            )}
            <FiltroLista
              titulo="Acomodação"
              itens={FILTROS.acomodacao}
              ativo={extra.acomodacao}
              onClick={(v) => toggleExtra("acomodacao", v)}
            />
            <FiltroLista
              titulo="Coparticipação"
              itens={FILTROS.coparticipacao}
              ativo={extra.coparticipacao}
              onClick={(v) => toggleExtra("coparticipacao", v)}
            />
            {filtrosFicticios && (
              <FiltroLista
                titulo="Contratação"
                itens={FILTROS.contratacao}
                ativo={extra.contratacao}
                onClick={(v) => toggleExtra("contratacao", v)}
              />
            )}
            <FiltroLista
              titulo="Perfil do cliente"
              itens={PERFIS}
              ativo={perfil}
              onClick={(v) => setPerfil(v as Perfil)}
            />
            <div className="px-2">
              <div className="mb-2 text-sm font-medium">Faixa de valor</div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  placeholder="Mín."
                  className="h-8"
                  value={faixaValor.min ?? ""}
                  onChange={(e) =>
                    setFaixaValor({
                      ...faixaValor,
                      min: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="Máx."
                  className="h-8"
                  value={faixaValor.max ?? ""}
                  onChange={(e) =>
                    setFaixaValor({
                      ...faixaValor,
                      max: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </div>
            </div>
            <div className="px-2">
              <div className="mb-2 text-sm font-medium">Hospitais de preferência</div>
              <Select
                value=""
                onChange={(e) => e.target.value && setHospPref((h) => [...new Set([...h, e.target.value])])}
              >
                <option value="">Adicionar hospital...</option>
                {hospDisponiveis.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.nome}
                  </option>
                ))}
              </Select>
              <ul className="mt-2 space-y-1 text-sm">
                {hospPref.map((id) => (
                  <li key={id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{hospitais.find((h) => h.id === id)?.nome ?? id}</span>
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setHospPref((h) => h.filter((x) => x !== id))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <label className="flex items-center gap-2 px-2 text-sm">
              <input
                type="checkbox"
                checked={todas}
                onChange={(e) => {
                  setTodas(e.target.checked);
                  setOpSel(null);
                }}
                className="size-4 accent-[hsl(var(--primary))]"
              />
              Mostrar todas as operadoras
            </label>
            <div className="px-2">
              <AssistenteIA />
            </div>
          </div>

          <div className="flex-1">
            {carregando && !dados ? (
              <p className="text-center text-sm text-muted-foreground">Carregando…</p>
            ) : !op ? (
              ops.length ? (
                <div
                  className={cn(
                    "grid grid-cols-[repeat(auto-fit,_minmax(136px,_max-content))] justify-center gap-4",
                    carregando && "opacity-50",
                  )}
                  aria-busy={carregando}
                >
                  {ops.map((o) => {
                    const n = selecionados.filter((id) => operadoraDoPlano.get(id) === o.id).length;
                    const qtd = filtrados.filter((p) => p.operadoraId === o.id).length;
                    return (
                      <button key={o.id} onClick={() => setOpSel(o.id)} className="relative" data-operadora={o.id}>
                        <div className="flex h-28 w-36 flex-col items-center justify-center gap-2 rounded border p-3 text-center duration-300 animate-in fade-in-25 hover:shadow-sm">
                          <OperadoraIcone op={o} tamanho={40} />
                          <span className="line-clamp-2 text-xs font-semibold leading-tight" style={{ color: o.cor }}>
                            {o.nome}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {qtd} plano{qtd === 1 ? "" : "s"}
                          </span>
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
              ) : carregando ? (
                <p className="text-center text-sm text-muted-foreground">Carregando…</p>
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  Não conseguimos localizar nenhum plano disponível. Por favor, confira as opções de filtro e tente
                  novamente.
                </p>
              )
            ) : (
              <div className="space-y-4">
                <button onClick={() => setOpSel(null)} className="flex items-center gap-2 text-sm text-primary">
                  <ArrowLeft className="h-4" /> Todas as operadoras
                </button>
                <div className="flex items-center gap-4">
                  <OperadoraLogo op={op} tamanho={40} className="text-2xl" />
                  {op.idss != null && (
                    <span
                      className="ml-auto text-xs text-muted-foreground"
                      title="Índice de Desempenho da Saúde Suplementar (ANS)"
                    >
                      IDSS {numero(op.idss, 4)}
                    </span>
                  )}
                </div>
                <div className="divide-y rounded border">
                  {filtrados
                    .filter((p) => p.operadoraId === op.id)
                    .map((p) => {
                      const ja = jaNaCotacao.has(p.id);
                      const sel = selecionados.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-4 p-4 hover:bg-muted/50",
                            ja && "opacity-50",
                          )}
                        >
                          <input
                            type="checkbox"
                            disabled={ja}
                            checked={sel || ja}
                            onChange={() => setSelecionados((s) => (sel ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                            className="size-4 accent-[hsl(var(--primary))]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">{p.nome}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.acomodacao} · {rotuloCopart(p)} · {p.abrangencia} · {p.rede.length} hospitais
                              {op.idss != null ? ` · IDSS ${numero(op.idss, 4)}` : ""}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs">R$ </span>
                            <span className="text-lg font-semibold text-primary">{numero(totais.get(p.id)!)}</span>
                            <div className="text-xs text-muted-foreground">{ja ? "já na cotação" : "/mês"}</div>
                            <OrigemPreco plano={p} className="block" />
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
        {selecionados.length > 0 && (
          <span className="text-sm text-muted-foreground">{selecionados.length} selecionado(s)</span>
        )}
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

/** Cidade com busca (datalist): o catálogo ANS tem centenas de municípios. Só aceita rótulos da lista. */
function SeletorCidade({
  cidades,
  value,
  onChange,
}: {
  cidades: string[];
  value: string;
  onChange: (c: string) => void;
}) {
  const [texto, setTexto] = useState(value);
  useEffect(() => setTexto(value), [value]);
  const existe = (c: string) => cidades.includes(c);
  return (
    <div>
      <Input
        list="cidades-catalogo"
        aria-label="Cidade"
        value={texto}
        placeholder="Cidade..."
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          setTexto(e.target.value);
          if (existe(e.target.value) && e.target.value !== value) onChange(e.target.value);
        }}
        onBlur={() => !existe(texto) && setTexto(value)}
      />
      <datalist id="cidades-catalogo">
        {cidades.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
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
            <button
              onClick={() => onClick(i)}
              className={cn("hover:text-foreground", ativo === i && "font-semibold text-primary")}
            >
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
    (h) =>
      planos.some((p) => p.rede.some((r) => r.hospitalId === h.id)) && h.nome.toLowerCase().includes(q.toLowerCase()),
  );
  const regioes = [...new Set(usados.map((h) => h.regiao))];
  return (
    <Modal open={open} onClose={onClose} className="max-h-[90vh] max-w-5xl grid-rows-[auto,1fr] overflow-hidden">
      <div className="flex items-center gap-4 pr-8">
        <button onClick={onClose} className="flex items-center gap-2 font-medium">
          <ArrowLeft className="h-4" /> Rede credenciada
        </button>
        <Input
          placeholder="Procurar..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="ml-auto h-9 w-48"
        />
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
                  <div className="text-xs text-muted-foreground">
                    {p.acomodacao === "Quarto Individual" ? "Quarto" : "Enfermaria"}
                  </div>
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
          H: internação · PS: pronto-socorro · PSA: pronto-socorro adulto · M: maternidade · ¹ atendimento com
          restrições.
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

function CampoLivre({ value, onSave }: { value?: string; onSave: (v: string) => void }) {
  const last = useRef(value ?? "");
  return (
    <input
      defaultValue={value}
      placeholder="Nenhum"
      maxLength={80}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v !== last.current) {
          last.current = v;
          onSave(v);
        }
      }}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="m-0 h-auto w-full border-none bg-transparent p-0 text-base text-inherit placeholder:text-muted-foreground focus:outline-none"
    />
  );
}

function CompartilharDialog({
  open,
  onClose,
  cotacao,
  mensagemPadrao,
  onImprimir,
}: {
  open: boolean;
  onClose: () => void;
  cotacao: Cotacao;
  mensagemPadrao: string;
  onImprimir: () => void;
}) {
  const toast = useToast();
  const [link, setLink] = useState("");
  useEffect(() => setLink(`${window.location.origin}/cotacoes/${cotacao.id}`), [cotacao.id]);
  const texto = `${mensagemPadrao}\n\n${link}`;
  const Opcao = ({ icon, titulo, onClick }: { icon: React.ReactNode; titulo: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded border p-4 text-sm transition-colors hover:bg-secondary"
    >
      {icon}
      {titulo}
    </button>
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Compartilhar"
      description="Envie a proposta para o seu cliente."
      className="max-w-md"
    >
      <div className="grid grid-cols-3 gap-3">
        <Opcao
          icon={<MessageCircle className="size-6 text-green-600" />}
          titulo="WhatsApp"
          onClick={async () => {
            await trackCotacao(cotacao.id);
            window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, "_blank");
          }}
        />
        <Opcao
          icon={<Mail className="size-6 text-primary" />}
          titulo="E-mail"
          onClick={async () => {
            await trackCotacao(cotacao.id);
            window.location.href = `mailto:?subject=${encodeURIComponent(cotacao.titulo)}&body=${encodeURIComponent(texto)}`;
          }}
        />
        <Opcao icon={<Printer className="size-6" />} titulo="Imprimir" onClick={onImprimir} />
      </div>
      <div className="flex gap-2">
        <Input readOnly value={link} className="h-9 flex-1" onFocus={(e) => e.currentTarget.select()} />
        <Button
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(texto);
            await trackCotacao(cotacao.id);
            toast("Copiado para a área de transferência.");
          }}
        >
          <Copy className="size-4" /> Copiar
        </Button>
      </div>
      <Link href={`/cotacoes/${cotacao.id}?preview=1`} target="_blank" className="text-sm text-primary">
        Abrir proposta do cliente
      </Link>
    </Modal>
  );
}

function OpcoesDialog({ open, onClose, cotacao }: { open: boolean; onClose: () => void; cotacao: Cotacao }) {
  const [o, setO] = useState<OpcoesEnvio>(cotacao.opcoes ?? OPCOES_PADRAO);
  const [pending, start] = useTransition();
  const Switch = ({ k, titulo, texto }: { k: "valores" | "rede" | "maisInfo"; titulo: string; texto: string }) => (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <div>
        <div className="text-sm font-medium">{titulo}</div>
        <div className="text-xs text-muted-foreground">{texto}</div>
      </div>
      <input
        type="checkbox"
        role="switch"
        checked={o[k]}
        onChange={(e) => setO({ ...o, [k]: e.target.checked })}
        className="size-5 accent-[hsl(var(--primary))]"
      />
    </label>
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Opções"
      description="Defina o que o cliente verá na proposta."
      className="max-w-md"
    >
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Validade</span>
        <Input
          type="date"
          value={o.validade ?? ""}
          onChange={(e) => setO({ ...o, validade: e.target.value || undefined })}
        />
      </label>
      <div className="divide-y">
        <Switch k="valores" titulo="Valores" texto="Exibir mensalidades e valor por faixa etária." />
        <Switch k="rede" titulo="Rede Credenciada" texto="Exibir hospitais e laboratórios da rede." />
        <Switch
          k="maisInfo"
          titulo="Mais informações"
          texto="Exibir acomodação, coparticipação, abrangência e contratação."
        />
      </div>
      <Button
        size="sm"
        className="ml-auto"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await updateOpcoes(cotacao.id, o);
            onClose();
          })
        }
      >
        Confirmar
      </Button>
    </Modal>
  );
}

function AssistenteIA() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={buttonClass({ variant: "outline" }, "w-full")}>
        <Sparkles className="size-4" /> Assistente IA
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Assistente IA">
        <p className="text-sm text-muted-foreground">
          O assistente vai sugerir planos a partir de uma descrição do cliente. Ele ainda não está ligado a um modelo;
          por enquanto, use os filtros de perfil, faixa de valor e hospitais ao lado.
        </p>
      </Modal>
    </>
  );
}
