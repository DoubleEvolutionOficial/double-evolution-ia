# REG-003 Pagadores

## Objetivo

Detectar e analisar padrões de pagamentos de devedores através de espaçamento entre brancos.

## Descrição

A regra funciona como confirmadora auxiliar, não gerando entrada sozinha. Detecta diferentes tipos de padrões de pagamento baseados na distância entre consecutivos brancos (0).

## Padrões de Pagamento suportados

### Duplo
- Espaçamento: 0 casas (brancos consecutivos)
- Exemplo: `[..., 0, 0, ...]`
- Score: 2.0

### Dentado  
- Espaçamento: 1 pedra
- Exemplo: `[..., 0, X, 0, ...]`
- Score: 1.5

### Banguelo
- Espaçamento: 2 pedras
- Exemplo: `[..., 0, X, Y, 0, ...]`
- Score: 1.0

### Banguelão
- Espaçamento: 3 pedras
- Exemplo: `[..., 0, X, Y, Z, 0, ...]`
- Score: 0.5

## Comportamento

- Analisa todos os pares consecutivos de brancos.
- Descarta padrões com espaçamento fora de 0-3.
- Acumula o score de todos os padrões detectados.
- Preserva metadados em formato privado (backend only).

## Integração

- Registra automaticamente no RuleEngine.
- Alimenta o DecisionEngine como regra auxiliar.
- Peso configurável: 0.5 por padrão.
