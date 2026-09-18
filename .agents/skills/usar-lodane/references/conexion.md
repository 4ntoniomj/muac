# Conectar un agente a lodane

Índice: [stdio](#por-stdio) · [http](#por-http-con-token) · [token](#conseguir-un-token) ·
[problemas](#problemas-frecuentes)

## Por stdio

Es la vía para uso local: sin red y sin token, con las credenciales del entorno. Es lo que
recomienda la especificación de MCP para un servidor que corre en la misma máquina.

El cliente arranca el binario con el subcomando `stdio`. Plantilla de configuración:
[cliente-mcp.json](../templates/cliente-mcp.json).

## Por HTTP con token

Es la vía del servidor único: un solo lodane en `127.0.0.1:7437` con el que hablan todas las
carpetas, todos los agentes y todos los dispositivos.

- Ruta del transporte MCP: `/mcp`
- El token va en `Authorization: Bearer <token>` en cada petición. Nunca en la URL.
- Petición sin token: 401. Token revocado: 401. `Host` que no es de esta máquina: 403.

## Conseguir un token

Lo emite el propio binario, y se muestra una sola vez:

```bash
lodane token crear "portátil del trabajo"
```

Con el servidor en contenedor:

```bash
cd deploy && ./gen-token.sh "portátil del trabajo"
```

Un token por dispositivo, para poder revocar uno sin tocar los demás:

```bash
lodane token listar
lodane token revocar 3
```

## Problemas frecuentes

| Síntoma | Causa probable | Qué hacer |
| :--- | :--- | :--- |
| 401 en todas las llamadas | Token ausente, mal copiado o revocado | `lodane token listar` y emitir uno nuevo |
| 403 | La cabecera `Host` no es de esta máquina | Usar `127.0.0.1` o `localhost` en la URL |
| 429 | Límite de tasa por token | Esperar; subirlo con `-limite-tasa` si es legítimo |
| La búsqueda por significado no encuentra nada | No hay motor de embeddings, o hay memorias sin vectorizar | `lodane_doctor` y mirar `motor_embeddings` y `pendientes_vectorizar` |
| Resultados de un modelo antiguo | Se cambió el modelo sin reindexar | `lodane reindexar` |
| El grafo aparece recortado | Degradación por número de nodos | Mirar `pagina.estrategia` y acotar con `desde` y `profundidad` |

Nada de esto hace falta adivinarlo: `lodane_doctor` y `lodane doctor` dicen el estado real.
