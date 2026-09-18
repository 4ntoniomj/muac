---
name: usar-sdd
description: >-
  Coordina y orquesta el ciclo de vida de Spec-Driven Development (SDD) con OpenSpec dividiendo el trabajo entre subagentes especializados por fase: exploración, propuesta de especificación, human gate, implementación de tareas y verificación con archivo. Activar cuando el usuario pida iniciar, coordinar o ejecutar un flujo SDD con OpenSpec, guiar un desarrollo por fases de especificación o implementar una funcionalidad dividiendo el trabajo en subagentes mediante SDD. No usar para interactuar directamente con comandos de OpenSpec sin fases (usar openspec-explore u openspec-propose), para implementar tareas sueltas sin ciclo previo (usar openspec-apply-change), ni para archivar cambios directamente (usar openspec-archive-change).
license: MIT
compatibility: Requiere entorno con soporte de subagentes y CLI de OpenSpec instalada.
metadata:
  version: "1.0.0"
---

# usar-sdd

## Contexto y objetivo

Spec-Driven Development (SDD) garantiza que ningún código se escriba sin especificaciones previas validadas y aprobadas. Esta skill actúa como el protocolo de orquestación para coordinar el ciclo completo de SDD en proyectos que usan OpenSpec, desacoplando cada fase técnica en un subagente especializado e imponiendo una barrera de control humano inquebrantable antes de cualquier implementación.

No instruye sobre la sintaxis ni el funcionamiento interno de OpenSpec, sino que referencia y delega en las skills especializadas del ecosistema (`openspec-explore`, `openspec-propose`, `openspec-apply-change`, `openspec-archive-change` y `openspec-update-change`).

Criterio de éxito: ciclo SDD completado con cada fase ejecutada por su subagente respectivo, Human Gate explícitamente aprobado por el usuario y cambio verificado con tests antes de su archivo.

## Tarea o flujo de trabajo

La orquestación sigue estrictamente 4 fases secuenciales con un punto de control humano intermedio.

```
[Usuario] ➔ Paso 1: Clarificación
              │
              ▼
[Fase 1: Exploración] ➔ Subagente (openspec-explore)
              │
              ▼
[Fase 2: Especificación] ➔ Subagente (openspec-propose)
              │
              ▼
   [HUMAN GATE OBLIGATORIO] ➔ Parada y confirmación del usuario
              │ (Aprobado)
              ▼
[Fase 3: Implementación] ➔ Subagente (openspec-apply-change)
              │
              ▼
[Fase 4: Verificación y Archivo] ➔ Subagente (openspec-archive-change + tests)
```

### Paso 1. Entender la petición y delimitar el cambio

Analiza la petición del usuario y el estado del repositorio. Si la necesidad no está clara o faltan parámetros esenciales, formula como máximo 3 preguntas por turno con respuesta por defecto:

1. ¿Cuál es el objetivo principal y el nombre propuesto en kebab-case para el cambio? (por defecto: derivado del requerimiento del usuario)
2. ¿Se requiere una fase previa de exploración de arquitectura o se dispone ya de la solución definida? (por defecto: exploración breve si hay dudas de diseño, o pasar a especificación si está claro)
3. ¿Qué suite de pruebas o verificación se usará para validar el cambio al final? (por defecto: la del proyecto existente)

Verificación: nombre del cambio definido en kebab-case y alcance delimitado antes de despachar subagentes.

### Paso 2. Fase 1: Exploración (Subagente de Exploración)

Si el problema presenta incertidumbre técnica, alternativas de diseño o requiere investigar la base de código, despacha un subagente de rol investigativo (`research` o `self`) asignándole la skill `openspec-explore`.

El orquestador prepara el prompt usando [subagent-dispatch.md](templates/subagent-dispatch.md).

Pautas para este subagente:
- Usa la skill `openspec-explore` para inspeccionar el estado actual y capacidades (`openspec list --specs`).
- Tiene terminantemente prohibido modificar código de la aplicación.
- Identifica restricciones, riesgos técnicos y componentes afectados.

Verificación: el subagente devuelve un informe claro con la recomendación de arquitectura y el alcance confirmado.

