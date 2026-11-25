import { PerfilForm } from "@/components/perfil-form";
import { readDb } from "@/lib/db";

export default function Perfil() {
  return <PerfilForm perfil={readDb().perfil} />;
}
