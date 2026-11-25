# Análise do app de referência

Levantamento feito em 25/11/2026 sobre `beta.paineldocorretor.com.br`, para
orientar a recriação deste diretório. Só foram lidas páginas e arquivos que o
navegador já recebe: as páginas públicas e, com o login feito pelo próprio
titular da conta no navegador, as telas que essa conta acessa. Nada foi criado,
alterado ou enviado na conta. Nenhuma credencial foi lida ou guardada. Dados de
clientes vistos durante a observação não foram copiados para cá.

## Método

A metodologia segue os guias de observação web do REA
([browser-observation](../../docs/guides/web/browser-observation.md),
[javascript-route-inventory](../../docs/javascript-route-inventory.md)):
inventário de páginas, scripts e recursos; leitura estática dos chunks
JavaScript (sem executar código do app fora do navegador); e cruzamento com o
DOM renderizado.

Neste ambiente as ferramentas CDP do REA (`inspect-web-page`,
`analyze-web-bundle`, `export-web-scripts`) não puderam ser usadas diretamente,
porque o contêiner não alcança o domínio e o navegador usado não expõe uma porta
CDP. A coleta foi feita pelo painel de navegador do app Claude, com JavaScript
no contexto da página, aplicando os mesmos passos. Para repetir com o REA no seu
computador, veja [Repetir com o REA](#repetir-com-o-rea).

## O que é público sem login

- `/` redireciona no servidor para o login hospedado pela Auth0 em
  `auth.paineldocorretor.com.br`. `/_next/static/` também redireciona.
- A página 404 é pública e carrega o layout raiz, o CSS (Tailwind) e chunks
  compartilhados. Por ela dá para obter o `buildId` e o `_buildManifest.js`.
- `robots.txt` bloqueia `/cotacoes/` e `/produtos/`.

## Stack observada

| Item | Evidência |
| --- | --- |
| Next.js App Router, React Server Components, server actions | caminhos `app/(dashboard)/…/page-*.js`, `createServerReference(...)` |
| Tailwind CSS + shadcn/ui + Radix | classes utilitárias, variantes `cva` do Button, componentes Radix (Dialog, Select, Toast, Dropdown) |
| Tema claro/escuro | `next-themes` com `attribute: "class"`; tokens HSL em `:root` e `.dark` |
| Auth0 | login universal, variáveis `AUTH0_*` |
| Formulários | `react-hook-form` + `zod` (mensagens traduzidas via i18next) |
| Dados no cliente | `@tanstack/react-query`, `zustand` |
| Datas | `dayjs` com locale pt-BR |
| Analytics e suporte | Mixpanel, Freshchat/Freshworks, Refiner (pesquisa), push via VAPID |
| Infra (nomes de env, sem valores secretos) | MongoDB, Vercel, Azure Storage, AWS, Turnstile |

Cor primária: `--primary: 195 100% 19%` (azul-petróleo, `rgb(0,73,97)`); fundo
de página `--page: 210 40% 96%`. Estes tokens foram reaproveitados no clone.

## Rotas (App Router)

| Rota | Arquivo de chunk | Função |
| --- | --- | --- |
| `/` | `app/(dashboard)/page` | Saudação |
| `/cotacoes?periodo=30` | `app/(dashboard)/cotacoes/(root)/page` | Lista, busca, filtro de período, paginação |
| `/cotacoes/nova` | `…/cotacoes/nova/page` | Título → server action `create` |
| `/cotacoes/[id]/edit?d=…` | `…/cotacoes/[id]/edit/page` | Editor; `d=cenarios` abre o seletor de planos, `d=comparativo` a rede credenciada |
| `/cotacoes/[id]/cenarios/[cenarioId]` | `app/cotacoes/[id]/cenarios/[cenarioId]/page` | Proposta pública do plano (fora do layout do painel) |
| `/busca-ans`, `/busca-ans/[id]` | `…/busca-ans/…` | Operadoras e planos com IDSS e reajuste |
| `/produtos`, `/produtos/[id]/precos?…` | `…/produtos/page` | Catálogo por operadora |
| `/conta/perfil` (+ conta, assinatura, usuários, equipes, integrações, preferências) | `…/conta/…` | Configurações |
| Contatos, Negócios | outro app (`app2.…/crm/…`) | CRM separado |

## Server actions encontradas por tela

- Editor de cotação: `editTitulo`, `updateCnpj`, `addGrupo`, `updateGrupo`,
  `deleteGrupo`, `updateFiltro`, `onPlanoSelect`, `onPlanoRemove`,
  `searchOperadoras`, `updateOpcoes`, `getRegioesDisponiveis`,
  `getManualSelecao`, `getManualTipos`, `calcularComPrompt` (assistente IA),
  `linkContato`, `searchContatos`, `linkNegocio`, `searchNegocios`,
  `createAndLinkNegocio`, `trackCotacao`, `deleteCotacao`.
- Proposta: `updateComentario`, `registrarEvento`, `getRedeCredenciada`.
- Busca ANS: `searchCredenciados`, `searchCredenciadosByIds`.
- Produtos: `getProdutos`, `getEntidade`.
- Perfil: `updatePerfil`, `updateEmail`, `resetPassword`, `updateAvatarAction`.
- Layout: `setSession` (usuário + feature flags), `setTenant` (troca de
  corretora), `addDevice`/`removeDevice` (push).

Feature flags vistas: `multimodalidade`, `cotacaoRapida`, `calculoOficial`,
`crm`, `produto`, `buscaAns`.

## Regras de negócio inferidas

- Vidas são distribuídas nas 10 faixas etárias da ANS (00–18 … 59+). Há um
  conversor que aceita uma lista colada de datas de nascimento.
- Preço do plano = soma de (vidas na faixa × preço da faixa).
- Opções de envio da cotação: validade, mostrar valores, mostrar rede
  (por regiões) e "mais informações" do manual do plano.
- A proposta enviada ao cliente registra visualizações e tem botão
  "Tenho interesse" que abre o WhatsApp do corretor.
- A rede credenciada usa códigos por hospital (H, PS, PSA, M e sobrescrito
  para restrições), agrupados por região.

## Repetir com o REA

No seu computador, com o REA instalado (`npx rea-agents setup`) e um Chrome
aberto com depuração local (`--remote-debugging-port=9222`) e logado na sua
própria conta:

```bash
rea list-browser-targets http://127.0.0.1:9222
rea inspect-web-page http://127.0.0.1:9222 TARGET_ID --json
rea analyze-web-bundle http://127.0.0.1:9222 TARGET_ID --json
rea export-web-scripts ... # exporta os scripts capturados para uma pasta nova
rea recover-javascript-sources ... # exige REA_WAKARU_COMMAND (ver docs/guides/javascript/javascript-recovery.md)
```

Os argumentos exatos de cada comando estão em `rea <comando> --help` e nos guias
de `docs/guides/web/`.
