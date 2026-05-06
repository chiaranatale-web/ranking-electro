#!/usr/bin/env python3
"""
Ranking diario — Top 20 ítems mas vendidos por categoria en MLA.
Categorias: Freidoras de Aire | Televisores | Heladeras |
            Lavarropas | Aires Acondicionados | Pequenos Electrodomesticos

Output: C:\\Users\\cnatale\\Claudio\\Reportes\\freidoras_ranking.html
Uso   : python freidoras_ranking.py
"""

from google.cloud import bigquery
from datetime import datetime, timedelta
import re, os

# ── Config ─────────────────────────────────────────────────────────────────────
BILLING_PROJECT = "meli-bi-data"
BQ_BATCH        = "meli-sbox.PLANNINGMLA.BT_ORDERS_MLA"
BQ_NRT          = "meli-sbox.PLANNINGMLA.BT_ORDERS_MLA_NRT"
OUTPUT_FILE     = r"C:\Users\cnatale\Claudio\Reportes\freidoras_ranking.html"
GIT_REPO        = r"C:\Users\cnatale\Claudio\ranking-electro"
GIT_INDEX       = r"C:\Users\cnatale\Claudio\ranking-electro\index.html"
TOP_N           = 20

today     = datetime.now().date()
yesterday = today - timedelta(days=1)

# Categorias: key -> (label, color_hex, attr_col_label, attr_fn_name)
CATS = {
    "freidoras":   ("Freidoras de Aire",          "#F97316", "Litros",    "litros"),
    "tv":          ("Televisores",                "#3B82F6", "Pulgadas",  "pulgadas"),
    "heladeras":   ("Heladeras",                  "#06B6D4", "Litros",    "litros"),
    "lavarropas":  ("Lavarropas",                 "#14B8A6", "Capacidad", "kg"),
    "aires":       ("Aires Acondicionados",        "#6366F1", "Frigorias", "frigorias"),
    "pavas":       ("Pavas",                       "#EAB308", "Litros",    "litros"),
    "cafeteras":   ("Cafeteras",                   "#92400E", "Tipo",      "agg3"),
    "licuadoras":  ("Licuadoras",                  "#EC4899", "Litros",    "litros"),
    "aspiradoras": ("Aspiradoras",                 "#8B5CF6", "Tipo",      "agg3"),
    "robot_vac":   ("Aspiradoras Robot",           "#10B981", "Tipo",      "agg3"),
    "notebooks":   ("Notebooks",                   "#0EA5E9", "Pulgadas",  "pulgadas"),
    "cortadoras":  ("Cort. / Afeit. / Trimmers",  "#F43F5E", "Tipo",      "agg3"),
    "planchitas":  ("Planchitas de Pelo",          "#A855F7", "Tipo",      "agg3"),
    "secadores":   ("Secadores de Pelo",           "#FB923C", "Tipo",      "agg3"),
    "cepillos":    ("Cepillos Eléctricos",         "#34D399", "Tipo",      "agg3"),
    "kits":        ("Kits de Artefactos",          "#64748B", "Tipo",      "agg3"),
    "colchones":   ("Colchones",                   "#78716C", "Tipo",      "agg3"),
}

DOMAIN_IDS = {
    "freidoras":   "AIR_FRYERS",
    "tv":          "TELEVISIONS",
    "heladeras":   "REFRIGERATORS",
    "lavarropas":  "WASHING_MACHINES",
    "aires":       "AIR_CONDITIONERS",
    "pavas":       "ELECTRIC_JUGS",
    "cafeteras":   "ELECTRIC_COFFEE_MAKERS",
    "licuadoras":  "BLENDERS",
    "aspiradoras": "VACUUM_AND_STEAM_CLEANERS",
    "robot_vac":   "ROBOT_VACUUMS",
    "notebooks":   "NOTEBOOKS",
    "cortadoras":  "HAIR_CLIPPERS_ELECTRIC_SHAVERS_AND_HAIR_TRIMMERS",
    "planchitas":  "HAIR_STRAIGHTENERS",
    "secadores":   "HAIR_DRYERS",
    "cepillos":    "ELECTRIC_HAIR_BRUSHES",
    "kits":        "HAIR_APPLIANCE_KITS",
    "colchones":   "MATTRESSES",
}

