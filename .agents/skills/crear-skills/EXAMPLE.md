# Ejemplo: crear-skills

Las salidas de este documento son reales (ejecutadas el 2026-09-17) y están recortadas con `…`. Las respuestas del usuario en el paso 1 son un supuesto del ejemplo.

## Caso 1. "Quiero una skill para páginas web"

### Entrada

> Quiero una skill para hacer páginas web.

### Ejecución intermedia

**Paso 1. Preguntas (un turno, 3 preguntas con respuesta por defecto)**

> 1. ¿Qué entrega la skill: diseño y código de la página, o solo revisión de una web existente? (por defecto: diseño y código)
> 2. ¿Qué tipo de páginas: landings y webs de producto, o aplicaciones web con lógica? (por defecto: landings y webs de producto)
> 3. ¿Stack fijo? (por defecto: HTML y CSS; si el repositorio ya usa un framework, ese)

Respuestas: "sí" a las tres, y que las páginas "no parezcan hechas con plantilla".

Ficha confirmada:

```markdown
Ficha: paginas-web
- Resultado: plan de diseño y código de la página
- Contexto: landings, webs de producto y portfolios; HTML y CSS o el framework del repo
- Debe activarse con: "hazme una landing", "rediseña mi portfolio", "que mi web no parezca una plantilla"
- No debe activarse con: "audita mi UI contra guías" (web-design-guidelines), "la UI de la app Tauri" (react-desktop-ui)
- Restricciones: sin dependencias nuevas sin preguntar; salida en español
- Supuestos no confirmados: ninguno
```

**Paso 2. Catálogos locales**

```text
$ python3 .agent/skills/crear-skills/scripts/find_skills.py --query "páginas web diseño frontend landing" --limit 5
catalogs_scanned: [".agent/skills", "/home/4ntoniomj/.claude/skills"]
11.0 imagegen-frontend-web      ~/.claude/skills  [desig, front, landi, page, web, websi]
 9.0 design-taste-frontend      ~/.claude/skills  [desig, front, landi]
 9.0 web-design-guidelines      ~/.claude/skills  [desig, site, web]
 8.0 design-taste-frontend-v1   ~/.claude/skills  [desig, front]
 7.0 site-architecture          ~/.claude/skills  [desig, page, site, websi]
```

Ninguna está en el catálogo del proyecto (`.agent/skills`): no hay que desviar a `mejorar-skills`. `web-design-guidelines` y `site-architecture` pasan a ser skills vecinas para los negativos.

**Paso 3. Búsqueda remota (con permiso del usuario)**

```text
$ npx skills find "frontend design"
anthropics/skills@frontend-design                 895.2K installs
leonxlnx/taste-skill@design-taste-frontend        487.9K installs
leonxlnx/taste-skill@design-taste-frontend-v1     243K installs
pbakaus/impeccable@frontend-design                54.5K installs
…
```

Se descargan `SKILL.md` y `LICENSE.txt` de las candidatas a un directorio temporal y se leen completos.

**Paso 4. Rúbrica**

| Criterio | anthropics/skills@frontend-design | Evidencia |
| :--- | :-: | :--- |
| 1. Ajuste a la ficha | 2 | Brief, plan de diseño y construcción de UI web |
| 2. Description | 1 | Dice qué hace; no dice cuándo activarse ni excluye nada |
| 3. Cuerpo | 2 | 71 líneas, secciones claras |
| 4. Scripts | 0 | Comprobaciones de calidad solo en prosa ("responsive, visible keyboard focus…") |
| 5. Ejemplos | 0 | Sin ejemplos de entrada y salida |
| 6. Evals | 0 | Sin casos de prueba |
| 7. Licencia | 2 | Apache-2.0 en LICENSE.txt |
| 8. Adopción | 2 | 895.2K instalaciones, repositorio oficial |
| **Total** | **9/16** | |

Recomendación: adaptar `frontend-design`. Tiene el mejor ajuste y licencia permisiva, y lo que le falta (description, scripts, ejemplos, evals) es justo lo que añade el paso 7. El usuario aprueba.

**Pasos 5 y 6. Diseño y borrador fuera del catálogo**

```text
$ python3 .agent/skills/crear-skills/scripts/scaffold_skill.py --name paginas-web --template procedural-runbook --root /tmp/…/borrador
{"created": true, "files": ["EXAMPLE.md", "SKILL.md", "references/backlog.md", "references/eval_cases.json", "scripts/.gitkeep", "templates/.gitkeep"], …}

$ python3 .agent/skills/crear-skills/scripts/validate_skill.py --path /tmp/…/borrador/paginas-web --strict
"valid": false
E148 references/eval_cases.json Caso pos_01: prompt vacío o con marcadores sin rellenar.
…
S060 SKILL.md Marcadores sin reemplazar: {{ACCION_PRINCIPAL}}, {{PREGUNTA_1}}, …
```

