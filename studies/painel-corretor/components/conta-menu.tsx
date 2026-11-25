"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

import { GRUPOS } from "@/lib/conta";

export function ContaMenu() {
  const path = usePathname();
  return (
    <nav className="space-y-4 p-2 sm:w-48">
      {GRUPOS.map((g) => (
        <div key={g.titulo}>
          <div className="px-2 pb-2 pt-2 text-xs font-semibold uppercase text-muted-foreground">{g.titulo}</div>
          {g.itens.map(([slug, label]) => (
            <Link
              key={slug}
              href={`/conta/${slug}`}
              className={cn(
                "block rounded-md px-3 py-2 text-sm hover:bg-accent",
                path === `/conta/${slug}` && "bg-slate-500/10 font-medium text-primary",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
