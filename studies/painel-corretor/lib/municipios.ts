// Rótulos de município a partir dos nomes da ANS ("SAO CAETANO DO SUL/SP" → "São Caetano do Sul - SP").
// A ANS publica nomes em caixa alta e sem acento; os acentos vêm de uma tabela das palavras mais comuns.

const ACENTOS: Record<string, string> = {
  SAO: "São",
  JOAO: "João",
  JOSE: "José",
  LUIS: "Luís",
  CONCEICAO: "Conceição",
  GONCALO: "Gonçalo",
  ANDRE: "André",
  BARBARA: "Bárbara",
  RIBEIRAO: "Ribeirão",
  GOIANIA: "Goiânia",
  ANAPOLIS: "Anápolis",
  BRASILIA: "Brasília",
  VITORIA: "Vitória",
  FLORIANOPOLIS: "Florianópolis",
  MACEIO: "Maceió",
  CUIABA: "Cuiabá",
  VARZEA: "Várzea",
  BELEM: "Belém",
  MACAPA: "Macapá",
  JUNDIAI: "Jundiaí",
  TAUBATE: "Taubaté",
  GUARUJA: "Guarujá",
  MAUA: "Mauá",
  POA: "Poá",
  ARUJA: "Arujá",
  CARAPICUIBA: "Carapicuíba",
  JACAREI: "Jacareí",
  ARACATUBA: "Araçatuba",
  MARILIA: "Marília",
  SUMARE: "Sumaré",
  HORTOLANDIA: "Hortolândia",
  PAULINIA: "Paulínia",
  BRAGANCA: "Bragança",
  TABOAO: "Taboão",
  PARNAIBA: "Parnaíba",
  UBERLANDIA: "Uberlândia",
  IBIRITE: "Ibirité",
  SABARA: "Sabará",
  POCOS: "Poços",
  DIVINOPOLIS: "Divinópolis",
  TEOFILO: "Teófilo",
  ITAUNA: "Itaúna",
  NITEROI: "Niterói",
  IGUACU: "Iguaçu",
  PETROPOLIS: "Petrópolis",
  MACAE: "Macaé",
  MAGE: "Magé",
  ITABORAI: "Itaboraí",
  MARICA: "Maricá",
  CHAPECO: "Chapecó",
  CRICIUMA: "Criciúma",
  ITAJAI: "Itajaí",
  PALHOCA: "Palhoça",
  MARINGA: "Maringá",
  PARANA: "Paraná",
  PARA: "Pará",
  JABOATAO: "Jaboatão",
  CAMACARI: "Camaçari",
  ILHEUS: "Ilhéus",
  GRAVATAI: "Gravataí",
  CAPAO: "Capão",
  LAURO: "Lauro",
  CORREGO: "Córrego",
  LIMOEIRO: "Limoeiro",
  ESPIRITO: "Espírito",
  AGUAS: "Águas",
  AGUA: "Água",
  LINDOIA: "Lindóia",
  // palavras comuns em nomes de operadoras
  SAUDE: "Saúde",
  MEDICA: "Médica",
  ASSISTENCIA: "Assistência",
  INTERMEDICA: "Intermédica",
  SULAMERICA: "SulAmérica",
  ODONTOLOGICA: "Odontológica",
};

const MINUSCULAS = new Set(["DE", "DA", "DO", "DAS", "DOS", "E"]);

function palavra(p: string, primeira: boolean): string {
  if (!p) return p;
  // "D'OESTE" → "d'Oeste"
  const ap = /^D'(.+)$/.exec(p);
  if (ap) return `${primeira ? "D" : "d"}'${palavra(ap[1], true)}`;
  if (!primeira && MINUSCULAS.has(p)) return p.toLowerCase();
  if (ACENTOS[p]) return ACENTOS[p];
  return p.charAt(0) + p.slice(1).toLowerCase();
}

/** Caixa título pt-BR com acentos das palavras mais comuns; preposições em minúsculas. */
export function capitalizar(nome: string): string {
  return nome
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .map((p, i) =>
      p
        .split("-")
        .map((q, j) => palavra(q, i === 0 && j === 0))
        .join("-"),
    )
    .join(" ");
}

/** "SAO CAETANO DO SUL/SP" → "São Caetano do Sul - SP". */
export function rotuloMunicipio(nomeAns: string): string {
  const i = nomeAns.lastIndexOf("/");
  if (i < 0) return capitalizar(nomeAns);
  return `${capitalizar(nomeAns.slice(0, i))} - ${nomeAns
    .slice(i + 1)
    .trim()
    .toUpperCase()}`;
}

const UF_IBGE: Record<string, string> = {
  "11": "RO",
  "12": "AC",
  "13": "AM",
  "14": "RR",
  "15": "PA",
  "16": "AP",
  "17": "TO",
  "21": "MA",
  "22": "PI",
  "23": "CE",
  "24": "RN",
  "25": "PB",
  "26": "PE",
  "27": "AL",
  "28": "SE",
  "29": "BA",
  "31": "MG",
  "32": "ES",
  "33": "RJ",
  "35": "SP",
  "41": "PR",
  "42": "SC",
  "43": "RS",
  "50": "MS",
  "51": "MT",
  "52": "GO",
  "53": "DF",
};

/** UF pelo código IBGE do município (2 primeiros dígitos); "" se desconhecido. */
export function ufDoCodigo(codigoIbge: string): string {
  return UF_IBGE[codigoIbge.replace(/\D/g, "").slice(0, 2)] ?? "";
}
