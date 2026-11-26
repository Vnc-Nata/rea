// Gera uma base ANS de EXEMPLO (determinística, sem rede) no mesmo formato de data/ans/base.json,
// mais rede.json e indicadores.json. Saída em tests/fixtures (ou no diretório passado como 1º argumento).
// Uso: npm run gerar-exemplo  |  ANS_DIR=tests/fixtures npm run dev
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(process.cwd(), process.argv[2] ?? "tests/fixtures");
const GERADO_EM = "2026-11-26T00:00:00.000Z";
const FAIXAS = [
  "00 a 18 anos",
  "19 a 23 anos",
  "24 a 28 anos",
  "29 a 33 anos",
  "34 a 38 anos",
  "39 a 43 anos",
  "44 a 48 anos",
  "49 a 53 anos",
  "54 a 58 anos",
  "59 anos ou mais",
];
// Razão de cada faixa sobre a primeira (a ANS limita 59+ a 6x a faixa 0-18).
const RAZAO = [1, 1.21, 1.46, 1.67, 1.81, 1.87, 2.24, 2.41, 2.98, 5.0];

const MUN = {
  sp: { codigo: "355030", nome: "SAO PAULO/SP" },
  scs: { codigo: "354880", nome: "SAO CAETANO DO SUL/SP" },
  bh: { codigo: "310620", nome: "BELO HORIZONTE/MG" },
  cps: { codigo: "350950", nome: "CAMPINAS/SP" },
};

const COL = "Coletivo empresarial",
  ADE = "Coletivo por adesão",
  IND = "Individual ou familiar";
const AH = ["Ambulatorial + Hospitalar com obstetrícia", "Ambulatorial + Hospitalar"];
const ODO = ["Odontológico", "Exclusivamente Odontológico"];
const REF = ["Referência", "Ambulatorial + Hospitalar"];

