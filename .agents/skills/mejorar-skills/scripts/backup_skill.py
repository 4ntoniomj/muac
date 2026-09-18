#!/usr/bin/env python3
"""Respaldos comprimidos de skills fuera del catálogo.

Uso:
  backup_skill.py create  --skill <nombre> --reason "<motivo>" [--catalog DIR] [--backups DIR]
  backup_skill.py list    --skill <nombre> [--backups DIR]
  backup_skill.py restore --skill <nombre> --id <AAAAMMDDTHHMMSSZ> [--yes] [--catalog DIR] [--backups DIR]

Por defecto el catálogo es la carpeta que contiene esta skill (…/.agent/skills) y los
respaldos van a …/.agent/backups/skills/<nombre>/<id>.tar.gz con un index.json (sha256,
motivo, número de archivos). Al estar comprimidos y fuera del catálogo, ningún cargador
de skills los descubre como skills duplicadas.

restore sin --yes solo muestra lo que haría. Con --yes crea antes un respaldo del estado
actual (motivo "pre-restore") y después sustituye la carpeta.
Salida JSON. Códigos: 0 correcto, 1 skill o respaldo inexistente, 2 error de uso o E/S.
"""

import argparse
import hashlib
import io
import json
import shutil
import sys
import tarfile
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_CATALOG = Path(__file__).resolve().parent.parent.parent


def out(data, code=0):
    print(json.dumps(data, indent=2, ensure_ascii=False))
    sys.exit(code)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def index_path(backups, skill):
    return backups / skill / "index.json"


def read_index(backups, skill):
    p = index_path(backups, skill)
    return json.loads(p.read_text(encoding="utf-8")) if p.is_file() else []


def create(catalog, backups, skill, reason):
    source = catalog / skill
    if not (source / "SKILL.md").is_file():
        out({"error": f"No existe la skill {source}"}, 1)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")[:-5] + "Z"
    dest_dir = backups / skill
    dest_dir.mkdir(parents=True, exist_ok=True)
    archive = dest_dir / f"{stamp}.tar.gz"
    if archive.exists():
        out({"error": f"Ya existe {archive}; reintenta en un segundo."}, 2)
    files = [p for p in sorted(source.rglob("*")) if p.is_file() and "__pycache__" not in p.parts]
    with tarfile.open(archive, "w:gz") as tar:
        for f in files:
            tar.add(f, arcname=f"{skill}/{f.relative_to(source)}")
    with tarfile.open(archive) as tar:
        stored = len([m for m in tar.getmembers() if m.isfile()])
    if stored != len(files):
        out({"error": f"Respaldo incompleto: {stored} de {len(files)} archivos."}, 2)
    entry = {"id": stamp, "file": str(archive), "sha256": sha256(archive), "files": stored,
             "reason": reason, "source": str(source)}
    index = read_index(backups, skill) + [entry]
    index_path(backups, skill).write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return entry


def main():
    parser = argparse.ArgumentParser(description="Respaldos de skills.")
    sub = parser.add_subparsers(dest="action", required=True)
    for name in ("create", "list", "restore"):
        p = sub.add_parser(name)
        p.add_argument("--skill", required=True)
        p.add_argument("--catalog", default=str(DEFAULT_CATALOG))
        p.add_argument("--backups", help="Por defecto <catálogo>/../backups/skills")
        if name == "create":
            p.add_argument("--reason", required=True)
        if name == "restore":
            p.add_argument("--id", required=True)
            p.add_argument("--yes", action="store_true")
    args = parser.parse_args()

    catalog = Path(args.catalog).resolve()
    backups = Path(args.backups).resolve() if args.backups else catalog.parent / "backups" / "skills"

    if args.action == "create":
        out({"action": "create", "backup": create(catalog, backups, args.skill, args.reason)})

    index = read_index(backups, args.skill)
    if args.action == "list":
        out({"action": "list", "skill": args.skill, "backups": index})

    entry = next((e for e in index if e["id"] == args.id), None)
    if not entry or not Path(entry["file"]).is_file():
        out({"error": f"No existe el respaldo {args.id} de {args.skill}"}, 1)
    if sha256(entry["file"]) != entry["sha256"]:
        out({"error": "El sha256 del respaldo no coincide con el índice; no se restaura."}, 2)
    target = catalog / args.skill
    if not args.yes:
        out({"action": "restore", "dry_run": True, "would_replace": str(target), "from": entry,
             "next": "Repite con --yes para restaurar. Se hará antes un respaldo del estado actual."})
    safety = create(catalog, backups, args.skill, f"pre-restore {args.id}") if (target / "SKILL.md").is_file() else None
    with tarfile.open(entry["file"]) as tar:
        members = tar.getmembers()
        if any(not m.name.startswith(f"{args.skill}/") or ".." in Path(m.name).parts for m in members):
            out({"error": "El respaldo contiene rutas fuera de la skill; no se restaura."}, 2)
        staging = catalog.parent / "backups" / ".staging" / args.skill
        if staging.exists():
            shutil.rmtree(staging)
        staging.parent.mkdir(parents=True, exist_ok=True)
        kwargs = {"filter": "data"} if hasattr(tarfile, "data_filter") else {}
        tar.extractall(staging.parent, members=members, **kwargs)
    if target.exists():
        shutil.rmtree(target)
    shutil.move(str(staging), str(target))
    out({"action": "restore", "restored": str(target), "from": entry, "safety_backup": safety})


if __name__ == "__main__":
    main()
