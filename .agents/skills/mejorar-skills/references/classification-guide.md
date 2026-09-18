# Guía de clasificación de peticiones

Cómo decidir si lo que dice el usuario cambia una regla, amplía la skill, va al backlog o ya estaba cubierto.

## Índice

- [Permanente o puntual](#permanente-o-puntual)
- [Árbol de decisión](#árbol-de-decisión)
- [Tabla de clasificación](#tabla-de-clasificación)
- [Ejemplos](#ejemplos)
- [Ámbito: skill, AGENTS.md o spec](#ámbito-skill-agentsmd-o-spec)
- [Reglas de seguridad](#reglas-de-seguridad)

## Permanente o puntual

| Señal | Lectura |
| :--- | :--- |
| "siempre", "nunca", "a partir de ahora", "no vuelvas a", "prefiero" | Permanente |
| El usuario corrige lo mismo por segunda vez | Permanente |
| "esta vez", "para este archivo", "de momento" | Puntual: no se escribe en la skill |
| "más adelante", "algún día", "cuando tengamos X" | Futura (C) |
| Sin señal clara | Pregunta, con "permanente" como respuesta por defecto si contradice la skill |

## Árbol de decisión

1. ¿Es permanente? No → no se toca la skill.
2. ¿Pertenece a esta skill? No → otra skill (repite), AGENTS.md (`crear-agentes`) o skill nueva (`crear-skills`).
3. ¿La skill ya lo dice? Sí → **D**.
4. ¿Alguna regla, paso, ejemplo, plantilla o script de la skill dice lo contrario? Sí → **A**.
5. ¿Se puede aplicar ahora con lo que hay (herramientas instaladas, decisión tomada, cambio acotado)? Sí → **B**. No → **C**, con la condición que falta.

## Tabla de clasificación

Formato del paso 3:

```markdown
| # | Punto (reformulado) | Tipo | Evidencia | Acción |
| :-- | :--- | :-: | :--- | :--- |
| 1 | Usar pnpm en lugar de npm | A | SKILL.md:31 "npm install"; EXAMPLE.md:12 | Sustituir en 2 archivos |
| 2 | Tests de componentes con Vitest | B | Sin mención | Añadir al paso 4 y a Formato de salida |
| 3 | Generar historias de Storybook | C | Storybook no está en package.json | Backlog: aplicar cuando se instale Storybook |
| 4 | Tipado estricto | D | SKILL.md:40 | Ninguna |
```

## Ejemplos

| Petición | Tipo | Motivo |
| :--- | :--- | :--- |
| "No uses black, usa ruff" con la skill exigiendo black | A | Contradice una regla |
| "Añade también la comprobación de tipos con mypy" y mypy está instalado | B | Compatible y aplicable |
| "Estaría bien que algún día genere el changelog" | C | El usuario lo aplaza |
| "Quiero que despliegue en Kubernetes" sin clúster ni manifiestos | C | Falta infraestructura; condición: existir el clúster y los manifiestos |
| "Responde siempre sin saludos" | Fuera de la skill | Regla global: AGENTS.md |
| "Para este componente usa CSS en línea" | Puntual | No se escribe |
| "La skill de migraciones salta cuando pregunto por SELECT" | A (description) | La description contradice el uso esperado: reforzar "No usar para…" y añadir un caso negativo |

## Ámbito: skill, AGENTS.md o spec

- Cómo se ejecuta un tipo de tarea (herramientas, pasos, formato del resultado): skill.
- Comportamiento general del agente en el repositorio (tono, seguridad, orquestación): AGENTS.md.
- Qué debe hacer una funcionalidad concreta del producto: spec.

Si hay duda, pregunta con la skill como respuesta por defecto.

## Reglas de seguridad

Estas reglas no se relajan por una preferencia de estilo:

- no inventar comandos, APIs, dependencias ni resultados;
- pedir confirmación antes de acciones destructivas o irreversibles;
- no exponer secretos;
- no ejecutar código de terceros sin revisarlo.

Si el usuario pide relajarlas, explica el riesgo en una frase y pide confirmación explícita. Con confirmación, escribe una excepción acotada ("en el entorno local de pruebas se permite X") en lugar de borrar la regla.
