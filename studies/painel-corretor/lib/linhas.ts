// Linha comercial do plano (Bronze, Prata, Ouro, Black, Efetivo, Clássico...), lida do nome registrado na ANS.
// A ANS não publica a linha; o nome do produto é a única fonte. Usada no seletor para agrupar os planos de uma
// operadora como no Painel (ex.: Amil Bronze / Prata / Ouro / Platinum / Black).

// Palavras que identificam uma linha, na forma exibida. A primeira que aparecer no nome (palavra inteira) vence.
const LINHAS = [
  "Bronze",
  "Prata",
  "Ouro",
  "Platinum",
  "Platina",
  "Black",
  "Diamante",
  "Cristal",
  "Esmeralda",
  "Rubi",
  "Safira",
  "Master",
  "Fácil",
  "Efetivo",
  "Ideal",
  "Flex",
  "Perfil",
  "Preferencial",
  "Top",
  "Nacional",
  "Básico",
  "Direto",
  "Exato",
  "Clássico",
  "Especial",
  "Executivo",
  "Prestige",
  "Smart",
  "Adapt",
  "Advance",
  "Infinity",
  "Premium",
  "Prime",
  "Nosso Plano",
  "Nosso Médico",
] as const;

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const CONHECIDAS = [
  ...LINHAS.map((l) => ({ linha: l as string, termos: semAcento(l).split(" ") })),
  { linha: "Nacional Plus", termos: ["nplus"] },
  { linha: "Nacional Plus", termos: ["nplusga"] },
  { linha: "Referência", termos: ["referencia"] },
];

// Marcas e siglas do começo do nome que não são linha.
const MARCAS = new Set(
  "amil bradesco saude bsaude operadora sulamerica sul america porto seguro hapvida notredame nd empresarial pme pj adesao".split(
    " ",
  ),
);

/**
 * Linha do plano a partir do nome: o primeiro termo depois da marca da operadora. Termo conhecido (Bronze, Efetivo,
 * Nosso Plano...) vira a forma exibida; número vira "Linha 200"; outro termo vira o próprio termo capitalizado.
 * Ex.: "Amil Empresarial Bronze SP QC" → Bronze; "Amil 400 QP Nacional" → Linha 400; "Bradesco Saúde Top Nacional
 * 2 E CE" → Top.
 */
export function linhaDoPlano(nome: string): string {
  const t = semAcento(nome)
    .split(/[^a-z0-9+]+/)
    .filter(Boolean);
  let i = 0;
  while (i < t.length && MARCAS.has(t[i])) i++;
  if (i >= t.length) return "Outros";
  for (const { linha, termos } of CONHECIDAS) if (termos.every((x, k) => t[i + k] === x)) return linha;
  if (/^\d+\+?$/.test(t[i])) return `Linha ${t[i]}`;
  return t[i].charAt(0).toUpperCase() + t[i].slice(1);
}

/** Percentual de coparticipação escrito no nome (ex.: "Copart 30%"), se houver. */
export function percentualCopartDoNome(nome: string): number | undefined {
  const m = /(\d{1,2})\s*%/.exec(nome);
  if (!m) return undefined;
  const v = Number(m[1]);
  return v > 0 && v <= 50 ? v : undefined;
}