# ── Attribute extractors ────────────────────────────────────────────────────────
_RE_LITROS    = re.compile(r'(\d+(?:[.,]\d+)?)\s*(?:litros?|lts?\.?|l\b)', re.I)
_RE_PULGADAS  = re.compile(r'(\d{2,3})\s*(?:pulgadas?|["\u201d]|\'\')', re.I)
_RE_KG        = re.compile(r'(\d+(?:[.,]\d+)?)\s*(?:kg|kgs?|kilos?)', re.I)
_RE_FRIG      = re.compile(r'(\d{1,3}\.?\d*)\s*(?:frigor[ií]as?|frig\.?)', re.I)
_RE_BTU       = re.compile(r'(\d{4,6})\s*btu', re.I)

def extract_attr(fn_name, titulo, agg3=""):
    t = str(titulo or "")
    if fn_name == "litros":
        m = _RE_LITROS.search(t)
        return f"{float(m.group(1).replace(',','.')):g} L" if m else "-"
    if fn_name == "pulgadas":
        m = _RE_PULGADAS.search(t)
        return f"{m.group(1)}\"" if m else "-"
    if fn_name == "kg":
        m = _RE_KG.search(t)
        return f"{float(m.group(1).replace(',','.')):g} kg" if m else "-"
    if fn_name == "frigorias":
        m = _RE_FRIG.search(t)
        if m: return f"{m.group(1)} frig."
        m = _RE_BTU.search(t)
        return f"{m.group(1)} BTU" if m else "-"
    if fn_name == "agg3":
        return str(agg3 or "-")[:30]
    return "-"

# ── SQL helpers ────────────────────────────────────────────────────────────────
_CAT_CASE_BATCH = """CASE
      WHEN ORD_ITEM_VERTICAL.DOM_DOMAIN_ID = 'AIR_FRYERS'                THEN 'freidoras'
      WHEN ORD_ITEM_VERTICAL.DOM_DOMAIN_ID = 'TELEVISIONS'               THEN 'tv'
      WHEN ORD_ITEM_VERTICAL.DOM_DOMAIN_ID = 'REFRIGERATORS'             THEN 'heladeras'
      WHEN ORD_ITEM_VERTICAL.DOM_DOMAIN_ID = 'WASHING_MACHINES'          THEN 'lavarropas'
      WHEN ORD_ITEM_VERTICAL.DOM_DOMAIN_ID = 'AIR_CONDITIONERS'          THEN 'aires'
      WHEN ORD_ITEM_VERTICAL.DOM_DOMAIN_ID = 'ELECTRIC_JUGS'             THEN 'pavas'
      WHEN ORD_ITEM_VERTICAL.DOM_DOMAIN_ID = 'ELECTRIC_COFFEE_MAKERS'    THEN 'cafeteras'
      WHEN ORD_ITEM_VERTICAL.DOM_DOMAIN_ID = 'BLENDERS'                                    THEN 'licuadoras'
      WHEN ORD_ITEM_VERTICAL.DOM_DOMAIN_ID = 'MIXERS'                                      THEN 'licuadoras'
      WHEN ORD_ITEM_VERTICAL.DOM_DOMAIN_ID = 'VACUUM_AND_STEAM_CLEANERS'                   THEN 'aspiradoras'
      WHEN ORD_ITEM_VERTICAL.DOM_DOMAIN_ID = 'ROBOT_VACUUMS'                               THEN 'robot_vac'
      WHEN ORD_ITEM_VERTICAL.DOM_DOMAIN_ID = 'NOTEBOOKS'                                   THEN 'notebooks'
      WHEN ORD_ITEM_VERTICAL.DOM_DOMAIN_ID = 'HAIR_CLIPPERS_ELECTRIC_SHAVERS_AND_HAIR_TRIMMERS' THEN 'cortadoras'
      WHEN ORD_ITEM_VERTICAL.DOM_DOMAIN_ID = 'HAIR_STRAIGHTENERS'                          THEN 'planchitas'
      WHEN ORD_ITEM_VERTICAL.DOM_DOMAIN_ID = 'HAIR_DRYERS'                                 THEN 'secadores'
      WHEN ORD_ITEM_VERTICAL.DOM_DOMAIN_ID = 'ELECTRIC_HAIR_BRUSHES'                       THEN 'cepillos'
      WHEN ORD_ITEM_VERTICAL.DOM_DOMAIN_ID = 'HAIR_APPLIANCE_KITS'                         THEN 'kits'
      WHEN ORD_ITEM_VERTICAL.DOM_DOMAIN_ID = 'MATTRESSES'                                  THEN 'colchones'
    END"""

