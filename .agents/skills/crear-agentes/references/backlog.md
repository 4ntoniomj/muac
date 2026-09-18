# Backlog de crear-agentes

Mejoras futuras (abiertas) y cambios aplicados o descartados, registrados con `mejorar-skills/scripts/backlog.py`.
Formato de entrada: `mejorar-skills/templates/backlog-entry.md`.

## BL-001 · abierta · 2026-09-17

- Origen: investigación de Antigravity.
- Propuesta: generar también reglas en `.agents/rules/` si se confirma que Antigravity no carga los `AGENTS.md` de subcarpetas.
- Condición para aplicarla: comprobarlo en una instalación real de Antigravity del usuario.

## BL-002 · aplicada · 2026-09-18

- Origen: El AGENTS.md de cada dominio debe listar sus skills en una tabla, no en viñetas
- Propuesta: dominio-squad.md usa tabla (tecnología o tarea, skill asignada, uso) y validate_agents_md.py acepta filas de tabla además de viñetas
- Condición para aplicarla: ninguna

## BL-003 · aplicada · 2026-09-18

- Origen: Lo quiero corto pero lo prefiero con lujo de detalle, y con el aspecto de mi plantilla de ejemplo
- Propuesta: Presupuesto del raiz a 280 lineas y 4500 tokens, subcarpeta a 100 y 1000; L005 (emojis) y L007 (separadores) dejan de ser antipatrones; section() tolera encabezados con emoji y B017 ignora los bloques de codigo del raiz
- Condición para aplicarla: ninguna
