# Procedencia

Skill creada el 2026-09-18 para el proyecto lodane, con el proceso completo de `crear-skills`,
incluida la búsqueda de candidatas publicadas que en las skills técnicas se había omitido.

## Candidatas evaluadas

Búsqueda: `npx skills find "memory mcp server usage"`, el 2026-09-18.

| Candidata | Instalaciones | Licencia | Decisión |
| :--- | :--- | :--- | :--- |
| `reason-machines/mcp-skills@iai-mcp-memory-server` | 209 | MIT | Descartada como base |
| `obra/superpowers-lab@mcp-cli` | 453 | No leída | Descartada: es un cliente de MCP genérico, no el uso de un servidor de memoria |
| `d-o-hub/rust-self-learning-memory@memory-mcp` | 32 | No leída | Descartada por cobertura y volumen frente a la anterior |

La primera se descargó y se leyó completa (616 líneas). Es una skill sólida, pero está escrita
entera para otro producto: `iai-mcp`, en Python, con LanceDB, `sentence-transformers` y sus
propios comandos de instalación y de demonio. Nada de su contenido aplica a lodane, así que
adaptarla habría significado reescribirla al completo. No se ha copiado texto suyo.

## Qué se tomó de ella

Dos ideas de estructura, no de contenido:

1. Un paso inicial de comprobación con la salida que se espera ver, antes de fiarse del sistema.
2. Una sección de problemas frecuentes con síntoma, causa probable y qué hacer.

## Fuentes propias

- Los nombres y campos de las diez herramientas salen del contrato del propio servidor,
  `internal/mcp/testdata/tool-contract.json`, generado del código y comprobado por un test.
- El comportamiento descrito (invalidación en vez de borrado, capas del grafo, divulgación
  progresiva) sale de `specs/00-especificacion.md` y `specs/03-contrato-mcp.md`.

Licencia: MIT, igual que el proyecto.
