# Laboratory Adaptive Learning

O `AdaptiveLearningEngine` opera apenas sobre os dados já produzidos pelo módulo `laboratory`.

## Entradas

- EventStore via LaboratoryEngine
- StatisticsEngine
- PatternScore
- RegimeDetector
- SequenceAnalyzer
- BacktestingEngine

## Saída

- adaptation_score
- learning_state
- recommended_bias
- event_count
- explanation
- factors

## Restrições arquiteturais

- Não depende de RuleEngine.
- Não depende de DecisionEngine.
- Não modifica PredictionEngine para aprender.
- Não altera os eventos armazenados.