// Gera uma base ANS SINTÉTICA GRANDE (determinística) no formato de data/ans/base.json + rede.json + indicadores.json,
// para medir o desempenho do catálogo (não é usada pela interface). Tamanho parecido com a base real de SP+MG:
// ≥ 500 operadoras, ≥ 20.000 planos, ~1.500 municípios, rede com ≥ 1 milhão de vínculos plano→hospital.
//
//   node scripts/gerar-base-grande.mjs /tmp/base-grande       (pasta de saída obrigatória; fora do projeto)
//   ANS_DIR=/tmp/base-grande npx next dev -p 3105
//   ANS_DIR=/tmp/base-grande npx tsx --conditions=react-server scripts/medir-catalogo.ts "Belo Horizonte - MG"
//
// Inclui as operadoras-alvo reais (Amil 326305 etc.) e os municípios de São Paulo, São Caetano do Sul, Campinas e
// Belo Horizonte, para que o teste de navegador (tests/e2e/fluxos.sh) rode contra ela.
import fs from "node:fs";
import path from "node:path";

const destino = process.argv[2];
if (!destino) {
  console.error("Informe a pasta de saída: node scripts/gerar-base-grande.mjs /tmp/base-grande");
  process.exit(1);
}
const OUT = path.resolve(destino);
const N_OPERADORAS = 550;
const N_PLANOS = 20_000;
const N_HOSPITAIS = 3_000;

