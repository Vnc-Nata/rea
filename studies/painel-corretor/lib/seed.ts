import {
  FAIXAS,
  type Acomodacao,
  type Coparticipacao,
  type Cotacao,
  type Db,
  type Faixa,
  type Hospital,
  type Modalidade,
  type Operadora,
  type Plano,
  vidasVazias,
} from "./types";

// Gerador pseudoaleatório determinístico: o mesmo seed gera sempre os mesmos dados.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export const CIDADES = [
  "São Paulo - SP",
  "Campinas - SP",
  "Santos - SP",
  "Rio de Janeiro - RJ",
  "Belo Horizonte - MG",
  "Goiânia - GO",
  "Itapuranga - GO",
  "Curitiba - PR",
];

// Operadoras FICTÍCIAS. Nomes, registros e índices são inventados.
const OPERADORAS: Operadora[] = [
  { id: "op-aurora", nome: "Aurora Saúde", razaoSocial: "AURORA SAÚDE OPERADORA LTDA.", registroAns: "900101", cor: "#db2777", idss: 0.5292, reajuste: 11.2, reajusteAnterior: 11.1 },
  { id: "op-vitalis", nome: "Vitalis", razaoSocial: "VITALIS ASSISTÊNCIA MÉDICA S.A.", registroAns: "900202", cor: "#2563eb", idss: 0.7811, reajuste: 9.6, reajusteAnterior: 12.4 },
  { id: "op-horizonte", nome: "Horizonte Med", razaoSocial: "HORIZONTE MED PLANOS DE SAÚDE LTDA.", registroAns: "900303", cor: "#ea580c", idss: 0.6904, reajuste: 13.9, reajusteAnterior: 14.2 },
  { id: "op-serena", nome: "Serena Care", razaoSocial: "SERENA CARE SEGURO SAÚDE S.A.", registroAns: "900404", cor: "#0d9488", idss: 0.8423, reajuste: 8.1, reajusteAnterior: 9.0 },
  { id: "op-pulsar", nome: "Pulsar", razaoSocial: "PULSAR SAÚDE INTEGRADA LTDA.", registroAns: "900505", cor: "#7c3aed", idss: 0.6012, reajuste: 15.4, reajusteAnterior: 13.0 },
  { id: "op-alvorada", nome: "Alvorada Vida", razaoSocial: "ALVORADA VIDA COOPERATIVA MÉDICA", registroAns: "900606", cor: "#16a34a", idss: 0.7355, reajuste: 10.7, reajusteAnterior: 10.9 },
  { id: "op-norte", nome: "NorteSul Saúde", razaoSocial: "NORTESUL SAÚDE S.A.", registroAns: "900707", cor: "#dc2626", idss: 0.5577, reajuste: 12.3, reajusteAnterior: 11.8 },
  { id: "op-sorriso", nome: "Sorriso Pleno", razaoSocial: "SORRISO PLENO ODONTOLOGIA LTDA.", registroAns: "900808", cor: "#0891b2", idss: 0.8102, reajuste: 6.5, reajusteAnterior: 7.2 },
];

const HOSPITAIS: Hospital[] = [
  ["Hospital Santa Clara", "Bela Vista", "São Paulo - Centro"],
  ["Hospital Jardim Paulista", "Jardim Paulista", "São Paulo - Centro"],
  ["Maternidade Bem Nascer", "Bela Vista", "São Paulo - Centro"],
  ["Hospital Vila Nova", "Vila Mariana", "São Paulo - Sul"],
  ["Hospital Morumbi Sul", "Morumbi", "São Paulo - Sul"],
  ["Pronto Atendimento Ipiranga", "Ipiranga", "São Paulo - Sul"],
  ["Hospital Tatuapé", "Tatuapé", "São Paulo - Leste"],
  ["Hospital Penha", "Penha", "São Paulo - Leste"],
  ["Hospital Santana", "Santana", "São Paulo - Norte"],
  ["Hospital Lapa", "Lapa", "São Paulo - Oeste"],
  ["Hospital Pinheiros", "Pinheiros", "São Paulo - Oeste"],
  ["Hospital Campinas Centro", "Centro", "Campinas"],
  ["Hospital Goiás Central", "Setor Central", "Goiânia"],
  ["Hospital Copacabana", "Copacabana", "Rio de Janeiro - Zona Sul"],
  ["Hospital Savassi", "Savassi", "Belo Horizonte"],
].map(([nome, bairro, regiao], i) => ({ id: `h${i + 1}`, nome, bairro, regiao }));

const LINHAS: Array<{ nome: string; fator: number; acomodacao: Acomodacao; copart: Coparticipacao; pct?: number }> = [
  { nome: "Essencial", fator: 0.62, acomodacao: "Quarto Coletivo", copart: "Com coparticipação", pct: 30 },
  { nome: "Essencial Plus", fator: 0.78, acomodacao: "Quarto Individual", copart: "Com coparticipação", pct: 30 },
  { nome: "Especial", fator: 1.0, acomodacao: "Quarto Individual", copart: "Com coparticipação", pct: 20 },
  { nome: "Exclusivo", fator: 1.35, acomodacao: "Quarto Individual", copart: "Sem coparticipação" },
  { nome: "Prime", fator: 2.1, acomodacao: "Quarto Individual", copart: "Sem coparticipação" },
];

