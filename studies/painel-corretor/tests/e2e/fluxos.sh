#!/usr/bin/env bash
# Teste de navegador (agent-browser) dos fluxos principais do painel.
#
#   BASE_URL=http://localhost:3102 npm run e2e
#
# Pré-requisitos: agent-browser instalado (npm i -g agent-browser && agent-browser install) e o painel rodando
# com a base de teste:  ANS_DIR=tests/fixtures npx next dev -p 3102
# O teste usa os dados da pasta de tests/fixtures (operadoras Amil, Bradesco etc.); não depende de cotações prévias.
# Para usar outro Chromium: AGENT_BROWSER_EXECUTABLE_PATH=/caminho/chrome.
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

ab() { agent-browser --session "$SESSION" "$@"; }

falha() {
  echo
  echo "FALHOU: $1" >&2
  echo "--- URL atual: $(ab get url 2>&1)" >&2
  echo "--- erros da página:" >&2
  ab errors 2>&1 | sed 's/^/    /' >&2
  echo "--- console (erros e avisos):" >&2
  ab console 2>&1 | grep -E '^\[(error|warning)\]' | sed 's/^/    /' >&2
  exit 1
}

# Executa um comando do agent-browser; falha o teste se ele falhar.
passo() {
  local saida
  saida=$(ab "$@" 2>&1) || falha "agent-browser $* -> $saida"
}

ok() { PASSOS=$((PASSOS + 1)); echo "ok  $1"; }

# Espera o texto aparecer na página.
espera() { passo wait --text "$1"; }

# Confere que o corpo da página contém (ou não) o texto.
tem() {
  local t
  t=$(ab get text body 2>&1) || falha "não consegui ler a página ($1)"
  grep -qF -- "$1" <<<"$t" || falha "texto esperado não encontrado: $1"
}
nao_tem() {
  local t
  t=$(ab get text body 2>&1) || falha "não consegui ler a página ($1)"
  grep -qF -- "$1" <<<"$t" && falha "texto não deveria aparecer: $1"
  return 0
}

# Avalia JS na página e exige o resultado "true".
js_true() {
  local r
  r=$(ab eval "$1" 2>&1) || falha "$2 (eval: $r)"
  [ "$r" = "true" ] || falha "$2 (obtido: $r)"
}

abrir_menu() { passo find role button click --name "Mais opções" --exact; }

# Limpeza: roda sempre ao sair (sucesso ou falha), sem mudar o código de saída.
limpar() {
  local codigo=$?
  trap - EXIT
  set +e
  if [ -n "$LEGADA_ID" ]; then
    node scripts/e2e-cotacao-legada.mjs --remover "$LEGADA_ID" >/dev/null 2>&1
  fi
  if [ "$CASO_CRIADO" = 1 ]; then
    ab open "$BASE_URL/comparar" >/dev/null 2>&1
    ab wait --text "Comparar com o Painel" >/dev/null 2>&1
    ab eval "(()=>{const r=[...document.querySelectorAll('tr')].find(r=>r.textContent.includes('5 vidas 24-28'));const b=r&&r.querySelector('button[aria-label=\"Excluir caso\"]');if(b)b.click();return !!b})()" >/dev/null 2>&1
    ab wait --text "Caso excluído." >/dev/null 2>&1
  fi
  if [ -n "$COT_ID" ]; then
    ab open "$BASE_URL/cotacoes/$COT_ID/edit" >/dev/null 2>&1
    ab wait --text "Adicionar Plano" >/dev/null 2>&1
    ab eval "window.confirm=()=>true" >/dev/null 2>&1
    ab find role button click --name "Mais opções" --exact >/dev/null 2>&1
    ab find role button click --name "Excluir" --exact >/dev/null 2>&1
    ab wait --url "**/cotacoes" >/dev/null 2>&1
  fi
  ab close >/dev/null 2>&1
  exit $codigo
}
trap limpar EXIT

command -v agent-browser >/dev/null || { echo "agent-browser não encontrado (npm i -g agent-browser && agent-browser install)." >&2; exit 2; }
curl -fsS -o /dev/null "$BASE_URL/cotacoes" || { echo "Painel não responde em $BASE_URL." >&2; exit 2; }

echo "E2E contra $BASE_URL (sessão $SESSION)"

