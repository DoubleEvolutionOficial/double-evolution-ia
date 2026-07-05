# REG-002 Devedor

## Objetivo

Detectar quando um branco está "devedor" com base na distância desde o último branco, considerando as distâncias de 5ª, 6ª e 7ª casas.

## Regras

- A regra lê uma sequência de resultados onde `0` representa um branco.
- Para cada branco encontrado, calcula a distância em casas desde o branco anterior.
- A regra só considera distâncias de 5, 6 ou 7 casas.
- Quanto maior a distância, maior o peso aplicado ao score.

## Peso

- distância 5 => peso 1.0
- distância 6 => peso 1.5
- distância 7 => peso 2.0

## Saída

A regra retorna apenas um score ao `RuleEngine`.

Detalhes internos são preservados em metadata e só devem ser usados pelo `AdminView`.
