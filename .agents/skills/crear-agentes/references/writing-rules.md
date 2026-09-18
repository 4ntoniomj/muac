# Reglas de redacción para AGENTS.md

Un archivo de reglas es un texto para un modelo, no un folleto. Cada código corresponde a una comprobación de `validate_agents_md.py`. Las citas entre comillas y el código entre comillas invertidas no se comprueban, para poder poner ejemplos de lo prohibido.

## Índice

- [Antipatrones detectados](#antipatrones-detectados)
- [Reglas no automatizadas](#reglas-no-automatizadas)
- [Plantilla de una regla](#plantilla-de-una-regla)

## Antipatrones detectados

| Código | Antipatrón | Ejemplo | Reescritura |
| :--- | :--- | :--- | :--- |
| L001 | Adjetivos inflados | "Política inquebrantable de certificación exhaustiva" | "Una fase no termina sin `pnpm run test` en código 0" |
| L002 | Contraste forzado | "No se trata de escribir código, sino de escribir buen código" | Eliminar; decir la regla concreta |
| L003 | Viñetas con etiqueta en negrita en más de la mitad | "**Tono**: sobrio" en cada línea | Frase directa: "Escribe en español técnico sobrio" |
| L004 | Imperativos en mayúsculas | "DEBE", "PROHIBIDO", "NUNCA" | Minúsculas; la prioridad se expresa con el orden y la concreción |
| L006 | Relleno y cortesía | "Nada contradice estas normas", "Es importante destacar que" | Eliminar |
| L008 | Diagramas Mermaid | Flujo de fases dibujado | Lista numerada de 3 a 5 líneas o enlace a la spec |

Sobre L004: los modelos actuales siguen bien las instrucciones en tono normal. Las mayúsculas y los "CRÍTICO" hacen que se apliquen reglas en exceso y en contextos donde no tocaban.

Los emojis en encabezados y los separadores `---` entre secciones no se penalizan: son decoración barata que ayuda a localizar la sección. Lo que sí se penaliza es la decoración que sustituye a una instrucción.

## Reglas no automatizadas

- **Imperativo y concreto**: "Ejecuta `cargo test` antes de entregar", no "Se recomienda verificar la calidad del código".
- **Una idea por línea.** Si una viñeta necesita "y además", son dos viñetas o sobra una.
- **Verificable**: cada regla debe poder comprobarse al leer el resultado. "Código limpio" no lo es; "sin `any` implícito" sí.
- **Sin duplicar al modelo**: no escribas lo que ya hace por defecto (formatear Markdown, ser educado).
- **Sin historia**: nada de "este archivo constituye la única fuente de verdad de la gobernanza". El archivo existe; con eso basta.
- **Español técnico**: términos de herramientas en su idioma original (`lint`, `typecheck`, `commit`).
- **Rutas relativas** y nombres exactos de archivos, scripts y skills.

## Plantilla de una regla

```text
<verbo en imperativo> <objeto concreto> [<condición>] [<comando o ruta que lo comprueba>].
```

Ejemplos:

- "Edita solo `src-tauri/**`; si la tarea exige tocar otra carpeta, detente y repórtalo al orquestador."
- "Pide confirmación antes de ejecutar migraciones sobre la base de datos compartida."
- "Entrega solo con `pnpm run typecheck`, `pnpm run lint` y `pnpm run test` en código 0."
