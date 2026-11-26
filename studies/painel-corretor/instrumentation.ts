// Next.js chama register() uma vez ao subir o servidor. Pré-aquece o catálogo ANS (leitura e conversão de uma
// base de 140 MB levam alguns segundos) para que a primeira cotação já abra rápida. Sem base.json não faz nada.
// O import fica dentro do if (padrão da documentação do Next.js): assim o bundle edge não tenta incluir node:fs.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { preaquecerCatalogo } = await import("./lib/catalogo");
    // Depois que o servidor terminar de subir: a conversão é síncrona e seguraria a inicialização.
    setTimeout(() => {
      try {
        preaquecerCatalogo();
      } catch (e) {
        console.warn("[catalogo] pré-aquecimento falhou; o catálogo será lido na primeira requisição.", e);
      }
    }, 0);
  }
}
