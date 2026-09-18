#!/usr/bin/env python3
"""Puntuación léxica compartida para búsqueda de skills y proxy de enrutamiento.

Módulo usado por find_skills.py (crear-skills) y diff_skill_evals.py (mejorar-skills).
No reproduce el enrutador real del agente: es una aproximación determinista que sirve
para ordenar candidatas y detectar regresiones relativas entre dos versiones de una
description. No mide calidad absoluta.

CLI de diagnóstico:
  routing_score.py --path .agent/skills/<skill> --prompt "texto de la petición"
Salida JSON. Códigos: 0 = ok, 2 = error de entrada.
"""

import argparse
import json
import math
import re
import sys
import unicodedata
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_skill import parse_frontmatter, split_frontmatter  # noqa: E402

METHOD = "lexical-proxy-v3"
STEM = 5

STOPWORDS = set("""
a al algo alguna alguno ante como con cual cuando de del desde donde el ella en entre es esa ese
esta este esto estos hay la las le lo los mas me mi mis muy ni no o para pero por que se si sin
sobre su sus tambien te tu un una uno unos y ya u
the and or for with to of in on an is are be as by it this that these my me i we you your want need
usar use used using activar active cuando when pida pide pidan solicite solicita usuario user
agente agent tarea task quiero necesito hazme haz dame puedes podrias favor
""".split())

# Equivalencias mínimas es/en (sobre raíces de 5 letras) para consultas en español
# contra skills redactadas en inglés y viceversa.
SYNONYMS = {
    "pagin": ["page", "web", "websi", "site"], "web": ["websi", "front", "html"], "sitio": ["site", "websi"],
    "disen": ["desig"], "desig": ["disen"], "inter": ["ui"], "prueb": ["test"], "test": ["prueb"],
    "segur": ["secur"], "secur": ["segur"], "datos": ["data"], "docum": ["doc"],
    "despl": ["deplo"], "deplo": ["despl"], "codig": ["code"], "code": ["codig"], "revis": ["revie"],
    "revie": ["revis"], "anima": ["motio"], "movil": ["mobil"], "rendi": ["perfo"], "perfo": ["rendi"],
    "crear": ["creat", "crea"], "creat": ["crear"], "mejor": ["impro"], "impro": ["mejor"],
}


def normalize(text):
    text = unicodedata.normalize("NFKD", str(text).lower())
    return "".join(c for c in text if not unicodedata.combining(c))


def stems(text, expand=False):
    words = re.findall(r"[a-z0-9]+", normalize(text).replace("-", " "))
    out = {w[:STEM] for w in words if len(w) >= 3 and w not in STOPWORDS}
    if expand:
        for s in list(out):
            out.update(SYNONYMS.get(s, []))
    return out


def split_description(desc):
    """Separa la description en parte positiva y parte de exclusiones ('No usar…')."""
    m = re.search(r"\b(no usar|no activar|no la uses|do not use|don't use)\b", normalize(desc))
    if not m:
        return desc, ""
    return desc[: m.start()], desc[m.start():]


def load_skill(skill_dir):
    """Devuelve (name, description, body) de una carpeta de skill o de un SKILL.md."""
    path = Path(skill_dir)
    skill_md = path if path.name == "SKILL.md" else path / "SKILL.md"
    content = skill_md.read_text(encoding="utf-8", errors="replace")
    raw, body, _ = split_frontmatter(content)
    fm = parse_frontmatter(raw)[0] if raw else {}
    return str(fm.get("name") or skill_md.parent.name), str(fm.get("description") or ""), body


def route_score(prompt, name, desc):
    """Afinidad de una petición con una skill.

    - Aciertos en la parte positiva, normalizados por raíz del tamaño del vocabulario.
    - Penalización por términos que solo aparecen en "No usar…"; se ignoran los nombres de
      skills vecinas citados ahí ("usar otra-skill") y no cuentan los sinónimos expandidos.
    - Bonificación de hasta 0.5 según la fracción de términos del nombre presentes.
    - Las menciones "skill <nombre-kebab>" son el objeto de la petición, no su intención: se
      retiran del texto y la skill nombrada recibe +0.5 fijo.
    """
    mentioned = set(re.findall(r"\bskills?\s+(?:de\s+)?`?([a-z0-9]+(?:-[a-z0-9]+)+)`?", normalize(prompt)))
    prompt = re.sub(r"\bskills?\s+(?:de\s+)?`?[a-z0-9]+(?:-[a-z0-9]+)+`?", "skill", normalize(prompt))
    raw = stems(prompt)
    p = stems(prompt, expand=True)
    pos_text, neg_text = split_description(desc)
    neg_text = re.sub(r"\(?\busar\s+[a-z0-9]+(?:-[a-z0-9]+)+\)?", " ", normalize(neg_text))
    pos = stems(pos_text)
    neg = stems(neg_text) - pos
    name_stems = stems(name)
    name_hits = p & name_stems
    pos_hits = p & pos
    neg_hits = raw & neg
    score = 0.0
    if pos:
        score += len(pos_hits) / math.sqrt(len(pos))
    if neg:
        score -= len(neg_hits) / math.sqrt(len(neg))
    if name_stems:
        score += 0.5 * len(name_hits) / len(name_stems)
    if normalize(name) in mentioned:
        score += 0.5
    return {
        "score": round(score, 4),
        "positive_hits": sorted(pos_hits),
        "negative_hits": sorted(neg_hits),
        "name_hits": sorted(name_hits),
    }


def main():
    parser = argparse.ArgumentParser(description="Diagnóstico del proxy léxico de enrutamiento.")
    parser.add_argument("--path", required=True, help="Carpeta de la skill o ruta a SKILL.md.")
    parser.add_argument("--prompt", required=True)
    args = parser.parse_args()
    try:
        name, desc, _ = load_skill(args.path)
    except OSError as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        sys.exit(2)
    print(json.dumps(dict(route_score(args.prompt, name, desc), skill=name, method=METHOD), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
