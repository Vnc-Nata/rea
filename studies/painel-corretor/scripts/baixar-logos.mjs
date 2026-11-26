#!/usr/bin/env node
// Baixa o ícone (favicon em 256 px) do site oficial de cada operadora listada em
// data/ans/logos.json ({ "<registro ANS>": "<domínio oficial>" }) e grava
// public/logos/<registro>.png. Logos são marcas de terceiros: a pasta fica fora do Git.
//
// Uso: npm run baixar-logos
//
// Falhas (sem rede, domínio sem ícone) só geram aviso; os demais logos continuam.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LISTA = path.join(RAIZ, "data", "ans", "logos.json");
const BASE = path.join(RAIZ, "data", "ans", "base.json");
const SAIDA = path.join(RAIZ, "public", "logos");

const dominios = JSON.parse(fs.readFileSync(LISTA, "utf8"));

// Com a base importada, mostra a razão social de cada registro para conferência.
let nomes = {};
try {
  const base = JSON.parse(fs.readFileSync(BASE, "utf8"));
  nomes = Object.fromEntries(base.operadoras.map((o) => [o.registroAns, o.nomeFantasia || o.razaoSocial]));
} catch {
  // sem base.json: segue sem os nomes
}

fs.mkdirSync(SAIDA, { recursive: true });
let ok = 0;
let falhas = 0;
for (const [registro, dominio] of Object.entries(dominios)) {
  const url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(dominio)}&sz=256`;
  const rotulo = `${registro} (${dominio}${nomes[registro] ? ` · ${nomes[registro]}` : ""})`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const tipo = r.headers.get("content-type") ?? "";
    if (!tipo.startsWith("image/")) throw new Error(`resposta não é imagem (${tipo || "sem tipo"})`);
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(path.join(SAIDA, `${registro}.png`), buf);
    console.log(`• ${rotulo}: ${(buf.length / 1024).toFixed(1)} KB`);
    ok++;
  } catch (e) {
    console.warn(`! ${rotulo}: não baixado (${e.message})`);
    falhas++;
  }
}
console.log(
  `• ${ok} logos gravados em ${path.relative(process.cwd(), SAIDA) || "."}${falhas ? `, ${falhas} falhas` : ""}`,
);
