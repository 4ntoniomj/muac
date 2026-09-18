# Las diez herramientas de lodane

## Índice

- [Lectura](#lectura)
- [Escritura](#escritura)
- [Reglas comunes](#reglas-comunes)

Los nombres y campos de esta página salen del contrato congelado en
`internal/mcp/testdata/tool-contract.json`, que un test compara con lo que expone el servidor. Si
aquí dice algo distinto de lo que ves, gana el servidor y hay que corregir esta página.

## Lectura

### lodane_context

Primera llamada de cada sesión.

| Campo | Tipo | Qué es |
| :--- | :--- | :--- |
| `tema` | texto, opcional | Tema del que se va a hablar; vacío devuelve el contexto general |
| `token_budget` | entero, opcional | Presupuesto de tokens de la respuesta |

Devuelve `preferencias`, `decisiones`, `sesion_previa`, `sin_vectores`, `truncado` y
`tokens_estimados`.

### lodane_search

| Campo | Tipo | Qué es |
| :--- | :--- | :--- |
| `consulta` | texto, obligatorio | Lo que se busca, en lenguaje natural |
| `limite` | entero, opcional | Máximo de resultados; por defecto 50, tope 500 |
| `tipos` | lista de texto, opcional | Filtra por tipo de memoria |
| `incluir_deducido` | booleano, opcional | Admite resultados de la capa deducida |
| `token_budget` | entero, opcional | Presupuesto de tokens |

Devuelve `total`, `coincidencias` (con `id`, `titulo`, `extracto`, `tipo`, `capa`, `puntuacion`),
`sin_vectores`, `motivo_sin_vectores`, `sin_texto` y `truncado`.

`sin_vectores` en verdadero significa que la búsqueda fue solo por texto.

### lodane_get

| Campo | Tipo | Qué es |
| :--- | :--- | :--- |
| `id` | entero, obligatorio | Identificador que devolvió una búsqueda |

Devuelve la memoria completa: `contenido`, `revision`, `vigente`, `valido_desde`, `valido_hasta`,
`modelo`, `dimension` y `enlaces`.

### lodane_graph

| Campo | Tipo | Qué es |
| :--- | :--- | :--- |
| `modo` | texto, obligatorio | `vecinos`, `camino`, `comunidades` o `mas_conectados` |
| `desde_clase` | texto | `memoria`, `sesion` o `entidad` |
| `desde_id` | entero | Identificador del nodo de partida |
| `hasta_clase`, `hasta_id` | texto y entero | Solo en el modo `camino` |
| `profundidad` | entero, opcional | Saltos; por defecto 2 |
| `limite` | entero, opcional | Máximo de nodos |
| `incluir_deducido` | booleano, opcional | Recorre también la capa deducida |

Devuelve `nodos`, `aristas`, `pagina` (con `limite`, `devueltos`, `omitidos` y `estrategia`) y, en
los modos de resumen, `comunidades` o `mas_conectados`.

Si `pagina.omitidos` es mayor que cero, el grafo se ha reducido para poder dibujarse: no es un
error, pero el resultado no está completo.

### lodane_doctor

Sin campos de entrada. Devuelve `version_esquema`, `version_sqlite`, `version_vec`, `modo_diario`,
`filas_por_tabla`, `pendientes_vectorizar`, `memorias_vigentes`, `memorias_invalidadas`, `modelo`,
`dimension`, `motor_embeddings` y `avisos`.

## Escritura

### lodane_save

| Campo | Tipo | Qué es |
| :--- | :--- | :--- |
| `tipo` | texto, obligatorio | `idea`, `proyecto`, `nota`, `objetivo`, `decision`, `hecho` o `preferencia` |
| `titulo` | texto, opcional | Título corto y reconocible |
| `contenido` | texto, obligatorio | Lo que se guarda, con su motivo |
| `clave_tema` | texto, opcional | Repetirla actualiza la memoria en su sitio |
| `entidades` | lista de `{nombre, tipo}` | Personas, proyectos, tecnologías, empresas |
| `relaciones` | lista de `{desde, hasta, relacion}` | Relaciones entre entidades, en voz activa |
| `sesion_id` | entero, opcional | Sesión en la que se guarda |
| `origen` | `{carpeta, agente, dispositivo}` | De dónde viene la escritura |

Devuelve `id`, `revision`, `creado`, `cambiado`, `entidades` y `relaciones`.

### lodane_log

Campos: `texto` (obligatorio), `rol`, `autor`, `sesion_id`, `origen`. Devuelve `id` y `duplicado`.

### lodane_link

Campos: `desde_clase`, `desde_id`, `hasta_clase`, `hasta_id`, `relacion`, `origen`. Devuelve `id`
y `creado`. Crea una arista de la capa declarada.

### lodane_invalidate

Campos: `id` (obligatorio), `motivo` (obligatorio), `sustituido_por` (opcional), `origen`.
Devuelve `invalidado_en` y `enlazado`.

### lodane_session

Campos: `accion` (`abrir` o `cerrar`), `clave`, `objetivo`, `resumen`, `sesion_id`, `origen`.
Devuelve `sesion_id` y `estado`.

Al abrir hace falta `objetivo`; al cerrar, `sesion_id` y `resumen`.

## Reglas comunes

- Todas las de lectura aceptan `token_budget` y avisan con `truncado` cuando recortan.
- Los errores de argumento dicen el campo y lo que se esperaba. Un fallo interno devuelve un
  mensaje corto: el detalle se queda en el registro del servidor.
- Los identificadores son enteros y salen siempre de una llamada anterior.
