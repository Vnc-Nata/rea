"use client";

import { AlertTriangle, ExternalLink, FlaskConical, Hospital as HospitalIcon, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { onPlanoRemove, registrarEvento, updateComentario } from "@/app/actions";
import type { Hospital, Operadora, Plano } from "@/lib/types";
import { Comparativo } from "./cotacao-editor";
import { Button, Modal } from "./ui";

export function Imprimir({ ativo }: { ativo: boolean }) {
  useEffect(() => {
    if (ativo) setTimeout(() => window.print(), 400);
  }, [ativo]);
  return null;
}

export function RegistrarVisualizacao({ cotacaoId, preview }: { cotacaoId: string; preview: boolean }) {
  const done = useRef(false);
  useEffect(() => {
    if (preview || done.current) return;
    done.current = true;
    registrarEvento(cotacaoId);
  }, [cotacaoId, preview]);
  return null;
}

/** Cenário cujo plano não está no catálogo atual. Remover só na visão do corretor (preview). */
export function PlanoIndisponivel({
  cotacaoId,
  cenarioId,
  removivel,
}: {
  cotacaoId: string;
  cenarioId: string;
  removivel: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded border-2 border-dashed bg-background p-6 text-center text-sm text-muted-foreground">
      <AlertTriangle className="size-6 text-amber-500" />
      <div className="font-medium text-foreground">Plano indisponível</div>
      <p className="text-xs">Este plano não está mais disponível.</p>
      {removivel && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await onPlanoRemove(cotacaoId, cenarioId);
              router.refresh();
            })
          }
        >
          <Trash2 className="size-4" /> Remover
        </Button>
      )}
    </div>
  );
}

export function Comentario({ cotacaoId, cenarioId, value, editavel }: { cotacaoId: string; cenarioId: string; value: string; editavel: boolean }) {
  if (!editavel) return value ? <p className="py-2 text-sm text-muted-foreground">{value}</p> : null;
  return (
    <textarea
      defaultValue={value}
      placeholder="Adicione um comentário..."
      onBlur={(e) => updateComentario(cotacaoId, cenarioId, e.target.value)}
      className="-mx-1 w-full resize-none rounded-md bg-transparent px-1 py-2 text-sm hover:bg-secondary focus:outline-none"
    />
  );
}

export function CoparticipacaoDetalhes() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-primary hover:text-primary/90">
        Ver detalhes <ExternalLink className="w-4" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Coparticipação">
        <p className="text-sm text-muted-foreground">
          Nos planos com coparticipação o beneficiário paga um percentual de cada consulta, exame ou procedimento
          realizado, além da mensalidade. Percentuais e limites constam no contrato do plano.
        </p>
      </Modal>
    </>
  );
}

export function RedeCards({ plano, op, hospitais }: { plano: Plano; op: Operadora; hospitais: Hospital[] }) {
  const [open, setOpen] = useState(false);
  const Card = ({ titulo, texto, icon }: { titulo: string; texto: string; icon: React.ReactNode }) => (
    <button type="button" onClick={() => setOpen(true)} className="w-full">
      <div className="group flex w-full items-center justify-between gap-2 rounded-sm bg-background p-6 text-foreground shadow-sm transition-colors">
        <div className="text-left">
          <h3 className="font-semibold text-primary transition-all group-hover:text-primary/90">{titulo}</h3>
          <p className="text-sm">{texto}</p>
        </div>
        <div className="text-foreground/50">{icon}</div>
      </div>
    </button>
  );
  if (!plano.rede.length) return null;
  return (
    <>
      <Card titulo={`${plano.rede.length} Hospitais`} texto="Confira os principais hospitais da rede." icon={<HospitalIcon />} />
      {plano.laboratorios > 0 && (
        <Card
          titulo={`${plano.laboratorios} Laboratórios`}
          texto="Confira os principais laboratórios da rede."
          icon={<FlaskConical />}
        />
      )}
      <Comparativo open={open} onClose={() => setOpen(false)} planos={[plano]} opMap={{ [op.id]: op }} hospitais={hospitais} />
    </>
  );
}
