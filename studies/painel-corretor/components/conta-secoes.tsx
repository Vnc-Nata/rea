"use client";

import { FotoUpload } from "./foto-upload";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import {
  addLicencas,
  aplicarAjuste,
  convidarUsuario,
  criarEquipe,
  excluirEquipe,
  gerarChaveApi,
  updateCorretora,
  updatePreferencias,
  updateUsuario,
} from "@/app/actions";
import type { Conta, Operadora } from "@/lib/types";
import { cn, moeda } from "@/lib/utils";
import { OperadoraIcone } from "./brand";
import { Button, Input, Label, Modal, Select, useToast } from "./ui";

function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-medium">{titulo}</h3>
        {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}

// ---------- Conta (dados da corretora) ----------

export function CorretoraForm({ conta, cidades }: { conta: Conta; cidades: string[] }) {
  const [f, setF] = useState(conta.corretora);
  const [pending, start] = useTransition();
  const toast = useToast();
  const campo = (k: keyof typeof f, label: string, placeholder?: string) => (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input value={f[k]} placeholder={placeholder} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </div>
  );
  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateCorretora(f);
          toast(r.success ? "Ação concluída com sucesso." : r.error, !r.success);
        });
      }}
    >
      <h2 className="text-lg font-semibold">Corretora</h2>
      <Secao titulo="Informações da Corretora" descricao="Dados principais da sua corretora.">
        <FotoUpload redonda={false} fallback={f.nome.slice(0, 2).toUpperCase()} />
        <div className="grid gap-4 sm:grid-cols-2">
          {campo("nome", "Nome", "Nome")}
          <div className="space-y-1">
            <Label>Cidade</Label>
            <Select value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })}>
              {cidades.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
        </div>
      </Secao>
      <Secao titulo="Redes Sociais" descricao="Posicione a presença da sua corretora nas redes.">
        <div className="grid gap-4 sm:grid-cols-2">
          {campo("facebook", "Facebook", "URL do Facebook")}
          {campo("instagram", "Instagram", "URL do Instagram")}
          {campo("linkedin", "LinkedIn", "URL do Linkedin")}
          {campo("site", "Site", "URL do Site")}
        </div>
      </Secao>
      <Button type="submit" disabled={pending}>
        Confirmar
      </Button>
    </form>
  );
}

// ---------- Plano e Assinatura ----------

const VALOR_LICENCA = 73.6; // fictício

export function Assinatura({ conta }: { conta: Conta }) {
  const [aberto, setAberto] = useState(false);
  const [qtd, setQtd] = useState(1);
  const [pending, start] = useTransition();
  const toast = useToast();
  const valor = conta.licencas * VALOR_LICENCA;
  const hoje = new Date();
  const faturas = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 10);
    return { venc: d.toLocaleDateString("pt-BR"), forma: "Boleto", valor };
  });
  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold">Assinatura</h2>
      <div className="flex flex-wrap items-center gap-4 rounded border p-4">
        <div className="flex-1">
          <div className="font-medium">Plano PRO ({conta.licencas} usuários)</div>
          <div className="text-xs text-muted-foreground">Pagamento com Boleto bancário · valores fictícios</div>
        </div>
        <Button variant="outline" onClick={() => setAberto(true)}>
          Adicionar novas licenças
        </Button>
        <Button variant="outline" onClick={() => toast("Troca de forma de pagamento não incluída no estudo.", true)}>
          Alterar forma de pagamento
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-2 font-medium">Vencimento</th>
            <th className="font-medium">Forma</th>
            <th className="font-medium">Valor</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {faturas.map((f) => (
            <tr key={f.venc} className="border-t">
              <td className="py-2">{f.venc}</td>
              <td>{f.forma}</td>
              <td>{moeda(f.valor)}</td>
              <td className="text-emerald-600">Pago</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="rounded bg-muted p-4 text-sm">
        Precisa de ajuda com seu plano?{" "}
        <button className="text-primary underline" onClick={() => toast("Atendimento não incluído no estudo.", true)}>
          Solicitar atendimento
        </button>
      </div>
      <Modal open={aberto} onClose={() => setAberto(false)} title="Adicionar novas licenças">
        <div className="space-y-1">
          <Label>Quantidade</Label>
          <Input type="number" min={1} value={qtd} onChange={(e) => setQtd(Math.max(1, Number(e.target.value) || 1))} />
          <p className="text-xs text-muted-foreground">
            Nova mensalidade: {moeda((conta.licencas + qtd) * VALOR_LICENCA)}
          </p>
        </div>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              await addLicencas(qtd);
              setAberto(false);
              toast("Licenças adicionadas.");
            })
          }
        >
          Confirmar
        </Button>
      </Modal>
    </div>
  );
}