### Paso 3. Fase 2: Especificación y Propuesta (Subagente de Especificación)

Despacha un subagente (`self`) con la skill `openspec-propose` (o `openspec-update-change` si se trata de modificar una propuesta ya existente).

Pautas para este subagente:
- Ejecuta el andamiaje de OpenSpec (`openspec new change "<nombre>"`).
- Redacta todos los artefactos de planificación requeridos: `proposal.md`, delta specs bajo `specs/`, `design.md` y `tasks.md`.
- Tiene terminantemente prohibido modificar código de la aplicación: su alcance se limita a los artefactos bajo `openspec/changes/<nombre>/`.

Verificación: ejecución de `python3 scripts/check_sdd_status.py --change <nombre>`, confirmando que los artefactos de planificación existen y las tareas están listas (- [ ]).

### Paso 4. Human Gate (Barrera de Control Humano)

**PUNTO DE PARADA OBLIGATORIO.** El orquestador NO invoca al subagente implementador bajo ninguna circunstancia sin autorización explícita del usuario.

El orquestador debe:
1. Presentar al usuario un resumen conciso de lo especificado: el qué (`proposal.md`), el cómo (`design.md`) y el plan de acción (`tasks.md`).
2. Solicitar aprobación explícita para proceder a la implementación.
3. Si el usuario solicita ajustes, reenviar al subagente de especificación con la skill `openspec-update-change` antes de volver al Human Gate.

Verificación: confirmación explícita del usuario ("sí", "procede", "aprobado") registrada en la conversación.

### Paso 5. Fase 3: Implementación (Subagente Implementador)

Una vez superado el Human Gate, despacha un subagente (`self`) asignándole la skill `openspec-apply-change`.

Pautas para este subagente:
- Sigue las instrucciones devueltas por `openspec instructions apply --change "<nombre>"`.
- Implementa estrictamente las tareas descritas en `tasks.md`.
- Marca cada tarea completada con `- [x]` tras su implementación.
- Si surgen contradicciones técnicas o cambios de diseño imprevistos, se detiene y avisa al orquestador (no improvisa cambios de arquitectura).

Verificación: `python3 scripts/check_sdd_status.py --change <nombre>` devuelve todas las tareas completadas y sin errores de compilación o sintaxis.

### Paso 6. Fase 4: Verificación y Archivo (Subagente Verificador)

Despacha un subagente (`self`) asignándole la suite de pruebas del proyecto y la skill `openspec-archive-change`.

Pautas para este subagente:
- Ejecuta los comandos de test automatizados y linters del proyecto.
- Verifica que no existen regresiones.
- Ejecuta el flujo de archivo según la skill `openspec-archive-change` (`openspec archive "<nombre>"`).

Verificación: suite de pruebas del proyecto en verde (código 0) y cambio archivado satisfactoriamente en `openspec/changes/archive/`.

## Formato de salida

El orquestador reporta al usuario al finalizar el ciclo con la siguiente estructura:

1. **Identificador del cambio**: nombre y ruta archivada en OpenSpec.
2. **Resumen de fases ejecutadas**: tabla con la fase, subagente utilizado y artefactos producidos.
3. **Estado de verificación**: resumen de las pruebas automatizadas ejecutadas y su resultado.
4. **Capacidades actualizadas**: especificaciones consolidadas en el proyecto.

## Restricciones y reglas

- No inventes comandos ni parámetros de OpenSpec: consulta siempre las skills de referencia o la ayuda oficial con `openspec --help`.
- Toda fase se delega en un subagente especializado según la [matriz-fases-subagentes.md](references/matriz-fases-subagentes.md).
- El Human Gate es inquebrantable: ningún subagente tocará código de producción antes de recibir la confirmación humana.
- Los subagentes de las fases 1 y 2 tienen estrictamente vetada la edición de código fuente del proyecto.
- Atribución y licenciamiento documentados en [procedencia.md](references/procedencia.md).
- Mejoras pendientes de esta skill: [backlog.md](references/backlog.md).

## Ejemplos

Guía detallada de ejecución paso a paso con prompts reales de delegación a subagentes: [EXAMPLE.md](EXAMPLE.md).
