"use client";

import { Bell, Briefcase, Database, FolderOpen, LayoutGrid, Menu, Settings, User, Wallet, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "./brand";
import { ThemeSwitch } from "./theme";
import { Badge, Button, Dropdown, DropdownItem } from "./ui";

const NavCtx = createContext<{ open: boolean; setOpen: (o: boolean) => void }>({ open: false, setOpen: () => {} });

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <NavCtx.Provider value={{ open, setOpen }}>{children}</NavCtx.Provider>;
}

const LINKS = [
  { href: "/cotacoes", label: "Cotações", icon: Wallet },
  { href: "/busca-ans", label: "Busca ANS", icon: FolderOpen, beta: true },
  { href: "/produtos", label: "Produtos", icon: LayoutGrid },
  { href: "/base-ans", label: "Base ANS", icon: Database, beta: true },
  { href: "/crm/contatos", label: "Contatos", icon: User },
  { href: "/crm/negocios", label: "Negócios", icon: Briefcase },
];

function NavLink({ href, label, icon: Icon, beta }: (typeof LINKS)[number]) {
  const path = usePathname();
  const active = path.startsWith(href);
  const { setOpen } = useContext(NavCtx);
  return (
    <Link
      href={href}
      onClick={() => setOpen(false)}
      data-active={active}
      className="group flex cursor-pointer items-center gap-3 rounded-lg p-2 px-4 text-sm font-medium opacity-75 transition-all duration-500 hover:opacity-100 data-[active=true]:bg-slate-500/10 data-[active=true]:opacity-100 dark:text-white"
    >
      <div className="flex w-full items-center">
        <Icon className="mr-2 h-5 w-5 text-foreground/50 group-data-[active=true]:text-primary group-data-[active=true]:dark:text-inherit" />
        {label}
        {beta && <Badge className="ml-auto scale-75">beta</Badge>}
      </div>
    </Link>
  );
}

export function Sidebar() {
  const { open, setOpen } = useContext(NavCtx);
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={cn(
          "fixed top-0 z-50 flex h-full w-64 shrink-0 flex-col justify-between border-r bg-background transition-transform duration-300 ease-in-out md:sticky md:z-0 md:h-screen md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div>
          <div className="ml-6 mt-4 flex items-center pr-4">
            <Link href="/">
              <Logo />
            </Link>
            <button className="ml-auto text-zinc-500 md:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu">
              <X className="h-5" />
            </button>
          </div>
          <nav className="mt-6 grid gap-1 px-4">
            {LINKS.map((l) => (
              <NavLink key={l.href} {...l} />
            ))}
            <hr className="my-2 border-muted" />
            <NavLink href="/conta/perfil" label="Configurações" icon={Settings} />
          </nav>
        </div>
        <footer className="flex justify-end p-4">
          <ThemeSwitch />
        </footer>
      </aside>
    </>
  );
}

export function TopNav({ corretora }: { corretora: string }) {
  const { open, setOpen } = useContext(NavCtx);
  const iniciais = corretora
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <nav className="sticky top-0 z-10 flex h-16 w-full items-center bg-background px-4 text-zinc-500 shadow-sm">
      <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Abrir menu">
        <Menu className="h-6 w-6" />
      </button>
      <div className="ml-auto flex items-center gap-4">
        <Dropdown
          trigger={
            <Button variant="icon" aria-label="Notificações">
              <Bell className="size-6" />
            </Button>
          }
        >
          <div className="px-2 py-1.5 text-sm font-semibold">Notificações</div>
          <div className="px-2 pb-2 text-sm text-muted-foreground">Nenhuma notificação por enquanto.</div>
        </Dropdown>
        <div className="h-8 w-px border-l border-border" />
        <Dropdown
          trigger={
            <button className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-cyan-500 text-xs font-bold text-white">
                {iniciais}
              </span>
              <span className="hidden text-sm font-semibold dark:text-muted-foreground sm:block">{corretora}</span>
            </button>
          }
        >
          <div className="px-2 py-1.5 text-sm font-semibold">{corretora}</div>
          <Link href="/conta/perfil">
            <DropdownItem>Configurações</DropdownItem>
          </Link>
          <DropdownItem onClick={() => alert("Ajuda: recurso não incluído no estudo.")}>Ajuda</DropdownItem>
          <DropdownItem onClick={() => alert("Sessão de demonstração: não há login neste estudo.")}>Sair</DropdownItem>
        </Dropdown>
      </div>
    </nav>
  );
}
