# Cotação com dados reais — desenho

Data: 2026-11-26 · Pasta: `studies/painel-corretor` · Branch: `claude/project-thread-k24z7s`

## Intenção

A Atan Prime quer mostrar ao Marcelo uma ferramenta própria que ele use **do mesmo jeito que usa o
Painel do Corretor**, com operadoras reais (com ícone) e **valores bem parecidos** com os do Painel.
Hoje o clone já tem todas as telas, mas o seletor de planos, os produtos e a proposta usam dados
fictícios; só a Base ANS e a Busca ANS usam a base real importada (`data/ans/base.json`).

O pedido (26/11): dados reais na janela de cotação, ícones das operadoras, números reais; rodar tudo
aqui e só depois comparar com o Painel (login lá derruba a outra sessão); repetir a revisão de 3
passadas por página; buscar na internet o que faltar; entregar pronto, validado e testado; testar o
frontend com o `agent-browser` da Vercel. A pessoa pediu para não ser consultada durante a execução:
as decisões abaixo marcadas "(decisão)" são minhas.

## Objetivos

1. **Catálogo real em todo o app.** Seletor de planos, cards da cotação, proposta do cliente,
   comparativo de rede, Produtos e Busca ANS passam a ler o catálogo da ANS quando
   `data/ans/base.json` existe. Sem a base, o app continua funcionando com os dados fictícios.
2. **Preço próximo do Painel.** Preço por vida = VCM da nota técnica (faixa etária ANS) × fator de
   ajuste da operadora; total = Σ vidas × preço, com +2,38% de IOF para seguradoras (regra observada no
   Painel). Quando existir tabela de venda importada para o plano/região, ela substitui o VCM. Cada
   preço mostra a origem: "Tabela de venda" ou "Referência ANS".
3. **Ícones das operadoras.** Logo/ícone real quando baixado no PC da pessoa; senão, selo com sigla e
   cor da marca.
4. **Rede, IDSS e reajuste reais** onde a ANS publica (rede hospitalar por plano, IDSS por operadora).
   O que não existir em dado público aparece como "—" e entra na lista de sugestões de fonte.
5. **Comparação com o Painel.** Uma tela "Comparar com o Painel" com casos de teste (operadora, plano,
   cidade, vidas por faixa), o nosso valor, um campo para o valor do Painel, a diferença em % e o fator
   de ajuste sugerido por operadora, que pode ser aplicado com um clique.
6. **Pronto para o Marcelo.** `iniciar.bat` (duplo clique no Windows: atualiza, instala se preciso,
   liga e abre o navegador) e um guia rápido em português no README.
7. **3 revisões por página** (inventário do Painel × clone, implementar diferenças, repetir) e testes
   de navegador com `agent-browser`.

## Não objetivos

- Copiar em massa preços, planos ou dados de clientes do Painel. A comparação usa poucas cotações de
  teste, digitadas ou lidas na tela uma a uma.
- Publicar ou hospedar o app. Ele roda no computador da pessoa (e no do Marcelo, se quiserem).
- CRM (Contatos/Negócios), que no Painel é outro sistema com login próprio.
- IA de verdade no "Assistente IA".

## Anti-objetivos

