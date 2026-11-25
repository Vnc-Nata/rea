"use client";

import { X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";

import { buttonClass, type ButtonProps } from "@/lib/button";

export { buttonClass };

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonProps>(
  ({ variant, size, className, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={buttonClass({ variant, size }, className)} {...props} />
  ),
);
Button.displayName = "Button";

export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
  ...rest
}: React.ComponentProps<typeof Link> & ButtonProps) {
  return (
    <Link href={href} className={buttonClass({ variant, size }, className)} {...rest}>
      {children}
    </Link>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-xs font-medium leading-none", className)} {...props} />;
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-transparent bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-sm bg-background shadow-sm", className)} {...props} />;
}

/** Grupo de botões exclusivos (equivalente ao ToggleGroup do Radix). */
export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("flex h-10 items-center gap-1 rounded-sm border px-1", className)}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={o === value}
          data-state={o === value ? "on" : "off"}
          onClick={() => onChange(o)}
          className="h-8 w-full flex-1 rounded-md px-3 text-sm font-semibold text-foreground/50 hover:text-foreground data-[state=on]:bg-slate-500/10 data-[state=on]:text-foreground"
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function useEscape(open: boolean, onClose: () => void) {
  React.useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/60 animate-in fade-in-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 grid w-full max-w-lg gap-4 rounded-lg border bg-background p-6 shadow-lg animate-in fade-in-0 zoom-in-95",
          className,
        )}
      >
        <button onClick={onClose} className="absolute right-4 top-4 opacity-70 hover:opacity-100" aria-label="Fechar">
          <X className="h-4 w-4" />
        </button>
        {(title || description) && (
          <div className="space-y-1.5 pr-6">
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Painel lateral (Sheet) que desliza da direita, como o seletor de planos. */
export function Drawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 animate-in fade-in-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute inset-y-0 right-0 grid h-full w-full grid-rows-[auto,1fr] gap-4 border-l bg-background p-6 pb-0 pr-0 shadow-lg duration-500 animate-in slide-in-from-right sm:w-11/12 sm:max-w-screen-2xl"
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute -left-10 top-6 hidden rounded-full p-1 text-white hover:bg-white/10 sm:block"
        >
          <X className="h-6" />
        </button>
        <button onClick={onClose} aria-label="Fechar" className="absolute right-2 top-2 p-1 text-muted-foreground sm:hidden">
          <X className="h-6" />
        </button>
        {children}
      </div>
    </div>
  );
}

/** Menu suspenso simples (DropdownMenu). */
export function Dropdown({
  trigger,
  children,
  align = "end",
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className={cn(
            "absolute z-50 mt-2 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** Toast mínimo (o app original usa o Toaster do shadcn com borda esquerda verde/vermelha). */
const ToastCtx = React.createContext<(msg: string, erro?: boolean) => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [t, setT] = React.useState<{ msg: string; erro?: boolean; id: number } | null>(null);
  const show = React.useCallback((msg: string, erro?: boolean) => {
    const id = Date.now();
    setT({ msg, erro, id });
    setTimeout(() => setT((cur) => (cur?.id === id ? null : cur)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && (
        <div className="fixed bottom-4 right-4 z-[100] w-full max-w-[420px] p-4">
          <div
            className={cn(
              "rounded-md border border-l-8 bg-background p-6 pr-8 shadow-lg animate-in slide-in-from-bottom-full",
              t.erro ? "border-l-red-500" : "border-l-emerald-500",
            )}
          >
            <div className="text-sm font-semibold">{t.erro ? "Atenção" : "Aviso"}</div>
            <div className="text-sm opacity-90">{t.msg}</div>
          </div>
        </div>
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => React.useContext(ToastCtx);