// Cada plano: [nome, contratacao, segmentação, abrangencia, copart, acomodacao, municípios, VCM faixa 0-18 (ou alvo), opções]
// opções: { alvo: [indiceFaixa, valor] } força o VCM de uma faixa; semVcm; variantes; nula59.
const GRUPOS = [
  {
    grupo: "Amil",
    registro: "326305",
    cnpj: "29309127000179",
    razao: "AMIL ASSISTENCIA MEDICA INTERNACIONAL S.A.",
    fantasia: "AMIL",
    modalidade: "Medicina de Grupo",
    uf: "SP",
    planos: [
      [
        "AMIL BRONZE SP QC COPART",
        COL,
        AH,
        "Municipal",
        true,
        "Coletiva",
        ["scs", "sp", "cps"],
        0,
        { alvo: [2, 179.18] },
      ],
      ["AMIL BRONZE SP QC", COL, AH, "Municipal", false, "Coletiva", ["scs", "sp"], 118],
      ["AMIL PRATA SP QP COPART", COL, AH, "Municipal", true, "Individual", ["sp", "cps"], 168],
      ["AMIL PRATA SP QC", ADE, AH, "Municipal", false, "Coletiva", ["sp", "scs"], 205],
      ["AMIL OURO NACIONAL QP", COL, AH, "Nacional", false, "Individual", ["sp", "bh", "cps"], 348],
      ["AMIL S450 REGIONAL SP QC", COL, AH, "Grupo de Municípios", true, "Coletiva", ["sp", "cps"], 190],
      ["AMIL ONE S2500 NACIONAL", COL, AH, "Nacional", false, "Individual", ["sp", "bh"], 690],
      ["AMIL FACIL INDIVIDUAL SP", IND, AH, "Municipal", true, "Coletiva", ["sp"], 150],
      ["AMIL DENTAL 205", COL, ODO, "Municipal", false, "Não se Aplica", ["sp", "scs"], 22],
      ["AMIL BLUE ADESAO SP QC", ADE, AH, "Municipal", true, "Coletiva", ["sp", "scs"], 160, { semVcm: true }],
    ],
  },
  {
    grupo: "Bradesco Saúde",
    registro: "005711",
    cnpj: "92693118000160",
    razao: "BRADESCO SAÚDE S/A",
    fantasia: "BRADESCO SAUDE",
    modalidade: "Seguradora Especializada em Saúde",
    uf: "RJ",
    planos: [
      [
        "NACIONAL II E CE",
        COL,
        AH,
        "Nacional",
        false,
        "Individual",
        ["sp", "bh", "cps"],
        0,
        { alvo: [6, 954.22], variantes: true },
      ],
      ["NACIONAL II E CA COPART", COL, AH, "Nacional", true, "Individual", ["sp", "bh"], 0, { alvo: [6, 842.1] }],
      ["EFETIVO III E CA", COL, AH, "Grupo de Municípios", true, "Coletiva", ["sp", "cps", "scs"], 270],
      ["EFETIVO II E CE", COL, AH, "Grupo de Municípios", false, "Coletiva", ["sp", "bh"], 310],
      ["NACIONAL PLUS PME", COL, AH, "Nacional", false, "Individual", ["sp", "bh", "cps"], 610],
      ["PREFERENCIAL REDE FLEX", COL, AH, "Nacional", true, "Individual", ["sp", "bh"], 480],
      ["TOP NACIONAL ADESAO", ADE, AH, "Nacional", false, "Individual", ["sp", "bh"], 830],
      ["SAUDE INDIVIDUAL SP", IND, AH, "Municipal", true, "Coletiva", ["sp"], 240],
      ["DENTAL IDEAL", COL, ODO, "Municipal", false, "Não se Aplica", ["sp", "bh"], 28],
      ["REFERENCIA AMBULATORIAL", COL, REF, "Nacional", false, "Não se Aplica", ["sp", "bh"], 140],
    ],
  },
  {
    grupo: "SulAmérica",
    registro: "006246",
    cnpj: "01685053000156",
    razao: "SUL AMÉRICA COMPANHIA DE SEGURO SAÚDE",
    fantasia: "SULAMERICA SAUDE",
    modalidade: "Seguradora Especializada em Saúde",
    uf: "RJ",
    planos: [
      ["DIRETO NACIONAL", COL, AH, "Nacional", false, "Coletiva", ["sp", "bh", "cps"], 260],
      ["DIRETO REGIONAL SP COPART", COL, AH, "Grupo de Municípios", true, "Coletiva", ["sp", "cps", "scs"], 210],
      ["ESPECIAL 100 NACIONAL", COL, AH, "Nacional", false, "Individual", ["sp", "bh"], 520],
      ["ESPECIAL 150 REDE FLEX", COL, AH, "Nacional", true, "Individual", ["sp", "bh"], 450],
      ["PRESTIGE NACIONAL", COL, AH, "Nacional", false, "Individual", ["sp", "bh", "cps"], 880],
      ["EXATO PROTEGIDO", ADE, AH, "Grupo de Municípios", true, "Coletiva", ["sp", "cps"], 230],
      ["CLASSICO ADESAO", ADE, AH, "Nacional", false, "Coletiva", ["sp", "bh"], 340],
      ["INDIVIDUAL SP", IND, AH, "Municipal", true, "Coletiva", ["sp"], 255],
      ["ODONTO EXECUTIVO", COL, ODO, "Municipal", false, "Não se Aplica", ["sp", "bh"], 25],
      ["REFERENCIA HOSPITALAR", COL, REF, "Nacional", false, "Não se Aplica", ["sp"], 150],
    ],
  },
  {
    grupo: "Porto Saúde",
    registro: "000582",
    cnpj: "04540010000170",
    razao: "PORTO SEGURO - SEGURO SAÚDE S/A",
    fantasia: "PORTO SEGURO SAUDE",
    modalidade: "Seguradora Especializada em Saúde",
    uf: "SP",
    planos: [
      ["PRATA PRO", COL, AH, "Municipal", false, "Individual", ["sp", "scs", "cps"], 290],
      ["PRATA PRO COPART", COL, AH, "Municipal", true, "Individual", ["sp", "scs"], 235],
      ["BRONZE MAIS", COL, AH, "Municipal", true, "Coletiva", ["sp", "cps"], 190],
      ["OURO NACIONAL", COL, AH, "Nacional", false, "Individual", ["sp", "bh"], 640],
      ["PLATINA NACIONAL", COL, AH, "Nacional", false, "Individual", ["sp", "bh", "cps"], 920],
      ["ESSENCIAL SAO PAULO", ADE, AH, "Municipal", true, "Coletiva", ["sp"], 205],
      ["MASTER I 910 PE", COL, AH, "Nacional", true, "Individual", ["sp", "bh"], 0, { alvo: [0, 954.22] }],
      ["INDIVIDUAL BRONZE", IND, AH, "Municipal", true, "Coletiva", ["sp"], 260],
      ["ODONTO BRONZE", COL, ODO, "Municipal", false, "Não se Aplica", ["sp", "scs"], 24],
      ["REFERENCIA PORTO", COL, REF, "Municipal", false, "Não se Aplica", ["sp"], 130],
    ],
  },
  {
    grupo: "Alice",
    registro: "421928",
    cnpj: "34266553000102",
    razao: "ALICE OPERADORA LTDA.",
    fantasia: "ALICE",
    modalidade: "Medicina de Grupo",
    uf: "SP",
    planos: [
      ["EQUILIBRIO", COL, AH, "Municipal", false, "Individual", ["sp"], 420, { nula59: true }],
      ["EQUILIBRIO PLUS", COL, AH, "Municipal", false, "Individual", ["sp", "cps"], 470],
      ["ESSENCIAL ALICE", COL, AH, "Municipal", true, "Coletiva", ["sp"], 320],
      ["ALICE EMPRESAS 50", COL, AH, "Municipal", false, "Individual", ["sp", "scs"], 395],
      ["ALICE CONECTA", ADE, AH, "Municipal", true, "Coletiva", ["sp"], 300],
      ["ALICE FAMILIA", IND, AH, "Municipal", false, "Individual", ["sp"], 450],
      ["ALICE REDE SELECIONADA", COL, AH, "Grupo de Municípios", true, "Coletiva", ["sp", "cps"], 340],
      ["ALICE ADESAO PROFISSIONAIS", ADE, AH, "Municipal", false, "Individual", ["sp"], 430],
      ["ALICE ODONTO", COL, ODO, "Municipal", false, "Não se Aplica", ["sp"], 26],
      ["ALICE REFERENCIA", COL, REF, "Municipal", false, "Não se Aplica", ["sp"], 150],
    ],
  },
  {
    grupo: "Hapvida NotreDame",
    registro: "368253",
    cnpj: "63554067000198",
    razao: "NOTRE DAME INTERMÉDICA SAÚDE S.A.",
    fantasia: "NOTREDAME INTERMEDICA",
    modalidade: "Medicina de Grupo",
    uf: "SP",
    planos: [
      ["NOSSO PLANO", COL, AH, "Municipal", true, "Coletiva", ["sp", "scs", "cps"], 105],
      ["NOSSO PLANO PLUS", COL, AH, "Municipal", true, "Coletiva", ["sp", "cps"], 130],
      ["SMART 200 SP", COL, AH, "Grupo de Municípios", true, "Coletiva", ["sp", "scs"], 150],
      ["SMART 300 NACIONAL", COL, AH, "Nacional", false, "Individual", ["sp", "bh"], 290],
      ["PREMIUM 500", COL, AH, "Nacional", false, "Individual", ["sp", "bh", "cps"], 520],
      ["BASICO ADESAO", ADE, AH, "Municipal", true, "Coletiva", ["sp"], 115],
      ["MIX ADESAO", ADE, AH, "Grupo de Municípios", false, "Coletiva", ["sp", "cps"], 190],
      ["INDIVIDUAL NOTREDAME", IND, AH, "Municipal", true, "Coletiva", ["sp"], 175],
      ["ODONTO NOTREDAME", COL, ODO, "Municipal", false, "Não se Aplica", ["sp", "bh"], 19],
      ["REFERENCIA NOTREDAME", COL, REF, "Municipal", false, "Não se Aplica", ["sp"], 100, { semVcm: true }],
    ],
  },
];

