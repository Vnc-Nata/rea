# Cotação com dados reais — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer seletor, cotação, proposta, produtos e busca usarem o catálogo real da ANS (com preço calibrável e tabelas de venda), ícones das operadoras, rede/IDSS/reajuste reais, uma tela de comparação com o Painel e um pacote pronto para o Marcelo.

**Architecture:** `lib/catalogo.ts` é a única porta de leitura de catálogo: converte `data/ans/base.json` (+ `rede.json`, `indicadores.json`, `data/tabelas/*.csv`, ajustes da conta) nos tipos `Operadora/Plano/Hospital` que as telas já usam; sem base, devolve os dados fictícios de `db.json`. A importação roda no PC da pessoa (scripts Node sem dependências). O seletor busca planos por server action filtrando no servidor.

**Tech Stack:** Next.js 15.5 App Router, React 19, TypeScript 5.7, Tailwind 3; testes unitários com `tsx --test` (node:test); testes de navegador com `agent-browser` (Vercel Labs).

**Spec:** `docs/superpowers/specs/2026-11-26-cotacao-dados-reais-design.md`

Todos os caminhos abaixo são relativos a `studies/painel-corretor/`.

## Global Constraints

- Branch `claude/project-thread-k24z7s`; commits terminam com as linhas de atribuição da sessão.
- Nada de preço, plano ou dado de cliente copiado do Painel do Corretor; nome/logo do Painel fora do app. Marca do app: "Atan Prime · Cotações".
- Preço por vida = tabela de venda (se houver) senão VCM × (1 + ajuste% da operadora / 100); total = Σ vidas × preço × (1 + 0,0238) quando a operadora é seguradora (`MODALIDADE` contém "Seguradora").
- Origem do preço sempre visível: "Tabela de venda" (com vigência) ou "Referência ANS".
- Sem `data/ans/base.json` o app funciona como hoje (dados fictícios).
- Não carregar o catálogo inteiro no navegador; páginas recebem só os planos filtrados.
- `public/logos/`, `data/ans/*.json` (exceto `operadoras-alvo.json`) e `data/db.json` fora do Git.
- Módulos de `lib/` testados usam imports relativos (não `@/`) para rodar no `tsx`.
- Textos da interface em português do Brasil.
- Sem novas dependências de runtime; dev: só `tsx`.

## Review Focus

1. Cotação antiga em `db.json` com `planoId` fictício quando a base real está ativa: cards e proposta mostram "Plano indisponível" e permitem remover, sem erro 500. (Task 5, teste e2e "cotação legada".)
2. Plano com VCM faltando em faixa que tem vidas: não aparece no seletor para aquela distribuição (não mostra R$ 0). (Task 2, `converterBase` + `precoDisponivel`.)
3. Município sem nenhum plano/cidade inexistente no filtro salvo da cotação: seletor mostra a mensagem de vazio e a lista de cidades cai na primeira cidade do catálogo. (Task 5.)
4. CSV de tabela de venda com decimal vírgula, BOM, linha em branco ou coluna faltando: linha inválida é ignorada e reportada, não derruba o catálogo. (Task 3.)
5. Base de 40+ MB: primeira leitura lenta não pode repetir a cada requisição (cache por mtime) e o editor não pode enviar >2 MB de props. (Task 2 cache + Task 5 server action.)

---

### Task 1: Infra de teste e base de exemplo

**Files:**
- Modify: `package.json` (scripts `test`, `gerar-exemplo`, `baixar-logos`, `e2e`; devDependency `tsx`)
- Create: `scripts/gerar-base-exemplo.mjs`, `tests/fixtures/` (saída gerada e commitada), `tests/unit/exemplo.test.ts`

**Interfaces:**
- Produces: `tests/fixtures/base.json` (formato `BaseAns` de `lib/ans.ts`), `tests/fixtures/rede.json` e `tests/fixtures/indicadores.json` (formatos da Task 4); variável de ambiente `ANS_DIR` (pasta de onde `lib/ans.ts` e o catálogo leem os JSON; padrão `data/ans`).

