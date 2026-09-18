# Matriz de Fases y Subagentes para Spec-Driven Development (SDD)

Esta matriz detalla la división de responsabilidades entre el agente orquestador y los subagentes especializados durante el ciclo de vida SDD con OpenSpec.

## Matriz de Fases

| Fase SDD | Subagente | Skill Asignada | Tipo de Agente | Entradas | Salidas Clave | Barrera de Seguridad |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Exploración** | Explorador de Requisitos | `openspec-explore` | `research` o `self` | Requerimiento en lenguaje natural, estado actual del repositorio, specs existentes (`openspec list --specs`) | Hallazgos de arquitectura, viabilidad, trade-offs, nombre del cambio en kebab-case | **Prohibido tocar código**: solo investigación y lectura |
| **2. Especificación** | Diseñador de Especificación | `openspec-propose` (o `openspec-update-change`) | `self` | Alcance confirmado, contexto del proyecto (`openspec/config.yaml`) | `proposal.md`, delta specs (`specs/<cap>/spec.md`), `design.md`, `tasks.md` | **Prohibido tocar código de la aplicación**: solo artefactos OpenSpec |
| **Pausa: Human Gate** | *Sin subagente* (Orquestador directo) | Ninguna (Interacción humana) | N/A | Artefactos generados en la fase 2 | Aprobación explícita del usuario | **Bloqueo absoluto**: ningún subagente implementador se invoca sin el "Sí" del usuario |
| **3. Implementación** | Implementador | `openspec-apply-change` | `self` | Cambio aprobado, lista de tareas en `tasks.md`, especificaciones | Código implementado, tests correspondientes, `tasks.md` actualizado con `- [x]` | **Límite de alcance**: ceñirse estrictamente a las tareas de `tasks.md` |
| **4. Verificación y Cierre** | Verificador y Cierre | `openspec-archive-change` (o `openspec-sync-specs`) | `self` | Implementación terminada, `tasks.md` con 100% tareas completas | Ejecución limpia de tests/linter, cambio archivado en `openspec/changes/archive/` | **Comprobación de calidad**: no archivar si hay tests fallidos o tareas pendientes |

---

## Ciclo de Retroalimentación y Cambios de Rumbo

Si durante la Fase 3 (Implementación) el subagente implementador detecta una contradicción en el diseño, una imposibilidad técnica o un requisito faltante:
1. El subagente implementador **detiene su trabajo** y reporta el bloqueo al orquestador.
2. El orquestador **NO improvisa ni cambia el código arbitrariamente**.
3. El orquestador despacha al subagente de especificación con la skill `openspec-update-change` para actualizar el diseño y las tareas.
4. Se reactiva el **Human Gate**: el usuario debe aprobar los cambios al plan antes de reanudar la implementación.
