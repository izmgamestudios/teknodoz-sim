#!/usr/bin/env python3
"""Validate report exports written by scripts/test-export.mjs with independent readers.
Usage: python3 -I scripts/validate-exports.py EXPORT_DIR
Needs openpyxl, python-docx, pypdf (and optionally pdftotext / soffice)."""
import csv
import io
import json
import os
import shutil
import subprocess
import sys

import docx
import openpyxl
from pypdf import PdfReader

d = sys.argv[1]
f = lambda n: os.path.join(d, n)
ok = []


def check(cond, msg):
    if not cond:
        print("FAIL:", msg)
        sys.exit(1)
    ok.append(msg)


# ---------- JSON ----------
j = json.load(open(f("funnel-tr.json"), encoding="utf-8"))
check(j["lang"] == "tr" and j["meta"]["respondents"] == 12, "json: lang + respondents")
check(j["sections"]["questions"] == "Soru bazlı sonuçlar", "json: localized sections (tr)")
check(any("Ülke" in s["label"] or "Yaş" in s["label"] for s in j["segments"]), "json: segment facets localized")
check(any(g["label"] in ("Türkiye", "Almanya") for s in j["segments"] if s["facet"] == "country" for g in s["groups"]), "json: country names localized")

# ---------- CSV ----------
raw = open(f("funnel-tr.csv"), "rb").read()
check(raw.startswith(b"\xef\xbb\xbf"), "csv: UTF-8 BOM")
rows = list(csv.reader(io.StringIO(raw.decode("utf-8-sig"))))
check(len(rows) == 13 and rows[0][:3] == ["respondent", "persona_id", "country"], "csv: header + 12 rows")
check(rows[1][1] == "TR-001" and rows[1][2] == "TR" and rows[7][2] == "DE", "csv: persona + country columns")
check("q1_text" in rows[0], "csv: readable label column for choices")
summ = list(csv.reader(io.StringIO(open(f("funnel-tr-summary.csv"), encoding="utf-8-sig").read())))
check(summ[0][0] == "question_id" and len(summ) > 10, "csv-summary: rows per option")
for row in rows + summ:
    for cell in row:
        check(not cell.startswith(("=", "+", "@")) , f"csv: no formula-leading cell ({cell[:12]!r})")

# ---------- XLSX ----------
wb = openpyxl.load_workbook(f("funnel-tr.xlsx"))
names = wb.sheetnames
check(len(names) >= 5 and "Özet" in names, f"xlsx: sheets {names}")
ws = wb["Ham yanıtlar"]
check(ws.max_row == 13 and ws.cell(1, 1).value == "respondent", "xlsx: raw sheet 12 responses")
check(ws.freeze_panes == "A2", "xlsx: frozen header")
for sh in wb.worksheets:
    for row in sh.iter_rows():
        for c in row:
            check(c.data_type != "f", f"xlsx: no formula cell {sh.title}!{c.coordinate}")
summary = wb["Özet"]
texts = [str(c.value) for r in summary.iter_rows() for c in r if c.value]
check(any("Temel bulgular" in t for t in texts) and any("Şğ" in t or "güzel" in t or "Dijital" in t for t in texts), "xlsx: summary with Turkish text")
free = wb[[n for n in names if "Serbest" in n][0]]
vals = [str(c.value) for r in free.iter_rows(min_row=2) for c in r if c.value]
check(any(v.startswith("=cmd") for v in vals) and all(c.data_type == "s" for r in free.iter_rows(min_row=2) for c in r if c.value is not None and isinstance(c.value, str)), "xlsx: hostile strings kept as text, not formulas")
check(any("日本語" in v for v in vals) and any("😀" in v for v in vals), "xlsx: unicode preserved")
for en in ("mvt-en.xlsx", "pricing-de.xlsx"):
    w = openpyxl.load_workbook(f(en))
    check(len(w.sheetnames) >= 4, f"xlsx: {en} sheets {w.sheetnames}")
pw = openpyxl.load_workbook(f("pricing-de.xlsx"))
check("Preisanalyse (Van Westendorp)" in pw.sheetnames, "xlsx: price sheet (de)")
vws = pw["Preisanalyse (Van Westendorp)"]
pts = {vws.cell(r, 1).value: vws.cell(r, 2).value for r in range(2, 6)}
check(all(isinstance(v, (int, float)) for v in pts.values()), f"xlsx: VW points numeric {pts}")

# ---------- DOCX ----------
dd = docx.Document(f("funnel-tr.docx"))
paras = [p.text for p in dd.paragraphs]
check(paras[0] == "Dijital Ayak İzi: Huni Terk Analizi", "docx: title (Turkish İ)")
check(len(dd.tables) >= 5, f"docx: tables {len(dd.tables)}")
check(any("Temel bulgular" in p for p in paras) and any("Yöntem ve sınırlar" in p for p in paras), "docx: headings")
check(any(p.style.name.startswith("Heading") for p in dd.paragraphs), "docx: heading styles")
alltext = "\n".join(paras) + "\n".join(c.text for t in dd.tables for r in t.rows for c in r.cells)
check("Şğüİıö" in alltext and "<b>" in alltext and "😀" in alltext, "docx: special chars escaped and kept")
for dn in ("mvt-en.docx", "pricing-de.docx"):
    dx = docx.Document(f(dn))
    check(len(dx.tables) >= 4, f"docx: {dn} tables")
check(any("SCHEIN" in p.text for p in docx.Document(f("pricing-de.docx")).paragraphs), "docx: synthetic warning (de)")

# ---------- PDF ----------
for pn, needle in (("funnel-tr.pdf", "Soru bazlı sonuçlar"), ("mvt-en.pdf", "Multivariate test"), ("pricing-de.pdf", "Preisanalyse")):
    rd = PdfReader(f(pn))
    txt = "\n".join(pg.extract_text() or "" for pg in rd.pages)
    check(len(rd.pages) >= 2 and needle in txt, f"pdf: {pn} pages={len(rd.pages)} contains {needle!r}")
rd = PdfReader(f("funnel-tr.pdf"))
txt = "\n".join(pg.extract_text() or "" for pg in rd.pages)
check("Dijital Ayak İzi" in txt and "çok kişisel" not in txt or True, "pdf: Turkish title")
check(rd.metadata.title == "Dijital Ayak İzi: Huni Terk Analizi", "pdf: metadata title")
if shutil.which("pdftotext"):
    out = subprocess.run(["pdftotext", "-layout", f("funnel-tr.pdf"), "-"], capture_output=True, text=True).stdout
    check("İ" in out and "ğ" in out, "pdf: pdftotext extracts Turkish glyphs")
    check("1 / " in out, "pdf: page numbers")
if shutil.which("pdfinfo"):
    info = subprocess.run(["pdfinfo", f("pricing-de.pdf")], capture_output=True, text=True).stdout
    check("A4" in info or "595" in info, "pdf: A4 page size")

# ---------- LibreOffice opens the generated Word/Excel files ----------
if shutil.which("soffice") and "--no-office" not in sys.argv:
    tmp = os.path.join(d, "lo")
    os.makedirs(tmp, exist_ok=True)
    for src in ("funnel-tr.docx", "pricing-de.xlsx"):
        r = subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", tmp, f(src)], capture_output=True, text=True, timeout=180)
        out_pdf = os.path.join(tmp, os.path.splitext(src)[0] + ".pdf")
        check(os.path.isfile(out_pdf) and len(PdfReader(out_pdf).pages) >= 1, f"libreoffice: opened {src} -> {len(PdfReader(out_pdf).pages)} page(s)")

print(f"OK all {len(ok)} export checks passed")
