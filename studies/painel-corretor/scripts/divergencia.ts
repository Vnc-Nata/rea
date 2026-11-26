// Mede a divergência entre o nosso catálogo e os preços lidos no Painel do Corretor.
//
//   npx tsx --conditions=react-server scripts/divergencia.ts data/comparacoes/painel-2026-11-26.csv [rodada]
//
// Entrada (CSV com ; e cabeçalho): caso;cidade;perfil;modalidade;operadora;planoPainel;acomodacao;copart;totalPainel;planoNosso
// Saída: data/comparacoes/divergencia-<data>-r<rodada>.csv e relatorios/divergencia-<data>-r<rodada>.md.
// O preço "nosso" vem do mesmo catálogo e da mesma conta (ajustes) que o app usa.
import fs from "node:fs";
import path from "node:path";
import { catalogo, planosDaCidade } from "../lib/catalogo";
import {
  calibracao,
  corresponder,
  medir,
  metricas,
  metricasPor,
  type LinhaResultado,
  type Metricas,
  type ObsPainel,
} from "../lib/divergencia";
import { lerNumeroBR } from "../lib/numeros";

const [arq, rodada = "1"] = process.argv.slice(2);
if (!arq) throw new Error("uso: scripts/divergencia.ts <entrada.csv> [rodada]");

const linhas = fs.readFileSync(arq, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
const cab = linhas[0].split(";").map((s) => s.trim());
const obs: ObsPainel[] = linhas.slice(1).map((l) => {
  const c = l.split(";");
  const get = (k: string) => (c[cab.indexOf(k)] ?? "").trim();
  const total = lerNumeroBR(get("totalPainel"));
  if (total == null) throw new Error(`totalPainel inválido: ${l}`);
  return {
    caso: get("caso"),
    cidade: get("cidade"),
    perfil: get("perfil"),
    modalidade: (get("modalidade") || "PME") as ObsPainel["modalidade"],
    operadora: get("operadora"),
    planoPainel: get("planoPainel"),
    acomodacao: get("acomodacao") as ObsPainel["acomodacao"],
    copart: (get("copart") || "Sem") as ObsPainel["copart"],
    totalPainel: total,
    planoNosso: get("planoNosso") || undefined,
  };
});

const cat = catalogo();
const regDe = new Map(cat.operadoras.map((o) => [o.id, o.registroAns]));
const resultado: LinhaResultado[] = obs.map((o) =>
  medir(o, corresponder(o, planosDaCidade(cat, o.cidade), (id) => regDe.get(id) ?? "")),
);

const data = new Date().toISOString().slice(0, 10);
const dirCsv = path.join("data", "comparacoes");
const dirRel = "relatorios";
fs.mkdirSync(dirCsv, { recursive: true });
fs.mkdirSync(dirRel, { recursive: true });
const nome = `divergencia-${data}-r${rodada}`;

const br = (v: number | undefined) => (v == null ? "" : v.toFixed(2).replace(".", ","));
const colunas = [
  "caso", "cidade", "UF", "operadora", "perfil", "vidas", "modalidade", "plano no Painel", "acomodação", "coparticipação",
  "plano no nosso app", "registro ANS", "origem", "total Painel", "por vida Painel", "total nosso", "por vida nosso",
  "diferença %", "confiança", "candidatos",
];
const csv = [
  colunas.join(";"),
  ...resultado.map((r) =>
    [
      r.caso, r.cidade, r.cidade.slice(-2), r.operadora, r.perfil, r.vidas, r.modalidade, r.planoPainel, r.acomodacao,
      r.copart, r.planoNossoNome ?? "", r.codigoAns ?? "", r.origem ?? "", br(r.totalPainel), br(r.totalPainel / r.vidas),
      br(r.totalNosso), br(r.totalNosso != null ? r.totalNosso / r.vidas : undefined),
      r.diferencaPct != null ? String(r.diferencaPct).replace(".", ",") : "", r.confianca, r.candidatos,
    ].join(";"),
  ),
].join("\n");
fs.writeFileSync(path.join(dirCsv, `${nome}.csv`), "﻿" + csv);

const faixaDe = (r: LinhaResultado) => (r.perfil.includes(",") ? "mista" : r.perfil.split(":")[0]);
const tabela = (titulo: string, xs: [string, Metricas][]) =>
  [
    `### ${titulo}`,
    "",
    "| | casos | sem equiv. | mediana | média | p90 | ±2% | ±5% | ±10% |",
    "|---|---|---|---|---|---|---|---|---|",
    ...xs.map(
      ([k, m]) =>
        `| ${k} | ${m.casos} | ${m.semEquivalente} | ${m.mediana}% | ${m.media}% | ${m.p90}% | ${m.dentro2}% | ${m.dentro5}% | ${m.dentro10}% |`,
    ),
    "",
  ].join("\n");
const geral = metricas(resultado);
const piores = resultado
  .filter((r) => r.diferencaPct != null)
  .sort((a, b) => Math.abs(b.diferencaPct!) - Math.abs(a.diferencaPct!))
  .slice(0, 10);
const calib = metricasPor(resultado, (r) => r.operadora).map(([op]) => [op, calibracao(resultado.filter((r) => r.operadora === op))] as const);
const md = [
  `# Divergência com o Painel do Corretor: rodada ${rodada} (${data})`,
  "",
  `Diferença % = (nosso − Painel) / Painel, no total mensal. Métricas sobre a diferença absoluta.`,
  "",
  tabela("Geral", [["todos", geral]]),
  tabela("Por operadora", metricasPor(resultado, (r) => r.operadora)),
  tabela("Por UF", metricasPor(resultado, (r) => r.cidade.slice(-2))),
  tabela("Por cidade", metricasPor(resultado, (r) => r.cidade)),
  tabela("Por faixa etária", metricasPor(resultado, faixaDe)),
  tabela("Por origem do preço", metricasPor(resultado, (r) => r.origem ?? "sem equivalente")),
  tabela("Por confiança da correspondência", metricasPor(resultado, (r) => r.confianca)),
  "### Calibração sugerida (sobre o ajuste atual)",
  "",
  "| operadora | casos usados | ajuste sugerido | desvio padrão | consistente (< 3 pts) |",
  "|---|---|---|---|---|",
  ...calib.map(([op, c]) => `| ${op} | ${c.n} | ${c.sugerido}% | ${c.desvio} pts | ${c.consistente ? "sim" : "não"} |`),
  "",
  "### 10 maiores divergências",
  "",
  "| caso | cidade | operadora | plano Painel | plano nosso | Painel | nosso | dif. | confiança |",
  "|---|---|---|---|---|---|---|---|---|",
  ...piores.map(
    (r) =>
      `| ${r.caso} | ${r.cidade} | ${r.operadora} | ${r.planoPainel} (${r.acomodacao}, ${r.copart}) | ${r.planoNossoNome} | ${br(r.totalPainel)} | ${br(r.totalNosso)} | ${r.diferencaPct}% | ${r.confianca} |`,
  ),
  "",
].join("\n");
fs.writeFileSync(path.join(dirRel, `${nome}.md`), md);
console.log(md.split("### Por UF")[0]);
console.log(`CSV: ${path.join(dirCsv, `${nome}.csv`)}\nRelatório: ${path.join(dirRel, `${nome}.md`)}`);
