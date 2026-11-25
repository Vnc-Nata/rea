"use client";

import { useState, useTransition } from "react";
import { updatePerfil } from "@/app/actions";
import type { Perfil } from "@/lib/types";
import { Button, Input, Label, useToast } from "./ui";

export function PerfilForm({ perfil }: { perfil: Perfil }) {
  const [f, setF] = useState(perfil);
  const [pending, start] = useTransition();
  const toast = useToast();
  const iniciais = f.corretora.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updatePerfil({ corretora: f.corretora, telefone: f.telefone, mensagemPadrao: f.mensagemPadrao });
          toast(r.success ? "Ação concluída com sucesso." : r.error, !r.success);
        });
      }}
    >
      <h2 className="mb-6 text-lg font-semibold">Minha Conta</h2>
      <div className="flex flex-col gap-8 sm:flex-row">
        <div className="flex flex-col items-center gap-2">
          <div className="grid size-32 place-items-center rounded-full bg-cyan-400 text-3xl font-bold text-white">{iniciais}</div>
          <Button variant="outline" size="sm" onClick={() => toast("Upload de avatar não incluído no estudo.", true)}>
            Alterar
          </Button>
        </div>
        <div className="flex-1 space-y-8">
          <section className="space-y-3">
            <div>
              <h3 className="font-medium">Perfil profissional</h3>
              <p className="text-xs text-muted-foreground">Informações de apresentação para o seu cliente.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={f.corretora} onChange={(e) => setF({ ...f, corretora: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} />
              </div>
            </div>
          </section>
          <section className="space-y-3">
            <div>
              <h3 className="font-medium">Dados de acesso</h3>
              <p className="text-xs text-muted-foreground">Neste estudo não há login; os campos são apenas ilustrativos.</p>
            </div>
            <div className="space-y-1">
              <Label>E-mail</Label>
              <div className="flex gap-2">
                <Input value={f.email} disabled />
                <Button variant="outline" disabled>
                  Alterar
                </Button>
              </div>
            </div>
          </section>
          <section className="space-y-3">
            <div>
              <h3 className="font-medium">Mensagem padrão</h3>
              <p className="text-xs text-muted-foreground">Mensagem utilizada no envio da cotação</p>
            </div>
            <textarea
              rows={4}
              value={f.mensagemPadrao}
              onChange={(e) => setF({ ...f, mensagemPadrao: e.target.value })}
              placeholder="Escreva a sua mensagem padrão..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </section>
        </div>
      </div>
      <div className="mt-6 flex justify-end border-t pt-4">
        <Button type="submit" disabled={pending}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
