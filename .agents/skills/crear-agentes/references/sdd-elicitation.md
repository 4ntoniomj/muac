# Elicitación SDD para generar AGENTS.md

Spec-Driven Development aplicado a la configuración de agentes: primero se acuerda qué es el proyecto (especificación), luego cómo se reparte (arquitectura), después quién hace qué (tareas) y por último cómo se comprueba (verificación). Cada fase termina con una confirmación del usuario. Máximo 3 preguntas por turno, cada una con respuesta por defecto sacada de `inspect_repo.py`.

## Índice

- [Fase 1. Especificación](#fase-1-especificación)
- [Fase 2. Arquitectura](#fase-2-arquitectura)
- [Fase 3. Tareas](#fase-3-tareas)
- [Fase 4. Verificación](#fase-4-verificación)
- [Proyecto nuevo (sin código)](#proyecto-nuevo-sin-código)

## Fase 1. Especificación

Objetivo: propósito, usuarios y límites del proyecto en 2 o 3 frases.

| Pregunta | Respuesta por defecto |
| :--- | :--- |
| ¿Qué hace el proyecto y para quién? | Lo que diga el README o el `name`/`description` de los manifiestos |
| ¿Qué está fuera de alcance para los agentes? | Despliegue a producción y datos reales |
| ¿Hay reglas de seguridad propias del dominio (secretos, datos personales, sesiones)? | Las genéricas del raíz |

Salida: frase de propósito, stack con versiones de los manifiestos y reglas de seguridad propias.

## Fase 2. Arquitectura

Objetivo: qué carpetas tienen subagente propio.

| Pregunta | Respuesta por defecto |
| :--- | :--- |
| ¿Confirmas estas carpetas como ámbitos de subagente? | Candidatas de `inspect_repo.py` con plantilla sugerida |
| ¿Alguna carpeta comparte subagente con otra? | No |
| ¿Existen AGENTS.md o CLAUDE.md que haya que conservar? | Se fusionan: se conserva lo específico y se eliminan duplicados, con respaldo previo |

Criterio para dar subagente a una carpeta: tiene manifiesto propio o stack distinto, o al menos un flujo de verificación propio. Carpetas solo de documentación o specs no llevan subagente.

Salida: tabla carpeta → rol → plantilla.

## Fase 3. Tareas

Objetivo: skills de cada subagente.

| Pregunta | Respuesta por defecto |
| :--- | :--- |
| Para `<carpeta>/`, ¿estas skills? | Resultado de `find_skills.py --query "<stack>"` en el catálogo del proyecto, más `mejorar-skills` |
| Falta skill para `<tecnología>`: ¿la creo con `crear-skills`? | Sí, una cada vez |
| ¿Hay reglas locales que no quepan en la skill? | Ninguna |

Salida: lista de skills por carpeta, con las que hay que crear marcadas.

## Fase 4. Verificación

Objetivo: comandos de verificación reales por carpeta.

- Toma los comandos con `"source"` de manifiesto (`package.json`, `Makefile`, `pyproject.toml`) de `inspect_repo.py`.
- Los de tipo `"convention"` (p. ej. `cargo test`) se comprueban antes: el binario existe (`command -v`) y el subcomando o flag aparece en `--help`.
- Si un comando no existe en la máquina (p. ej. un subcomando de cargo no instalado), no se escribe como obligatorio: se pregunta si instalarlo o se sustituye.

| Pregunta | Respuesta por defecto |
| :--- | :--- |
| ¿Estos comandos de verificación para `<carpeta>/`? | Los verificados |
| ¿Puedo ejecutarlos ahora para confirmar que pasan? | Sí, si no modifican nada |

Salida: comandos por carpeta con su origen y resultado de la comprobación.

## Proyecto nuevo (sin código)

`inspect_repo.py` devuelve `"greenfield": true`. Entonces:

1. Fase 1 igual.
2. Fase 2: propone 2 o 3 carpetas por capacidad del producto o por stack (p. ej. `web/`, `api/`, `specs/`) y pide confirmación antes de crearlas.
3. Fase 3 igual.
4. Fase 4: los comandos quedan como pendientes hasta que exista el manifiesto; el AGENTS.md lo indica y no inventa comandos.
5. El `AGENTS.md` raíz se crea antes que el código.
