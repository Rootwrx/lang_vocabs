#!/usr/bin/env python3
"""Scans data/**/*.json and writes data/index.json and data/search.json (run locally or by the GitHub Action).

Supported layouts (all can be mixed; keep meta() identical to meta() in js/manage.js):
  data/animals.json                              flat file            -> set "Animals" (group taken from catalog.json if it knows the set)
  data/animals/part1.json                        folder = set         -> set "Animals", Part 1
  data/animals/verbs.json                        folder = set         -> "Animals – verbs"
  data/travel/hotels.json                        folder = known group -> group Travel, set "Hotels"
  data/by_level/Basic Vocabulary (A1A2)/part1.json   group/set/part   -> By Level / Basic Vocabulary (A1A2) / Part 1
  data/en/...  or  data/fr/...                   a leading "en"/"fr" folder sets the language of everything below it (no prefix = English)
Language: leading folder, else "lang" inside the file, else "en".
Fields inside the file (title, group, set, part, lang, source) always override what the path says.

list id = path without .json, folders joined with "__", unsafe characters -> "_" (keep listId() in js/manage.js identical).
search.json = one compact entry per word: w, pos, ar, def, lg (language), l (list id), i (word index), c (collocations).

Invalid files are SKIPPED (the others still get indexed) and reported as GitHub annotations; exit code 1 then."""
import json, re, sys, pathlib
DATA = pathlib.Path(__file__).parent / "data"
SKIP = {"index.json", "search.json", "catalog.json"}   # generated files; only skipped at the top level of data/
LANGS = ("en", "fr")
PART_WORD = {"fr": "Partie"}       # "Au restaurant – Partie 1"; other languages: "Part"
strip = lambda s: (s or "").replace("*", "")
sent = lambda x: next((x[k] for k in LANGS if x.get(k)), "")          # the sentence of an example / collocation / text: "en", "fr", ...
untag = lambda p: re.sub(r"\s*\[[^\]]*\]\s*(\([^)]*\))?\s*$", "", p or "")   # "un *ami* proche [coll] (daily)" -> "un *ami* proche"
stars = lambda s: str(s).count("*")
gdir = lambda g: re.sub(r"[^a-z0-9]+", "_", str(g).lower()).strip("_") or "other"   # same rule as gDir() in js/manage.js
def pretty(s):   # "animals" -> "Animals", "by_level" -> "By Level"; names that already have capitals are left alone
    s = str(s)
    return " ".join(w[:1].upper() + w[1:] for w in re.sub(r"[_-]+", " ", s).split(" ")) if s == s.lower() else s
try: CAT = json.loads((DATA / "catalog.json").read_text(encoding="utf-8-sig"))
except Exception: CAT = []
clang = lambda c: c.get("lang") or "en"

def cat_group(name):
    """catalog group whose folder-style name matches (IELTS == ielts == "by level" == By Level), else ''"""
    return next((c["group"] for c in CAT if gdir(c["group"]) == gdir(name)), "")
def set_name(name, lang):
    """the catalog's spelling of a set (data/animals.json -> "Animals"), else a prettified folder / file name"""
    for c in CAT:
        if clang(c) == lang:
            for s in c.get("sets", []):
                if gdir(s) == gdir(name): return s
    return pretty(name)
def find_group(st, lang):
    return next((c["group"] for c in CAT if clang(c) == lang and any(gdir(s) == gdir(st) for s in c.get("sets", []))), "")

def meta(rel, d):
    """-> group, set, part, title, lang of a list. See the layouts in the docstring above."""
    parts = list(rel.with_suffix("").parts); stem = parts.pop()
    lang = d.get("lang") or ""
    if parts and parts[0].lower() in LANGS:
        lang = lang or parts[0].lower(); parts = parts[1:]
    if lang not in LANGS: lang = "en"
    group, st, part = d.get("group", ""), d.get("set", ""), d.get("part", 0)
    m = re.fullmatch(r"part[-_ ]?(\d+)", stem, re.I)
    part = part or (int(m.group(1)) if m else 0)
    named = False                      # True when the file name itself is the set name (no "– stem" suffix in the title)
    if len(parts) >= 2:
        group = group or cat_group(parts[0]) or pretty(parts[0])
        st = st or " / ".join(set_name(p, lang) for p in parts[1:])
    elif len(parts) == 1:
        g = cat_group(parts[0])
        if g and not group and not st:            # data/travel/hotels.json, data/travel/part1.json
            group = g
            if not m: st, named = set_name(stem, lang), True
        else:                                     # data/animals/part1.json
            st = st or set_name(parts[0], lang)
    else:
        st = st or set_name(stem, lang); named = True      # data/animals.json
    if not group and st: group = find_group(st, lang)
    if d.get("title"): title = d["title"]
    elif part: title = f"{st or group or pretty(stem)} – {PART_WORD.get(lang, 'Part')} {part}"
    elif st and not named: title = f"{st} – {stem}"
    else: title = st or pretty(stem)
    return group, st, part, title, lang

