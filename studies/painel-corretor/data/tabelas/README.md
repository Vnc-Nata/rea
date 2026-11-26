# Tabelas de venda (preço por faixa etária)

Coloque aqui arquivos `.csv` com as tabelas comerciais das operadoras. O painel os lê automaticamente
(recarrega quando o arquivo muda). Para usar outra pasta, defina `TABELAS_DIR`.

## Como preencher a partir do PDF da operadora

1. Abra a tabela de preços (PDF) do plano e copie o modelo `modelo.csv` para um arquivo novo, por exemplo
   `amil-sp-pme-2026-01.csv`. Pode haver vários arquivos e várias linhas por arquivo.
2. **Uma linha por plano por vigência.** O preço de uma linha vale para o plano em **todas** as cidades
   que ele atende: o painel não tem preço por cidade. As colunas `uf` e `municipio_ibge` só restringem
   quais planos a linha pode casar (ex.: `uf` = `SP` não casa com plano que não atende SP); elas não criam
   um preço diferente por região. Se a operadora tem preços diferentes por região, isso normalmente é
   um plano (código ANS) diferente — faça uma linha para cada código.
   Várias linhas para o mesmo plano com a mesma vigência (ex.: uma por município) geram o aviso
   "várias linhas para o mesmo plano e vigência; usada a primeira" em Preferências, e só a primeira vale.
3. Colunas (separador `;`, codificação UTF-8, BOM aceito):
   - `registro_operadora`: registro ANS da operadora (obrigatório; zeros à esquerda são completados até 6 dígitos).
   - `codigo_plano_ans`: código do plano na ANS (opcional, mas é a forma mais segura de casar o plano).
   - `nome_plano`: nome comercial (usado quando não há código; acento e maiúsculas não importam).
   - `uf`: sigla da UF (opcional; se informada, só casa com plano que atende essa UF; o preço vale em todas
     as cidades do plano).
   - `municipio_ibge`: código IBGE do município (opcional, apenas informativo; não cria preço por cidade).
   - `modalidade`: `PF`, `PME` ou `Adesão` (também aceita `Individual` e `Empresarial`).
   - `vigencia`: início da vigência da tabela, `AAAA-MM-DD`, `AAAA-MM` ou `DD/MM/AAAA` (obrigatório).
     Havendo mais de uma tabela para o mesmo plano, vale a de vigência mais recente.
   - `f00_18` ... `f59_mais`: valor mensal por faixa (00-18, 19-23, 24-28, 29-33, 34-38, 39-43, 44-48, 49-53,
     54-58, 59 ou mais). Aceita `1.034,80`, `1034.80`, `1034,8` ou `1.034` (ponto seguido de 3 dígitos é
     milhar). Deixe vazio quando a faixa não existe.
4. Linhas com problema (sem registro, vigência ou preço inválido) são ignoradas e listadas como aviso em
   Preferências.

## Exemplo (fictício, não usar como dado real)

```
registro_operadora;codigo_plano_ans;nome_plano;uf;municipio_ibge;modalidade;vigencia;f00_18;f19_23;f24_28;f29_33;f34_38;f39_43;f44_48;f49_53;f54_58;f59_mais
999999;000000000;Plano Exemplo Ficticio;SP;;PME;2026-01-01;250,00;280,00;310,00;350,00;400,00;450,00;520,00;620,00;780,00;1.200,00
```