# 1. Nova cotação ------------------------------------------------------------------------------------------------
passo open "$BASE_URL/cotacoes/nova"
passo fill "input[required]" "E2E fluxos $(date +%s)"
passo find role button click --name "Confirmar" --exact
passo wait --url "**/cotacoes/*/edit*"
COT_ID=$(ab get url | sed -E 's#.*/cotacoes/([^/]+)/edit.*#\1#')
[ -n "$COT_ID" ] || falha "não consegui descobrir o id da cotação"
ok "nova cotação $COT_ID"

# 2. Distribuição: 3 vidas de 24 a 28 anos --------------------------------------------------------------------------
espera "Distribuição de vidas"
passo find label "24 a 28 anos" fill 3 --exact
passo find role button click --name "Confirmar" --exact
espera "3 vidas"
ok "distribuição 3 vidas 24-28"

# 3. Seletor: São Caetano do Sul - SP, PME, operadora com ícone, plano, card com preço e "Referência ANS" ----------------
espera "Quais planos deseja comparar?"
passo find label "Cidade" fill "São Caetano do Sul - SP" --exact
# A lista é recarregada ao trocar a cidade: espera a contagem de planos de São Caetano (2 na Amil, nas fixtures).
passo wait --fn "(document.querySelector('[data-operadora=\"ans-326305\"]')||{innerText:''}).innerText.includes('2 planos')"
js_true "(()=>{const i=document.querySelector('[data-operadora=\"ans-326305\"] img, [data-operadora=\"ans-326305\"] [data-sigla]');return !!i&&i.getBoundingClientRect().width>0})()" "ícone da operadora não está visível no seletor"
tem "Amil"
ok "seletor: cidade e ícone da operadora"
passo click '[data-operadora="ans-326305"]'
espera "AMIL BRONZE SP QC"
tem "Referência ANS"
passo find first "input[data-plano]" click
passo find role button click --name "Continuar" --exact
passo wait --fn "!document.body.innerText.includes('Quais planos deseja comparar?')"
espera "Referência ANS"
tem "R$"
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
passo open "$BASE_URL/cotacoes/$COT_ID?preview=1"
espera "AMIL"
nao_tem "Referência ANS"
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
espera "Referência ANS"
tem "R$"
ok "proposta pública com valores"

# 7. Produtos com filtros (MEI só existe na base fictícia; na base da ANS o filtro não aparece) ----------------------------
passo open "$BASE_URL/produtos"
passo wait 'a[href^="/produtos/"]'
passo find role link click --name "Amil" --exact
espera "Amil"
passo open "$BASE_URL/produtos"
passo wait 'a[href^="/produtos/"]'
passo find role button click --name "Quarto Individual" --exact
passo wait --fn "document.querySelectorAll('a[href^=\"/produtos/\"]').length > 0"
if ab get text body 2>/dev/null | grep -qF "Aceita MEI"; then
  passo find text "Aceita MEI" click
  passo wait --fn "document.querySelectorAll('a[href^=\"/produtos/\"]').length > 0"
  ok "produtos com filtro MEI"
else
  nao_tem "Aceita MEI"
  ok "produtos com filtros (MEI não se aplica à base ANS)"
fi

# 8. Busca ANS: detalhe da operadora e do plano -------------------------------------------------------------------------
passo open "$BASE_URL/busca-ans"
espera "Busca ANS"
passo click 'a[href^="/busca-ans/326305"]'
espera "Registro ANS: 326305"
espera "Valor Máximo"
tem "Faixa Etária"
ok "busca ANS: detalhe"

# 9. Comparar: valor digitado e sugestão de ajuste ---------------------------------------------------------------------
passo open "$BASE_URL/comparar"
espera "Comparar com o Painel"
passo select "select" "São Caetano do Sul - SP"
passo find label "24-28" fill 5 --exact
passo find placeholder "Buscar plano pelo nome" fill "AMIL BRONZE SP QC COPART"
passo wait "ul.max-h-48 button"
passo find first "ul.max-h-48 button" click
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
passo open "$BASE_URL/cotacoes/$LEGADA_ID/edit"
espera "Plano indisponível"
ok "cotação legada: Plano indisponível"

# Erros de console durante todo o fluxo ----------------------------------------------------------------------------------
ERROS=$(ab errors 2>&1)
[ -z "$ERROS" ] || falha "erros na página: $ERROS"

echo
echo "E2E concluído: $PASSOS verificações ok."
