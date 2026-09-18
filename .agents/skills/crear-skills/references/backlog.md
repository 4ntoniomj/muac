# Backlog de crear-skills

Mejoras futuras (abiertas) y cambios aplicados o descartados, registrados con `mejorar-skills/scripts/backlog.py`.
Formato de entrada: `mejorar-skills/templates/backlog-entry.md`.

## BL-001 · abierta · 2026-09-17

- Origen: diseño v2 de las meta-skills.
- Propuesta: sustituir el proxy léxico del paso 8 por una evaluación con el modelo real (disparar cada caso 3 veces y medir tasa de activación, como hace `run_loop.py` de anthropics/skills).
- Condición para aplicarla: disponer de un comando de modelo no interactivo aprobado por el usuario para usar con `--judge-cmd`.

## BL-002 · abierta · 2026-09-17

- Origen: investigación de rutas de Antigravity.
- Propuesta: migrar el catálogo de `.agent/skills/` a `.agents/skills/`, que es la ruta que documenta hoy Antigravity, dejando un enlace simbólico en la ruta antigua.
- Condición para aplicarla: confirmación del usuario y comprobar en su instalación qué ruta carga.
