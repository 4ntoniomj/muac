# Ejemplo de uso de usar-sdd

Este ejemplo muestra la orquestación completa del ciclo SDD para implementar un limitador de peticiones (rate limiting) en un servicio backend, dividiendo el trabajo entre subagentes y respetando el Human Gate.

---

## 1. Entrada del usuario

```text
Usuario: "Quiero implementar rate limiting en los endpoints de nuestra API REST usando el ciclo SDD y subagentes."
```

---

## 2. Paso 1: Entender la petición y delimitar el cambio

El orquestador analiza el repositorio y define la ficha del cambio:

- **Nombre propuesto**: `api-rate-limiting`
- **Ámbito**: Middleware de rate limiting basado en token bucket sobre Redis/en memoria.
- **Herramientas de fases**: Skills especializadas de OpenSpec.

El orquestador formula una breve confirmación:
> "He registrado el cambio como `api-rate-limiting`. Vamos a arrancar con una breve fase de exploración para evaluar dependencias de almacenamiento antes de redactar la propuesta. ¿Conforme?"
> *Usuario: "Sí, adelante."*

---

## 3. Fase 1: Exploración (Subagente Explorador)

El orquestador despacha al subagente:

```python
invoke_subagent(
    TypeName="research",
    Role="Explorador de Requisitos SDD",
    Prompt="""
    Actúa como subagente explorador del ciclo SDD para el proyecto.
    Misión: Investigar la mejor estrategia de rate limiting para los endpoints de la API REST.
    Sigue las pautas de la skill `openspec-explore`.
    Restricción: NO escribas ni modifiques código de la aplicación.
    Analiza el router existente y dependencias disponibles en el proyecto.
    Devuelve un informe con la propuesta técnica y alcance.
    """
)
```

**Respuesta del subagente explorador:**
> "He revisado el router HTTP. Contamos con soporte para middlewares estándar y no dependemos de servicios externos aún. Recomiendo implementar un token bucket en memoria para el MVP con una interfaz extensible a Redis."

---

## 4. Fase 2: Especificación y Propuesta (Subagente Diseñador)

El orquestador despacha al subagente de especificación:

```python
invoke_subagent(
    TypeName="self",
    Role="Diseñador de Especificación SDD",
    Prompt="""
    Actúa como subagente de especificación para el cambio `api-rate-limiting`.
    Sigue las pautas de la skill `openspec-propose`.
    Genera el cambio con `openspec new change "api-rate-limiting"` y completa:
    - proposal.md (justificación y alcance)
    - specs/api/rate-limiting/spec.md (delta de requerimientos y escenarios)
    - design.md (arquitectura de middleware en memoria)
    - tasks.md (lista detallada de pasos de implementación)
    Restricción: NO toques código de la aplicación. Limítate a los archivos de OpenSpec.
    """
)
```

**Verificación intermedia del orquestador:**
```bash
python3 scripts/check_sdd_status.py --change api-rate-limiting
```
Salida:
```json
{
  "change": "api-rate-limiting",
  "phase": "HUMAN_GATE",
  "planning_artifacts": {
    "proposal": true,
    "specs": true,
    "design": true,
    "tasks": true
  },
  "tasks": { "total": 4, "completed": 0, "remaining": 4 },
  "next_action": "Detenerse. Presentar la especificación y lista de tareas al usuario para confirmación explícita."
}
```

---

## 5. Human Gate (Punto de Control)

El orquestador se detiene y presenta la propuesta al usuario:

> **Especificación lista para revisión:**
> - **Propuesta**: Middleware de limitación a 100 req/min por IP.
> - **Tareas planificadas**:
>   1. Crear estructura `RateLimiter` con algoritmo Token Bucket.
>   2. Implementar middleware HTTP para interceptar peticiones entrantes.
>   3. Retornar cabeceras estándar `X-RateLimit-*` y código HTTP 429 al exceder cuota.
>   4. Añadir tests unitarios y de integración para verificar el bloqueo.
>
> ¿Apruebas esta especificación y la lista de tareas para comenzar la implementación?

**Usuario**: *"Aprobado, procede con la implementación."*

---

## 6. Fase 3: Implementación (Subagente Implementador)

Con la autorización expresa, el orquestador despacha al subagente implementador:

```python
invoke_subagent(
    TypeName="self",
    Role="Implementador SDD",
    Prompt="""
    Actúa como subagente implementador para el cambio `api-rate-limiting`.
    El Human Gate ha sido APROBADO por el usuario.
    Sigue las pautas de la skill `openspec-apply-change`.
    Lee proposal.md, design.md y tasks.md.
    Ejecuta las 4 tareas de tasks.md marcando cada una como - [x] tras completarla.
    Asegúrate de que el código compile y cumpla con las especificaciones.
    """
)
```

---

## 7. Fase 4: Verificación y Cierre (Subagente Verificador)

El orquestador verifica que todas las tareas están marcadas como `- [x]` y despacha al subagente verificador:

```python
invoke_subagent(
    TypeName="self",
    Role="Verificador y Cierre SDD",
    Prompt="""
    Actúa como subagente de verificación y cierre para `api-rate-limiting`.
    1. Ejecuta la suite de pruebas del proyecto para asegurar que todos los tests pasan.
    2. Sigue las pautas de la skill `openspec-archive-change` para archivar el cambio completado.
    """
)
```

**Resultado:**
Tests pasando al 100% y cambio archivado en `openspec/changes/archive/api-rate-limiting`.

---

## 8. Cierre al usuario

El orquestador informa de la conclusión exitosa del ciclo SDD con la referencia al cambio archivado y los componentes creados.
