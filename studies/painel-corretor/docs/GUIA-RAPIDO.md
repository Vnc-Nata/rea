# Guia rápido: Atan Prime · Cotações

Para quem vai usar o painel no dia a dia, sem precisar entender de programação. Siga na ordem. Os passos 1 e 2 são
feitos **uma única vez** em cada computador.

## 1. Instalar os programas (uma vez)

1. **Node.js**: acesse <https://nodejs.org>, baixe a versão **LTS** e instale clicando em "Avançar" até o fim.
2. **Git para Windows**: acesse <https://git-scm.com>, baixe e instale também deixando as opções padrão.

Depois de instalar, **reinicie o computador** (ou pelo menos feche e abra de novo as janelas) para o Windows
reconhecer os programas.

## 2. Baixar o projeto (uma vez)

1. Abra o menu Iniciar, digite **cmd** e abra o "Prompt de Comando".
2. Escolha uma pasta para guardar o projeto (por exemplo, a sua pasta de documentos) e copie os comandos abaixo, um por
   vez, apertando Enter ao final de cada um:

```
cd %USERPROFILE%\Documents
git clone https://github.com/vnc-nata/rea.git
cd rea
git checkout claude/project-thread-k24z7s
cd studies\painel-corretor
```

3. Abra essa pasta no Explorador de Arquivos: `Documentos\rea\studies\painel-corretor`. Ela tem o arquivo
   **iniciar.bat**. Dica: clique com o botão direito nele > Enviar para > Área de trabalho (criar atalho).

## 3. Usar o painel (todo dia)

Dê **duplo clique em `iniciar.bat`**. Ele faz tudo sozinho:

- busca as atualizações do projeto;
- instala o que estiver faltando (só demora na primeira vez);
- liga o painel em uma segunda janela, chamada **Atan Prime Cotações**, e abre o navegador em
  <http://localhost:3000>.

**Não feche a janela "Atan Prime Cotações" enquanto estiver usando o painel.** Quando terminar o trabalho, pode
fechá-la. Se o Windows perguntar sobre permissão de rede (firewall), pode permitir.

## 4. Importar os dados reais da ANS (uma vez, e de vez em quando para atualizar)

O painel usa os dados abertos da ANS (planos, valores de referência, rede de hospitais). Eles precisam ser baixados:

1. Abra o Prompt de Comando na pasta `painel-corretor` (no Explorador de Arquivos, clique na barra de endereço, digite
   `cmd` e aperte Enter).
2. Rode:

```
npm run importar-ans -- --uf SP,MG --todas
```

Troque `SP,MG` pelos estados em que você vende (por exemplo `SP,MG,RJ`). **Demora bastante** (baixa mais de 1 GB; deixe
o computador ligado e conectado à internet). Quando terminar, reinicie o painel (feche a janela "Atan Prime Cotações" e
dê duplo clique em `iniciar.bat`). Repita o comando quando quiser atualizar a base, por exemplo uma vez por mês.

## 5. Logos das operadoras (opcional)

Para aparecer o logotipo de cada operadora no lugar da sigla colorida:

```
npm run baixar-logos
```

## 6. Tabelas de venda (os preços reais das operadoras)

O valor que vem da ANS é uma **referência** (o VCM, que a operadora declarou à ANS), não a tabela de venda. Para o
painel usar os **preços de venda reais**, coloque as tabelas na pasta `data\tabelas`, em arquivos `.csv` (um modelo e as
instruções estão em `data\tabelas\README.md`). Onde houver tabela de venda, ela vale no lugar do valor de referência. O
painel mostra em cada preço de onde ele veio: "Referência ANS" ou "Tabela de venda".

Se alguma linha do arquivo tiver problema, a tela **Configurações > Preferências** lista o arquivo e a linha para você
corrigir.

## 7. Comparar com o Painel (conferir os valores)

Use a tela **Comparar** para conferir se o nosso valor está perto do que o Painel mostra:

1. Em **Novo caso**, escolha a cidade, informe quantas vidas há em cada faixa etária e procure o plano pelo nome.
2. Digite em **Valor no Painel** o total que o Painel mostra para o mesmo caso e clique em **Adicionar caso**. (Também
   dá para preencher depois, na tabela.)
3. A coluna **Diferença** mostra quanto o nosso valor está acima (+) ou abaixo (−) do Painel.
4. Em **Ajuste sugerido por operadora**, o painel calcula a correção em % para aquela operadora. Clique em **Aplicar
   ajuste** para usá-la. Você também pode digitar o ajuste à mão em **Configurações > Preferências**.

Quanto mais casos você comparar por operadora, melhor fica o ajuste sugerido. O ajuste só vale para planos **sem**
tabela de venda.

## 8. Dia a dia: cotação

1. **Cotações > Nova cotação**: dê um título e informe as vidas por faixa etária.
2. Em **Adicionar Plano**, escolha cidade, tipo (PF, PME ou Adesão), a operadora e marque os planos.
3. Use **Compartilhar** para enviar a proposta ao cliente (WhatsApp, e-mail, link) e **Opções** para escolher o que o
   cliente vê (valores, rede, mais informações) e até quando a proposta vale.

## Limites que você precisa saber

- **O valor da ANS (VCM) é referência e pode ser diferente do preço de venda.** Use a tela **Comparar** para ajustar
  por operadora e, quando tiver a tabela de venda, coloque em `data\tabelas`: ela sempre vale mais que a referência.
- Operadoras e planos novos só aparecem depois de importar a base de novo (passo 4).
- O painel não substitui o CRM (Contatos e Negócios) nem tem login. O assistente de IA é só um botão, ainda sem função.
- Seus dados (cotações, preferências) ficam só neste computador, em `data\db.json`. Faça cópia dessa pasta se quiser
  guardar.

## Problemas comuns

| O que aconteceu                           | O que fazer                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| "Node.js não está instalado"              | Refaça o passo 1 e reinicie o computador.                                                  |
| O navegador abre e mostra erro de conexão | Espere um minuto e atualize a página (F5). Na primeira vez o painel demora a ligar.        |
| Janela de comandos mostra erro vermelho   | Copie a mensagem e envie para o suporte.                                                   |
| Quer voltar aos dados de exemplo          | No Prompt de Comando da pasta do projeto: `npm run reset-db`. Isso apaga as suas cotações. |