// PRNG determinístico (mulberry32)
let semente = 20261126;
const rnd = () => {
  semente |= 0;
  semente = (semente + 0x6d2b79f5) | 0;
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
const amostra = (xs, n) => {
  const copia = xs.slice();
  for (let i = 0; i < n && i < copia.length; i++) {
    const j = i + Math.floor(rnd() * (copia.length - i));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia.slice(0, n);
};

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
const RAZAO = [1, 1.21, 1.46, 1.67, 1.81, 1.87, 2.24, 2.41, 2.98, 5.0];

// Municípios: 4 reais + sintéticos até 645 em SP e 853 em MG.
const REAIS = {
  SP: [
    { codigo: "355030", nome: "SAO PAULO/SP" },
    { codigo: "354880", nome: "SAO CAETANO DO SUL/SP" },
    { codigo: "350950", nome: "CAMPINAS/SP" },
  ],
  MG: [{ codigo: "310620", nome: "BELO HORIZONTE/MG" }],
};
const MUN = { SP: [...REAIS.SP], MG: [...REAIS.MG] };
for (const [uf, total, pref] of [
  ["SP", 645, "35"],
  ["MG", 853, "31"],
]) {
  for (let i = MUN[uf].length; i < total; i++)
    MUN[uf].push({ codigo: `${pref}${String(9000 + i).padStart(4, "0")}`, nome: `MUNICIPIO ${uf} ${i}/${uf}` });
}
const CAPITAL = { SP: REAIS.SP, MG: REAIS.MG };

const ALVO = [
  ["326305", "Amil", "AMIL ASSISTENCIA MEDICA INTERNACIONAL S.A.", "AMIL", "Medicina de Grupo"],
  ["005711", "Bradesco Saúde", "BRADESCO SAÚDE S/A", "BRADESCO SAUDE", "Seguradora Especializada em Saúde"],
  ["421715", "Bradesco Saúde", "BRADESCO SAUDE - OPERADORA DE PLANOS S/A", null, "Medicina de Grupo"],
  [
    "006246",
    "SulAmérica",
    "SUL AMÉRICA COMPANHIA DE SEGURO SAÚDE",
    "SULAMERICA SAUDE",
    "Seguradora Especializada em Saúde",
  ],
  ["416428", "SulAmérica", "SULAMERICA SERVIÇOS DE SAÚDE S.A.", null, "Medicina de Grupo"],
  [
    "000582",
    "Porto Saúde",
    "PORTO SEGURO - SEGURO SAÚDE S/A",
    "PORTO SEGURO SAUDE",
    "Seguradora Especializada em Saúde",
  ],
  ["417491", "Porto Saúde", "PORTO SAÚDE OPERADORA DE PLANOS S.A.", null, "Medicina de Grupo"],
  ["421928", "Alice", "ALICE OPERADORA LTDA", "ALICE", "Medicina de Grupo"],
  ["368253", "Hapvida NotreDame", "HAPVIDA ASSISTENCIA MEDICA S.A.", "HAPVIDA", "Medicina de Grupo"],
  ["359017", "Hapvida NotreDame", "NOTRE DAME INTERMEDICA SAUDE S.A.", "NOTREDAME", "Medicina de Grupo"],
];
const operadoras = ALVO.map(([registroAns, grupo, razaoSocial, nomeFantasia, modalidade]) => ({
  registroAns,
  grupo,
  cnpj: String(10_000_000_000_000 + Number(registroAns)).padStart(14, "0"),
  razaoSocial,
  nomeFantasia,
  modalidade,
  uf: "SP",
  dataRegistro: "2000-01-01",
}));
const MODALIDADES_OP = [
  "Medicina de Grupo",
  "Cooperativa Médica",
  "Autogestão",
  "Filantropia",
  "Seguradora Especializada em Saúde",
];
for (let i = operadoras.length; i < N_OPERADORAS; i++) {
  const registroAns = String(300000 + i * 7).padStart(6, "0");
  const uf = rnd() < 0.55 ? "SP" : "MG";
  operadoras.push({
    registroAns,
    grupo: "",
    cnpj: String(20_000_000_000_000 + i).padStart(14, "0"),
    razaoSocial: `OPERADORA SINTETICA ${i} LTDA`,
    nomeFantasia: rnd() < 0.5 ? `SINTETICA ${i} SAUDE` : null,
    modalidade: pick(MODALIDADES_OP),
    uf,
    dataRegistro: "2005-01-01",
  });
}

// Hospitais (SP 60%, MG 40%), com peso maior nas capitais.
const hospitais = {};
const hospPorUf = { SP: [], MG: [] };
for (let i = 0; i < N_HOSPITAIS; i++) {
  const uf = i < N_HOSPITAIS * 0.6 ? "SP" : "MG";
  const mun = rnd() < 0.35 ? pick(CAPITAL[uf]) : pick(MUN[uf]);
  const cnes = String(2_000_000 + i * 13);
  hospitais[cnes] = {
    nome: `HOSPITAL SINTETICO ${i}`,
    municipio: mun.nome,
    uf,
    classe: rnd() < 0.7 ? "Geral" : "Especializado",
    urgencia: rnd() < 0.6,
  };
  hospPorUf[uf].push(cnes);
}

const CONTRATACOES = ["Coletivo empresarial", "Coletivo empresarial", "Coletivo por adesão", "Individual ou familiar"];
const SEGMENTOS = [
  ["Ambulatorial + Hospitalar com obstetrícia", "Ambulatorial + Hospitalar", false],
  ["Ambulatorial + Hospitalar sem obstetrícia", "Ambulatorial + Hospitalar", false],
  ["Referência", "Ambulatorial + Hospitalar", false],
  ["Odontológico", "Exclusivamente Odontológico", true],
];
const planos = [];
const porPlano = {};
let vinculos = 0;
for (let i = 0; i < N_PLANOS; i++) {
  const op = i < 2_000 ? operadoras[i % ALVO.length] : operadoras[int(ALVO.length, operadoras.length - 1)];
  const [segmentacao, segmentacaoGrupo, odontologico] = rnd() < 0.85 ? pick(SEGMENTOS.slice(0, 3)) : SEGMENTOS[3];
  const uf = rnd() < 0.6 ? "SP" : "MG";
  const r = rnd();
  let abrangencia, municipios, ufs;
  if (r < 0.4) {
    abrangencia = "Municipal";
    municipios = [...new Set([...amostra(CAPITAL[uf], 1), ...amostra(MUN[uf], int(0, 4))])];
    ufs = [uf];
  } else if (r < 0.75) {
    abrangencia = "Grupo de municípios";
    municipios = [...new Set([...amostra(CAPITAL[uf], int(0, CAPITAL[uf].length)), ...amostra(MUN[uf], int(10, 60))])];
    ufs = [uf];
  } else if (r < 0.9) {
    abrangencia = "Estadual";
    municipios = MUN[uf].slice();
    ufs = [uf];
  } else {
    abrangencia = "Nacional";
    municipios = [];
    ufs = [];
  }
  const p0 = odontologico ? int(20, 80) : int(90, 900);
  const precos = RAZAO.map((k) => Math.round(p0 * k * 100) / 100);
  if (rnd() < 0.03) precos[9] = null; // VCM faltando em uma faixa
  const id = String(5_000_000 + i);
  const semVcm = rnd() < 0.05;
  planos.push({
    id,
    codigoAns: String(400_000_000 + i),
    nome: `${(op.nomeFantasia ?? op.razaoSocial).toUpperCase()} PLANO ${i} ${uf}`,
    registroAns: op.registroAns,
    grupo: op.grupo,
    contratacao: pick(CONTRATACOES),
    segmentacao,
    segmentacaoGrupo,
    odontologico,
    obstetricia: segmentacao.includes("com obstetrícia") ? "Com Obstetrícia" : "Sem Obstetrícia",
    abrangencia,
    fatorModerador: rnd() < 0.5 ? "Coparticipação" : "Ausente",
    acomodacao: rnd() < 0.5 ? "Coletiva" : "Individual",
    livreEscolha: "Ausente",
    dataRegistro: "2015-01-01",
    vcm: semVcm
      ? null
      : {
          nota: String(400_000 + i),
          data: "2026-08-01",
          atualizadoEm: "2026-11-24",
          variantes: {
            [abrangencia.toUpperCase()]: {
              precos,
              min: precos.map((v) => (v == null ? null : Math.round(v * 70) / 100)),
              max: precos.map((v) => (v == null ? null : Math.round(v * 130) / 100)),
            },
          },
        },
    ufs,
    municipios,
  });
  if (!odontologico) {
    const doUf = ufs.length ? hospPorUf[uf] : [...hospPorUf.SP, ...hospPorUf.MG];
    const rede = amostra(doUf, int(30, 100));
    porPlano[id] = rede;
    vinculos += rede.length;
  }
}

const indicadores = { geradoEm: "2026-11-26T00:00:00.000Z", porOperadora: {} };
for (const o of operadoras)
  if (rnd() < 0.6)
    indicadores.porOperadora[o.registroAns] = {
      idss: Math.round(rnd() * 10000) / 10000,
      idssAno: 2025,
      reajuste: Math.round(rnd() * 200) / 10,
      ciclo: 2026,
    };

fs.mkdirSync(OUT, { recursive: true });
const base = {
  geradoEm: "2026-11-26T00:00:00.000Z",
  fonte: "sintetica",
  ufsDetalhadas: ["SP", "MG"],
  faixas: FAIXAS,
  operadoras,
  planos,
};
// Escrita em pedaços: JSON.stringify da base inteira de uma vez estoura a string máxima em algumas versões.
const escrever = (arq, cab, lista, rodape) => {
  const fd = fs.openSync(path.join(OUT, arq), "w");
  fs.writeSync(fd, cab);
  lista.forEach((x, i) => fs.writeSync(fd, (i ? "," : "") + JSON.stringify(x)));
  fs.writeSync(fd, rodape);
  fs.closeSync(fd);
};
const { planos: _p, ...semPlanos } = base;
escrever("base.json", JSON.stringify(semPlanos).slice(0, -1) + ',"planos":[', planos, "]}");
fs.writeFileSync(path.join(OUT, "rede.json"), JSON.stringify({ geradoEm: base.geradoEm, hospitais, porPlano }));
fs.writeFileSync(path.join(OUT, "indicadores.json"), JSON.stringify(indicadores));
fs.mkdirSync(path.join(OUT, "tabelas"), { recursive: true });

const mb = (arq) => (fs.statSync(path.join(OUT, arq)).size / 1e6).toFixed(1);
console.log(
  `Base sintética em ${OUT}: ${operadoras.length} operadoras, ${planos.length} planos, ` +
    `${MUN.SP.length + MUN.MG.length} municípios, ${Object.keys(hospitais).length} hospitais, ${vinculos} vínculos de rede ` +
    `(base.json ${mb("base.json")} MB, rede.json ${mb("rede.json")} MB).`,
);
