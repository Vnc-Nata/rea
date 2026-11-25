import type { Conta, Db } from "./types";

/** Dados fictícios de configurações, criados na primeira vez que a seção é usada. */
export function contaPadrao(db: Db): Conta {
  return {
    corretora: {
      nome: db.perfil.corretora,
      cidade: "São Paulo - SP",
      facebook: "",
      instagram: "",
      linkedin: "",
      site: "",
    },
    usuarios: [
      { id: "usr-admin", nome: db.perfil.usuario, email: db.perfil.email, perfil: "Administrador", ativo: true },
      { id: "usr-consultor", nome: "Consultor Demo", email: "consultor@exemplo.com", perfil: "Usuário", equipeId: "eq-consultores", ativo: true },
    ],
    equipes: [{ id: "eq-consultores", nome: "Consultores" }],
    operadorasHabilitadas: [],
    maisInfoRelevantes: true,
    licencas: 3,
  };
}

export function lerConta(db: Db): Conta {
  return db.conta ?? contaPadrao(db);
}
