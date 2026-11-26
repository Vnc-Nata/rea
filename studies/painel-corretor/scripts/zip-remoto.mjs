// Lê entradas de um .zip grande sem baixá-lo inteiro: o diretório central vem do fim
// do arquivo por requisições HTTP Range, e cada entrada é baixada só no seu intervalo.
// Com um caminho local (importar-ans --fonte), lê os mesmos intervalos com fs.
// Suporta ZIP64 (arquivos e deslocamentos acima de 4 GB). Sem dependências.

import fs from "node:fs";
import { Readable, PassThrough, pipeline } from "node:stream";
import zlib from "node:zlib";

const SIG_EOCD = 0x06054b50;
const SIG_LOC64 = 0x07064b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const MAX32 = 0xffffffff;
const MAX16 = 0xffff;

const remoto = (fonte) => /^https?:/i.test(String(fonte));

/** Tamanho total do arquivo (local: fs.stat; remoto: Content-Range de um pedido de 1 byte). */
async function tamanho(fonte) {
  if (!remoto(fonte)) return fs.statSync(fonte).size;
  const r = await fetch(fonte, { headers: { Range: "bytes=0-0" } });
  await r.body?.cancel();
  if (r.status !== 206) throw new Error(`${fonte}: o servidor não aceitou Range (HTTP ${r.status})`);
  const total = Number(/\/(\d+)\s*$/.exec(r.headers.get("content-range") ?? "")?.[1]);
  if (!Number.isFinite(total)) throw new Error(`${fonte}: Content-Range sem tamanho total`);
  return total;
}

const PADRAO = { tentativas: 5, esperaMs: 1000 };
const PROGRESSO_MIN = 1 << 20; // 1 MB recebido desde a última queda zera as tentativas
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Erro que não adianta repetir (servidor sem Range, resposta incoerente). */
class ErroFatal extends Error {}

/**
 * Baixa [ini, fim) por Range. Se a conexão cair, tenta de novo (até `tentativas` quedas seguidas,
 * com espera crescente) retomando do último byte recebido; quem lê vê um fluxo contínuo.
 */
async function* baixarComRetomada(url, ini, fim, { tentativas, esperaMs }) {
  let pos = ini;
  let falhas = 0;
  let posFalha = ini;
  while (pos < fim) {
    try {
      const r = await fetch(url, { headers: { Range: `bytes=${pos}-${fim - 1}` } });
      if (r.status !== 206) {
        await r.body?.cancel();
        throw new ErroFatal(`${url}: o servidor não aceitou Range (HTTP ${r.status})`);
      }
      const ini2 = Number(/bytes\s+(\d+)-/.exec(r.headers.get("content-range") ?? "")?.[1]);
      if (ini2 !== pos) {
        await r.body?.cancel();
        throw new ErroFatal(`${url}: Content-Range inesperado (${r.headers.get("content-range")})`);
      }
      for await (const c of r.body) {
        let b = Buffer.from(c.buffer, c.byteOffset, c.byteLength);
        if (b.length > fim - pos) b = b.subarray(0, fim - pos);
        if (!b.length) continue;
        pos += b.length;
        // Só zera a contagem depois de avançar bastante (evita repetir para sempre de 10 em 10 bytes).
        if (pos - posFalha >= PROGRESSO_MIN) falhas = 0;
        yield b;
      }
      if (pos < fim) throw new Error(`conexão encerrada em ${pos - ini} de ${fim - ini} bytes`);
    } catch (e) {
      if (e instanceof ErroFatal || ++falhas > tentativas) throw e;
      posFalha = pos;
      const ms = esperaMs * 2 ** (falhas - 1);
      console.warn(`! ${url}: ${e.message}; tentando de novo em ${ms / 1000} s (retomando do byte ${pos})`);
      await espera(ms);
    }
  }
}

/** Bytes [ini, fim) do arquivo, como stream. */
async function intervaloStream(fonte, ini, fim, opcoes = PADRAO) {
  if (fim <= ini) return Readable.from([]);
  if (!remoto(fonte)) return fs.createReadStream(fonte, { start: ini, end: fim - 1 });
  return Readable.from(baixarComRetomada(fonte, ini, fim, { ...PADRAO, ...opcoes }), { objectMode: false });
}

/** Bytes [ini, fim) do arquivo, em memória (para trechos pequenos). */
async function intervalo(fonte, ini, fim, opcoes) {
  if (!remoto(fonte)) {
    const buf = Buffer.alloc(Math.max(0, fim - ini));
    const fd = fs.openSync(fonte, "r");
    try {
      let lidos = 0;
      while (lidos < buf.length) {
        const n = fs.readSync(fd, buf, lidos, buf.length - lidos, ini + lidos);
        if (!n) break;
        lidos += n;
      }
      return buf.subarray(0, lidos);
    } finally {
      fs.closeSync(fd);
    }
  }
  const partes = [];
  for await (const c of await intervaloStream(fonte, ini, fim, opcoes)) partes.push(c);
  return Buffer.concat(partes);
}