_CAT_CASE_NRT = """CASE
      WHEN DOM_DOMAIN_ID = 'AIR_FRYERS'                THEN 'freidoras'
      WHEN DOM_DOMAIN_ID = 'TELEVISIONS'               THEN 'tv'
      WHEN DOM_DOMAIN_ID = 'REFRIGERATORS'             THEN 'heladeras'
      WHEN DOM_DOMAIN_ID = 'WASHING_MACHINES'          THEN 'lavarropas'
      WHEN DOM_DOMAIN_ID = 'AIR_CONDITIONERS'          THEN 'aires'
      WHEN DOM_DOMAIN_ID = 'ELECTRIC_JUGS'             THEN 'pavas'
      WHEN DOM_DOMAIN_ID = 'ELECTRIC_COFFEE_MAKERS'    THEN 'cafeteras'
      WHEN DOM_DOMAIN_ID = 'BLENDERS'                                         THEN 'licuadoras'
      WHEN DOM_DOMAIN_ID = 'MIXERS'                                           THEN 'licuadoras'
      WHEN DOM_DOMAIN_ID = 'VACUUM_AND_STEAM_CLEANERS'                        THEN 'aspiradoras'
      WHEN DOM_DOMAIN_ID = 'ROBOT_VACUUMS'                                    THEN 'robot_vac'
      WHEN DOM_DOMAIN_ID = 'NOTEBOOKS'                                        THEN 'notebooks'
      WHEN DOM_DOMAIN_ID = 'HAIR_CLIPPERS_ELECTRIC_SHAVERS_AND_HAIR_TRIMMERS' THEN 'cortadoras'
      WHEN DOM_DOMAIN_ID = 'HAIR_STRAIGHTENERS'                               THEN 'planchitas'
      WHEN DOM_DOMAIN_ID = 'HAIR_DRYERS'                                      THEN 'secadores'
      WHEN DOM_DOMAIN_ID = 'ELECTRIC_HAIR_BRUSHES'                            THEN 'cepillos'
      WHEN DOM_DOMAIN_ID = 'HAIR_APPLIANCE_KITS'                              THEN 'kits'
      WHEN DOM_DOMAIN_ID = 'MATTRESSES'                                       THEN 'colchones'
    END"""

_DOMAIN_FILTER = """(
      ORD_ITEM_VERTICAL.DOM_DOMAIN_ID IN (
        'AIR_FRYERS','TELEVISIONS','REFRIGERATORS','WASHING_MACHINES','AIR_CONDITIONERS',
        'ELECTRIC_JUGS','ELECTRIC_COFFEE_MAKERS','BLENDERS','MIXERS',
        'VACUUM_AND_STEAM_CLEANERS','ROBOT_VACUUMS','NOTEBOOKS',
        'HAIR_CLIPPERS_ELECTRIC_SHAVERS_AND_HAIR_TRIMMERS','HAIR_STRAIGHTENERS',
        'HAIR_DRYERS','ELECTRIC_HAIR_BRUSHES','HAIR_APPLIANCE_KITS','MATTRESSES'
      )
    )"""

