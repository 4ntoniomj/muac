#!/usr/bin/env python3
"""Comprueba si un servidor lodane está disponible y en qué estado.

Sirve para que un agente sepa, antes de fiarse de la memoria, si el servidor responde, si hay
motor de embeddings y cuántas memorias hay. Con la ruta de salud no hace falta token; para el
diagnóstico sí.

Uso:
  comprobar_lodane.py [--url http://127.0.0.1:7437] [--token <token>] [--text]

El token se toma de --token o de la variable de entorno LODANE_TOKEN. Nunca se imprime.

Salida JSON. Códigos: 0 lodane usable, 1 no usable o con avisos que impiden buscar por
significado, 2 error de uso.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request


def pedir(url, token=None, timeout=5.0):
    peticion = urllib.request.Request(url)
    if token:
        peticion.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(peticion, timeout=timeout) as respuesta:
        cuerpo = respuesta.read().decode("utf-8", "replace")
        return respuesta.status, cuerpo


def main():
    ap = argparse.ArgumentParser(description="Sonda de lodane para agentes.")
    ap.add_argument("--url", default=os.getenv("LODANE_URL", "http://127.0.0.1:7437"))
    ap.add_argument("--token", default=os.getenv("LODANE_TOKEN", ""))
    ap.add_argument("--timeout", type=float, default=5.0)
    ap.add_argument("--text", action="store_true")
    args = ap.parse_args()

    base = args.url.rstrip("/")
    resultado = {
        "url": base,
        "responde": False,
        "autenticado": False,
        "busqueda_por_significado": False,
        "avisos": [],
        "motivo": None,
    }

    # 1. ¿Hay algo escuchando? La ruta de salud no pide token.
    try:
        estado, cuerpo = pedir(f"{base}/healthz", timeout=args.timeout)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        resultado["motivo"] = f"no responde: {getattr(exc, 'reason', exc)}"
        salir(resultado, args.text, 1)
    else:
        if estado != 200 or cuerpo.strip() != "ok":
            resultado["motivo"] = f"la ruta de salud respondió {estado}: puede no ser un lodane"
            salir(resultado, args.text, 1)
        resultado["responde"] = True

    # 2. ¿Sirve el token?
    if not args.token:
        resultado["motivo"] = ("falta el token: pásalo con --token o LODANE_TOKEN; "
                               "se emite con «lodane token crear \"<dispositivo>\"»")
        salir(resultado, args.text, 1)

    try:
        estado, cuerpo = pedir(f"{base}/api/diagnostico", args.token, args.timeout)
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            resultado["motivo"] = "token no válido o revocado"
        elif exc.code == 403:
            resultado["motivo"] = "Host no admitido: usa 127.0.0.1 o localhost en la URL"
        elif exc.code == 429:
            resultado["motivo"] = "límite de tasa alcanzado: espera un momento"
        else:
            resultado["motivo"] = f"el servidor respondió {exc.code}"
        salir(resultado, args.text, 1)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        resultado["motivo"] = f"error de red: {getattr(exc, 'reason', exc)}"
        salir(resultado, args.text, 1)

    resultado["autenticado"] = True
    try:
        d = json.loads(cuerpo)
    except json.JSONDecodeError:
        resultado["motivo"] = "el diagnóstico no devolvió JSON"
        salir(resultado, args.text, 1)

    resultado.update({
        "version_esquema": d.get("version_esquema"),
        "version_sqlite": d.get("version_sqlite"),
        "version_vec": d.get("version_vec"),
        "motor_embeddings": d.get("motor_embeddings"),
        "modelo": d.get("modelo") or None,
        "dimension": d.get("dimension"),
        "memorias_vigentes": d.get("memorias_vigentes"),
        "memorias_invalidadas": d.get("memorias_invalidadas"),
        "pendientes_vectorizar": d.get("pendientes_vectorizar"),
        "avisos": list(d.get("avisos") or []),
    })

    motor = resultado.get("motor_embeddings")
    resultado["busqueda_por_significado"] = bool(motor) and motor != "ninguno"
    if not resultado["busqueda_por_significado"]:
        resultado["motivo"] = ("sin motor de embeddings: la búsqueda funciona por texto, "
                               "no por significado")

    # Código 1 también cuando falta la búsqueda por significado: el agente debe saberlo antes de
    # concluir que algo no está guardado.
    salir(resultado, args.text, 0 if resultado["busqueda_por_significado"] else 1)


def salir(resultado, como_texto, codigo):
    if como_texto:
        print(f"lodane en {resultado['url']}")
        print(f"  responde:        {'sí' if resultado['responde'] else 'no'}")
        print(f"  token válido:    {'sí' if resultado['autenticado'] else 'no'}")
        if resultado.get("version_esquema") is not None:
            print(f"  esquema:         {resultado['version_esquema']} "
                  f"(sqlite {resultado.get('version_sqlite')}, vec {resultado.get('version_vec')})")
            print(f"  memorias:        {resultado.get('memorias_vigentes')} vigentes, "
                  f"{resultado.get('memorias_invalidadas')} invalidadas")
            print(f"  embeddings:      {resultado.get('motor_embeddings')} "
                  f"(modelo {resultado.get('modelo') or 'ninguno'}, "
                  f"dimensión {resultado.get('dimension')})")
            print(f"  sin vectorizar:  {resultado.get('pendientes_vectorizar')}")
        print(f"  por significado: {'sí' if resultado['busqueda_por_significado'] else 'no'}")
        for aviso in resultado.get("avisos", []):
            print(f"  aviso: {aviso}")
        if resultado.get("motivo"):
            print(f"  {resultado['motivo']}")
    else:
        print(json.dumps(resultado, indent=2, ensure_ascii=False))
    sys.exit(codigo)


if __name__ == "__main__":
    main()