const u64 = (buf, p) => {
  const n = buf.readBigUInt64LE(p);
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("zip: valor de 64 bits grande demais");
  return Number(n);
};

/**
 * Lista as entradas do zip (local ou URL) lendo só o fim do arquivo e o diretório central.
 * @returns {Promise<{ nome: string, offset: number, tamanhoComprimido: number, tamanho: number, metodo: number }[]>}
 */
export async function listarEntradasRemotas(url, opcoes) {
  const total = await tamanho(url);
  // EOCD (22 bytes) + comentário (até 65535) + localizador ZIP64 (20) antes dele.
  const iniCauda = Math.max(0, total - (22 + MAX16 + 20));
  const cauda = await intervalo(url, iniCauda, total, opcoes);
  let e = cauda.length - 22;
  while (e >= 0 && cauda.readUInt32LE(e) !== SIG_EOCD) e--;
  if (e < 0) throw new Error("zip inválido: fim do diretório central não encontrado");

  let n = cauda.readUInt16LE(e + 10);
  let tamCentral = cauda.readUInt32LE(e + 12);
  let iniCentral = cauda.readUInt32LE(e + 16);
  if (n === MAX16 || tamCentral === MAX32 || iniCentral === MAX32) {
    const l = e - 20;
    if (l < 0 || cauda.readUInt32LE(l) !== SIG_LOC64) throw new Error("zip64 inválido: localizador não encontrado");
    const posEocd64 = u64(cauda, l + 8);
    const rec = await intervalo(url, posEocd64, posEocd64 + 56, opcoes);
    if (rec.readUInt32LE(0) !== SIG_EOCD64) throw new Error("zip64 inválido: registro do fim não encontrado");
    n = u64(rec, 32);
    tamCentral = u64(rec, 40);
    iniCentral = u64(rec, 48);
  }

  const cd = await intervalo(url, iniCentral, iniCentral + tamCentral, opcoes);
  const out = [];
  let p = 0;
  for (let i = 0; i < n; i++) {
    if (p + 46 > cd.length || cd.readUInt32LE(p) !== SIG_CENTRAL)
      throw new Error(`zip inválido: entrada ${i} corrompida`);
    const metodo = cd.readUInt16LE(p + 10);
    let tamanhoComprimido = cd.readUInt32LE(p + 20);
    let tam = cd.readUInt32LE(p + 24);
    const nl = cd.readUInt16LE(p + 28);
    const xl = cd.readUInt16LE(p + 30);
    const cl = cd.readUInt16LE(p + 32);
    let offset = cd.readUInt32LE(p + 42);
    const nome = cd.subarray(p + 46, p + 46 + nl).toString("utf8");
    // Campo extra ZIP64 (0x0001): só traz os valores que estão como 0xFFFFFFFF, nesta ordem.
    let x = p + 46 + nl;
    const fimX = x + xl;
    while (x + 4 <= fimX) {
      const id = cd.readUInt16LE(x);
      const sz = cd.readUInt16LE(x + 2);
      if (id === 0x0001) {
        let q = x + 4;
        if (tam === MAX32) {
          tam = u64(cd, q);
          q += 8;
        }
        if (tamanhoComprimido === MAX32) {
          tamanhoComprimido = u64(cd, q);
          q += 8;
        }
        if (offset === MAX32) offset = u64(cd, q);
      }
      x += 4 + sz;
    }
    p = fimX + cl;
    out.push({ nome, offset, tamanhoComprimido, tamanho: tam, metodo });
  }
  return out;
}

/**
 * Abre uma entrada listada por listarEntradasRemotas, já descompactada.
 * Os comprimentos de nome e extra vêm do cabeçalho local (podem diferir do diretório central).
 * @returns {Promise<Readable>}
 */
export async function abrirEntradaRemota(url, entrada, opcoes) {
  const loc = await intervalo(url, entrada.offset, entrada.offset + 30, opcoes);
  if (loc.length < 30 || loc.readUInt32LE(0) !== SIG_LOCAL)
    throw new Error(`zip: cabeçalho local inválido (${entrada.nome})`);
  const ini = entrada.offset + 30 + loc.readUInt16LE(26) + loc.readUInt16LE(28);
  const dados = await intervaloStream(url, ini, ini + entrada.tamanhoComprimido, opcoes);
  if (entrada.metodo === 0) return dados;
  if (entrada.metodo !== 8) {
    dados.destroy();
    throw new Error(`zip: método de compressão ${entrada.metodo} não suportado (${entrada.nome})`);
  }
  const saida = new PassThrough();
  pipeline(dados, zlib.createInflateRaw(), saida, () => {});
  return saida;
}