_DOMAIN_FILTER_NRT = """(
      DOM_DOMAIN_ID IN (
        'AIR_FRYERS','TELEVISIONS','REFRIGERATORS','WASHING_MACHINES','AIR_CONDITIONERS',
        'ELECTRIC_JUGS','ELECTRIC_COFFEE_MAKERS','BLENDERS','MIXERS',
        'VACUUM_AND_STEAM_CLEANERS','ROBOT_VACUUMS','NOTEBOOKS',
        'HAIR_CLIPPERS_ELECTRIC_SHAVERS_AND_HAIR_TRIMMERS','HAIR_STRAIGHTENERS',
        'HAIR_DRYERS','ELECTRIC_HAIR_BRUSHES','HAIR_APPLIANCE_KITS','MATTRESSES'
      )
    )"""

def sql_batch(fecha: str) -> str:
    return f"""
WITH raw AS (
  SELECT
    {_CAT_CASE_BATCH}                                                AS cat,
    ITE_ITEM_ID                                                       AS item_id,
    MAX(ORD_ITEM.TITLE)                                              AS titulo,
    MAX(BRAND)                                                        AS brand,
    MAX(ORD_OWN.SUB_COMBO)                                          AS subcombo,
    MAX(ORD_ITEM_VERTICAL.DOM_DOMAIN_AGG3)                          AS agg3,
    SUM(ORD_METRICS.TSI)                                              AS nsi,
    ROUND(SUM(ORD_METRICS.TGMV_LC) / NULLIF(SUM(ORD_METRICS.TSI),0)) AS precio
  FROM `{BQ_BATCH}`
  WHERE SIT_SITE_ID          = 'MLA'
    AND ORD_STATUS           = 'paid'
    AND ORD_FLAGS.ORD_TGMV_FLG = TRUE
    AND ORD_LOCALTIME.FECHA_DT = DATE('{fecha}')
    AND {_DOMAIN_FILTER}
  GROUP BY cat, item_id
  HAVING cat IS NOT NULL
),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY cat ORDER BY nsi DESC) AS rn
  FROM raw
)
SELECT * EXCEPT(rn) FROM ranked WHERE rn <= {TOP_N}
ORDER BY cat, nsi DESC
"""

def sql_nrt(fecha: str) -> str:
    return f"""
WITH raw AS (
  SELECT
    {_CAT_CASE_NRT}                                                  AS cat,
    ITE_ITEM_ID                                                       AS item_id,
    MAX(ITEM_TITLE)                                                   AS titulo,
    MAX(SUB_COMBO)                                                    AS subcombo,
    MAX(DOM_DOMAIN_AGG3)                                              AS agg3,
    SUM(TSI)                                                          AS nsi,
    ROUND(SUM(TGMV_LC) / NULLIF(SUM(TSI), 0))                       AS precio
  FROM `{BQ_NRT}`
  WHERE SIT_SITE_ID        = 'MLA'
    AND ORD_TGMV_FLG       = TRUE
    AND FECHA_LOCALTIME     = DATE('{fecha}')
    AND {_DOMAIN_FILTER_NRT}
  GROUP BY cat, item_id
  HAVING cat IS NOT NULL
),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY cat ORDER BY nsi DESC) AS rn
  FROM raw
)
SELECT * EXCEPT(rn) FROM ranked WHERE rn <= {TOP_N}
ORDER BY cat, nsi DESC
"""

# ── BQ runner ─────────────────────────────────────────────────────────────────
def run_query(client, sql, label):
    print(f"  [{label}]...", end=" ", flush=True)
    try:
        df = client.query(sql, project=BILLING_PROJECT).to_dataframe()
        print(f"OK ({len(df)} filas)")
        return df
    except Exception as e:
        print(f"ERROR: {e}")
        import pandas as pd
        return pd.DataFrame()

# ── Format helpers ─────────────────────────────────────────────────────────────
def fmt_precio(val):
    try:    return "$ " + f"{int(val):,}".replace(",", ".")
    except: return "-"

def fmt_nsi(val):
    try:    return f"{int(val):,}".replace(",", ".")
    except: return str(val)

def rank_delta(current_rank, other_rank):
    if other_rank is None:
        return '<span class="badge-new">NEW</span>'
    delta = other_rank - current_rank
    if delta > 0:  return f'<span class="up">&#9650; {delta}</span>'
    if delta < 0:  return f'<span class="dn">&#9660; {abs(delta)}</span>'
    return '<span class="eq">&#8212;</span>'

