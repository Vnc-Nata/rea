// Next.js chama register() uma vez ao subir o servidor. Pré-aquece o catálogo ANS (leitura e conversão de uma
// base de 140 MB levam alguns segundos) para que a primeira cotação já abra rápida. Sem base.json não faz nada.
// O import fica dentro do if (padrão da documentação do Next.js): assim o bundle edge não tenta incluir node:fs.
// A conversão é síncrona e roda num setTimeout(0): register() retorna logo, mas a conversão ainda ocupa o
// processo por alguns segundos (o "Ready" pode atrasar) e uma requisição que chegue nesse intervalo espera por ela.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    setTimeout(async () => {
      try {
        const { preaquecerCatalogo } = await import("./lib/catalogo");
        preaquecerCatalogo();
      } catch (e) {
        console.warn("[catalogo] pré-aquecimento falhou; o catálogo será lido na primeira requisição.", e);
      }
    }, 0);
  }
}
