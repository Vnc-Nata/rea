#!/usr/bin/env bash
# Teste de navegador (agent-browser) dos fluxos principais do painel.
#
#   BASE_URL=http://localhost:3102 npm run e2e
#
# Pré-requisitos: agent-browser instalado (npm i -g agent-browser && agent-browser install) e o painel rodando
# com a base de teste:  ANS_DIR=tests/fixtures npx next dev -p 3102
# Roda com a base de teste (tests/fixtures) ou com a base real/grande: só confere formatos (ex.: "N planos", "R$ ..."),
# não valores das fixtures. Precisa da Amil (registro 326305) comercializada em São Caetano do Sul - SP.
# Não depende de cotações prévias. Antes do navegador, aquece as páginas com curl (a primeira compilação do Next.js
# e a leitura de uma base grande podem passar de 25 s); todo comando espera até 60 s (E2E_TIMEOUT, ms).
# Para usar outro Chromium: AGENT_BROWSER_EXECUTABLE_PATH=/caminho/chrome.
# Base grande sintética: node scripts/gerar-base-grande.mjs /tmp/base-grande && ANS_DIR=/tmp/base-grande npx next dev -p 3105
# Não suba um segundo `next dev` na mesma pasta de outro já rodando: os dois escrevem em .next e se quebram (use uma
# cópia da pasta; o helper da cotação legada aceita DB_FILE).
#
# O que ele cria em data/db.json: uma cotação "E2E fluxos ...", uma cotação legada "E2E cotação legada" (por
# scripts/e2e-cotacao-legada.mjs) e um caso em Comparar. Tudo é apagado no final, pela própria interface
# (Excluir / Excluir caso), mesmo quando algum passo falha. Se o script for interrompido à força, apague à mão
# as cotações que começam com "E2E" e o caso "5 vidas 24-28" em Comparar.
# Sai com código diferente de 0 em qualquer falha e imprime os erros do console.

set -uo pipefail
cd "$(dirname "$0")/../.."

BASE_URL="${BASE_URL:-http://localhost:3000}"
BASE_URL="${BASE_URL%/}"
SESSION="e2e-fluxos-$$"
COT_ID=""
LEGADA_ID=""
CASO_CRIADO=0
PASSOS=0

if [ -z "${AGENT_BROWSER_EXECUTABLE_PATH:-}" ]; then
  for c in /opt/pw-browsers/chromium-*/chrome-linux64/chrome; do
    [ -x "$c" ] && export AGENT_BROWSER_EXECUTABLE_PATH="$c" && break
  done
fi

TMP_E2E=$(mktemp -d "${TMPDIR:-/tmp}/e2e-fluxos.XXXXXX")
SAIDA=""

ab() { agent-browser --session "$SESSION" "$@"; }

# Roda o agent-browser e guarda a saída em $SAIDA (devolve o código de saída dele).
# A saída vai para um arquivo, nunca para um pipe/$(...): no Windows (Git Bash) o daemon do agent-browser herda o
# pipe e a captura nunca recebe EOF (o script trava no primeiro comando).
# Espera padrão (ms), uma só para a execução inteira: o agent-browser reabre o navegador (página em branco)
# quando AGENT_BROWSER_DEFAULT_TIMEOUT muda entre dois comandos da mesma sessão.
ESPERA="${E2E_TIMEOUT:-60000}"
export AGENT_BROWSER_DEFAULT_TIMEOUT="$ESPERA"
capt() {
  local rc
  ab "$@" </dev/null >"$TMP_E2E/saida" 2>&1
  rc=$?
  # Sem o aviso que o agent-browser imprime quando a espera padrão muda.
  SAIDA=$(grep -v '^⚠ default-timeout' "$TMP_E2E/saida")
  return $rc
}

falha() {
  echo
  echo "FALHOU: $1" >&2
  capt get url
  echo "--- URL atual: $SAIDA" >&2
  echo "--- erros da página:" >&2
  capt errors
  sed 's/^/    /' <<<"$SAIDA" >&2
  echo "--- console (erros e avisos):" >&2
  capt console
  grep -E '^\[(error|warning)\]' <<<"$SAIDA" | sed 's/^/    /' >&2
  exit 1
}

# Executa um comando do agent-browser; falha o teste se ele falhar.
passo() {
  capt "$@" || falha "agent-browser $* -> $SAIDA"
}

# Marca os passos que podem demorar (primeira compilação, base grande); usam a mesma espera única.
lento() { passo "$@"; }

ok() { PASSOS=$((PASSOS + 1)); echo "ok  $1"; }

# Espera o texto aparecer na página.
espera() { passo wait --text "$1"; }