# ── HTML table builder ─────────────────────────────────────────────────────────
def build_table(df_main, df_other, cat_key, brand_lookup=None):
    """
    df_main  : DataFrame del panel que se muestra (ayer o hoy)
    df_other : DataFrame del otro panel (para delta de ranking)
    cat_key  : clave de CATS
    brand_lookup : dict {item_id: brand} para complementar NRT que no tiene brand
    """
    import pandas as pd
    cat_label, color, attr_label, attr_fn = CATS[cat_key]

    if df_main is None or df_main.empty:
        return '<tr><td colspan="9" class="empty">Sin datos para esta fecha</td></tr>', False

    # Filtrar por categoria
    dm = df_main[df_main["cat"] == cat_key].copy() if "cat" in df_main.columns else df_main.copy()
    do = df_other[df_other["cat"] == cat_key].copy() if df_other is not None and not df_other.empty and "cat" in df_other.columns else pd.DataFrame()

    if dm.empty:
        return '<tr><td colspan="9" class="empty">Sin datos para esta fecha</td></tr>', False

    # Ranks del otro panel
    other_ranks = {}
    if not do.empty:
        for i, (_, r) in enumerate(do.iterrows(), 1):
            other_ranks[r["item_id"]] = i

    rows = []
    for rank, (_, row) in enumerate(dm.iterrows(), 1):
        bg = "#fafafa" if rank % 2 == 0 else "#fff"
        titulo = str(row.get("titulo") or "")
        agg3   = str(row.get("agg3") or "")

        # Brand: batch tiene brand; NRT no -> buscar en lookup
        brand = str(row.get("brand") or "")
        if not brand and brand_lookup:
            brand = brand_lookup.get(row["item_id"], "")

        attr   = extract_attr(attr_fn, titulo, agg3)
        precio = fmt_precio(row.get("precio"))
        nsi    = fmt_nsi(row.get("nsi"))
        delta  = rank_delta(rank, other_ranks.get(row["item_id"]))
        sub    = str(row.get("subcombo") or "-") or "-"

        rows.append(f"""<tr style="background:{bg}">
          <td class="col-rank">{rank}</td>
          <td class="col-id">MLA{row['item_id']}</td>
          <td class="col-titulo">{titulo[:80]}</td>
          <td class="col-ctr">{brand}</td>
          <td class="col-ctr">{attr}</td>
          <td class="col-num">{precio}</td>
          <td class="col-ctr">{sub}</td>
          <td class="col-num">{nsi}</td>
          <td class="col-ctr">{delta}</td>
        </tr>""")

    return "\n".join(rows), True

