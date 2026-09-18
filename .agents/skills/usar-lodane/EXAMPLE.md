# Ejemplo: una sesión entera con lodane

Recorrido real ejecutado el 2026-09-18 contra un servidor lodane en marcha, por MCP sobre HTTP con
token. Las salidas son las de verdad, con el motor de embeddings `all-minilm` de 384 dimensiones.

## Paso 0: comprobar que está ahí

```text
$ python3 scripts/comprobar_lodane.py --url http://127.0.0.1:7601 --text
lodane en http://127.0.0.1:7601
  responde:        sí
  token válido:    no
  por significado: no
  falta el token: pásalo con --token o LODANE_TOKEN; se emite con «lodane token crear "<dispositivo>"»
```

Código 1: el servidor está, falta la credencial. Con el token puesto, el mismo script informa del
esquema, del motor y de cuántas memorias hay.

## Paso 1 y 2: handshake y herramientas

```text
1. handshake correcto: servidor lodane dev, protocolo 2025-11-25
2. herramientas expuestas: 10
```

## Paso 3: abrir sesión

```text
3. sesión abierta: 1 (abierta)
```

## Paso 4 y 5: guardar y registrar

```text
4. memoria guardada: id 1, creado true, 2 entidades y 1 relaciones
5. log crudo registrado: id 1
```

La memoria guardada decía que los vectores van dentro del binario, y declaró dos entidades
(`sqlite-vec` y `Go`) y una relación (`lodane usa sqlite-vec`).

## Paso 6: esperar a que se vectorice

```text
6. diagnóstico: motor all-minilm, modelo indexado "all-minilm", dimensión 384, pendientes 0
```

`pendientes 0` es la señal de que ya se puede buscar por significado. Antes de eso, la búsqueda
responde solo por texto.

## Paso 7: buscar por significado, no por palabras

Tres consultas contra la misma memoria, mirando por qué vía la encontró cada una:

```text
consulta: «sqlite»
  -> id 2 · Vectores dentro del binario · 0.032787 · por texto#1 y vector#1

consulta: «recuperar informacion parecida sin escribir las mismas palabras»
  -> id 2 · Vectores dentro del binario · 0.032522 · por texto#1 y vector#2

consulta: «zxqvwk palabra inexistente»
  -> id 2 · Vectores dentro del binario · 0.016129 · por vector#2
```

La tercera es la prueba de que la búsqueda por significado funciona: ninguna de esas palabras está
en la memoria, la vía de texto no encontró nada, y aun así la vectorial la trajo. La puntuación
0,016129 es exactamente 1/(60+2): una sola vía, en segunda posición.

## Paso 8: contenido completo y enlaces

```text
8. contenido recuperado (148 caracteres), vigente true, 3 enlaces:
   menciona → sqlite-vec [deducida]
   menciona → Go [deducida]
   guardado_en → control de calidad de lodane [declarada]
```

Las dos entidades que declaró el agente están marcadas como deducidas. El enlace con la sesión es
declarado, porque eso sí es un hecho.

## Paso 9: el grafo

```text
9. grafo: 4 nodos (completo)
   Vectores dentro del binario  memoria  declarada
   sqlite-vec                   entidad  deducida
   Go                           entidad  deducida
   control de calidad de lodane sesion   declarada
```

## Paso 10: corregir sin borrar

```text
10. invalidada el 2026-09-18 07:50 (enlazada: true); sigue consultable con 148 caracteres y vigente=false
```

Lo importante es la última parte: el dato antiguo sigue ahí, con su contenido íntegro, marcado como
no vigente. Nada se ha perdido.

## Paso 11: cerrar y heredar

```text
11. sesión cerrada (cerrada); el contexto siguiente ve 1 decisiones
    resumen heredado: control de calidad ejecutado de extremo a extremo; queda pendiente medir el
    rendimiento con diez mil memorias
```

Ese resumen es lo que leerá el próximo agente en su primera llamada. Está escrito para alguien que
no estaba en la conversación, que es la única forma de que sirva.

## Paso 12: un error que no filtra nada

```text
12. error de argumento: es_error=true · service: argumento inválido: tipo "invento":
    se esperaba uno de idea, proyecto, nota, objetivo, decision, hecho, preferencia
```

Dice el campo y lo que esperaba. Cuando el fallo es interno, en cambio, el cliente solo recibe un
mensaje corto: el detalle se queda en el registro del servidor.

## Qué se aprendió

- `pendientes_vectorizar` en el diagnóstico es lo primero que hay que mirar cuando una búsqueda por
  significado no encuentra lo que debería: puede que la memoria esté guardada pero aún sin vector.
- `posicion_texto` y `posicion_vector` dicen por qué vía llegó cada resultado, y son la forma de
  comprobar que la parte semántica está funcionando de verdad.
- El protocolo negociado por HTTP en esta prueba fue 2025-11-25, mientras que por transporte en
  memoria fue 2026-07-28. Las dos las admite el servidor; conviene no dar por hecha una versión.