# Confere que o corpo da página contém (ou não) o texto.
tem() {
  capt get text body || falha "não consegui ler a página ($1)"
  grep -qF -- "$1" <<<"$SAIDA" || falha "texto esperado não encontrado: $1"
}
nao_tem() {
  capt get text body || falha "não consegui ler a página ($1)"
  grep -qF -- "$1" <<<"$SAIDA" && falha "texto não deveria aparecer: $1"
  return 0
}

# Avalia JS na página e exige o resultado "true".
js_true() {
  capt eval "$1" || falha "$2 (eval: $SAIDA)"
  [ "$SAIDA" = "true" ] || falha "$2 (obtido: $SAIDA)"
}

# Origem do preço: "Referência ANS" ou "Tabela de venda" (a base real pode ter tabelas de venda).
ORIGEM_JS="/Referência ANS|Tabela de venda/.test(document.body.innerText)"

abrir_menu() { passo find role button click --name "Mais opções" --exact; }

# Limpeza: roda sempre ao sair (sucesso ou falha), sem mudar o código de saída.
limpar() {
  local codigo=$?
  trap - EXIT
  set +e
  if [ -n "$LEGADA_ID" ]; then
    node scripts/e2e-cotacao-legada.mjs --remover "$LEGADA_ID" </dev/null >/dev/null 2>&1
  fi
  if [ "$CASO_CRIADO" = 1 ]; then
    ab open "$BASE_URL/comparar" </dev/null >/dev/null 2>&1
    ab wait --text "Comparar com o Painel" </dev/null >/dev/null 2>&1
    ab eval "(()=>{const r=[...document.querySelectorAll('tr')].find(r=>r.textContent.includes('5 vidas 24-28'));const b=r&&r.querySelector('button[aria-label=\"Excluir caso\"]');if(b)b.click();return !!b})()" </dev/null >/dev/null 2>&1
    ab wait --text "Caso excluído." </dev/null >/dev/null 2>&1
  fi
  if [ -n "$COT_ID" ]; then
    ab open "$BASE_URL/cotacoes/$COT_ID/edit" </dev/null >/dev/null 2>&1
    ab wait --text "Adicionar Plano" </dev/null >/dev/null 2>&1
    ab eval "window.confirm=()=>true" </dev/null >/dev/null 2>&1
    ab find role button click --name "Mais opções" --exact </dev/null >/dev/null 2>&1
    ab find role button click --name "Excluir" --exact </dev/null >/dev/null 2>&1
    ab wait --url "**/cotacoes" </dev/null >/dev/null 2>&1
  fi
  ab close </dev/null >/dev/null 2>&1
  rm -rf "$TMP_E2E"
  exit $codigo
}
trap limpar EXIT

command -v agent-browser >/dev/null || { echo "agent-browser não encontrado (npm i -g agent-browser && agent-browser install)." >&2; exit 2; }
curl -fsS -o /dev/null "$BASE_URL/cotacoes" || { echo "Painel não responde em $BASE_URL." >&2; exit 2; }

echo "E2E contra $BASE_URL (sessão $SESSION)"

# Aquecimento: compila as páginas (e lê o catálogo) antes do navegador. Ids inexistentes compilam a rota do mesmo jeito.
echo "aquecendo as páginas..."
for p in /cotacoes /cotacoes/nova /cotacoes/e2e-aquecimento/edit /cotacoes/e2e-aquecimento \
  /cotacoes/e2e-aquecimento/cenarios/x /produtos /busca-ans /busca-ans/326305 /comparar; do
  curl -s -o /dev/null --max-time 300 "$BASE_URL$p" </dev/null || true
done

# Sobe o daemon da sessão uma vez, sem nenhuma captura de saída (ver capt).
ab open about:blank </dev/null >/dev/null 2>&1 || { echo "agent-browser não conseguiu abrir o navegador." >&2; exit 2; }

# 1. Nova cotação ------------------------------------------------------------------------------------------------
lento open "$BASE_URL/cotacoes/nova"
passo fill "input[required]" "E2E fluxos $(date +%s)"
passo find role button click --name "Confirmar" --exact
lento wait --url "**/cotacoes/*/edit*"
capt get url
COT_ID=$(sed -E 's#.*/cotacoes/([^/]+)/edit.*#\1#' <<<"$SAIDA")
[ -n "$COT_ID" ] || falha "não consegui descobrir o id da cotação"
ok "nova cotação $COT_ID"

# 2. Distribuição: 3 vidas de 24 a 28 anos --------------------------------------------------------------------------
lento wait --text "Distribuição de vidas"
passo find label "24 a 28 anos" fill 3 --exact
passo find role button click --name "Confirmar" --exact
espera "3 vidas"
ok "distribuição 3 vidas 24-28"

