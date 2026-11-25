"use client";

import { ListFilter } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Dropdown, DropdownItem, Input, buttonClass } from "./ui";

export function ClickableRow({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr
      onClick={() => router.push(href)}
      className="cursor-pointer border-b transition-colors hover:bg-muted/50"
    >
      {children}
    </tr>
  );
}

export function SearchAndFilter() {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams(params);
      if (q) p.set("q", q);
      else p.delete("q");
      p.delete("page");
      if (p.toString() !== params.toString()) router.replace(`${path}?${p}`);
    }, 400);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  function periodo(v: string) {
    const p = new URLSearchParams(params);
    if (v) p.set("periodo", v);
    else p.delete("periodo");
    p.delete("page");
    router.replace(`${path}?${p}`);
  }

  return (
    <div className="flex gap-2">
      <Input placeholder="Procurar..." value={q} onChange={(e) => setQ(e.target.value)} />
      <Dropdown
        align="start"
        trigger={
          <button className={buttonClass({ variant: "reverse", size: "square" }, "border border-border")} aria-label="Filtrar">
            <ListFilter className="h-4 text-foreground/50" />
          </button>
        }
      >
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Período</div>
        <DropdownItem onClick={() => periodo("")}>Todo o período</DropdownItem>
        <DropdownItem onClick={() => periodo("7")}>Últimos 7 dias</DropdownItem>
        <DropdownItem onClick={() => periodo("30")}>Últimos 30 dias</DropdownItem>
      </Dropdown>
    </div>
  );
}
