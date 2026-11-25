// Modelo de dados reconstruído a partir das telas e dos nomes de server actions
// observados no app de referência (ver ANALISE.md). Todos os dados são fictícios.

export const FAIXAS = [
  "00-18",
  "19-23",
  "24-28",
  "29-33",
  "34-38",
  "39-43",
  "44-48",
  "49-53",
  "54-58",
  "59-999",
] as const;
export type Faixa = (typeof FAIXAS)[number];

export type Segmento = "Saúde" | "Dental";
export type Modalidade = "PF" | "PME" | "Adesão";
export type Acomodacao = "Quarto Coletivo" | "Quarto Individual";
export type Coparticipacao = "Com coparticipação" | "Sem coparticipação";
export type Contratacao = "Opcional" | "Compulsória";

export interface Operadora {
  id: string;
  nome: string;
  razaoSocial: string;
  registroAns: string;
  cor: string; // cor usada no "logotipo" textual
  idss: number;
  reajuste: number; // % reajuste anual atual
  reajusteAnterior: number;
}

export interface Hospital {
  id: string;
  nome: string;
  bairro: string;
  regiao: string;
}

export interface RedeItem {
  hospitalId: string;
  servicos: string; // ex.: "H,PS" (Hospital, Pronto-socorro, Maternidade...)
}

export interface Plano {
  id: string;
  operadoraId: string;
  nome: string;
  registroAns: string;
  segmento: Segmento;
  modalidade: Modalidade;
  acomodacao: Acomodacao;
  coparticipacao: Coparticipacao;
  percentualCopart?: number;
  contratacao: Contratacao;
  aceitaMei: boolean;
  abrangencia: "Municipal" | "Grupo de municípios" | "Estadual" | "Nacional";
  cidades: string[];
  precos: Record<Faixa, number>;
  rede: RedeItem[];
  laboratorios: number;
}

export interface Grupo {
  nome: string;
  vidas: Record<Faixa, number>;
}

export interface Cenario {
  id: string;
  planoId: string;
  comentario: string;
  destaque?: boolean;
}

/** Opções de envio (menu ⋮ › Opções, rota ?d=flags no app de referência). */
export interface OpcoesEnvio {
  validade?: string; // AAAA-MM-DD; depois dela a proposta pública mostra "expirada"
  valores: boolean;
  rede: boolean;
  maisInfo: boolean;
}
export const OPCOES_PADRAO: OpcoesEnvio = { valores: true, rede: true, maisInfo: true };

export interface Evento {
  tipo: "Criada" | "Enviada" | "Visualizada" | "Plano adicionado" | "Plano removido" | "Duplicada";
  em: string;
  por: string;
}

export interface FiltroCotacao {
  segmento: Segmento;
  modalidade: Modalidade;
  cidade: string;
}

export interface Cotacao {
  id: string;
  titulo: string;
  criadaEm: string;
  criadaPor: string;
  cnpj: string;
  grupos: Grupo[];
  cenarios: Cenario[];
  filtro: FiltroCotacao;
  eventos: Evento[];
  visualizacoes: number;
  opcoes?: OpcoesEnvio;
  contato?: string;
  negocio?: string;
}

export interface Perfil {
  corretora: string;
  usuario: string;
  telefone: string;
  email: string;
  mensagemPadrao: string;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: "Administrador" | "Usuário";
  equipeId?: string;
  ativo: boolean;
}

export interface Equipe {
  id: string;
  nome: string;
}

export interface Conta {
  corretora: { nome: string; cidade: string; facebook: string; instagram: string; linkedin: string; site: string };
  usuarios: Usuario[];
  equipes: Equipe[];
  apiKey?: string;
  operadorasHabilitadas: string[]; // vazio = todas
  maisInfoRelevantes: boolean;
  licencas: number;
}

export interface Db {
  conta?: Conta;
  perfil: Perfil;
  operadoras: Operadora[];
  hospitais: Hospital[];
  planos: Plano[];
  cotacoes: Cotacao[];
}

export function faixaLabel(f: Faixa) {
  const [a, b] = f.split("-");
  return b === "999" ? `${a} anos ou mais` : `${a} a ${b} anos`;
}

export function vidasVazias(): Record<Faixa, number> {
  return Object.fromEntries(FAIXAS.map((f) => [f, 0])) as Record<Faixa, number>;
}

export function faixaDaIdade(idade: number): Faixa {
  return FAIXAS.find((f) => idade <= Number(f.split("-")[1])) ?? "59-999";
}