def check(d):
    if not isinstance(d, dict) or not isinstance(d.get("words"), list) or not d["words"]:
        return ['needs an object with a non-empty "words" list']
    if "part" in d and not (isinstance(d["part"], int) and not isinstance(d["part"], bool) and d["part"] > 0):
        return ['"part" must be a positive integer']
    if "lang" in d and d["lang"] not in LANGS:
        return [f'"lang" must be one of {", ".join(LANGS)}']
    errs, seen = [], set()
    for i, w in enumerate(d["words"]):
        if not isinstance(w, dict): errs.append(f"word {i+1}: must be an object"); continue
        nm = f"word {i+1} ({w.get('w','?')})"
        for k in ("w", "pos", "def", "ar"):          # emoji is optional
            if not w.get(k): errs.append(f"{nm}: missing '{k}'")
        key = str(w.get("w", "")).lower()
        if key and key in seen: errs.append(f"{nm}: duplicate word in this list")
        seen.add(key)
        for c in w.get("col", []):                    # *form* marks: none or exactly one pair (examples without a mark are shown but not used in flashcards)
            if stars(untag(c.get("p", ""))) not in (0, 2): errs.append(f"{nm}: collocation '{c.get('p')}' needs exactly one *form* (or none)")
            if sent(c) and stars(sent(c)) not in (0, 2): errs.append(f"{nm}: example for '{c.get('p')}' needs exactly one *form* (or none)")
        for e in w.get("ex", []):
            if not sent(e): errs.append(f"{nm}: example has no sentence (use \"en\" or \"fr\")")
            elif stars(sent(e)) not in (0, 2): errs.append(f"{nm}: example needs exactly one *form* (or none): {sent(e)}")
    return errs

entries, search, failed = [], [], 0
for f in sorted(DATA.rglob("*.json")):
    rel = f.relative_to(DATA)
    if rel.name in SKIP and len(rel.parts) == 1: continue
    try:
        d = json.loads(f.read_text(encoding="utf-8-sig"))   # utf-8-sig: tolerate a BOM
        errs = check(d)
    except Exception as e:
        errs = [f"invalid JSON ({e})"]
    if errs:
        failed += 1
        for m in errs: print(f"::error file=data/{rel.as_posix()}::{m}")
        continue
    idp = rel.with_suffix("").parts
    if len(idp) > 1 and idp[0].lower() == "en": idp = idp[1:]       # data/en/x and data/x get the same id, so moving a list into en/ keeps its progress
    lid = re.sub(r"[^A-Za-z0-9_-]+", "_", "__".join(idp))
    group, st, part, title, lang = meta(rel, d)
    for i, w in enumerate(d["words"]):
        search.append({"w": w["w"], "pos": w["pos"], "ar": w["ar"], "def": strip(w.get("def")), "lg": lang, "l": lid, "i": i,
                       "c": [[strip(untag(c.get("p"))), c.get("p_ar", "")] for c in w.get("col", [])]})
    entries.append({"id": lid, "file": rel.as_posix(), "title": title, "lang": lang,
                    "group": group, "set": st, "part": part, "source": d.get("source", ""),
                    "count": len(d["words"]), "texts": len(d.get("texts", []))})

(DATA / "index.json").write_text(json.dumps(entries, ensure_ascii=False, indent=1), encoding="utf-8")
(DATA / "search.json").write_text(json.dumps(search, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"index.json: {len(entries)} lists; search.json: {len(search)} words; skipped {failed} invalid file(s)")
sys.exit(1 if failed else 0)
