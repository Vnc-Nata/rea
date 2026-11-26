import { Database } from "lucide-react";
import Link from "next/link";
import { AvisoBaseIlegivel } from "@/components/busca-ans-real";
import { estimativa, filtrarPlanos, lerBaseAnsSegura, opcoes, vcmPrincipal, type FiltroAns } from "@/lib/ans";
import { buttonClass } from "@/lib/button";
import { faixaLabel } from "@/lib/types";
import { FAIXAS } from "@/lib/types";
import { moeda } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LIMITE = 100;
type SP = Record<string, string | undefined>;

const campo =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function Sel({ name, value, label, opts }: { name: string; value?: string; label: string; opts: [string, string][] }) {
  return (
    <label className="grid gap-1 text-xs font-medium">
      {label}
      <select name={name} defaultValue={value ?? ""} className={campo}>
        <option value="">Todos</option>
        {opts.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

const dataBr = (iso?: string) => (iso ? iso.split("-").reverse().join("/") : "—");

export default async function BaseAnsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { base, ilegivel } = lerBaseAnsSegura();
  if (ilegivel) return <AvisoBaseIlegivel />;

  if (!base) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Database className="h-6 w-6" /> Base ANS
        </h1>
        <div className="rounded-sm bg-background p-6 shadow-sm">
          <p className="text-sm">A base ainda não foi importada. No terminal, dentro desta pasta, rode:</p>
          <pre className="mt-3 rounded bg-muted p-3 text-sm">npm run importar-ans -- --uf SP</pre>
          <p className="mt-3 text-sm text-muted-foreground">
            O script baixa os dados abertos da ANS das operadoras listadas em <code>data/ans/operadoras-alvo.json</code>{" "}
            e grava <code>data/ans/base.json</code>. Depois, recarregue esta página.
          </p>
        </div>
      </div>
    );
  }

  const f: FiltroAns = {
    q: sp.q,
    grupo: sp.grupo,
    contratacao: sp.contratacao,
    acomodacao: sp.acomodacao,
    copart: sp.copart,
    uf: sp.uf,
    municipio: sp.municipio,
    vcm: sp.vcm ?? (Object.keys(sp).length ? undefined : "1"),
  };
  const vidas = FAIXAS.map((_, i) => Math.max(0, Math.floor(Number(sp[`v${i}`]) || 0)));
  const totalVidas = vidas.reduce((a, b) => a + b, 0);
  const op = opcoes(base);

  const municipios =
    f.uf && base.ufsDetalhadas.includes(f.uf)
      ? [
          ...new Map(
            base.planos.flatMap((p) =>
              p.municipios.filter((m) => m.nome.endsWith(`/${f.uf}`)).map((m) => [m.codigo, m.nome]),
            ),
          ),
        ].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
      : [];

  const linhas = filtrarPlanos(base, f).map((p) => ({ p, total: totalVidas ? estimativa(p, vidas) : null }));
  if (totalVidas)
    linhas.sort((a, b) => (a.total ?? Infinity) - (b.total ?? Infinity) || a.p.nome.localeCompare(b.p.nome));
  else linhas.sort((a, b) => a.p.grupo.localeCompare(b.p.grupo) || a.p.nome.localeCompare(b.p.nome));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Database className="h-6 w-6" /> Base ANS
          </h1>
          <p className="text-sm text-muted-foreground">
            {base.operadoras.length} operadoras, {base.planos.length.toLocaleString("pt-BR")} planos ativos. Importada
            em {new Date(base.geradoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.
          </p>
        </div>
      </div>

      <div className="rounded-sm border-l-4 border-amber-500 bg-amber-500/10 p-3 text-sm">
        Os valores são o <b>VCM</b> (valor comercial da mensalidade) que a operadora declarou à ANS na nota técnica do
        plano, na data indicada. Servem como referência e para conferir tabelas; <b>não são o preço de venda atual</b>.
      </div>

      <form method="get" className="space-y-4 rounded-sm bg-background p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-xs font-medium">
            Nome ou código ANS
            <input name="q" defaultValue={sp.q} className={campo} placeholder="Ex.: S380, 463…" />
          </label>
          <Sel name="grupo" value={f.grupo} label="Operadora" opts={op.grupos.map((g) => [g, g])} />
          <Sel name="contratacao" value={f.contratacao} label="Contratação" opts={op.contratacoes.map((g) => [g, g])} />
          <Sel name="acomodacao" value={f.acomodacao} label="Acomodação" opts={op.acomodacoes.map((g) => [g, g])} />
          <Sel
            name="copart"
            value={f.copart}
            label="Coparticipação / franquia"
            opts={[
              ["com", "Com"],
              ["sem", "Sem"],
            ]}
          />
          <Sel name="uf" value={f.uf} label="UF de comercialização" opts={op.ufs.map((u) => [u, u])} />
          {municipios.length > 0 && <Sel name="municipio" value={f.municipio} label="Município" opts={municipios} />}
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="vcm" value="1" defaultChecked={f.vcm === "1"} /> Só planos com VCM
          </label>
        </div>

        <div>
          <div className="mb-1 text-xs font-medium">Vidas por faixa etária (para estimar o total)</div>
          <div className="grid grid-cols-5 gap-2 lg:grid-cols-10">
            {FAIXAS.map((fx, i) => (
              <label key={fx} className="grid gap-1 text-center text-[11px] text-muted-foreground">
                <span className="flex h-7 items-end justify-center leading-tight">{faixaLabel(fx)}</span>
                <input
                  type="number"
                  min={0}
                  name={`v${i}`}
                  defaultValue={vidas[i] || ""}
                  className={campo + " text-center"}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button type="submit" className={buttonClass({})}>
            Filtrar
          </button>
          <Link href="/base-ans" className={buttonClass({ variant: "outline" })}>
            Limpar
          </Link>
        </div>
      </form>

      <div className="text-sm text-muted-foreground">
        {linhas.length.toLocaleString("pt-BR")} planos
        {linhas.length > LIMITE && `, mostrando os ${LIMITE} primeiros`}
        {totalVidas > 0 && ` · ${totalVidas} vidas · ordenado pela estimativa`}
      </div>

      <div className="space-y-2">
        {linhas.slice(0, LIMITE).map(({ p, total }) => {
          const v = vcmPrincipal(p);
          return (
            <details key={p.id} className="group rounded-sm bg-background shadow-sm">
              <summary className="grid cursor-pointer list-none gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase text-primary dark:text-sky-300">{p.grupo}</div>
                  <div className="truncate font-semibold">{p.nome}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>Reg. {p.codigoAns}</span>
                    <span>{p.contratacao}</span>
                    <span>{p.segmentacaoGrupo}</span>
                    <span>Acomodação {p.acomodacao.toLowerCase()}</span>
                    <span>{p.fatorModerador === "Ausente" ? "Sem coparticipação" : p.fatorModerador}</span>
                    <span>{p.abrangencia}</span>
                    {p.ufs.length > 0 && <span>{p.ufs.length > 6 ? `${p.ufs.length} UFs` : p.ufs.join(", ")}</span>}
                  </div>
                </div>
                <div className="text-right">
                  {total != null ? (
                    <>
                      <div className="text-lg font-bold">{moeda(total)}</div>
                      <div className="text-xs text-muted-foreground">estimativa VCM / mês</div>
                    </>
                  ) : v ? (
                    <>
                      <div className="text-sm font-semibold">
                        {moeda(v.precos[0] ?? 0)} a {moeda(v.precos[9] ?? 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">VCM de {dataBr(p.vcm?.data)}</div>
                    </>
                  ) : (
                    <div className="text-xs text-muted-foreground">sem VCM publicado</div>
                  )}
                </div>
              </summary>
              <div className="border-t p-4 text-sm">
                {v ? (
                  <>
                    <div className="mb-2 text-xs text-muted-foreground">
                      Nota técnica {p.vcm!.nota} de {dataBr(p.vcm!.data)} · abrangência {v.abrangencia.toLowerCase()}
                      {Object.keys(p.vcm!.variantes).length > 1 &&
                        ` (outras: ${Object.keys(p.vcm!.variantes).slice(1).join(", ").toLowerCase()})`}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] text-right text-xs">
                        <thead className="text-muted-foreground">
                          <tr>
                            <th className="py-1 text-left font-medium">Faixa</th>
                            <th className="font-medium">VCM</th>
                            <th className="font-medium">Mínimo</th>
                            <th className="font-medium">Máximo</th>
                            {totalVidas > 0 && <th className="font-medium">Vidas</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {FAIXAS.map((fx, i) => (
                            <tr key={fx} className="border-t">
                              <td className="py-1 text-left">{faixaLabel(fx)}</td>
                              <td className="font-semibold">{v.precos[i] != null ? moeda(v.precos[i]!) : "—"}</td>
                              <td>{v.min[i] != null ? moeda(v.min[i]!) : "—"}</td>
                              <td>{v.max[i] != null ? moeda(v.max[i]!) : "—"}</td>
                              {totalVidas > 0 && <td>{vidas[i] || ""}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">A ANS não publica VCM por faixa para este plano.</p>
                )}
                <div className="mt-3 text-xs text-muted-foreground">
                  ID ANS {p.id} · registrado em {dataBr(p.dataRegistro)} · {p.segmentacao} · {p.obstetricia}
                  {p.municipios.length > 0 && ` · ${p.municipios.length} municípios nas UFs detalhadas`}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
