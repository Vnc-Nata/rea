// Ajuda do teste de navegador (tests/e2e/fluxos.sh): cria/remove uma cotação "legada", cujo plano não existe mais no catálogo.
//   node scripts/e2e-cotacao-legada.mjs            acrescenta a cotação a data/db.json e imprime o id
//   node scripts/e2e-cotacao-legada.mjs --remover <id>   remove a cotação criada
// Se o servidor roda em outra pasta de dados, defina DB_FILE (padrão: data/db.json deste projeto).
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const arquivo = process.env.DB_FILE ?? fileURLToPath(new URL("../data/db.json", import.meta.url));
if (!fs.existsSync(arquivo)) {
  console.error(`Base ${arquivo} não encontrada: abra o painel uma vez para ela ser criada.`);
  process.exit(1);
}
const db = JSON.parse(fs.readFileSync(arquivo, "utf8"));
const salvar = () => {
  fs.writeFileSync(arquivo + ".tmp", JSON.stringify(db, null, 2));
  fs.renameSync(arquivo + ".tmp", arquivo);
};

const i = process.argv.indexOf("--remover");
if (i >= 0) {
  const id = process.argv[i + 1];
  if (!id || !id.startsWith("cot-e2e-")) {
    console.error("Informe o id de uma cotação criada por este script (cot-e2e-...).");
    process.exit(1);
  }
  db.cotacoes = db.cotacoes.filter((c) => c.id !== id);
  salvar();
  console.log(`removida ${id}`);
} else {
  const id = `cot-e2e-${Date.now().toString(36)}`;
  const agora = new Date().toISOString();
  const vidas = Object.fromEntries(
    ["00-18", "19-23", "24-28", "29-33", "34-38", "39-43", "44-48", "49-53", "54-58", "59-999"].map((f) => [
      f,
      f === "24-28" ? 3 : 0,
    ]),
  );
  db.cotacoes.unshift({
    id,
    titulo: "E2E cotação legada",
    criadaEm: agora,
    criadaPor: "Usuário Demo",
    cnpj: "",
    grupos: [{ nome: "Geral", vidas }],
    cenarios: [{ id: `cen-${id}`, planoId: "plano-inexistente", comentario: "" }],
    filtro: { segmento: "Saúde", modalidade: "PME", cidade: "São Paulo - SP" },
    eventos: [{ tipo: "Criada", em: agora, por: "Usuário Demo" }],
    visualizacoes: 0,
  });
  salvar();
  console.log(id);
}
