# Enrutamiento semántico: cómo redactar la description

El agente decide si carga una skill leyendo solo `name` y `description` (nivel 1). El cuerpo de `SKILL.md` (nivel 2) y los archivos de `references/`, `scripts/` y `templates/` (nivel 3) se leen después, solo si la skill se activa. Una description imprecisa produce dos fallos:

- **Falso negativo**: la petición correspondía a la skill y el agente no la cargó. Es el fallo más frecuente; la guía de `skill-creator` de Anthropic recomienda descriptions algo insistentes por este motivo.
- **Falso positivo**: la skill se carga en peticiones vecinas, gasta contexto y sesga la respuesta.

## Índice

- [Límites de la especificación](#límites-de-la-especificación)
- [Estructura en tres partes](#estructura-en-tres-partes)
- [Reglas de redacción](#reglas-de-redacción)
- [Antipatrones](#antipatrones)
- [Calibración con evals](#calibración-con-evals)

## Límites de la especificación

Verificados en agentskills.io/specification y en la guía de buenas prácticas de Anthropic (2026-09-17):

| Campo | Regla |
| :--- | :--- |
| `name` | 1 a 64 caracteres; `a-z`, `0-9` y `-`; sin guion inicial, final ni doble; igual que la carpeta; sin las palabras "anthropic" ni "claude" |
| `description` | 1 a 1024 caracteres; qué hace y cuándo usarla; tercera persona; sin etiquetas XML |
| Opcionales | `license`, `compatibility` (≤ 500 caracteres), `metadata` (mapa de texto), `allowed-tools` (experimental) |
| Cuerpo | Menos de 500 líneas y unos 5000 tokens; referencias a un nivel de profundidad |

Claude Code admite campos propios (`when_to_use`, `disable-model-invocation`, `paths`…), pero no son portables: este catálogo usa solo los de la especificación y guarda lo demás en `metadata`.

## Estructura en tres partes

```text
<Qué hace: verbos y artefacto>. Activar cuando <intenciones y vocabulario del usuario>.
No usar para <peticiones vecinas> (usar <skill-vecina>).
```

1. **Qué hace**: verbos concretos y el artefacto que manipula. "Genera y valida migraciones de esquema PostgreSQL con Prisma", no "ayuda con bases de datos".
2. **Activar cuando**: cómo lo pide un usuario real, con sinónimos y en los idiomas en que se va a pedir. Incluye 1 o 2 ejemplos literales entre comillas.
3. **No usar para**: las peticiones que se parecen pero pertenecen a otra skill, nombrando esa skill. Así el agente sabe a dónde derivar.

Longitud orientativa: 400 a 900 caracteres. Por debajo de 100 suele faltar vocabulario; cerca de 1024 suele sobrar enumeración.

## Reglas de redacción

- Tercera persona: "Crea…", "Audita…". Nunca "Te ayudo a…".
- Vocabulario del usuario antes que jerga interna: "página web", "landing", "web" antes que "capa de presentación".
- Nombres de archivo, extensiones y herramientas que aparecen en las peticiones (`AGENTS.md`, `.sql`, `Prisma`) ayudan al enrutado.
- Una skill, un propósito. Si la description necesita tres "y además", son dos skills.
- Nada de adjetivos ("potente", "definitivo", "premium"): no aportan señal de enrutado.

## Antipatrones

| Antipatrón | Ejemplo | Fallo | Corrección |
| :--- | :--- | :--- | :--- |
| Red de arrastre | "Ayuda con frontend y webs." | Falsos positivos en cualquier tarea web | Acotar el resultado y añadir "No usar para…" |
| Nombre técnico que nadie usa | "Implementa el RFC 7636." | Falsos negativos: nadie pide "RFC 7636" | Añadir "OAuth con PKCE, login con Google, flujo de autorización" |
| Monolito | "Despliega, testea, documenta y lintea." | Compite con cuatro skills | Dividir en skills o acotar a un flujo |
| Solo qué, sin cuándo | "Guía de diseño visual distintivo." | El agente no sabe en qué peticiones cargarla | Añadir "Activar cuando…" con ejemplos |
| Exclusiones sin destino | "No usar para otras cosas." | No evita confusiones concretas | Nombrar la petición vecina y su skill |

## Calibración con evals

1. Escribe 5 casos positivos con vocabulario variado y 5 negativos **cercanos**: peticiones reales que deberían ir a una skill vecina. Un negativo como "¿qué hora es?" no prueba nada.
2. Mide con el proxy léxico:
   ```bash
   python3 .agent/skills/mejorar-skills/scripts/diff_skill_evals.py --after .agent/skills/<skill> --catalog .agent/skills
   ```
3. Positivo fallado: añade a "Activar cuando…" las palabras de ese caso que falten.
4. Negativo activado: nombra esa petición en "No usar para…" o refuerza la description de la skill vecina.
5. Repite hasta que no empeore ningún caso. El proxy solo compara palabras: una mejora en el proxy no garantiza la mejora con el modelo real. Si hay un modelo disponible por línea de comandos, usa `--judge-cmd` (ver `mejorar-skills`).