const r2 = (n) => Math.round(n * 100) / 100;

function montarVcm(base, opts, n) {
  const f = opts.alvo ? opts.alvo[1] / RAZAO[opts.alvo[0]] : base;
  const mk = (mult) => {
    const precos = RAZAO.map((r) => r2(f * r * mult));
    if (opts.alvo && mult === 1) precos[opts.alvo[0]] = opts.alvo[1];
    if (opts.nula59) precos[9] = null;
    return {
      precos,
      min: precos.map((p) => (p == null ? null : r2(p * 0.7))),
      max: precos.map((p) => (p == null ? null : r2(p * 1.3))),
    };
  };
  const variantes = { REGIONALIZADA: mk(1) };
  if (opts.variantes) variantes.UNICA = mk(1.12);
  return { nota: String(400000 + n * 37), data: "2026-08-27", atualizadoEm: "2026-11-24", variantes };
}

const operadoras = [];
const planos = [];
let n = 0;
for (const g of GRUPOS) {
  operadoras.push({
    registroAns: g.registro,
    grupo: g.grupo,
    cnpj: g.cnpj,
    razaoSocial: g.razao,
    nomeFantasia: g.fantasia,
    modalidade: g.modalidade,
    uf: g.uf,
    dataRegistro: "2000-01-01",
  });
  for (const [
    nome,
    contratacao,
    [segmentacao, segGrupo],
    abrangencia,
    copart,
    acomodacao,
    muns,
    base,
    opts = {},
  ] of g.planos) {
    n++;
    const odo = segGrupo === ODO[1];
    const municipios = muns.map((m) => MUN[m]);
    planos.push({
      id: String(1000000 + n),
      codigoAns: String(400000000 + n * 1013),
      nome,
      registroAns: g.registro,
      grupo: g.grupo,
      contratacao,
      segmentacao,
      segmentacaoGrupo: segGrupo,
      odontologico: odo,
      obstetricia: segmentacao.includes("com obstetrícia") ? "Com Obstetrícia" : "Não se Aplica",
      abrangencia,
      fatorModerador: copart ? "Coparticipação" : "Ausente",
      acomodacao,
      livreEscolha: n % 7 === 0 ? "Parcial sem internação" : "Ausente",
      dataRegistro: `${2005 + (n % 15)}-0${1 + (n % 9)}-15`,
      vcm: opts.semVcm ? null : montarVcm(base, opts, n),
      ufs: [...new Set(municipios.map((m) => m.nome.split("/")[1]))].sort(),
      municipios,
    });
  }
}

