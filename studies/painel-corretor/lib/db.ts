import "server-only";
import fs from "node:fs";
import path from "node:path";
import { criarSeed } from "./seed";
import type { Db } from "./types";

// "Banco" local em JSON. Apague data/db.json (ou rode `npm run reset-db`) para voltar aos dados iniciais.
const FILE = path.join(process.cwd(), "data", "db.json");

export function readDb(): Db {
  if (!fs.existsSync(FILE)) {
    const seed = criarSeed();
    writeDb(seed);
    return seed;
  }
  return JSON.parse(fs.readFileSync(FILE, "utf8")) as Db;
}

export function writeDb(db: Db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

export function updateDb<T>(fn: (db: Db) => T): T {
  const db = readDb();
  const out = fn(db);
  writeDb(db);
  return out;
}
