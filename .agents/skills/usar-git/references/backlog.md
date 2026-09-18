# Backlog de Mejoras (flujo-git)

Este archivo registra las propuestas de evolución de la skill para ser procesadas mediante `mejorar-skills`.

## Tareas Pendientes

- [ ] **Etiquetado Semántico Automático:**
  - Implementar sugerencia de tags (`git tag -a vX.Y.Z`) cuando el usuario autorice la promoción de `dev` a `main`.

- [ ] **Hook de Pre-Integración:**
  - Añadir verificación determinista que compruebe que la suite de pruebas del proyecto (p. ej. `npm test`, `pytest`) haya concluido con código 0 antes de realizar merge hacia `dev`.

- [ ] **Generador de Pull Requests:**
  - Crear plantilla en `templates/pull_request.md` para redactar descripciones automáticas de PRs en GitHub/GitLab con resumen de cambios y checklist de validación.

- [ ] **Soporte para Cherry-pick de Hotfixes:**
  - Definir flujo documentado para hotfixes críticos en `main` que deban ser propagados de vuelta a `dev`.