import { Plus } from "lucide-react";
import Link from "next/link";
import { ClickableRow, SearchAndFilter } from "@/components/cotacoes-list";
import { ButtonLink } from "@/components/ui";
import { buttonClass } from "@/lib/button";
import { readDb } from "@/lib/db";
import { cn, tempoRelativo } from "@/lib/utils";

const POR_PAGINA = 8;

export default async function Cotacoes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; periodo?: string; page?: string }>;
}) {
  const { q = "", periodo, page = "0" } = await searchParams;
  const { cotacoes } = readDb();
  const dias = Number(periodo) || 0;
  const desde = dias ? Date.now() - dias * 86400_000 : 0;
  const noPeriodo = cotacoes.filter((c) => new Date(c.criadaEm).getTime() >= desde);
  const anterior = dias
    ? cotacoes.filter((c) => {
        const t = new Date(c.criadaEm).getTime();
        return t < desde && t >= desde - dias * 86400_000;
      }).length
    : 0;
  const lista = noPeriodo
    .filter((c) => c.titulo.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm));
  const p = Math.max(0, Number(page) || 0);
  const pagina = lista.slice(p * POR_PAGINA, (p + 1) * POR_PAGINA);
  const visualizadas = noPeriodo.filter((c) => c.visualizacoes > 0).length;
  const variacao = anterior ? Math.round(((noPeriodo.length - anterior) / anterior) * 100) : null;

  const qs = (n: number) => {
    const s = new URLSearchParams();
    if (periodo) s.set("periodo", periodo);
    if (q) s.set("q", q);
    s.set("page", String(n));
    return `?${s}`;
  };

  return (
    <>
      <div className="flex sm:mb-12">
        <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Cotações</h1>
      </div>
      <div className="grid gap-4 sm:flex">
        <div className="grid flex-1 gap-4">
          <div className="flex">
            <SearchAndFilter />
            <ButtonLink href="/cotacoes/nova" size="sm" className="ml-auto">
              <Plus className="h-4" /> Nova
            </ButtonLink>
          </div>
          <div className="rounded-sm bg-background shadow-sm">
            <table className="w-full caption-bottom text-sm">
              <thead className="hidden border-b md:table-header-group">
                <tr>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Título</th>
                  <th className="h-12 w-40 px-4 text-left align-middle font-medium text-muted-foreground">Criada por</th>
                  <th className="h-12 w-40 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {pagina.map((c) => (
                  <ClickableRow key={c.id} href={`/cotacoes/${c.id}/edit`}>
                    <td className="p-4 align-middle">
                      <div className="grid">
                        {c.titulo}
                        <span className="text-xs text-foreground/75">
                          {c.cenarios.length ? `${c.cenarios.length} plano(s)` : ""}
                        </span>
                      </div>
                    </td>
                    <td className="hidden p-4 align-middle sm:table-cell">
                      <div className="grid">
                        <span className="truncate">{c.criadaPor}</span>
                        <span className="text-xs text-foreground/75">{tempoRelativo(c.criadaEm)}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center align-middle">
                      <Status visualizado={c.visualizacoes > 0} />
                    </td>
                  </ClickableRow>
                ))}
                {!pagina.length && (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-muted-foreground">
                      Nenhuma cotação encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="flex items-center justify-end space-x-2 p-4">
              <div className="flex-1 text-sm text-muted-foreground">Página {p + 1}</div>
              <Link
                href={qs(p - 1)}
                aria-disabled={p === 0}
                className={cn(buttonClass({ variant: "outline", size: "sm" }), p === 0 && "pointer-events-none opacity-50")}
              >
                Anterior
              </Link>
              <Link
                href={qs(p + 1)}
                aria-disabled={(p + 1) * POR_PAGINA >= lista.length}
                className={cn(
                  buttonClass({ variant: "outline", size: "sm" }),
                  (p + 1) * POR_PAGINA >= lista.length && "pointer-events-none opacity-50",
                )}
              >
                Próximo
              </Link>
            </div>
          </div>
        </div>
        <div className="grid grid-rows-[auto,auto,1fr] gap-4 sm:mt-14 sm:w-72">
          <Stat titulo="cadastradas" valor={String(noPeriodo.length)} variacao={variacao} />
          <Stat titulo="visualizadas" valor={visualizadas ? String(visualizadas) : "-"} />
        </div>
      </div>
    </>
  );
}

function Status({ visualizado }: { visualizado: boolean }) {
  const cor = visualizado ? "bg-emerald-500" : "bg-gray-400";
  const ring = visualizado ? "ring-emerald-500/25" : "ring-gray-400/25";
  return (
    <span className="flex items-center gap-2 text-xs">
      <div className="relative size-4">
        <div className={cn("absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4", ring)} />
        <div className={cn("absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full", cor)} />
      </div>
      <span>{visualizado ? "Visualizado" : "Não visualizado"}</span>
    </span>
  );
}

function Stat({ titulo, valor, variacao }: { titulo: string; valor: string; variacao?: number | null }) {
  return (
    <div className="flex h-24 items-center gap-4 rounded-sm bg-background p-5 shadow-sm">
      <div className="grid w-full flex-1">
        <div className="flex text-sm font-medium capitalize text-foreground/75">
          <span>{titulo}</span>
          {variacao != null && (
            <span
              className={cn(
                "ml-auto rounded-xl px-1 py-0.5",
                variacao >= 0 ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600",
              )}
            >
              {variacao >= 0 ? "+" : ""}
              {variacao}%
            </span>
          )}
        </div>
        <div className="-mt-1 flex w-full flex-1 items-end gap-2">
          <span className="text-3xl">{valor}</span>
        </div>
      </div>
    </div>
  );
}