El validador bloquea el borrador hasta que se rellenan todos los marcadores.

**Paso 7. Mejoras aplicadas sobre la candidata**

1. Traducido y resumido al español; la lista de patrones genéricos pasa a `references/patrones-genericos.md`.
2. Paso 1 socrático: tipo de página y acción principal, stack, marca; cada pregunta con respuesta por defecto.
3. Regla de no inventar clases, APIs ni flags.
4. Verificación por paso y formato de salida.
5. `scripts/check_page.py`: comprueba `lang`, `viewport`, `title`, `alt`, un único `h1` y saltos de encabezado (antes era prosa).
6. `references/procedencia.md` y copia de `LICENSE.txt` (Apache-2.0 exige conservar la licencia e indicar los cambios).
7. `references/backlog.md` vacío.

**Paso 8. Evals y calibración**

Primera medición con las skills vecinas como competidoras:

```text
$ python3 .agent/skills/mejorar-skills/scripts/diff_skill_evals.py --after /tmp/…/paginas-web --catalog /tmp/…/vecinas
"after": {"tp": 4, "fp": 0, "tn": 5, "fn": 1, "accuracy": 0.9}
"misses_after": ["pos_02"]
pos_02 "Diseña la web de producto de mi app de recetas, que no parezca una plantilla."
  activated: false, score: 0.7803, best_competitor: web-design-guidelines (0.8497)
```

Corrección: añadir a "Activar cuando…" el vocabulario del caso fallado ("para que no parezca una plantilla"). Segunda medición contra la versión anterior:

```text
$ python3 .agent/skills/mejorar-skills/scripts/diff_skill_evals.py --before /tmp/…/v1/paginas-web --after /tmp/…/paginas-web --catalog /tmp/…/vecinas
"method": "lexical-proxy-v2"
"before": {"accuracy": 0.9, "recall": 0.8}
"after":  {"accuracy": 1.0, "recall": 1.0}
"fixed": ["pos_02"], "regressed": []
exit=0
```

**Paso 9. Validación**

```text
$ python3 .agent/skills/crear-skills/scripts/validate_skill.py --path /tmp/…/paginas-web --strict
{
  "skill": "paginas-web",
  "strict": true,
  "valid": true,
  "errors": [],
  "warnings": [],
  "metrics": {"description_chars": 723, "body_lines": 65, "scripts": 1, "eval_cases": {"positive": 5, "negative": 5}, …}
}
exit=0
```

### Salida

```text
Ficha: confirmada (ver arriba).

Candidatas:
| Fuente                                   | Instalaciones | Licencia   | Puntos | Decisión  |
| anthropics/skills@frontend-design         | 895.2K        | Apache-2.0 | 9/16   | Adaptar   |
| leonxlnx/taste-skill@design-taste-frontend | 487.9K        | revisar    | —      | Descartar: no se evaluó tras elegir la oficial |

Árbol:
.agent/skills/paginas-web/
├── SKILL.md
├── EXAMPLE.md
├── LICENSE.txt
├── scripts/check_page.py
├── templates/plan-diseno.md
└── references/
    ├── patrones-genericos.md
    ├── procedencia.md
    ├── backlog.md
    └── eval_cases.json

description: 723 caracteres.
Mejoras aplicadas: 7 (lista del paso 7).
Validación: valid=true, errors=[], warnings=[] (código 0).
Proxy de evals: 5/5 positivos, 5/5 negativos (lexical-proxy-v2).
No verificado: la activación con el modelo real; el proxy solo compara vocabulario.
```

## Caso 2. Petición que no corresponde a esta skill

### Entrada

> La skill react-desktop-ui sigue proponiendo npm y yo uso pnpm. Arréglala.

### Comportamiento esperado

No se activa `crear-skills`: la skill ya existe en el catálogo y el usuario la está corrigiendo. Corresponde a `mejorar-skills`, que clasifica la corrección como contradicción de una regla, hace un respaldo y cambia la regla. Si `crear-skills` se hubiera activado, el paso 2 lo detectaría (`find_skills.py --name react-desktop-ui --exact` devuelve un resultado en `.agent/skills`) y derivaría a `mejorar-skills`.
