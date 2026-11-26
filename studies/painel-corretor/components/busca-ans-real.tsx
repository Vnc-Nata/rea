import { ArrowLeft, Filter } from "lucide-react";
import Link from "next/link";
import { filtrarPlanos, opcoes, type BaseAns, type FiltroAns, type IndicadoresAns, type RedeAns } from "@/lib/ans";
import { rotuloMunicipio } from "@/lib/municipios";
import { buttonClass } from "@/lib/button";
import { cn, moeda } from "@/lib/utils";

// Busca ANS alimentada pela base oficial importada (data/ans/base.json).
// Formulários GET: os filtros ficam na URL e a página é renderizada no servidor.

type SP = Record<string, string | undefined>;

const campo =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

// Modalidade do Painel -> tipo de contratação da ANS.
const MODALIDADES: [string, string][] = [
  ["", "Qualquer modalidade"],
  ["Individual ou familiar", "PF"],
  ["Coletivo empresarial", "PME / Empresarial"],
  ["Coletivo por adesão", "Adesão"],
];

function filtroDe(sp: SP): FiltroAns {
  return {
    q: sp.q,
    contratacao: sp.contratacao,
    acomodacao: sp.acomodacao,
    cobertura: sp.cobertura,
    copart: sp.copart,
    uf: sp.uf,
    municipio: sp.municipio,
    vcm: sp.vcm,
  };
}

function Cabecalho({ base }: { base: BaseAns }) {
  return (
    <div className="mb-6 flex items-start">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Busca ANS</h1>
        <p className="text-sm text-muted-foreground">
          Dados abertos da ANS importados em {new Date(base.geradoEm).toLocaleDateString("pt-BR")} ·{" "}
          {base.operadoras.length} operadoras · {base.planos.length.toLocaleString("pt-BR")} planos
        </p>
      </div>
      <div className="ml-auto rounded-md bg-teal-600 px-3 py-1 text-lg font-black italic text-white">ANS</div>
    </div>
  );
}

function Filtros({ base, sp, action }: { base: BaseAns; sp: SP; action: string }) {
  const op = opcoes(base);
  const municipios = new Map<string, string>();
  for (const p of base.planos) for (const m of p.municipios) municipios.set(m.codigo, m.nome);
  const listaMun = [...municipios].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  return (
    <form action={action} className="space-y-3 sm:w-[230px]">
      <div className="flex items-center gap-2 font-medium">
        <Filter className="h-4" /> Filtros
      </div>
      <input name="q" defaultValue={sp.q} placeholder="Nome do plano ou código ANS..." className={campo} />
      <select name="contratacao" defaultValue={sp.contratacao ?? ""} className={campo}>
        {MODALIDADES.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <select name="uf" defaultValue={sp.uf ?? ""} className={campo}>
        <option value="">Qualquer UF</option>
        {op.ufs.map((u) => (
          <option key={u}>{u}</option>
        ))}
      </select>
      <select name="municipio" defaultValue={sp.municipio ?? ""} className={campo}>
        <option value="">Qualquer cidade</option>
        {listaMun.map(([c, n]) => (
          <option key={c} value={c}>
            {n}
          </option>
        ))}
      </select>
      <select name="cobertura" defaultValue={sp.cobertura ?? ""} className={campo}>
        <option value="">Qualquer cobertura</option>
        {op.coberturas.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <select name="acomodacao" defaultValue={sp.acomodacao ?? ""} className={campo}>
        <option value="">Qualquer acomodação</option>
        {op.acomodacoes.map((a) => (
          <option key={a}>{a}</option>
        ))}
      </select>
      <select name="copart" defaultValue={sp.copart ?? ""} className={campo}>
        <option value="">Com ou sem coparticipação</option>
        <option value="com">Com coparticipação</option>
        <option value="sem">Sem coparticipação</option>
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="vcm" value="1" defaultChecked={sp.vcm === "1"} /> Só planos com valor (VCM)
      </label>
      <button className={buttonClass({}, "w-full")}>Filtrar</button>
    </form>
  );
}

const query = (sp: SP, extra: SP = {}) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...extra })) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : "";
};

