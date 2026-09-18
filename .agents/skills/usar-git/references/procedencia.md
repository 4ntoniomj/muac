# Procedencia y Registro de Decisiones

- **Nombre de la skill:** `flujo-git`
- **Versión:** 1.0.0
- **Fecha de creación:** Septiembre 2026
- **Licencia:** MIT (compatible con modificación y distribución en catálogos de agentes)
- **Fuentes de referencia:**
  - Patrón de ramificación *Feature Branch Workflow*.
  - Especificación estándar *Conventional Commits v1.0.0*.

---

## Decisiones y Adaptaciones Clave

1. **Topología estricta de dos ramas maestras:**
   - Se fija `main` como rama exclusiva para código estable / producción.
   - Se fija `dev` como rama de integración para todo el desarrollo activo.

2. **Barrera de seguridad en `main`:**
   - Se prohíbe de forma explícita cualquier merge, rebase o push hacia `main` por iniciativa autónoma de la IA. Requiere que el usuario pruebe primero en `dev` y otorgue autorización verbal.

3. **Control estricto de comandos destructivos:**
   - Comandos como `git reset --hard`, `git push --force`, `git clean -f` o `git checkout .` no pueden ejecutarse sin presentar previamente:
     - Razón técnica de necesidad.
     - Advertencia de pérdida potencial de cambios.
     - Confirmación explícita del usuario.

4. **Componente determinista:**
   - Incorporación de `scripts/check_git_status.py` para devolver estados estructurados JSON y códigos de retorno del sistema (`0`, `1`, `2`), reduciendo alucinaciones sobre el estado del árbol de trabajo.