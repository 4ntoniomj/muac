# Catálogo de patologías de skills y su corrección

Cada patología indica cómo detectarla (script o lectura), el cambio y cómo comprobar que no hubo regresión.

## Índice

- [Enrutamiento](#enrutamiento)
- [Estructura y contexto](#estructura-y-contexto)
- [Lógica y scripts](#lógica-y-scripts)
- [Dependencias y comandos](#dependencias-y-comandos)
- [Evals](#evals)
- [Redacción](#redacción)

## Enrutamiento

| Patología | Detección | Corrección | Comprobación |
| :--- | :--- | :--- | :--- |
| Falso positivo: se activa en peticiones vecinas | Caso negativo con `activated: true` en `diff_skill_evals.py`; queja del usuario | Añadir la petición vecina a "No usar para…" nombrando la skill que le corresponde; quitar palabras genéricas de la parte positiva | Nuevo caso negativo con esa petición; `regressed` vacío |
| Falso negativo: no se activa cuando debe | Caso positivo con `activated: false`; el usuario tuvo que pedir la skill por su nombre | Añadir a "Activar cuando…" el vocabulario literal del usuario, sinónimos y archivos o herramientas típicos | Nuevo caso positivo; `fixed` incluye el caso |
| Red de arrastre ("ayuda con frontend") | Description sin verbo concreto ni exclusiones | Reescribir en tres partes (ver `crear-skills/references/semantic-routing.md`) | Proxy sin regresiones en positivos |
| Colisión con otra skill del catálogo | `best_competitor` gana en casos propios o ajenos | Delimitar ambas descriptions por resultado; si se solapan en propósito, fusionar | Evals de ambas skills sin regresiones |
| Description de más de 1024 caracteres | `validate_skill.py` E031 | Quitar enumeraciones y detalles de proceso; dejar qué, cuándo y exclusiones | E031 desaparece; proxy sin regresiones |

## Estructura y contexto

| Patología | Detección | Corrección | Comprobación |
| :--- | :--- | :--- | :--- |
| Monolito: `SKILL.md` con teoría, tablas y tutoriales | Más de 200 líneas; secciones que no son instrucciones | Flujo en `SKILL.md`; teoría y tablas a `references/` con enlace de un nivel | `body_lines` baja; W108 sin avisos |
| Skill con varios propósitos | Pasos que no se usan juntos; description con varios "y además" | Dividir en dos skills (la nueva con `crear-skills`) | Evals de ambas |
| Referencias huérfanas | W108 | Enlazar desde el paso que las usa o borrarlas (con respaldo) | W108 desaparece |
| Referencia larga sin índice | W109 | Índice al principio | W109 desaparece |
| Respaldos dentro de la skill | W107 | Mover a `.agent/backups/` con `backup_skill.py` | W107 desaparece |
| Reglas globales repetidas (tono, seguridad genérica) | Lectura: coinciden con el AGENTS.md raíz | Borrarlas de la skill | Ninguna regla del dominio perdida |

## Lógica y scripts

| Patología | Detección | Corrección | Comprobación |
| :--- | :--- | :--- | :--- |
| Lógica mecánica en prosa ("cuenta", "compara", "comprueba que todos…") | Lectura: pasos que un programa resuelve con certeza | Script en `scripts/` (Python 3 de la biblioteca estándar, JSON, códigos 0/1/2); el paso pasa a ser la invocación | `validate_skill.py` E130–E134 sin errores; ejecución real del script |
| Script sin documentar | Script no citado en `SKILL.md` | Interfaz (argumentos, salida, códigos) en el paso que lo usa | Lectura |
| Dependencia de terceros en un script | E134 | Reescribir con la biblioteca estándar o documentar la dependencia como requisito y preguntar | E134 desaparece |
| Rutas absolutas fijas | `grep -rn "/home/\|C:\\\\"` | Rutas relativas al script o por argumento | Ejecución desde otro directorio |

## Dependencias y comandos

| Patología | Detección | Corrección | Comprobación |
| :--- | :--- | :--- | :--- |
| Binario no instalado citado como obligatorio | `check_commands.py` `missing` | Preguntar: instalar, sustituir o marcar como opcional | `missing` vacío o justificado |
| Flag o subcomando inexistente | `<bin> --help` no lo muestra | Corregir con el `--help` real | Salida de `--help` citada en el informe |
| Paquete deprecado | `npm view <paquete> deprecated`, documentación oficial | Sustituir por la alternativa oficial | Comando ejecutado con código 0 |
| Versión fijada obsoleta | Manifiesto del proyecto con versión mayor distinta | Alinear con el manifiesto; si cambia la API, actualizar ejemplos | Ejemplos coherentes con el manifiesto |

## Evals

| Patología | Detección | Corrección |
| :--- | :--- | :--- |
| Negativos triviales ("¿qué hora es?") | Lectura | Sustituir por peticiones de skills vecinas |
| Positivos con el nombre de la skill | Lectura | Redactarlos como los escribiría un usuario que no conoce la skill |
| Corrección del usuario sin caso que la reproduzca | Paso 6 | Añadir el caso; puede haber más de 10 |
| Marcadores sin rellenar | E148 | Rellenar |

## Redacción

| Patología | Detección | Corrección |
| :--- | :--- | :--- |
| Adjetivos inflados | W061 | Eliminar o sustituir por el dato concreto |
| Mayúsculas imperativas ("DEBE", "CRÍTICO") | Lectura | Tono normal; concretar la regla |
| Instrucciones vagas ("asegura la calidad") | Lectura | Criterio comprobable ("`pnpm run lint` en código 0") |
