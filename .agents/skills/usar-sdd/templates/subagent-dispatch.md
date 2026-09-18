# Plantilla de Despacho de Subagentes para Fases SDD

Usa esta plantilla al invocar a un subagente mediante `invoke_subagent` para una fase específica del ciclo SDD.

---

## 1. Subagente de Fase 1: Exploración

```markdown
Role: Explorador de Requisitos SDD
TypeName: research
Prompt:
Actúa como subagente explorador del ciclo SDD para el proyecto.
Tu misión es investigar y explorar la viabilidad y alcance para: "{OBJETIVO_CAMBIO}".

Instrucciones:
1. Consulta y sigue las pautas de la skill `openspec-explore`.
2. Lee el repositorio, examina la arquitectura existente y verifica artefactos OpenSpec (`openspec list --specs`, `openspec show <spec-id>`).
3. NO implementes código en el proyecto ni modifiques archivos de la aplicación.
4. Si se decide formalizar la idea, estructura el alcance preliminar y genera o propone el nombre del cambio en kebab-case.
5. Devuelve un informe con los hallazgos, dependencias técnicas y riesgos detectados.
```

---

## 2. Subagente de Fase 2: Especificación y Propuesta

```markdown
Role: Diseñador de Especificación SDD
TypeName: self
Prompt:
Actúa como subagente de especificación para el cambio "{NOMBRE_CAMBIO}" en OpenSpec.

Instrucciones:
1. Consulta y sigue las pautas de la skill `openspec-propose` (o `openspec-update-change` si el cambio ya existía).
2. Genera los artefactos de planificación requeridos por OpenSpec:
   - `proposal.md`: qué se va a construir y por qué.
   - `specs/<dominio>/spec.md`: delta de requerimientos y escenarios observables.
   - `design.md`: decisiones técnicas de arquitectura.
   - `tasks.md`: lista desglosada y secuencial de tareas verificables (- [ ]).
3. LÍMITE ESTRICTO: NO toques ni modifiques ningún archivo de código de la aplicación. Limítate a los artefactos de OpenSpec.
4. Devuelve el resumen de los artefactos generados y la lista de tareas para el Human Gate.
```

---

## 3. Subagente de Fase 3: Aplicación / Implementación

```markdown
Role: Implementador SDD
TypeName: self
Prompt:
Actúa como subagente implementador para el cambio "{NOMBRE_CAMBIO}" en OpenSpec. El Human Gate ha sido APROBADO por el usuario.

Instrucciones:
1. Consulta y sigue las pautas de la skill `openspec-apply-change`.
2. Lee los artefactos de contexto: `proposal.md`, `specs/`, `design.md` y `tasks.md`.
3. Implementa exclusivamente las tareas definidas en `tasks.md`, marcando cada una como `- [x]` al completarla y verificarla.
4. Respeta las convenciones del stack y no introduzcas código fuera del alcance especificado.
5. Devuelve un informe con los archivos modificados y el estado final de `tasks.md`.
```

---

## 4. Subagente de Fase 4: Verificación y Archivo

```markdown
Role: Verificador y Cierre SDD
TypeName: self
Prompt:
Actúa como subagente de verificación y archivo para el cambio "{NOMBRE_CAMBIO}".

Instrucciones:
1. Ejecuta la suite de pruebas automatizadas del proyecto (linter, tests unitarios, tests de integración) para asegurar que no hay regresiones.
2. Comprueba que todas las tareas en `tasks.md` estén marcadas como completas (- [x]).
3. Sigue las pautas de la skill `openspec-archive-change` (o `openspec-sync-specs`) para sincronizar o archivar el cambio.
4. Devuelve el resultado de las pruebas y la confirmación de archivo.
```