# 3. Seletor: São Caetano do Sul - SP, PME, operadora com ícone, plano, card com preço e "Referência ANS" ----------------
espera "Quais planos deseja comparar?"
passo find label "Cidade" fill "São Caetano do Sul - SP" --exact
# A lista é recarregada ao trocar a cidade: espera a Amil com "N planos" (N ≥ 1; o número depende da base).
passo wait 500
lento wait --fn "!document.querySelector('[aria-busy=\"true\"]')&&/(^|\\D)[1-9]\\d* planos?/.test((document.querySelector('[data-operadora=\"ans-326305\"]')||{innerText:''}).innerText)"
# Hospitais de preferência: só da UF da cidade (SP); hospitais de outra cidade aparecem como "Nome (Cidade - UF)".
js_true "[...document.querySelectorAll('select[aria-label=\"Adicionar hospital\"] option')].slice(1).every(o=>!/ - [A-Z]{2}\\)\$/.test(o.textContent)||/ - SP\\)\$/.test(o.textContent))" "hospitais de preferência de outra UF"
js_true "(()=>{const i=document.querySelector('[data-operadora=\"ans-326305\"] img, [data-operadora=\"ans-326305\"] [data-sigla]');return !!i&&i.getBoundingClientRect().width>0})()" "ícone da operadora não está visível no seletor"
tem "Amil"
ok "seletor: cidade e ícone da operadora"
passo click '[data-operadora="ans-326305"]'
passo wait "input[data-plano]"
js_true "$ORIGEM_JS" "origem do preço não aparece no seletor"
js_true "/R\\$\\s*\\d/.test(document.body.innerText)" "preço não aparece no seletor"
# Escolhe o primeiro plano com rede hospitalar ("N hospitais", N ≥ 1): o passo 6b precisa de regiões da rede.
js_true "(()=>{const ls=[...document.querySelectorAll('label')].filter(l=>l.querySelector('input[data-plano]:not(:disabled)'));const l=ls.find(l=>/(^|\\D)[1-9]\\d* hospitais/.test(l.textContent))||ls[0];if(!l)return false;l.querySelector('input[data-plano]').click();return true})()" "nenhum plano para selecionar"
passo wait "input[data-plano]:checked"
passo find role button click --name "Continuar" --exact
passo wait --fn "!document.body.innerText.includes('Quais planos deseja comparar?')"
passo wait --fn "$ORIGEM_JS"
js_true "/R\\$\\s*\\d/.test(document.body.innerText)" "preço não aparece no card do plano"
js_true "(()=>{const i=document.querySelector('[class*=\"group/card\"] img, [class*=\"group/card\"] [data-sigla]');return !!i&&i.getBoundingClientRect().width>0})()" "ícone da operadora não aparece no card do plano"
ok "plano na cotação: card com preço e Referência ANS"

# 4. Compartilhar -------------------------------------------------------------------------------------------------
abrir_menu
passo find role button click --name "Compartilhar" --exact
espera "Envie a proposta para o seu cliente."
tem "Abrir proposta do cliente"
passo find role button click --name "Fechar" --exact
passo wait --fn "!document.body.innerText.includes('Envie a proposta para o seu cliente.')"
ok "compartilhar"

# 5. Opções: esconde os valores na proposta -----------------------------------------------------------------------------
abrir_menu
passo find role button click --name "Opções" --exact
espera "Defina o que o cliente verá na proposta."
passo find role switch click --name "Valores"
passo find role button click --name "Confirmar" --exact
passo wait --fn "!document.body.innerText.includes('Defina o que o cliente verá')"
ok "opções"

# 6. Proposta pública (respeita as opções) ------------------------------------------------------------------------------
lento open "$BASE_URL/cotacoes/$COT_ID?preview=1"
lento wait --fn "/amil/i.test(document.body.innerText)"
nao_tem "Referência ANS"
nao_tem "Tabela de venda"
nao_tem "R$"
ok "proposta pública sem valores"
passo open "$BASE_URL/cotacoes/$COT_ID/edit"
espera "Adicionar Plano"
abrir_menu
passo find role button click --name "Opções" --exact
espera "Defina o que o cliente verá na proposta."
passo find role switch click --name "Valores"
passo find role button click --name "Confirmar" --exact
passo wait --fn "!document.body.innerText.includes('Defina o que o cliente verá')"
passo open "$BASE_URL/cotacoes/$COT_ID?preview=1"
passo wait --fn "$ORIGEM_JS"
js_true "/R\\$\\s*\\d/.test(document.body.innerText)" "preço não aparece na proposta"
ok "proposta pública com valores"

