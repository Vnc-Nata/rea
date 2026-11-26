import { ArrowLeft, MessageCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OperadoraLogo, OrigemPreco } from "@/components/brand";
import {
  Comentario,
  CoparticipacaoDetalhes,
  PlanoIndisponivel,
  RedeCards,
  RegistrarVisualizacao,
} from "@/components/proposta";
import { buttonClass } from "@/lib/button";
import { catalogo, operadoraPorId, planoPorId } from "@/lib/catalogo";
import { readDb } from "@/lib/db";
import { FAIXAS, OPCOES_PADRAO, faixaLabel } from "@/lib/types";
import { numero, precoTotal, vidasPorFaixa } from "@/lib/utils";

export default async function Cenario({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; cenarioId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { id, cenarioId } = await params;
  const { preview } = await searchParams;
  const db = readDb();
  const c = db.cotacoes.find((x) => x.id === id);
  const cen = c?.cenarios.find((x) => x.id === cenarioId);
  if (!c || !cen) notFound();
  const plano = planoPorId(cen.planoId);
  const op = plano && operadoraPorId(plano.operadoraId);
  if (!plano || !op)
    return (
      <div className="mx-auto max-w-sm space-y-4">
        <Link
          href={`/cotacoes/${c.id}${preview ? "?preview=1" : ""}`}
          className="flex items-center gap-1 text-sm text-primary"
        >
          <ArrowLeft className="h-4" /> voltar
        </Link>
        <PlanoIndisponivel cotacaoId={c.id} cenarioId={cen.id} removivel={!!preview} />
      </div>
    );
  const hospIds = new Set(plano.rede.map((r) => r.hospitalId));
  const hospitais = catalogo().hospitais.filter((h) => hospIds.has(h.id));
  const ficticio = plano.origemPreco === "ficticio";
  const vidas = vidasPorFaixa(c.grupos);
  const o = c.opcoes ?? OPCOES_PADRAO;
  const tel = db.perfil.telefone.replace(/\D/g, "");
  const msg = `Olá, ${db.perfil.usuario}!\nTenho interesse neste plano de saúde. Pode me ajudar?\n\n${plano.nome} (${op.nome})`;

  const detalhes = (
    <dl className="grid divide-y divide-border lg:grid-cols-2 lg:divide-y-0">
      <div className="border-border px-8 py-6 sm:border-t">
        <dt className="text-sm font-medium leading-6">
          {plano.acomodacao === "Quarto Individual"
            ? "Quarto individual (apartamento)"
            : "Quarto coletivo (enfermaria)"}
        </dt>
        <dd className="mt-1 text-sm leading-6 text-gray-500">
          {plano.acomodacao === "Quarto Individual"
            ? "Em caso de internação, o paciente fica em um quarto particular e com a possibilidade de ter um acompanhante."
            : "Em caso de internação, o paciente divide o quarto com outros pacientes."}
        </dd>
      </div>
      <div className="border-border px-8 py-6 sm:border-t">
        <dt className="text-sm font-medium leading-6">
          {plano.coparticipacao !== "Com coparticipação"
            ? "Sem coparticipação"
            : plano.percentualCopart != null
              ? `Coparticipação ${plano.percentualCopart}%`
              : "Com coparticipação"}
        </dt>
        <dd className="mt-1 text-sm leading-6 text-gray-500">
          {plano.coparticipacao === "Com coparticipação" ? (
            <>
              Plano com mensalidades mais baratas, em que é preciso pagar uma parte das despesas ao realizar consultas,
              exames, procedimentos e internações. <CoparticipacaoDetalhes />
            </>
          ) : (
            "Não há cobrança adicional ao utilizar consultas, exames e procedimentos."
          )}
        </dd>
      </div>
      <div className="border-border px-8 py-6 sm:border-t">
        <dt className="text-sm font-medium leading-6">Abrangência {plano.abrangencia.toLowerCase()}</dt>
        <dd className="mt-1 text-sm leading-6 text-gray-500">
          Registro do produto{ficticio ? " (fictício)" : " na ANS"}: {plano.registroAns}
        </dd>
      </div>
      {ficticio && (
        <div className="border-border px-8 py-6 sm:border-t">
          <dt className="text-sm font-medium leading-6">Contratação {plano.contratacao.toLowerCase()}</dt>
          <dd className="mt-1 text-sm leading-6 text-gray-500">
            {plano.contratacao === "Compulsória"
              ? "Todos os funcionários elegíveis entram no plano."
              : "A adesão ao plano é opcional para os elegíveis."}
          </dd>
        </div>
      )}
    </dl>
  );

  return (
    <>
      <RegistrarVisualizacao cotacaoId={c.id} preview={!!preview} />
      <div className="flex w-full flex-col gap-4 md:flex-row">
        <div className="rounded-sm bg-background text-center shadow-sm sm:text-left md:flex-1">
          <div className="flex flex-col-reverse gap-2 p-8 pb-4 sm:flex-row">
            <div>
              <h1 className="text-xl font-semibold">Plano {plano.nome}</h1>
              <p className="text-sm text-gray-500">
                {op.nome} {plano.segmento} {plano.modalidade}
              </p>
              <Link
                href={`/cotacoes/${c.id}${preview ? "?preview=1" : ""}`}
                className="mt-3 hidden items-center gap-1 text-sm text-primary md:flex"
              >
                <ArrowLeft className="h-4" /> voltar
              </Link>
            </div>
            <div className="m-auto flex h-16 items-center sm:m-0 sm:ml-auto">
              <OperadoraLogo op={op} className="text-4xl" />
            </div>
          </div>
          {o.maisInfo && <div className="hidden sm:grid">{detalhes}</div>}
        </div>

        <div className="sticky top-6 flex w-full flex-col gap-4 self-start md:w-96">
          <div className="rounded-sm bg-background p-6 shadow-sm">
            <h2 className="truncate text-base font-semibold">Plano {plano.nome}</h2>
            <Comentario cotacaoId={c.id} cenarioId={cen.id} value={cen.comentario} editavel={!!preview} />
            {o.valores && (
              <>
                <div className="mb-6 mt-2 divide-y divide-border">
                  {FAIXAS.filter((f) => vidas[f] > 0).map((f) => (
                    <dl key={f} className="flex py-2 text-sm">
                      <dt>{faixaLabel(f)}</dt>
                      <dd className="ml-auto">
                        <span className="text-foreground/50">{vidas[f]} x </span>
                        {plano.precos[f] != null ? `R$ ${numero(plano.precos[f]!)}` : "—"}
                      </dd>
                    </dl>
                  ))}
                  {plano.iof ? (
                    <dl className="flex py-2 text-sm">
                      <dt>IOF</dt>
                      <dd className="ml-auto">{numero(plano.iof * 100)}%</dd>
                    </dl>
                  ) : null}
                </div>
                <div className="mb-4 flex items-end justify-end gap-1">
                  <span>R$</span>
                  <span className="text-2xl font-semibold text-primary">{numero(precoTotal(plano, c.grupos))}</span>
                  <span className="text-xs">/mês</span>
                </div>
                <OrigemPreco plano={plano} className="-mt-3 mb-4 block text-right" />
              </>
            )}
            <a
              href={`https://api.whatsapp.com/send?phone=55${tel}&text=${encodeURIComponent(msg)}`}
              target="_blank"
              className={buttonClass({ variant: "whatsapp" })}
            >
              <MessageCircle className="h-5" /> Tenho interesse
            </a>
            <p className="mt-1 text-xs">Não há cobrança de taxa.</p>
          </div>
          {o.rede && <RedeCards plano={plano} op={op} hospitais={hospitais} />}
          {o.maisInfo && <div className="block rounded-sm bg-background shadow-sm sm:hidden">{detalhes}</div>}
        </div>
      </div>
    </>
  );
}