- Mostrar número "real" que é inventado. Todo preço sem fonte oficial é rotulado como referência.
- Usar nome ou logo do Painel do Corretor; a marca do app é da Atan Prime (decisão: "Atan Prime ·
  Cotações").
- Quebrar as cotações já salvas em `data/db.json`.

## Restrições

- O contêiner de nuvem não alcança os servidores da ANS nem sites de operadoras (proxy). Toda
  importação e download de logos roda no PC da pessoa (sessão remota já autorizada) por scripts
  `npm run ...`. Na nuvem desenvolvemos com uma base de exemplo no mesmo formato.
- `base.json` real tem ~42 MB (14 operadoras, 9.796 planos). Não pode ir inteiro para o navegador:
  o seletor consulta o servidor filtrando por modalidade e cidade.
- Next.js 15 App Router, server actions, JSON local; sem novas dependências pesadas.
- Logos são marcas de terceiros: baixados no PC, fora do Git (`public/logos/` no `.gitignore`).

## Abordagens consideradas

1. **Adaptador de catálogo (escolhida).** Um módulo `lib/catalogo.ts` converte a base ANS nos tipos
   que as telas já usam (`Operadora`, `Plano`, `Hospital`) e é a única porta de leitura de catálogo.
   As telas trocam `db.planos/db.operadoras/db.hospitais` por `catalogo()`. Reaproveita toda a UI já
   revisada; uma regra de preço só, num lugar só.
2. **Telas novas só para dados ANS.** Duplicaria seletor, cards e proposta; duas regras de preço e
   o dobro de revisão. Descartada.
3. **Gravar o catálogo ANS dentro de `db.json`.** Misturaria dado importado com dado do usuário e
   deixaria o arquivo enorme a cada gravação. Descartada.

Sobre preço: (A) só VCM; (B) VCM + fator por operadora calibrado pela comparação; (C) tabelas de
venda oficiais. Escolha (decisão): **C onde houver tabela, B no resto**, porque o VCM sozinho fica
até ±30% longe e a ANS não publica tabela de venda.

## Desenho

**Importação (PC da pessoa).** `scripts/importar-ans.mjs` ganha: `--todas` (todas as operadoras com
plano ativo nas UFs pedidas, além das alvo), rede hospitalar por plano e IDSS por operadora (arquivos
da PDA da ANS, colunas localizadas pelo nome do cabeçalho), e grava `base.json` +
`rede.json` (separado, para não pesar). Padrão recomendado: `--uf SP,MG`.
`scripts/baixar-logos.mjs` baixa ícones (favicon em alta resolução do site oficial de cada grupo) para
`public/logos/<registro>.png`.

**Tabelas de venda.** Pasta `data/tabelas/` com CSV em modelo fixo (operadora, código ANS do plano ou
nome, UF/município, modalidade, 10 preços, vigência). `lib/tabelas.ts` lê e indexa. Modelo e
instruções em `data/tabelas/README.md`. Tabelas públicas achadas na pesquisa entram já preenchidas.

**Catálogo (`lib/catalogo.ts`).** Converte cada plano ANS:
contratação → PF/PME/Adesão; odontológico → Dental; acomodação Individual/Coletiva; fator moderador →
coparticipação; abrangência; cidades = municípios de comercialização (rótulo "Nome - UF"; planos
estaduais/nacionais sem município listado valem para todos os municípios das UFs);
preços = tabela de venda > VCM × ajuste; operadora = registro ANS, nome fantasia curto, cor da marca,
IDSS, flag seguradora. Planos sem preço ficam fora do seletor (aparecem na Busca ANS). Cache em memória
por data de modificação do arquivo. Lista de cidades vem do catálogo.

**Telas.** Editor/seletor: a página não envia todos os planos; o seletor chama a server action
`buscarPlanos(filtro)` ao mudar modalidade/cidade. Cards, proposta, comparativo, Produtos e Busca ANS
leem do catálogo. IDSS/reajuste opcionais nos tipos ("—" quando faltar). Selo da origem do preço.
Preferências ganham "Ajuste por operadora (%)" e "Operadoras habilitadas" com a lista real.

**Comparação.** Rota `/comparar`: casos de teste salvos em `db.json` (`comparacoes`), com nosso valor
calculado na hora, campo "Valor no Painel", diferença %, e por operadora o fator sugerido (mediana das
razões), com botão "Aplicar ajuste".

**Entrega.** `iniciar.bat`, guia rápido, ANALISE/README atualizados, testes `agent-browser` em
`tests/e2e/` rodando contra a base de exemplo (nuvem) e contra a base real (PC).

## Deixado para quem constrói

Nomes de arquivos auxiliares, layout fino do selo de origem e da tela de comparação (seguir o padrão
visual existente), heurística de nome curto da operadora, e como tratar planos com várias variantes de
VCM (padrão: primeira variante; a variante usada aparece no detalhe).