// ---------- Usuários ----------

export function Usuarios({ conta, mostrarInativos }: { conta: Conta; mostrarInativos: boolean }) {
  const [q, setQ] = useState("");
  const [convite, setConvite] = useState<{ nome: string; email: string; equipeId: string } | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const lista = conta.usuarios.filter(
    (u) => u.ativo !== mostrarInativos && `${u.nome} ${u.email}`.toLowerCase().includes(q.toLowerCase()),
  );
  const equipe = (id?: string) => conta.equipes.find((e) => e.id === id)?.nome;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-semibold">Usuários</h2>
        <a href={`?status=${mostrarInativos ? "true" : "false"}`} className="text-sm text-primary">
          {mostrarInativos ? "Ver ativos" : "Ver inativos"}
        </a>
        <Input placeholder="Procurar..." value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-48" />
        <Button size="sm" onClick={() => setConvite({ nome: "", email: "", equipeId: "" })}>
          <Plus className="mr-1 size-4" /> Convidar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {conta.usuarios.filter((u) => u.ativo).length} de {conta.licencas} licenças em uso.
      </p>
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-2 font-medium" />
            <th className="font-medium">Perfil</th>
            <th className="font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="py-2">
                <div className="font-medium">{u.nome}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </td>
              <td>
                <Select
                  className="h-8 w-40"
                  value={u.perfil}
                  onChange={(e) => updateUsuario(u.id, { perfil: e.target.value as typeof u.perfil })}
                >
                  <option>Administrador</option>
                  <option>Usuário</option>
                </Select>
                {equipe(u.equipeId) && <div className="mt-1 text-xs text-muted-foreground">{equipe(u.equipeId)}</div>}
              </td>
              <td>
                <button
                  onClick={() => updateUsuario(u.id, { ativo: !u.ativo })}
                  className={cn("text-sm", u.ativo ? "text-emerald-600" : "text-muted-foreground")}
                  title={u.ativo ? "Desativar" : "Reativar"}
                >
                  {u.ativo ? "Ativo" : "Inativo"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs text-muted-foreground">
        {lista.length ? `1-${lista.length} de ${lista.length}` : "Nenhum usuário"}
      </div>
      <Modal open={!!convite} onClose={() => setConvite(null)} title="Convidar usuário">
        {convite && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={convite.nome} onChange={(e) => setConvite({ ...convite, nome: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={convite.email}
                onChange={(e) => setConvite({ ...convite, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Equipe</Label>
              <Select value={convite.equipeId} onChange={(e) => setConvite({ ...convite, equipeId: e.target.value })}>
                <option value="">Geral</option>
                {conta.equipes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await convidarUsuario(convite.nome, convite.email, convite.equipeId);
                  toast(r.success ? "Convite registrado (nenhum e-mail é enviado no estudo)." : r.error, !r.success);
                  if (r.success) setConvite(null);
                })
              }
            >
              Convidar
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------- Equipes ----------

export function Equipes({ conta }: { conta: Conta }) {
  const [nome, setNome] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const membros = (id?: string) => conta.usuarios.filter((u) => u.ativo && u.equipeId === id).length;
  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <h2 className="mr-auto text-lg font-semibold">Equipes</h2>
        <Button size="sm" onClick={() => setNome("")}>
          <Plus className="mr-1 size-4" /> Criar Equipe
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-2 font-medium">Equipe</th>
            <th className="font-medium">Membros</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {conta.equipes.map((e) => (
            <tr key={e.id} className="border-t">
              <td className="py-2">{e.nome}</td>
              <td>{membros(e.id)} membro(s)</td>
              <td className="text-right">
                <button
                  aria-label={`Excluir ${e.nome}`}
                  onClick={() => excluirEquipe(e.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </td>
            </tr>
          ))}
          <tr className="border-t">
            <td className="py-2">Geral</td>
            <td>{membros(undefined)} membro(s)</td>
            <td />
          </tr>
        </tbody>
      </table>
      <Modal open={nome !== null} onClose={() => setNome(null)} title="Criar Equipe">
        <Input placeholder="Nome da equipe" value={nome ?? ""} onChange={(e) => setNome(e.target.value)} />
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await criarEquipe(nome ?? "");
              toast(r.success ? "Equipe criada." : r.error, !r.success);
              if (r.success) setNome(null);
            })
          }
        >
          Criar
        </Button>
      </Modal>
    </div>
  );
}

// ---------- Integrações ----------

export function Integracoes({ conta }: { conta: Conta }) {
  const [chave, setChave] = useState(conta.apiKey);
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold">Integrações</h2>
      <Secao
        titulo="Chave da API"
        descricao="Chave para integrar sua conta com outros sistemas (ilustrativa: o estudo não expõe API)."
      >
        {chave && (
          <div className="flex items-center gap-2 rounded border bg-muted p-2 font-mono text-xs">
            <KeyRound className="size-4 shrink-0" />
            <span className="truncate">{chave}</span>
            <button
              className="ml-auto"
              aria-label="Copiar chave"
              onClick={async () => {
                await navigator.clipboard.writeText(chave);
                toast("Copiado para a área de transferência.");
              }}
            >
              <Copy className="size-4" />
            </button>
          </div>
        )}
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setChave(await gerarChaveApi());
              toast("Nova chave gerada. A anterior deixa de valer.");
            })
          }
        >
          Gerar Chave
        </Button>
      </Secao>
      <Secao titulo="Zapier" descricao="Conecte as cotações a outros aplicativos.">
        <Button variant="outline" onClick={() => toast("Integração com Zapier não incluída no estudo.", true)}>
          Conectar
        </Button>
      </Secao>
    </div>
  );
}

// ---------- Preferências ----------

export function Preferencias({
  conta,
  operadoras,
  habilitadas,
  fonte,
  errosTabelas,
}: {
  conta: Conta;
  operadoras: Operadora[];
  /** Habilitadas de fato (a lista da conta ou o padrão: operadoras-alvo no catálogo ANS, todas no fictício). */
  habilitadas: string[];
  fonte: "ans" | "ficticio";
  errosTabelas: { arquivo: string; linha: number; motivo: string }[];
}) {
  const todas = operadoras.map((o) => o.id);
  const [sel, setSel] = useState<string[]>(habilitadas);
  const [maisInfo, setMaisInfo] = useState(conta.maisInfoRelevantes);
  const [editando, setEditando] = useState(false);
  const [busca, setBusca] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  // No fictício, lista vazia = todas. No catálogo ANS, vazia = operadoras-alvo; por isso salva a lista explícita.
  const salvar = (ops: string[], mi: boolean) =>
    start(async () => {
      await updatePreferencias(fonte === "ficticio" && ops.length === todas.length ? [] : ops, mi);
      toast("Ação concluída com sucesso.");
    });
  const habilitadasOps = operadoras.filter((o) => sel.includes(o.id));
  const q = busca.trim().toLowerCase();
  const listaModal = q
    ? operadoras.filter((o) => o.nome.toLowerCase().includes(q) || o.registroAns.includes(q))
    : operadoras;
  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold">Preferências</h2>
      {errosTabelas.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <div className="font-medium">
            {errosTabelas.length} linha(s) de tabela de venda ignorada(s) em data/tabelas
          </div>
          <ul className="mt-1 max-h-40 list-disc overflow-auto pl-5 text-xs">
            {errosTabelas.map((e, i) => (
              <li key={i}>
                {e.arquivo}:{e.linha} {e.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Secao titulo="Operadoras" descricao="Habilite as operadoras e seguradoras com as quais sua equipe trabalha.">
        <p className="text-sm text-muted-foreground">
          {sel.length === todas.length ? "Todas habilitadas" : `${sel.length} de ${todas.length} habilitadas`}
        </p>
        <Button variant="outline" onClick={() => setEditando(true)}>
          Alterar
        </Button>
      </Secao>
      <Secao
        titulo="Ajuste de preço por operadora (%)"
        descricao="Aplicado sobre o valor de referência da ANS (VCM). Planos com tabela de venda não mudam."
      >
        {fonte === "ans" ? (
          <ul className="max-w-md divide-y rounded border">
            {habilitadasOps.map((o) => (
              <AjusteOperadora key={o.id} op={o} valor={conta.ajustes?.[o.id] ?? 0} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Disponível quando a base da ANS estiver importada.</p>
        )}
      </Secao>
      <Secao titulo="Mais informações">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={maisInfo}
            onChange={(e) => {
              setMaisInfo(e.target.checked);
              salvar(sel, e.target.checked);
            }}
          />
          Enviar apenas as informações que considerar relevantes para o cliente.
        </label>
      </Secao>
      <Modal open={editando} onClose={() => setEditando(false)} title="Operadoras habilitadas">
        {operadoras.length > 12 && (
          <Input placeholder="Procurar operadora..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        )}
        <div className="max-h-80 space-y-1 overflow-auto">
          {listaModal.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sel.includes(o.id)}
                onChange={() => setSel((s) => (s.includes(o.id) ? s.filter((x) => x !== o.id) : [...s, o.id]))}
              />
              <OperadoraIcone op={o} tamanho={20} />
              {o.nome}
              <span className="text-xs text-muted-foreground">{o.registroAns}</span>
            </label>
          ))}
        </div>
        <Button
          disabled={pending || !sel.length}
          onClick={() => {
            salvar(sel, maisInfo);
            setEditando(false);
          }}
        >
          Confirmar
        </Button>
      </Modal>
    </div>
  );
}

function AjusteOperadora({ op, valor }: { op: Operadora; valor: number }) {
  const [v, setV] = useState(String(valor));
  const salvo = useRef(valor);
  const [pending, start] = useTransition();
  const toast = useToast();
  const salvar = () => {
    const n = Number(v.replace(",", "."));
    if (v.trim() === "" || n === salvo.current) return setV(String(salvo.current));
    start(async () => {
      const r = await aplicarAjuste(op.id, n);
      if (!r.success) {
        setV(String(salvo.current));
        return toast(r.error, true);
      }
      salvo.current = n;
      toast("Ajuste salvo.");
    });
  };
  return (
    <li className="flex items-center gap-3 px-3 py-2 text-sm">
      <OperadoraIcone op={op} tamanho={24} />
      <span className="flex-1 truncate">{op.nome}</span>
      <Input
        type="number"
        step="0.1"
        aria-label={`Ajuste de ${op.nome} (%)`}
        className="h-8 w-24 text-right"
        value={v}
        disabled={pending}
        onChange={(e) => setV(e.target.value)}
        onBlur={salvar}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
      <span className="text-muted-foreground">%</span>
    </li>
  );
}
