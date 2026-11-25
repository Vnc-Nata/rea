export const GRUPOS = [
  { titulo: "Geral", itens: [["perfil", "Perfil"], ["corretora", "Conta"]] },
  {
    titulo: "Conta",
    itens: [
      ["assinatura", "Plano e Assinatura"],
      ["usuarios", "Usuários"],
      ["equipes", "Equipes"],
      ["integracoes", "Integrações"],
      ["preferencias", "Preferências"],
    ],
  },
];
export const SECOES = Object.fromEntries(GRUPOS.flatMap((g) => g.itens));

