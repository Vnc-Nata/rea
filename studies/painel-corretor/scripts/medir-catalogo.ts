// Mede o tempo do catálogo e do seletor de planos (server action buscarPlanos) numa base ANS grande.
// Não é usado pela interface. Gere a base com scripts/gerar-base-grande.mjs e rode:
//
//   ANS_DIR=/tmp/base-grande npx tsx --conditions=react-server scripts/medir-catalogo.ts ["Belo Horizonte - MG"]
//
// Mede selecaoPlanos, o corpo da server action (o import de app/actions não roda fora do Next).
// Imprime: leitura+conversão do catálogo (frio), buscarPlanos frio (logo após o pré-aquecimento) e quente.
import { performance } from "node:perf_hooks";
import { catalogo, preaquecerCatalogo, selecaoPlanos } from "../lib/catalogo";
import { vidasVazias, type FiltroCotacao } from "../lib/types";

const cidade = process.argv[2] ?? "Belo Horizonte - MG";
const vidas = { ...vidasVazias(), "24-28": 3, "34-38": 2 };
const grupos = [{ nome: "Geral", vidas }];

const ms = (t0: number) => `${(performance.now() - t0).toFixed(0)} ms`;

async function main() {
  let t0 = performance.now();
  preaquecerCatalogo();
  const cat = catalogo();
  console.log(
    `pré-aquecimento (leitura + conversão + índice, como no instrumentation.ts): ${ms(t0)} — ${cat.planos.length} planos, ${cat.cidades.length} cidades`,
  );

  for (const [rotulo, filtro] of [
    ["frio", { segmento: "Saúde", modalidade: "PME", cidade }],
    ["quente", { segmento: "Saúde", modalidade: "PME", cidade }],
    ["quente PF", { segmento: "Saúde", modalidade: "PF", cidade }],
    ["quente todas", { segmento: "Saúde", modalidade: "PME", cidade }],
  ] as [string, FiltroCotacao][]) {
    t0 = performance.now();
    const r = selecaoPlanos(filtro, grupos, { todas: rotulo === "quente todas" });
    const bytes = JSON.stringify(r).length;
    console.log(
      `buscarPlanos ${rotulo} (${filtro.modalidade}, ${cidade}): ${ms(t0)} — ${r.planos.length} planos, ` +
        `${r.operadoras.length} operadoras, ${r.hospitais.length} hospitais, ${(bytes / 1e6).toFixed(2)} MB`,
    );
  }
}

main();
