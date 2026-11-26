/**
 * Número em pt-BR (sem sinal): com vírgula, pontos são milhares ("1.034,80"); sem vírgula, um ponto seguido de
 * 1-2 dígitos no fim é decimal ("1034.8") e pontos em grupos de 3 são milhares ("1.034", "12.345.678").
 * Aceita "R$" e espaços. "" -> null; formato inválido -> NaN.
 */
export function lerNumeroBR(entrada: string): number | null {
  const s = entrada.replace(/R\$|\s/g, "");
  if (!s) return null;
  let n: string;
  if (s.includes(",")) {
    if (!/^\d{1,3}(\.\d{3})*,\d{1,2}$|^\d+,\d{1,2}$/.test(s)) return NaN;
    n = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+\.\d{1,2}$/.test(s)) n = s;
  else if (/^\d{1,3}(\.\d{3})+$|^\d+$/.test(s)) n = s.replace(/\./g, "");
  else return NaN;
  return Number(n);
}
