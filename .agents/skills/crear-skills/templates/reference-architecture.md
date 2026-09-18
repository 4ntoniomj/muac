---
name: {{NOMBRE_SKILL}}
description: >-
  Aplica los estándares de {{DOMINIO}} del proyecto: {{TEMAS CLAVE}}. Activar cuando el
  usuario pregunte o trabaje sobre {{INTENCIONES Y VOCABULARIO REAL}}. No usar para
  ejecutar despliegues, generar andamiaje ni para {{PETICIONES VECINAS}} (usar {{SKILL_VECINA}}).
metadata:
  version: "0.1.0"
---

# {{NOMBRE_SKILL}}

## Contexto y objetivo

{{Marco normativo que cubre la skill y por qué se consulta por partes en lugar de cargarlo entero.}}

Criterio de éxito: la respuesta cita la referencia y sección exactas de las que sale cada norma.

## Tarea o flujo de trabajo

### Paso 1. Entender la consulta

Identifica el tema. Si la consulta encaja en más de uno o falta contexto (versión, entorno), pregunta: máximo 3 preguntas, con respuesta por defecto.

### Paso 2. Cargar solo la referencia necesaria

| Tema | Referencia |
| :--- | :--- |
| {{TEMA_1}} | `references/{{archivo-1}}.md` |
| {{TEMA_2}} | `references/{{archivo-2}}.md` |
| {{TEMA_3}} | `references/{{archivo-3}}.md` |

Enlaza cada archivo desde esta tabla con un enlace markdown cuando exista. Lee la sección pertinente, no el archivo completo, si tiene índice.

### Paso 3. Responder o aplicar

Aplica la norma al caso concreto. Si la norma no cubre el caso, dilo y propone registrarlo con `mejorar-skills`.

## Formato de salida

1. Norma aplicable con cita `referencia#sección`.
2. Aplicación al caso (código, tabla o decisión).
3. Huecos detectados en la normativa.

## Restricciones y reglas

- No cargues todas las referencias a la vez.
- No inventes normas: si no está en `references/`, no es norma del proyecto.
- No cambies la normativa sin acuerdo del usuario; los cambios se hacen con `mejorar-skills`.
- Mejoras pendientes de esta skill: [backlog.md](references/backlog.md).

## Ejemplos

Consultas reales resueltas con la tabla de referencias: [EXAMPLE.md](EXAMPLE.md).