# ── Full HTML ──────────────────────────────────────────────────────────────────
def build_html(df_ayer, df_hoy):
    generated  = datetime.now().strftime("%d/%m/%Y %H:%M")
    hoy_label  = today.strftime("%d/%m/%Y")
    ayer_label = yesterday.strftime("%d/%m/%Y")

    # Brand lookup from ayer (batch has brand; NRT doesn't)
    brand_lookup = {}
    if df_ayer is not None and not df_ayer.empty and "brand" in df_ayer.columns:
        for _, row in df_ayer.iterrows():
            iid = row.get("item_id")
            br  = str(row.get("brand") or "")
            if iid and br:
                brand_lookup[iid] = br

    # Build tabs HTML
    tab_btns  = ""
    tab_panels = ""
    first = True
    for cat_key, (cat_label, color, attr_label, attr_fn) in CATS.items():
        active_cls = "active" if first else ""
        first_tab_cls = f' style="border-bottom-color:{color};color:{color};"' if first else ""

        rows_a, has_a = build_table(df_ayer, df_hoy,  cat_key, None)
        rows_h, has_h = build_table(df_hoy,  df_ayer, cat_key, brand_lookup)

        thead = f"""<tr>
          <th class="col-rank">#</th>
          <th>Item ID</th>
          <th>Titulo</th>
          <th class="col-ctr">Brand</th>
          <th class="col-ctr">{attr_label}</th>
          <th class="col-num">Precio</th>
          <th class="col-ctr">Subcombo</th>
          <th class="col-num">NSI (u.)</th>
          <th class="col-ctr">vs Dia ant.</th>
        </tr>"""

        tab_btns += f'<button class="tab-btn {active_cls}" data-cat="{cat_key}" data-color="{color}" onclick="switchTab(this)">{cat_label}</button>\n'

        tab_panels += f"""
        <div id="panel-{cat_key}" class="cat-panel {'active' if active_cls else ''}">
          <div class="day-bar">
            <button class="day-btn active" onclick="switchDay(this, '{cat_key}', 'ayer')">
              Ayer <span class="date-tag">{ayer_label}</span>
            </button>
            <button class="day-btn" onclick="switchDay(this, '{cat_key}', 'hoy')">
              Hoy <span class="date-tag">{hoy_label}</span>
            </button>
          </div>
          <div id="{cat_key}-ayer" class="day-panel active">
            <div class="card"><table><thead>{thead}</thead><tbody>{rows_a}</tbody></table></div>
          </div>
          <div id="{cat_key}-hoy" class="day-panel">
            <div class="card"><table><thead>{thead}</thead><tbody>{rows_h}</tbody></table></div>
          </div>
        </div>"""

        first = False

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ranking Electro Diario — MLA</title>
<style>
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: 'Segoe UI', Arial, sans-serif;
    background: #f0f0f0;
    color: #222;
    min-height: 100vh;
  }}
  .header {{
    background: linear-gradient(135deg, #FFE600 0%, #FFC107 100%);
    padding: 20px 32px 18px;
    border-bottom: 3px solid #d4a900;
  }}
  .header h1 {{ font-size: 20px; font-weight: 700; color: #1a1a1a; }}
  .header p  {{ font-size: 11px; color: #666; margin-top: 4px; }}

  /* Categoria tabs */
  .cat-tabs {{
    background: #fff;
    border-bottom: 1px solid #e5e5e5;
    padding: 0 24px;
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    overflow-x: auto;
  }}
  .tab-btn {{
    padding: 13px 18px;
    font-size: 13px;
    font-weight: 600;
    border: none;
    border-bottom: 3px solid transparent;
    background: none;
    color: #888;
    cursor: pointer;
    white-space: nowrap;
    transition: all .15s;
  }}
  .tab-btn:hover  {{ color: #333; }}
  .tab-btn.active {{ color: #333; }}

  .cat-panel {{ display: none; padding: 20px 24px; }}
  .cat-panel.active {{ display: block; }}

  /* Day toggle */
  .day-bar {{
    display: flex;
    gap: 10px;
    margin-bottom: 14px;
    align-items: center;
  }}
  .day-btn {{
    padding: 8px 22px;
    font-size: 13px;
    font-weight: 600;
    border: 2px solid #ddd;
    border-radius: 8px;
    cursor: pointer;
    background: #fff;
    color: #888;
    transition: all .15s;
  }}
  .day-btn.active {{
    background: #FFE600;
    border-color: #d4a900;
    color: #1a1a1a;
    box-shadow: 0 2px 8px rgba(0,0,0,.10);
  }}
  .date-tag {{
    display: inline-block;
    background: rgba(0,0,0,.08);
    border-radius: 20px;
    padding: 1px 8px;
    font-size: 10px;
    font-weight: 400;
    margin-left: 4px;
  }}

  .day-panel {{ display: none; }}
  .day-panel.active {{ display: block; }}

  /* Table */
  .card {{
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,.07);
    overflow: hidden;
    overflow-x: auto;
  }}
  table {{ width: 100%; border-collapse: collapse; min-width: 860px; font-size: 12px; }}
  thead tr {{ background: #1a1a1a; }}
  thead th {{
    padding: 10px 11px;
    text-align: left;
    font-size: 10px;
    letter-spacing: .5px;
    text-transform: uppercase;
    color: #FFE600;
    font-weight: 700;
    white-space: nowrap;
  }}
  thead th.col-rank {{ text-align: center; width: 28px; }}
  thead th.col-num  {{ text-align: right; }}
  thead th.col-ctr  {{ text-align: center; }}
  tbody td {{ padding: 9px 11px; border-bottom: 1px solid #eee; }}
  tbody tr:last-child td {{ border-bottom: none; }}
  .col-rank {{ text-align: center; color: #aaa; font-weight: 600; }}
  .col-id   {{ font-family: monospace; font-size: 11px; color: #888; }}
  .col-ctr  {{ text-align: center; }}
  .col-num  {{ text-align: right; font-weight: 700; }}
  .col-titulo {{ max-width: 320px; }}
  .empty    {{ text-align: center; color: #aaa; padding: 28px; font-size: 13px; }}

  /* Rank delta */
  .up         {{ color: #16A34A; font-weight: 700; }}
  .dn         {{ color: #DC2626; font-weight: 700; }}
  .eq         {{ color: #aaa; }}
  .badge-new  {{ background: #3B82F6; color: #fff; border-radius: 4px;
                padding: 1px 6px; font-size: 10px; font-weight: 700; }}
  .footer {{
    text-align: center; padding: 20px;
    font-size: 11px; color: #bbb;
  }}
</style>
</head>
<body>

<div class="header">
  <h1>Ranking Electro Diario &mdash; MLA</h1>
  <p>Top {TOP_N} items por NSI &nbsp;&middot;&nbsp; Ayer: BT_ORDERS_MLA (batch) &nbsp;|&nbsp; Hoy: BT_ORDERS_MLA_NRT &nbsp;&middot;&nbsp; Generado: {generated}</p>
</div>

<div class="cat-tabs">
{tab_btns}
</div>

{tab_panels}

<div class="footer">Planning &amp; Analytics &middot; MercadoLibre Argentina</div>

<script>
function switchTab(btn) {{
  document.querySelectorAll('.tab-btn').forEach(b => {{
    b.classList.remove('active');
    b.style.borderBottomColor = 'transparent';
    b.style.color = '';
  }});
  document.querySelectorAll('.cat-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  btn.style.borderBottomColor = btn.dataset.color;
  btn.style.color = btn.dataset.color;
  document.getElementById('panel-' + btn.dataset.cat).classList.add('active');
}}

function switchDay(btn, cat, day) {{
  var panel = document.getElementById('panel-' + cat);
  panel.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
  panel.querySelectorAll('.day-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(cat + '-' + day).classList.add('active');
}}

// Set active color on first tab
(function() {{
  var first = document.querySelector('.tab-btn');
  if (first) {{
    first.style.borderBottomColor = first.dataset.color;
    first.style.color = first.dataset.color;
  }}
}})();
</script>

</body>
</html>"""

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("Ranking Electro Diario - MLA")
    print(f"Fecha: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print(f"Ayer: {yesterday}  |  Hoy: {today}")
    print("=" * 60)

    client = bigquery.Client(project=BILLING_PROJECT)

    print("\nEjecutando queries BigQuery...")
    df_ayer = run_query(client, sql_batch(str(yesterday)), f"Ayer {yesterday} (batch)")
    df_hoy  = run_query(client, sql_nrt(str(today)),      f"Hoy  {today}  (NRT)")

    print("\nGenerando HTML...")
    html = build_html(df_ayer, df_hoy)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"\nListo: {OUTPUT_FILE}")

    # Publicar en GitHub Pages
    import shutil, subprocess
    shutil.copy2(OUTPUT_FILE, GIT_INDEX)
    ts = datetime.now().strftime("%d/%m/%Y %H:%M")
    subprocess.run(["git", "-C", GIT_REPO, "add", "index.html"], check=True)
    result = subprocess.run(["git", "-C", GIT_REPO, "diff", "--cached", "--quiet"])
    if result.returncode != 0:
        subprocess.run(["git", "-C", GIT_REPO, "commit", "-m", f"update {ts}"], check=True)
        subprocess.run(["git", "-C", GIT_REPO, "push"], check=True)
        print(f"Publicado en GitHub Pages ({ts})")
    else:
        print("Sin cambios para publicar.")

    import webbrowser
    webbrowser.open(f"file:///{OUTPUT_FILE.replace(os.sep, '/')}")

if __name__ == "__main__":
    main()
