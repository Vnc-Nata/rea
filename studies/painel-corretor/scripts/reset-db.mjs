import fs from "node:fs";
fs.rmSync(new URL("../data/db.json", import.meta.url), { force: true });
console.log("data/db.json removido. Os dados de exemplo serão recriados na próxima requisição.");
