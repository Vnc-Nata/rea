import { create } from "@/app/actions";
import { Button } from "@/components/ui";

export default function NovaCotacao() {
  return (
    <form action={create} className="flex">
      <div className="relative flex w-full items-center justify-end rounded-sm bg-background shadow-sm">
        <input
          name="titulo"
          autoFocus
          required
          maxLength={50}
          placeholder="Informe um título para cotação..."
          className="w-full bg-transparent px-4 py-4 text-xl focus:outline-none"
        />
        <Button type="submit" size="sm" className="absolute mr-2">
          Confirmar
        </Button>
      </div>
    </form>
  );
}
