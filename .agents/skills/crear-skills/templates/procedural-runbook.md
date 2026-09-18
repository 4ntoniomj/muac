---
name: {{NOMBRE_SKILL}}
description: >-
  {{QUE_HACE: verbos concretos y artefacto}}. Activar cuando el usuario pida
  {{INTENCIONES Y VOCABULARIO REAL, con 1 o 2 ejemplos entre comillas}}. No usar para
  {{PETICIONES VECINAS}} (usar {{SKILL_VECINA}}).
metadata:
  version: "0.1.0"
---

# {{NOMBRE_SKILL}}

## Contexto y objetivo

{{Por qué existe la tarea, qué problema evita y qué entrega. 3 a 5 líneas.}}

Criterio de éxito: {{condición comprobable, p. ej. comando con código 0 o archivo generado con campos X}}.

## Tarea o flujo de trabajo

### Paso 1. Entender la petición

Extrae del mensaje y del repositorio lo que ya se sabe. Pregunta solo lo que falte, como máximo 3 preguntas por turno y cada una con respuesta por defecto:

1. {{PREGUNTA_1}} (por defecto: {{RESPUESTA_1}})
2. {{PREGUNTA_2}} (por defecto: {{RESPUESTA_2}})
3. {{PREGUNTA_3}} (por defecto: {{RESPUESTA_3}})

Verificación: supuestos confirmados por el usuario o explícitos en el informe.

### Paso 2. Comprobar prerrequisitos

```bash
{{COMANDO_DE_COMPROBACION}}   # p. ej. command -v <herramienta> && <herramienta> --version
```

Verificación: código 0. Si falta una herramienta, detente e informa; no la sustituyas por otra sin preguntar.

### Paso 3. {{ACCION_PRINCIPAL}}

{{Instrucción imperativa. Comandos verificados con --help o documentación oficial.}}

Verificación: {{salida o archivo esperado}}.

### Paso 4. Verificar el resultado

```bash
{{COMANDO_DE_VERIFICACION}}
```

Verificación: código 0 y {{criterio}}. Si falla, busca la causa antes de volver a editar.

## Formato de salida

1. {{Qué se entrega: archivos, rutas, resumen}}.
2. Comandos de verificación ejecutados con su código de salida.
3. Supuestos y datos no verificados.

## Restricciones y reglas

- No inventes comandos, flags, paquetes ni APIs: verifícalos con `--help`, la documentación oficial o el repositorio.
- No ejecutes acciones destructivas o irreversibles sin confirmación explícita.
- Cambios mínimos: no reescribas archivos completos si basta con unas líneas.
- {{REGLA_DEL_DOMINIO}}
- Mejoras pendientes de esta skill: [backlog.md](references/backlog.md).

## Ejemplos

Entrada, ejecución intermedia y salida de un caso real: [EXAMPLE.md](EXAMPLE.md).
