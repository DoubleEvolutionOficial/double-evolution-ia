# REG-001 Pedra Chave

## Objetivo

Calcular automaticamente a Pedra Chave de cada hora.

## Descrição

A regra busca o primeiro branco (0) de cada hora, lê a pedra imediatamente anterior e a pedra imediatamente posterior e soma os dois valores.

## Passos

1. Agrupar os resultados por hora.
2. Encontrar o primeiro branco (0) daquela hora.
3. Ler a pedra imediatamente anterior ao branco.
4. Ler a pedra imediatamente posterior ao branco.
5. Somar os dois valores.
6. Se a soma for maior que 14, reduzir somando os dígitos até obter um valor entre 0 e 14.

## Exemplo de redução

- 7 + 5 = 12
- 9 + 8 = 17 => 1 + 7 = 8
- 11 + 10 = 21 => 2 + 1 = 3

## Saída armazenada

- hora
- horário do primeiro branco
- pedra esquerda
- pedra direita
- soma
- pedra_chave

## Uso

A regra implementa `BaseRule` e é carregada pelo `RuleEngine` quando `app.rules` é importado.
