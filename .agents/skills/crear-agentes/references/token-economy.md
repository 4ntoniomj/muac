# Economía de tokens en AGENTS.md

Un `AGENTS.md` se carga en cada sesión y en cada subagente. Cada línea se paga siempre, se use o no. Esta referencia fija los presupuestos y qué va en cada sitio.

## Índice

- [Presupuestos](#presupuestos)
- [Qué carga cada herramienta](#qué-carga-cada-herramienta)
- [Dónde va cada cosa](#dónde-va-cada-cosa)
- [Técnicas de recorte](#técnicas-de-recorte)
- [Coste de las reglas de skills](#coste-de-las-reglas-de-skills)

## Presupuestos

| Archivo | Líneas máx. | Tokens estimados máx. | Motivo |
| :--- | :-: | :-: | :--- |
| `AGENTS.md` raíz (orquestador) | 300 | 5000 | Lo leen el orquestador y, de forma indirecta, todos los subagentes |
| `<carpeta>/AGENTS.md` (subagente) | 100 | 1000 | Hereda el raíz; solo añade lo local |

Estimación: `tokens ≈ ceil(caracteres / 3.5)`. Es conservadora para español con Markdown; no es el tokenizador de ningún modelo. `validate_agents_md.py` la aplica y marca `tokens_method` en su salida.

Referencias externas (verificadas el 2026-09-17): Claude Code recomienda menos de 200 líneas por `CLAUDE.md`; Antigravity limita cada archivo de reglas a 12 000 caracteres. El presupuesto del raíz de este catálogo admite el flujo completo explicado paso a paso; el de subcarpeta sigue siendo estricto porque se multiplica por cada dominio.

## Qué carga cada herramienta

| Herramienta | Qué lee | Consecuencia |
| :--- | :--- | :--- |
| Claude Code | Solo `CLAUDE.md` (no `AGENTS.md`). Admite `@ruta` para importar otro archivo. Los `CLAUDE.md` de subcarpetas se cargan cuando trabaja con archivos de esa carpeta | Crear `CLAUDE.md` con la línea `@AGENTS.md` en la raíz y, si se quiere carga automática, en cada subcarpeta. Alternativa: enlace simbólico `CLAUDE.md -> AGENTS.md` |
| Antigravity | `AGENTS.md` o `GEMINI.md` en la raíz del workspace; reglas en `.agents/rules/` (acepta `.agent/rules/` por compatibilidad); `@ruta` dentro de `AGENTS.md` desde la versión 2.11.0 | La carga de `AGENTS.md` anidados no está confirmada en la documentación oficial |
| Estándar agents.md | `AGENTS.md` anidados: gana el más cercano al archivo editado | Depende de la implementación de cada herramienta |

Por eso el orquestador no confía en la carga automática: al delegar, el prompt del subagente empieza con "Lee `<carpeta>/AGENTS.md`".

## Dónde va cada cosa

| Contenido | Lugar |
| :--- | :--- |
| Reglas que aplican a todo el repositorio | `AGENTS.md` raíz |
| Ámbito, skills, comandos y reglas de una carpeta | `<carpeta>/AGENTS.md` |
| Procedimientos largos, guías de un stack, checklists | Skill en `.agent/skills/` (se carga solo cuando se usa) |
| Contratos, criterios de aceptación de una funcionalidad | `specs/<id>.md` |
| Descripción del producto para humanos | `README.md` (no se duplica en AGENTS.md) |

Criterio detallado: [rules-vs-skills-matrix.md](rules-vs-skills-matrix.md).

## Técnicas de recorte

1. **No repetir el raíz** en subcarpetas: basta con "Hereda ../AGENTS.md". `validate_agents_md.py` avisa con `B017` a partir de 3 líneas copiadas.
2. **Tabla para el mapa** de carpetas en lugar de párrafos por carpeta.
3. **Enlazar en vez de copiar**: specs, skills y README se nombran, no se pegan.
4. **Sin diagramas Mermaid** ni títulos numerados largos: no aportan instrucciones (`L008`). Los emojis de encabezado y los separadores `---` están permitidos.
5. **Una regla, una línea**, en imperativo. Sin justificar cada regla salvo que el motivo cambie la forma de aplicarla.
6. **Comandos exactos** y nada más: `pnpm run test`, no "ejecuta la batería de pruebas con el gestor de paquetes".
7. **Fuera lo que el modelo ya hace bien** sin instrucción (formatear Markdown, usar nombres descriptivos).

## Coste de las reglas de skills

- Lista de skills de una subcarpeta: 1 línea o fila de tabla por skill, con cuándo usarla. La skill se carga solo al usarse.
- `mejorar-skills` en todas las listas: 1 línea. La comprobación de cierre ("¿hubo correcciones sin aplicar?") no consume tokens si no hubo correcciones.
- El protocolo de `crear-skills` y `mejorar-skills` vive en el raíz (sección Skills, 3 líneas), no en cada subcarpeta.