- [ ] Instalar `tsx` como devDependency; scripts: `"test": "tsx --test tests/unit/*.test.ts"`, `"gerar-exemplo": "node scripts/gerar-base-exemplo.mjs"`.
- [ ] `gerar-base-exemplo.mjs`: gera dados determinísticos no formato real: 6 operadoras com os registros de `data/ans/operadoras-alvo.json` (Bradesco e SulAmérica e Porto como "Seguradora Especializada em Saúde", demais "Medicina de Grupo"), ~10 planos cada cobrindo PF/PME/Adesão, Individual/Coletiva, copart Ausente/Coparticipação, um odontológico, municípios `{codigo,nome}` no formato da ANS (`"SAO PAULO/SP"`, `"SAO CAETANO DO SUL/SP"` 354880, `"BELO HORIZONTE/MG"` 310620, `"CAMPINAS/SP"` 350950), `ufsDetalhadas: ["SP","MG"]`, VCM com variantes (um plano com 2 variantes, um com `null` na faixa 59+), rede com 8 hospitais (CNES) e indicadores (IDSS 0–1, reajuste %). Deixar claro no JSON `fonte: "exemplo"`.
- [ ] `lib/ans.ts`: caminho base passa a ser `process.env.ANS_DIR ?? data/ans`.
- [ ] Teste `exemplo.test.ts`: o fixture tem 6 operadoras, ≥ 50 planos, todos com `vcm` exceto 2, e municípios de SP e MG.
- [ ] `npm test` passa; commit.

### Task 2: Catálogo e regra de preço

**Files:**
- Create: `lib/catalogo.ts`, `lib/municipios.ts`, `tests/unit/catalogo.test.ts`
- Modify: `lib/types.ts`, `lib/utils.ts` (`precoTotal`), `lib/ans.ts` (`lerRedeAns`, `lerIndicadoresAns`)

**Interfaces:**
- Consumes: `BaseAns/PlanoAns` (`lib/ans.ts`), `RedeAns`, `IndicadoresAns` (Task 4 formatos, abaixo), `TabelaVenda` e `tabelaPara` (Task 3).
- Produces:
  - `types.ts`: `Operadora` ganha `idss?: number; reajuste?: number; reajusteAnterior?: number; sigla: string; seguradora?: boolean; logo?: string` (idss/reajuste viram opcionais); `Plano` ganha `iof?: number; origemPreco: "tabela" | "ans" | "ficticio"; vigencia?: string; codigoAns?: string; variante?: string` e `precos: Record<Faixa, number | null>`; `Conta` ganha `ajustes?: Record<string, number>` (chave = id da operadora, valor em %).
  - `utils.ts`: `precoTotal(p: Plano, grupos: Grupo[]): number` (soma × (1 + iof)); `precoDisponivel(p: Plano, grupos: Grupo[]): boolean` (false se faixa com vidas tem preço null).
  - `catalogo.ts`: `interface Catalogo { fonte: "ans" | "ficticio"; geradoEm?: string; operadoras: Operadora[]; planos: Plano[]; hospitais: Hospital[]; cidades: string[] }`; `converterBase(base, opts: { rede?: RedeAns; indicadores?: IndicadoresAns; tabelas?: TabelaVenda[]; ajustes?: Record<string, number> }): Omit<Catalogo, "fonte">` (pura); `catalogo(): Catalogo` (cache por mtime dos arquivos + JSON dos ajustes); `planosPara(f: FiltroCotacao): Plano[]`; `planoPorId(id)`, `operadoraPorId(id)`.
  - `municipios.ts`: `rotuloMunicipio(nomeAns: string): string` (`"SAO CAETANO DO SUL/SP"` → `"São Caetano do Sul - SP"`; acentos por tabela das ~50 palavras mais comuns + capitalização pt-BR, preposições minúsculas) e `ufDoCodigo(codigoIbge: string): string`.
  - Ids: operadora `ans-<registro>`, plano `ans-<ID_PLANO>`, hospital `cnes-<CNES>`.

- [ ] Testes (`catalogo.test.ts`, usando `tests/fixtures`):
  - `converterBase` mapeia "Individual ou familiar"→PF, "Coletivo empresarial"→PME, "Coletivo por adesão"→Adesão; "Odontológico"→Dental; acomodação "Individual"→"Quarto Individual", outras→"Quarto Coletivo"; fator moderador ≠ "Ausente"→"Com coparticipação".
  - plano nacional/estadual sem municípios recebe todas as cidades das UFs detalhadas que estão em `plano.ufs`.
  - seguradora → `iof` 0.0238; não seguradora → sem iof; `precoTotal` de 4 vidas na faixa 44-48 a 1000 numa seguradora = 4095.20.
  - ajuste `{ "ans-005711": 10 }` multiplica VCM por 1.1; tabela de venda casada substitui VCM e marca `origemPreco: "tabela"` com vigência.
  - plano sem VCM e sem tabela não entra em `planos`; `precoDisponivel` false quando a faixa com vidas é null.
  - `rotuloMunicipio("SAO CAETANO DO SUL/SP")` = `"São Caetano do Sul - SP"`; `"BELO HORIZONTE/MG"` = `"Belo Horizonte - MG"`.
  - sem base (ANS_DIR vazio), `catalogo().fonte === "ficticio"` e vem de `db.json`.