# 6b. Opções: regiões da rede e itens de "Mais informações" -------------------------------------------------------------
passo open "$BASE_URL/cotacoes/$COT_ID?preview=1"
espera "Ver detalhes"
passo find role link click --name "Ver detalhes" --exact
lento wait --text "Tenho interesse"
capt get url
CEN_URL="$SAIDA"
espera "Hospitais"
js_true "/Quarto (coletivo|individual)/.test(document.body.innerText)" "acomodação não aparece na proposta"
passo open "$BASE_URL/cotacoes/$COT_ID/edit"
espera "Adicionar Plano"
abrir_menu
passo find role button click --name "Opções" --exact
espera "Defina o que o cliente verá na proposta."
js_true "/^[1-9]\\d* regi(ões|ão)$/.test(document.querySelector('[data-lista=\"regioes\"]').textContent.trim())" "botão de regiões sem a contagem"
js_true "/^[1-9]\\d* ite(ns|m)$/.test(document.querySelector('[data-lista=\"itens\"]').textContent.trim())" "botão de itens sem a contagem"
passo click '[data-lista="regioes"]'
passo wait '[data-checklist="regioes"]'
passo find text "Desmarcar todos" click --exact
js_true "document.querySelector('[data-lista=\"regioes\"]').textContent.trim()==='0 regiões'" "desmarcar regiões não zerou a contagem"
passo click '[data-lista="itens"]'
passo wait '[data-checklist="itens"]'
passo find label "Acomodação" click --exact
passo find role button click --name "Confirmar" --exact
passo wait --fn "!document.body.innerText.includes('Defina o que o cliente verá')"
passo open "$CEN_URL"
espera "Tenho interesse"
nao_tem "Hospitais"
js_true "!/Quarto (coletivo|individual)/.test(document.body.innerText)" "acomodação deveria estar oculta"
tem "Abrangência"
ok "opções: regiões e itens filtram a proposta"

# 7. Produtos com filtros (MEI só existe na base fictícia; na base da ANS o filtro não aparece) ----------------------------
lento open "$BASE_URL/produtos"
lento wait 'a[href^="/produtos/"]'
passo find role link click --name "Amil" --exact
espera "Amil"
passo open "$BASE_URL/produtos"
passo wait 'a[href^="/produtos/"]'
passo find role button click --name "Quarto Individual" --exact
passo wait --fn "document.querySelectorAll('a[href^=\"/produtos/\"]').length > 0"
capt get text body
if grep -qF "Aceita MEI" <<<"$SAIDA"; then
  passo find text "Aceita MEI" click
  passo wait --fn "document.querySelectorAll('a[href^=\"/produtos/\"]').length > 0"
  ok "produtos com filtro MEI"
else
  nao_tem "Aceita MEI"
  ok "produtos com filtros (MEI não se aplica à base ANS)"
fi

# 8. Busca ANS: detalhe da operadora e do plano -------------------------------------------------------------------------
lento open "$BASE_URL/busca-ans"
lento wait --text "Busca ANS"
passo click 'a[href^="/busca-ans/326305"]'
lento wait --text "Registro ANS: 326305"
espera "Valor Máximo"
tem "Faixa Etária"
ok "busca ANS: detalhe"

# 9. Comparar: valor digitado e sugestão de ajuste ---------------------------------------------------------------------
lento open "$BASE_URL/comparar"
lento wait --text "Comparar com o Painel"
# Tudo dentro do painel "Novo caso": casos já salvos sem plano têm uma busca igual (não pode ser usada aqui).
passo select "[data-novo-caso] select" "São Caetano do Sul - SP"
passo find label "24-28" fill 5 --exact
passo fill '[data-novo-caso] input[placeholder="Buscar plano pelo nome"]' "Amil"
passo wait "[data-novo-caso] ul.max-h-48 button"
passo find first "[data-novo-caso] ul.max-h-48 button" click
passo wait --fn "[...document.querySelectorAll('[data-novo-caso] button')].some(b=>b.textContent.trim()==='Trocar')"
passo find role button click --name "Adicionar caso" --exact
CASO_CRIADO=1
espera "Caso adicionado."
passo wait --fn "[...document.querySelectorAll('tr')].some(r=>r.textContent.includes('5 vidas 24-28'))"
passo find label "5 vidas 24-28" fill "9.999,00"
passo press Tab
espera "Sugerido"
tem "Aplicar ajuste"
js_true "[...document.querySelectorAll('tr')].some(r=>r.textContent.includes('5 vidas 24-28')&&/[+-]?\\d+[,.]\\d+\\s*%/.test(r.textContent))" "diferença % não apareceu no caso"
ok "comparar: diferença e ajuste sugerido"

# 10. Cotação legada com plano inexistente -----------------------------------------------------------------------------
LEGADA_ID=$(node scripts/e2e-cotacao-legada.mjs) || falha "helper da cotação legada falhou"
lento open "$BASE_URL/cotacoes/$LEGADA_ID/edit"
lento wait --text "Plano indisponível"
ok "cotação legada: Plano indisponível"

# Erros de console durante todo o fluxo ----------------------------------------------------------------------------------
capt errors
[ -z "$SAIDA" ] || falha "erros na página: $SAIDA"

echo
echo "E2E concluído: $PASSOS verificações ok."
