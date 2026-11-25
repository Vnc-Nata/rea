import { cn } from "./utils";

// Variantes copiadas do componente Button observado no bundle (shadcn/ui + cva).
const base =
  "flex items-center justify-center gap-1 rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
const variants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  outline: "border border-input hover:bg-accent hover:text-accent-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "underline-offset-4 hover:text-primary/80 text-primary font-normal inline-block p-0 m-0 text-left",
  icon: "hover:bg-accent hover:text-accent-foreground h-auto w-auto rounded-full p-1",
  reverse: "bg-background hover:bg-background/75",
  whatsapp: "bg-green-600 text-white hover:bg-green-700",
};
const sizes = {
  default: "h-10 py-2 px-4",
  sm: "h-9 px-3 rounded-md",
  lg: "h-11 px-8 rounded-md",
  auto: "py-1",
  square: "p-2 h-10 w-10",
};
export type ButtonProps = {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function buttonClass({ variant = "default", size = "default" }: ButtonProps = {}, className?: string) {
  const s = variant === "link" || variant === "icon" ? "" : sizes[size];
  return cn(base, variants[variant], s, className);
}

