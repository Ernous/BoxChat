import sqlite3, json

p = 'thecomboxmsgr.db'
con = sqlite3.connect(p)
cur = con.cursor()

tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").fetchall()]
out = {}

for t in tables:
    cols = cur.execute(f"PRAGMA table_info({t})").fetchall()
    idx = cur.execute(f"PRAGMA index_list({t})").fetchall()
    out[t] = {
        'columns': [{'cid': c[0], 'name': c[1], 'type': c[2], 'notnull': c[3], 'dflt': c[4], 'pk': c[5]} for c in cols],
        'indexes': [{'seq': i[0], 'name': i[1], 'unique': i[2], 'origin': i[3], 'partial': i[4]} for i in idx],
    }

print(json.dumps(out, indent=2, ensure_ascii=False))
