# Laboratory Module

Este módulo é independente do RuleEngine e tem como responsabilidade inicial registrar eventos de análise para futura mineração estatística.

## Componentes

- EventLogger: registra eventos com timestamp e contexto.
- LaboratoryEngine: camada de uso para registrar eventos de análise.
- Statistics: gera resumos simples de eventos.
- PatternDetector: espaço reservado para futuras detecções de padrões.

## Regras de design

- Não altera o fluxo atual do DecisionEngine.
- Não depende do RuleEngine.
- Mantém os registros em memória no escopo inicial.
