@echo off
rem Atan Prime - Cotacoes: atualiza o projeto, instala o que falta, liga o painel e abre o navegador.
rem Rode com duplo clique. Requer Node.js e Git instalados (veja docs\GUIA-RAPIDO.md).
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Atan Prime - Cotações
set "URL=http://localhost:3000"

echo.
echo  ===== Atan Prime - Cotações =====
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo  O Node.js não está instalado. Baixe a versão LTS em https://nodejs.org, instale e rode este arquivo de novo.
  goto erro
)

rem Se o painel já está ligado, só abre o navegador.
curl.exe -s -f -o nul "%URL%/cotacoes" >nul 2>&1
if not errorlevel 1 (
  echo  O painel já está ligado. Abrindo o navegador...
  start "" "%URL%"
  goto fim
)

where git >nul 2>&1
if errorlevel 1 (
  echo  Git não encontrado: pulando a atualização do projeto. Instale em https://git-scm.com para receber atualizações.
) else (
  echo  Buscando atualizações do projeto...
  git pull
  if errorlevel 1 echo  Não foi possível atualizar agora. O painel vai abrir com a versão que já está no computador.
)

set "INSTALAR=0"
if not exist "node_modules\" set "INSTALAR=1"
if not exist "node_modules\.package-lock.json" set "INSTALAR=1"
if "%INSTALAR%"=="0" (
  powershell -NoProfile -Command "if ((Get-Item 'package-lock.json').LastWriteTime -gt (Get-Item 'node_modules\.package-lock.json').LastWriteTime) { exit 1 } else { exit 0 }" >nul 2>&1
  if errorlevel 1 set "INSTALAR=1"
)
if "%INSTALAR%"=="1" (
  echo  Instalando os componentes do painel ^(só na primeira vez ou quando houver novidade; pode demorar alguns minutos^)...
  call npm install
  if errorlevel 1 (
    echo  A instalação falhou. Confira a internet e rode este arquivo de novo.
    goto erro
  )
)

echo  Ligando o painel em uma janela separada. Não feche essa janela enquanto estiver usando o painel.
start "Atan Prime Cotações" cmd /k npm run dev

echo  Esperando o painel ficar pronto ^(a primeira vez pode levar um minuto^)...
set /a tentativas=0
:esperar
curl.exe -s -f -o nul "%URL%/cotacoes" >nul 2>&1
if not errorlevel 1 goto pronto
set /a tentativas+=1
if %tentativas% geq 120 goto demorou
ping -n 3 127.0.0.1 >nul
goto esperar

:pronto
echo  Pronto! Abrindo o navegador em %URL%
start "" "%URL%"
goto fim

:demorou
echo  O painel está demorando para responder. Veja a janela "Atan Prime Cotações" e, se ela mostrar um erro, copie a mensagem e envie para o suporte.
goto erro

:erro
echo.
pause
exit /b 1

:fim
echo.
echo  Para encerrar o painel, feche a janela "Atan Prime Cotações".
timeout /t 5 >nul
exit /b 0
