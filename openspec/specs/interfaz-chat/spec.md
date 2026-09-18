# Spec: Interfaz de Chat y Aro de Contexto

## Purpose
Proporcionar una interfaz web interactiva con cálculo de ventana de contexto en tiempo real, selección de modelos de Antigravity y streaming en vivo.

## Requirements

### Requirement: Aro de Contexto Interactivo
La barra de mensaje debe mostrar un aro SVG circular con el porcentaje de tokens consumidos frente al límite del modelo activo.

#### Scenario: Alerta de umbral de contexto
- **WHEN** Los tokens superan el 80% del límite del modelo
- **THEN** El color del aro transiciona de azul a naranja/rojo y muestra el tooltip explicativo.

### Requirement: Selector de Modelos y Cuentas
La barra debe incluir selectores desplegables para modelos y cuentas con su estado de cuota.

#### Scenario: Cambio de modelo
- **WHEN** El usuario selecciona un modelo diferente
- **THEN** El aro de contexto recalcula de inmediato su porcentaje frente al nuevo límite máximo.