export function BuscaAnsRealLista({ base, sp }: { base: BaseAns; sp: SP }) {
  const planos = filtrarPlanos(base, filtroDe(sp));
  const porOp = new Map<string, number>();
  for (const p of planos) porOp.set(p.registroAns, (porOp.get(p.registroAns) ?? 0) + 1);
  const lista = base.operadoras.filter((o) => porOp.has(o.registroAns));
  return (
    <>
      <Cabecalho base={base} />
      <div className="flex flex-col gap-8 rounded-sm bg-background p-6 shadow-sm sm:flex-row">
        <Filtros base={base} sp={sp} action="/busca-ans" />
        <div className="flex-1 space-y-3">
          <div className="flex justify-end">
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
              {lista.length} operadoras encontradas
            </span>
          </div>
          {lista.map((o) => (
            <Link
              key={o.registroAns}
              href={`/busca-ans/${o.registroAns}${query(sp)}`}
              className="flex items-center gap-4 rounded-md border p-4 transition-shadow hover:shadow-sm"
            >
              <span className="rounded bg-blue-50 px-2 py-1 font-mono text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                {o.registroAns}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium uppercase">{o.nomeFantasia ?? o.razaoSocial}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {o.razaoSocial} · {o.modalidade}
                </div>
              </div>
              <span className="text-sm font-medium text-primary">{porOp.get(o.registroAns)} planos</span>
            </Link>
          ))}
          {!lista.length && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Não encontramos planos que correspondam aos critérios de busca.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

const ABAS = ["Preços", "Abrangência", "Rede Credenciada", "Características"] as const;

const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;

export function BuscaAnsRealDetalhe({
  base,
  registro,
  sp,
  indicadores,
  rede,
}: {
  base: BaseAns;
  registro: string;
  sp: SP;
  indicadores: IndicadoresAns | null;
  rede: RedeAns | null;
}) {
  const op = base.operadoras.find((o) => o.registroAns === registro);
  if (!op) return null;
  const planos = filtrarPlanos(base, filtroDe(sp)).filter((p) => p.registroAns === registro);
  const todos = planos.length ? planos : base.planos.filter((p) => p.registroAns === registro);
  const plano = todos.find((p) => p.id === sp.plano) ?? todos[0];
  const aba = ABAS.find((a) => a === sp.aba) ?? "Preços";
  const nome = op.nomeFantasia ?? op.razaoSocial;
  const ind = indicadores?.porOperadora[registro];
  const hospitaisPlano = plano
    ? (rede?.porPlano[plano.id] ?? [])
        .map((cnes) => ({ cnes, ...rede!.hospitais[cnes] }))
        .filter((h) => h.nome)
        .sort((a, b) => a.municipio.localeCompare(b.municipio, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR"))
    : [];
  const { plano: _p, aba: _a, ...filtros } = sp;
  return (
    <>
      <Cabecalho base={base} />
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="space-y-4 sm:w-[300px]">
          <div className="space-y-4 rounded-sm bg-background p-4 shadow-sm">
            <Link href={`/busca-ans${query(filtros)}`} className="flex items-center gap-2 font-medium">
              <ArrowLeft className="h-4" /> {nome}
            </Link>
            <p className="text-xs text-muted-foreground">
              Registro ANS: {op.registroAns} · CNPJ {op.cnpj}
            </p>
            <form action={`/busca-ans/${registro}`} className="space-y-2">
              {Object.entries(filtros).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
              <select name="plano" defaultValue={plano?.id} className={campo}>
                {todos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} [{p.contratacao}]
                  </option>
                ))}
              </select>
              <button className={buttonClass({ variant: "outline", size: "sm" }, "w-full")}>Ver plano</button>
            </form>
          </div>
          <div className="space-y-2 rounded-sm bg-background p-4 text-sm shadow-sm">
            <div className="font-medium">Operadora</div>
            <p className="text-muted-foreground">{op.modalidade}</p>
            {ind?.idss != null || ind?.reajuste != null ? (
              <dl className="grid grid-cols-2 gap-2">
                <div>
                  <dt className="text-xs text-muted-foreground">IDSS{ind.idssAno ? ` ${ind.idssAno}` : ""}</dt>
                  <dd className="font-medium">
                    {ind.idss != null ? ind.idss.toLocaleString("pt-BR", { minimumFractionDigits: 4 }) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Reajuste{ind.ciclo ? ` ${ind.ciclo}` : ""}</dt>
                  <dd className="font-medium">
                    {ind.reajuste != null ? pct(ind.reajuste) : "—"}
                    {ind.reajusteAnterior != null && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        (anterior {pct(ind.reajusteAnterior)})
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">
                IDSS e reajuste desta operadora não estão na base importada.
              </p>
            )}
          </div>
        </div>
        {plano && (
          <div className="flex-1 rounded-sm bg-background p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div>
                <h2 className="text-xl font-semibold">{plano.nome}</h2>
                <p className="text-sm text-muted-foreground">{op.razaoSocial}</p>
              </div>
              <span className="ml-auto whitespace-nowrap bg-black px-1.5 py-0.5 text-sm font-bold text-white">
                ANS nº {plano.codigoAns}
              </span>
            </div>
            <div className="mt-6 flex gap-2 border-b">
              {ABAS.map((t) => (
                <Link
                  key={t}
                  href={`/busca-ans/${registro}${query(sp, { aba: t, plano: plano.id })}`}
                  className={cn(
                    "px-4 py-2 text-sm font-medium",
                    aba === t ? "border-b-2 border-primary text-primary" : "text-foreground/60",
                  )}
                >
                  {t}
                </Link>
              ))}
            </div>
            {aba === "Preços" &&
              (plano.vcm ? (
                Object.entries(plano.vcm.variantes).map(([abr, v]) => (
                  <div key={abr} className="mt-4">
                    {Object.keys(plano.vcm!.variantes).length > 1 && (
                      <div className="text-xs font-medium text-muted-foreground">Variante: {abr.toLowerCase()}</div>
                    )}
                    <table className="mt-2 w-full text-sm">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="p-2 text-left font-medium">Faixa Etária</th>
                          <th className="p-2 text-center font-medium">Mínimo</th>
                          <th className="p-2 text-center font-medium">Mensalidade</th>
                          <th className="p-2 text-center font-medium">Valor Máximo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {base.faixas.map((f, i) => (
                          <tr key={f} className="border-t">
                            <td className="p-2">{f}</td>
                            <td className="p-2 text-center text-muted-foreground">
                              {v.min[i] != null ? moeda(v.min[i]!) : "—"}
                            </td>
                            <td className="p-2 text-center">{v.precos[i] != null ? moeda(v.precos[i]!) : "—"}</td>
                            <td className="p-2 text-center text-muted-foreground">
                              {v.max[i] != null ? moeda(v.max[i]!) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Este plano não tem valor comercial (VCM) na nota técnica.
                </p>
              ))}
            {aba === "Preços" && plano.vcm && (
              <p className="mt-4 rounded-md bg-blue-50 p-4 text-xs text-foreground/80 dark:bg-blue-950">
                <strong className="text-primary">Nota:</strong> valores de referência da nota técnica (NTRP{" "}
                {plano.vcm.nota}, {plano.vcm.data.split("-").reverse().join("/")}). O preço praticado pode variar até
                30% para mais ou para menos; confirme na tabela de venda da operadora.
              </p>
            )}
            {aba === "Abrangência" && (
              <div className="mt-4 space-y-2 text-sm">
                <p>
                  Abrangência <strong>{plano.abrangencia.toLowerCase()}</strong>
                  {plano.ufs.length ? ` · UFs: ${plano.ufs.join(", ")}` : ""}
                </p>
                {plano.municipios.length > 0 && (
                  <ul className="columns-2 text-muted-foreground sm:columns-3">
                    {plano.municipios.map((m) => (
                      <li key={m.codigo}>{m.nome}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {aba === "Rede Credenciada" &&
              (hospitaisPlano.length ? (
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="p-2 text-left font-medium">Hospital</th>
                      <th className="p-2 text-left font-medium">Cidade</th>
                      <th className="p-2 text-center font-medium">Pronto-socorro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hospitaisPlano.map((h) => (
                      <tr key={h.cnes} className="border-t">
                        <td className="p-2">
                          {h.nome}
                          <div className="text-xs text-muted-foreground">CNES {h.cnes}</div>
                        </td>
                        <td className="p-2 text-muted-foreground">{rotuloMunicipio(h.municipio)}</td>
                        <td className="p-2 text-center">{h.urgencia ? "Sim" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  {rede
                    ? "Sem hospitais da rede deste plano na base importada."
                    : "A rede credenciada não foi importada."}
                </p>
              ))}
            {aba === "Características" && (
              <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                {(
                  [
                    ["Contratação", plano.contratacao],
                    ["Segmentação", plano.segmentacao],
                    ["Obstetrícia", plano.obstetricia],
                    ["Acomodação", plano.acomodacao],
                    ["Fator moderador", plano.fatorModerador],
                    ["Livre escolha", plano.livreEscolha],
                    ["Odontológico", plano.odontologico ? "Sim" : "Não"],
                    ["Registro do plano", plano.dataRegistro.split("-").reverse().join("/")],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd>{v || "—"}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </div>
    </>
  );
}
