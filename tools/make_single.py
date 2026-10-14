#!/usr/bin/env python3
# Собирает однофайловые бандлы функций для дашборда: импорты всех частей поднимаются наверх без дублей.
import sys
from pathlib import Path
R = Path("/workspace/mia/supabase/functions")
NOTES = {
 "unlock": "// unlock — ОДИН ФАЙЛ для дашборда. Verify JWT: ВЫКЛ. Секреты: SB_SECRET_KEY, UNLOCK_HMAC_SECRET, YC_KEY_ID, YC_SECRET (+ SUPABASE_URL).",
 "pack_images": "// pack_images — ОДИН ФАЙЛ для дашборда. Verify JWT: ВКЛ. Секреты: YC_KEY_ID, YC_SECRET (+ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).",
 "free_arts": "// free_arts — ОДИН ФАЙЛ для дашборда. Verify JWT: ВЫКЛ. Секреты: YC_KEY_ID, YC_SECRET (+ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).",
 "yc_upload": "// yc_upload — ОДИН ФАЙЛ для дашборда. Verify JWT: ВКЛ. Секреты: YC_KEY_ID, YC_SECRET (+ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).",
 "yc_migrate": "// yc_migrate — ОДИН ФАЙЛ для дашборда. Verify JWT: ВКЛ. Секреты: YC_KEY_ID, YC_SECRET.",
}
LOCAL = ('from "../_shared/', 'from "./')
def split(t):
    imps, rest = [], []
    for l in t.split("\n"):
        (imps if l.startswith("import ") else rest).append(l)
    return imps, "\n".join(rest)
def build(name):
    parts = []
    if name == "yc_migrate": parts.append(("core.ts", (R / name / "core.ts").read_text()))
    elif name != "yc_upload": parts.append(("yc.ts", (R / "_shared/yc.ts").read_text()))
    parts.append(("index.ts", (R / name / "index.ts").read_text()))
    imps, bodies = [], []
    for fn, t in parts:
        i, b = split(t)
        imps += [x for x in i if not any(s in x for s in LOCAL)]
        bodies.append(f"// ---- {fn} ----\n" + b.replace("export async function", "async function").replace("export function", "function").replace("export const", "const").replace("export type", "type"))
    seen, uniq = set(), []
    for x in imps:
        if x.strip() not in seen: seen.add(x.strip()); uniq.append(x)
    assert len([x for x in uniq if "AwsClient" in x]) <= 1
    return NOTES[name] + "\n" + "\n".join(uniq) + "\n\n" + "\n".join(bodies)
for n in sys.argv[1:] or ["unlock", "pack_images", "free_arts", "yc_migrate", "yc_upload"]:
    out = build(n)
    dst = Path(f"/workspace/yandex/single/{n}.ts")
    dst.write_text(out); Path(f"/workspace/yandex/serve/{n}.ts").write_text(out)
    print(n, "imports:", out.count("\nimport "), "AwsClient imports:", out.count("import { AwsClient }"))