const base = {
  geradoEm: GERADO_EM,
  fonte: "exemplo",
  ufsDetalhadas: ["SP", "MG"],
  faixas: FAIXAS,
  operadoras,
  planos,
};

const hospitais = {
  2077485: {
    nome: "Hospital Sírio-Libanês (exemplo)",
    municipio: "SAO PAULO/SP",
    uf: "SP",
    classe: "Geral",
    urgencia: true,
  },
  2078015: {
    nome: "Hospital Albert Einstein (exemplo)",
    municipio: "SAO PAULO/SP",
    uf: "SP",
    classe: "Geral",
    urgencia: true,
  },
  2079275: {
    nome: "Hospital São Camilo Pompeia (exemplo)",
    municipio: "SAO PAULO/SP",
    uf: "SP",
    classe: "Geral",
    urgencia: true,
  },
  2080192: {
    nome: "Maternidade Santa Joana (exemplo)",
    municipio: "SAO PAULO/SP",
    uf: "SP",
    classe: "Especializado",
    urgencia: false,
  },
  2082616: {
    nome: "Hospital São Caetano (exemplo)",
    municipio: "SAO CAETANO DO SUL/SP",
    uf: "SP",
    classe: "Geral",
    urgencia: true,
  },
  2091607: {
    nome: "Hospital PUC Campinas (exemplo)",
    municipio: "CAMPINAS/SP",
    uf: "SP",
    classe: "Geral",
    urgencia: true,
  },
  2126494: {
    nome: "Hospital Mater Dei (exemplo)",
    municipio: "BELO HORIZONTE/MG",
    uf: "MG",
    classe: "Geral",
    urgencia: true,
  },
  2695324: {
    nome: "Hospital Vila da Serra (exemplo)",
    municipio: "BELO HORIZONTE/MG",
    uf: "MG",
    classe: "Geral",
    urgencia: false,
  },
};
const cnesPorMun = {};
for (const [cnes, h] of Object.entries(hospitais)) (cnesPorMun[h.municipio] ||= []).push(cnes);
const porPlano = {};
for (const p of planos) {
  const todos = p.municipios.flatMap((m) => cnesPorMun[m.nome] ?? []);
  porPlano[p.id] = [...new Set(p.odontologico ? [] : todos)].sort();
}
const rede = { geradoEm: GERADO_EM, hospitais, porPlano };

const idss = {
  Amil: 0.78,
  "Bradesco Saúde": 0.91,
  SulAmérica: 0.86,
  "Porto Saúde": 0.88,
  Alice: 0.72,
  "Hapvida NotreDame": 0.8,
};
const reaj = {
  Amil: [13.5, 11.9],
  "Bradesco Saúde": [15.8, 14.2],
  SulAmérica: [14.1, 12.6],
  "Porto Saúde": [12.7, 10.4],
  Alice: [11.2, 9.8],
  "Hapvida NotreDame": [10.9, 9.5],
};
const indicadores = { geradoEm: GERADO_EM, porOperadora: {} };
for (const g of GRUPOS) {
  indicadores.porOperadora[g.registro] = {
    idss: idss[g.grupo],
    idssAno: 2025,
    reajuste: reaj[g.grupo][0],
    reajusteAnterior: reaj[g.grupo][1],
    ciclo: 2026,
  };
}

fs.mkdirSync(OUT, { recursive: true });
for (const [arq, dados] of [
  ["base.json", base],
  ["rede.json", rede],
  ["indicadores.json", indicadores],
]) {
  fs.writeFileSync(path.join(OUT, arq), JSON.stringify(dados, null, 2) + "\n");
}
console.log(
  `Exemplo gerado em ${OUT}: ${operadoras.length} operadoras, ${planos.length} planos, ${Object.keys(hospitais).length} hospitais.`,
);
