# Lista de control de calidad

Cada punto indica si lo comprueba `validate_skill.py` (código) o si requiere revisión manual.

## Diseño

- [ ] Ficha confirmada por el usuario (manual).
- [ ] La skill tiene un único propósito y no duplica otra del catálogo (`find_skills.py`, `E016`).
- [ ] `description` en tres partes: qué hace, "Activar cuando…", "No usar para…" (`W033`, `W034`).
- [ ] Los negativos nombran la skill vecina a la que corresponden (manual).
- [ ] Reparto decidido: flujo en `SKILL.md`, lógica mecánica en `scripts/`, detalle en `references/` (manual).

## Frontmatter

- [ ] `name` kebab-case, ≤ 64 caracteres, igual que la carpeta (`E021`, `E022`); sin "anthropic" ni "claude" (`W023`).
- [ ] `description` ≤ 1024 caracteres (`E031`), ≥ 80 (`W032`), tercera persona (`W035`), sin etiquetas XML (`W036`).
- [ ] Solo claves de la especificación: `name`, `description`, `license`, `compatibility`, `metadata`, `allowed-tools` (`W012`).

## SKILL.md

- [ ] Secciones: Contexto y objetivo, Tarea o flujo de trabajo, Formato de salida, Restricciones y reglas, Ejemplos (`W050`).
- [ ] Cuerpo por debajo de 500 líneas (`E040`); objetivo recomendado: menos de 200 (manual).
- [ ] Primer paso socrático con máximo 3 preguntas y respuesta por defecto (manual).
- [ ] Cada paso tiene criterio de verificación (manual).
- [ ] Regla de no inventar comandos, flags ni APIs (manual).
- [ ] Sin marcadores `{{...}}` (`W060`) ni adjetivos inflados (`W061`).
- [ ] Enlace markdown a `EXAMPLE.md` (`W071`) y a cada archivo de `references/` (`W108`).

## Archivos

- [ ] Existen `EXAMPLE.md` (`E070`), `scripts/`, `templates/`, `references/` (`W080`).
- [ ] Enlaces relativos sin romper y dentro de la skill (`E120`, `E121`).
- [ ] Sin respaldos dentro de la skill (`W107`); van a `.agent/backups/`.
- [ ] Referencias de más de 100 líneas con índice (`W109`).
- [ ] `references/backlog.md` con entradas bien formadas (`W111`).
- [ ] `references/procedencia.md` si la skill deriva de una fuente externa (manual).

## Scripts

- [ ] Shebang (`E130`) con `python3` (`W132`) y permiso de ejecución (`E131`).
- [ ] Sin errores de sintaxis (`E133`) ni dependencias fuera de la biblioteca estándar (`E134`).
- [ ] Aceptan `--help`, devuelven JSON y códigos 0/1/2 (manual).
- [ ] No usan rutas absolutas fijas: resuelven rutas relativas al script o por argumento (manual).
- [ ] No borran ni sobrescriben sin respaldo o confirmación (manual).

## Evals

- [ ] `references/eval_cases.json` válido, con `skill` igual a la carpeta (`E141`–`E143`).
- [ ] Campos `id`, `type`, `prompt`, `expected_activation`, `rationale` coherentes y sin duplicados (`E144`–`E147`).
- [ ] Sin `TODO` ni marcadores en los prompts (`E148`).
- [ ] Al menos 5 positivos y 5 negativos (`W149`).
- [ ] Proxy de enrutamiento ejecutado y revisado (manual, `diff_skill_evals.py`).

## Cierre

- [ ] `validate_skill.py --path <skill> --strict` con código 0.
- [ ] `validate_skill.py --catalog .agent/skills` con código 0 (sin nombres duplicados).