- [ ] Implementar; nome curto da operadora: `nomeFantasia` ou grupo, em caixa título, sem "S.A."/"LTDA"; sigla = 2 letras; cor por mapa dos 6 grupos (Amil azul #0047bb, Bradesco vermelho #cc092f, SulAmérica laranja #f47920, Porto azul #0046c0, Alice rosa #ff4f6d, Hapvida laranja #f58220) senão cor derivada do registro.
- [ ] `npm test` e `npx tsc --noEmit` passam; commit.

### Task 3: Tabelas de venda (CSV)

**Files:**
- Create: `lib/tabelas.ts`, `data/tabelas/README.md`, `data/tabelas/modelo.csv`, `tests/unit/tabelas.test.ts`, `tests/fixtures/tabelas/*.csv`

**Interfaces:**
- Produces: `interface TabelaVenda { registro: string; codigoAns?: string; nomePlano?: string; uf?: string; municipio?: string; modalidade?: "PF" | "PME" | "Adesão"; vigencia: string; precos: (number | null)[]; arquivo: string; linha: number }`; `lerTabelas(dir?: string): { tabelas: TabelaVenda[]; erros: { arquivo: string; linha: number; motivo: string }[] }` (padrão `process.env.TABELAS_DIR ?? data/tabelas`, cache por mtime); `tabelaPara(p: { registroAns: string; codigoAns: string; nome: string; ufs: string[] }, tabelas: TabelaVenda[]): TabelaVenda | undefined` (código ANS primeiro, senão nome normalizado sem acento/caixa + registro; entre várias, vigência mais recente; se `uf` informado, precisa estar em `ufs`).
- CSV: `;`, decimal vírgula ou ponto, BOM aceito. Cabeçalho exato: `registro_operadora;codigo_plano_ans;nome_plano;uf;municipio_ibge;modalidade;vigencia;f00_18;f19_23;f24_28;f29_33;f34_38;f39_43;f44_48;f49_53;f54_58;f59_mais`.

- [ ] Testes: lê fixture com BOM e vírgula decimal (`"1.034,80"` → 1034.8); linha sem registro gera erro e é pulada; casa por código ANS; casa por nome com acento diferente; escolhe vigência mais recente.
- [ ] Implementar; `README.md` explica em português como preencher a partir do PDF da operadora e onde colocar.
- [ ] Testes passam; commit.

### Task 4: Importador v2 e logos (rodam no PC)

**Files:**
- Modify: `scripts/importar-ans.mjs`, `.gitignore`
- Create: `scripts/zip-remoto.mjs`, `scripts/baixar-logos.mjs`, `data/ans/logos.json`, `tests/unit/importar.test.ts`, `tests/fixtures/pda/` (CSVs mínimos)

**Interfaces:**
- Consumes: arquivos PDA (URLs e cabeçalhos abaixo, verificados em 26/11 no PC).
- Produces (em `data/ans/`):
  - `base.json` como hoje, com `operadoras[].modalidade` preservada e opção `--todas` (todas as operadoras ativas do cadop que tenham plano ativo comercializado nas UFs de `--uf`).
  - `rede.json`: `{ geradoEm: string; hospitais: Record<cnes, { nome: string; municipio: string; uf: string; classe: string; urgencia: boolean }>; porPlano: Record<idPlano, string[]> }`.
  - `indicadores.json`: `{ geradoEm: string; porOperadora: Record<registro, { idss?: number; idssAno?: number; reajuste?: number; reajusteAnterior?: number; ciclo?: number }> }`.
- Fontes (`B = https://dadosabertos.ans.gov.br/FTP/PDA/`):
  - rede: `B/produtos_e_prestadores_hospitalares/produtos_e_prestadores_hospitalares.zip` (2,28 GB; um CSV por UF `produtos_prestadores_hospitalares_<UF>.csv`). Colunas: `ID_PLANO`, `CD_CNES`, `NM_ESTABELECIMENTO_SAUDE`, `DE_CLAS_ESTB_SAUDE`, `LG_URGENCIA_EMERGENCIA`, `NM_MUNICIPIO`, `SG_UF`, `DT_VINCULO_FIM` (manter só vazio). `;`, UTF-8.
  - IDSS: `B/historico_idss-020/pda-020-historico-idss-2016_2025.csv`; usar a coluna `IDSS_<ano>_*` mais recente que não seja "ND"; decimal vírgula.
  - reajuste: `B/percentuais_de_reajuste_de_agrupamento-055/pda-055-Percentuais_de_Reajuste_de_Agrupamento.csv`; por registro, `PCT_UNICO` dos dois `CICLO` mais recentes → `reajuste` e `reajusteAnterior`.
  - área: `CD_OPERADORA` vem com TAB à esquerda e sem zeros: normalizar com `registro()`.

- [ ] `zip-remoto.mjs`: `listarEntradasRemotas(url): Promise<{ nome, offset, tamanhoComprimido, metodo }[]>` lendo o diretório central com requisições `Range` (fim do arquivo; suportar ZIP64) e `abrirEntradaRemota(url, entrada): Promise<Readable>` (Range do dado + `zlib.createInflateRaw`). Com `--fonte` local, ler do arquivo com `fs` nos mesmos offsets.
- [ ] Importador: novas etapas `rede(fonte, planos, ufs)` e `indicadores(fonte, registros)`; flag `--sem-rede`; colunas sempre achadas pelo nome do cabeçalho; progresso no console.
- [ ] `baixar-logos.mjs`: para cada registro em `data/ans/logos.json` (`{ "<registro>": "<domínio oficial>" }`, com os 6 grupos e as principais operadoras de SP/MG), baixa `https://www.google.com/s2/favicons?domain=<dominio>&sz=256` e grava `public/logos/<registro>.png`; ignora falhas com aviso. `.gitignore`: `public/logos/`, `data/ans/rede.json`, `data/ans/indicadores.json`.
- [ ] Testes (fixtures mínimas em `tests/fixtures/pda/`, com um zip pequeno gerado no teste): leitura de diretório central de zip local, filtro de vínculo encerrado, IDSS mais recente não-ND, reajuste dos 2 ciclos mais recentes.
- [ ] Testes passam; commit.

### Task 5: Telas no catálogo real

**Files:**
- Modify: `components/brand.tsx`, `components/cotacao-editor.tsx`, `app/(dashboard)/cotacoes/[id]/edit/page.tsx`, `app/actions.ts` (`buscarPlanos`, `aplicarAjuste`), `app/cotacoes/[id]/page.tsx`, `app/cotacoes/[id]/cenarios/[cenarioId]/page.tsx`, `components/proposta.tsx`, `components/produtos.tsx`, `app/(dashboard)/produtos/**`, `app/(dashboard)/busca-ans/**`, `components/busca-ans*.tsx`, `components/conta-secoes.tsx` (Preferências), `app/(dashboard)/conta/[secao]/page.tsx`, `app/(dashboard)/cotacoes/nova` (cidade inicial), `components/sidebar.tsx` (marca + link "Comparar"), `lib/seed.ts` (CIDADES só como fallback)
- Test: `tests/unit/acoes.test.ts` (função pura de filtro), e2e na Task 7

**Interfaces:**
- Consumes: `catalogo()`, `planosPara`, `planoPorId`, `operadoraPorId`, `precoTotal`, `precoDisponivel` (Task 2).
- Produces: `buscarPlanos(filtro: FiltroCotacao, grupos: Grupo[]): Promise<{ planos: Plano[]; operadoras: Operadora[]; hospitais: Hospital[] }>` (server action; só planos com preço disponível para os grupos, só operadoras habilitadas na conta); componente `OperadoraLogo({ op, className, tamanho? })` mostrando `<img src="/logos/<registro>.png">` quando `op.logo` existe, senão selo redondo com `sigla` na `cor`; `OrigemPreco({ plano })`.

- [ ] Editor: página passa só os planos dos cenários e as cidades; o seletor chama `buscarPlanos` ao abrir e a cada mudança de segmento/modalidade/cidade, mostrando "Carregando…"; grade de operadoras com ícone + nome; lista de planos com preço total, origem e "IDSS".
- [ ] `catalogo().operadoras` já marca `logo` quando `public/logos/<registro>.png` existe.
- [ ] Cards, proposta, cenário e comparativo: lookup por `planoPorId`; plano ausente → card "Plano indisponível" com Remover.
- [ ] Produtos e Busca ANS: cidades e operadoras do catálogo; Busca ANS fictícia só sem base; detalhe da Busca mostra IDSS e reajuste reais quando houver, aba "Rede Credenciada" com a rede do plano.
- [ ] Preferências: lista real de operadoras para "habilitadas" (padrão: os 6 grupos de `operadoras-alvo.json`) e "Ajuste de preço por operadora (%)".
- [ ] Marca "Atan Prime · Cotações" no lugar de "Painel · multicálculo · estudo"; rodapé sem "dados fictícios" quando a base real está ativa.
- [ ] `npx tsc --noEmit` e `npm test` passam; páginas abrem sem erro com `ANS_DIR=tests/fixtures`; commit.

### Task 6: Comparar com o Painel

**Files:**
- Create: `app/(dashboard)/comparar/page.tsx`, `components/comparar.tsx`, `lib/comparar.ts`, `tests/unit/comparar.test.ts`
- Modify: `lib/types.ts` (`Comparacao`, `Db.comparacoes?`), `app/actions.ts`

**Interfaces:**
- Produces: `interface Comparacao { id: string; titulo: string; planoId: string; cidade: string; vidas: Record<Faixa, number>; valorPainel?: number; criadaEm: string }`; `sugerirAjuste(pares: { nosso: number; painel: number }[], ajusteAtual: number): number` = ((1 + ajusteAtual/100) × mediana(painel/nosso) − 1) × 100, arredondado a 1 casa; actions `criarComparacao(dados)`, `atualizarValorPainel(id, valor)`, `excluirComparacao(id)`, `aplicarAjuste(operadoraId, pct)`.
- Casos iniciais (criados no primeiro acesso se não houver nenhum): "Amil Bronze · São Caetano do Sul - SP · 3 vidas 24-28" e "Bradesco Nacional II · Belo Horizonte - MG · 4 vidas 44-48" (plano escolhido pelo nome no catálogo; se não achar, caso fica sem plano e pede para escolher).

- [ ] Testes: `sugerirAjuste([{nosso:100,painel:110},{nosso:200,painel:190},{nosso:100,painel:120}], 0)` = 10; com `ajusteAtual` 10 e mediana 1 → 10; lista vazia → ajusteAtual.
- [ ] Tela: tabela (caso, operadora, nosso valor com origem, campo "Valor no Painel", diferença %), formulário para novo caso (plano via busca por nome, cidade, vidas por faixa), por operadora o ajuste sugerido + botão "Aplicar ajuste"; link no menu lateral.
- [ ] Testes passam; commit.

### Task 7: Entrega e testes de navegador

**Files:**
- Create: `iniciar.bat`, `tests/e2e/fluxos.sh`, `docs/GUIA-RAPIDO.md`
- Modify: `README.md`, `ANALISE.md`, `package.json` (`"e2e": "bash tests/e2e/fluxos.sh"`)

- [ ] `iniciar.bat`: `cd /d %~dp0`, `git pull`, `npm install` se `node_modules` não existir ou `package-lock.json` for mais novo que `node_modules\.package-lock.json`, abre o navegador em `http://localhost:3000` após o servidor responder, roda `npm run dev`. Mensagens em português.
- [ ] `tests/e2e/fluxos.sh` com `agent-browser` contra `BASE_URL` (padrão `http://localhost:3000`): nova cotação → distribuição 3 vidas 24-28 → seletor em "São Caetano do Sul - SP" PME → escolher operadora (ícone visível) → plano → card com preço e "Referência ANS"; Compartilhar; Opções; proposta pública; Produtos com filtro MEI; Busca ANS detalhe; Comparar com valor digitado e sugestão de ajuste; cotação legada com plano inexistente → "Plano indisponível". Sai com código ≠ 0 em falha e imprime erros do console.
- [ ] Guia rápido (português, para quem não é técnico): instalar Node e Git uma vez, baixar o projeto, duplo clique em `iniciar.bat`, importar a base (`npm run importar-ans -- --uf SP,MG --todas`), baixar logos, onde colocar tabelas de venda, como usar a tela Comparar.
- [ ] README/ANALISE atualizados (fontes de dados reais, limites: VCM é referência; sem CRM; IA só botão).
- [ ] e2e passa contra `ANS_DIR=tests/fixtures`; commit e push.