// Multiplicadores por faixa: a 10ª faixa pode ser no máximo 6x a 1ª (regra ANS).
const MULT: Record<Faixa, number> = {
  "00-18": 1,
  "19-23": 1.18,
  "24-28": 1.34,
  "29-33": 1.53,
  "34-38": 1.76,
  "39-43": 1.96,
  "44-48": 2.21,
  "49-53": 2.45,
  "54-58": 2.99,
  "59-999": 4.73,
};

const SERVICOS = ["H,PS", "H", "PS", "H,PS,M", "H¹", "H,PSA", "M"];

function gerarPlanos(): Plano[] {
  const r = rng(42);
  const planos: Plano[] = [];
  const modalidades: Modalidade[] = ["PF", "PME", "Adesão"];
  let n = 0;
  for (const op of OPERADORAS) {
    const dental = op.id === "op-sorriso";
    const base = dental ? 38 + r() * 20 : 390 + r() * 420;
    const linhas = dental ? LINHAS.slice(0, 2) : LINHAS.filter(() => r() > 0.25);
    for (const linha of linhas) {
      for (const modalidade of modalidades) {
        if (!dental && r() < 0.2) continue;
        n += 1;
        const fatorMod = modalidade === "PF" ? 1.22 : modalidade === "Adesão" ? 1.08 : 1;
        const b = base * linha.fator * fatorMod;
        const precos = Object.fromEntries(
          FAIXAS.map((f) => [f, Math.round(b * (dental ? 1 : MULT[f]) * 100) / 100]),
        ) as Record<Faixa, number>;
        const cidades = CIDADES.filter((c, i) => i === 0 || r() > 0.4);
        const rede = dental
          ? []
          : HOSPITAIS.filter(() => r() > 0.35 - linha.fator * 0.1).map((h) => ({
              hospitalId: h.id,
              servicos: SERVICOS[Math.floor(r() * SERVICOS.length)],
            }));
        planos.push({
          id: `p${n}`,
          operadoraId: op.id,
          nome: dental ? `Odonto ${linha.nome}` : `${linha.nome}${linha.fator > 1.2 && r() > 0.5 ? " Mais" : ""}`,
          registroAns: String(480000000 + Math.floor(r() * 9999999)),
          segmento: dental ? "Dental" : "Saúde",
          modalidade,
          acomodacao: dental ? "Quarto Coletivo" : linha.acomodacao,
          coparticipacao: linha.copart,
          percentualCopart: linha.pct,
          contratacao: r() > 0.5 ? "Opcional" : "Compulsória",
          aceitaMei: modalidade === "PME" && r() > 0.3,
          abrangencia: linha.fator >= 1.35 ? "Nacional" : linha.fator >= 1 ? "Estadual" : "Grupo de municípios",
          cidades,
          precos,
          rede,
          laboratorios: dental ? 0 : Math.round(40 + r() * 160),
        });
      }
    }
  }
  return planos;
}

const NOMES = [
  "Mariana Souza",
  "Pedro Almeida",
  "Clínica Bem-Estar",
  "Rafael Lima",
  "Família Oliveira",
  "Tech Solutions ME",
  "Juliana Costa",
  "Carlos Henrique",
];

function gerarCotacoes(planos: Plano[]): Cotacao[] {
  const r = rng(7);
  const agora = Date.now();
  return NOMES.map((titulo, i) => {
    const vidas = vidasVazias();
    const qtd = 1 + Math.floor(r() * 4);
    for (let k = 0; k < qtd; k++) vidas[FAIXAS[Math.floor(r() * FAIXAS.length)]] += 1;
    const pme = planos.filter((p) => p.modalidade === "PME" && p.segmento === "Saúde");
    const cenarios =
      i % 3 === 2
        ? []
        : Array.from({ length: 2 + (i % 2) }, (_, k) => ({
            id: `c${i}-${k}`,
            planoId: pme[Math.floor(r() * pme.length)].id,
            comentario: "",
          }));
    const criadaEm = new Date(agora - (i * 7 + 1) * 3600_000 * (1 + r() * 3)).toISOString();
    const visualizacoes = cenarios.length && r() > 0.5 ? 1 + Math.floor(r() * 4) : 0;
    return {
      id: `cot-${String(i + 1).padStart(3, "0")}`,
      titulo,
      criadaEm,
      criadaPor: "Usuário Demo",
      cnpj: "",
      grupos: [{ nome: "Geral", vidas }],
      cenarios,
      filtro: { segmento: "Saúde", modalidade: "PME", cidade: "São Paulo - SP" },
      eventos: [{ tipo: "Criada", em: criadaEm, por: "Usuário Demo" }],
      visualizacoes,
    } satisfies Cotacao;
  });
}

export function criarSeed(): Db {
  const planos = gerarPlanos();
  return {
    perfil: {
      corretora: "Corretora Demo",
      usuario: "Usuário Demo",
      telefone: "(11) 90000-0000",
      email: "demo@exemplo.com.br",
      mensagemPadrao:
        "Olá, tudo bem? Seguem as informações sobre os planos de saúde conforme combinamos. Por favor, clique no link abaixo e me avise caso tenha qualquer dúvida.",
    },
    operadoras: OPERADORAS,
    hospitais: HOSPITAIS,
    planos,
    cotacoes: gerarCotacoes(planos),
  };
}
