---
name: {{NOMBRE_SKILL}}
description: >-
  {{QUE_HACE}} mediante el script determinista {{NOMBRE_SCRIPT}}. Activar cuando el
  usuario pida {{INTENCIONES Y VOCABULARIO REAL}}. No usar para {{PETICIONES VECINAS}}
  (usar {{SKILL_VECINA}}) ni para análisis cualitativos que no necesitan el script.
metadata:
  version: "0.1.0"
---

# {{NOMBRE_SKILL}}

## Contexto y objetivo

{{Qué calcula o transforma el script y por qué no debe hacerlo el modelo: exactitud, coste en tokens, repetibilidad.}}

Criterio de éxito: el script devuelve código 0 y su JSON se presenta sin reinterpretar los valores.

## Tarea o flujo de trabajo

### Paso 1. Entender la petición

Confirma la entrada (archivo, directorio o parámetros) y el uso del resultado. Máximo 3 preguntas por turno, cada una con respuesta por defecto.

### Paso 2. Ejecutar el script

```bash
python3 .agent/skills/{{NOMBRE_SKILL}}/scripts/{{NOMBRE_SCRIPT}} --input "<ruta>"
```

| Argumento | Obligatorio | Descripción |
| :--- | :--- | :--- |
| `--input <ruta>` | Sí | {{descripción}} |
| `--strict` | No | {{descripción}} |

Códigos de salida: `0` sin hallazgos, `1` con hallazgos (leer `errors` del JSON), `2` error de uso o de lectura.

### Paso 3. Interpretar y actuar

- Código 0: presenta el resumen.
- Código 1: agrupa los hallazgos por severidad y propone la corrección de cada uno.
- Código 2: muestra `stderr` literal y revisa argumentos o rutas; no modifiques el script para forzar el paso.

## Formato de salida

1. Comando ejecutado y código de salida.
2. Resumen del JSON (conteos y hallazgos principales) con rutas y líneas.
3. Acciones propuestas o aplicadas.

## Restricciones y reglas

- No repliques en prosa la lógica del script: ejecútalo.
- No edites el script para ocultar un fallo; aísla la causa y, si el fallo es del script, regístralo con `mejorar-skills`.
- Entrecomilla rutas y argumentos.
- No inventes flags: los disponibles son los de `--help`.
- Mejoras pendientes de esta skill: [backlog.md](references/backlog.md).

## Ejemplos

Invocaciones reales con su salida: [EXAMPLE.md](EXAMPLE.md).
