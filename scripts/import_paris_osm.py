#!/usr/bin/env python3
import json, re, time
from pathlib import Path
import requests

OVERPASS = "https://overpass-api.de/api/interpreter"
QUERY = r"""
[out:json][timeout:120];
area(3600007444)->.paris;
(
  nwr["shop"="bakery"](area.paris);
  nwr["shop"="pastry"](area.paris);
);
out center tags;
"""

def arrondissement(postcode):
    if not postcode:
        return None
    m = re.match(r"75(?:0|1)(\d{2})$", str(postcode))
    if not m:
        return None
    n = int(m.group(1))
    return n if 1 <= n <= 20 else None

def address(tags):
    house = tags.get("addr:housenumber", "")
    street = tags.get("addr:street", "")
    pc = tags.get("addr:postcode", "")
    city = tags.get("addr:city", "Paris")
    first = " ".join(x for x in [house, street] if x).strip()
    second = " ".join(x for x in [pc, city] if x).strip()
    return ", ".join(x for x in [first, second] if x) or "Paris"

def coords(e):
    if "lat" in e and "lon" in e:
        return e["lat"], e["lon"]
    c = e.get("center") or {}
    return c.get("lat"), c.get("lon")

def main():
    r = requests.post(
        OVERPASS,
        data={"data": QUERY},
        timeout=150,
        headers={"User-Agent": "eclair-paris/1.0 (GitHub public dataset refresh)"}
    )
    r.raise_for_status()
    raw = r.json()
    rows = []
    for e in raw.get("elements", []):
        tags = e.get("tags", {})
        lat, lon = coords(e)
        if lat is None or lon is None:
            continue
        name = tags.get("name") or tags.get("brand")
        if not name:
            continue
        pc = tags.get("addr:postcode")
        rows.append({
            "catalog_id": f"osm:{e['type']}:{e['id']}",
            "osm_type": e["type"],
            "osm_id": e["id"],
            "name": name,
            "address": address(tags),
            "postal_code": pc,
            "arrondissement": arrondissement(pc),
            "latitude": lat,
            "longitude": lon,
            "type": "patisserie" if tags.get("shop") == "pastry" else "boulangerie",
            "website": tags.get("website") or tags.get("contact:website"),
            "phone": tags.get("phone") or tags.get("contact:phone"),
            "opening_hours": tags.get("opening_hours"),
            "availability_status": "unknown",
            "source_url": f"https://www.openstreetmap.org/{e['type']}/{e['id']}",
            "source": "OpenStreetMap"
        })
    rows.sort(key=lambda x: (x.get("arrondissement") or 99, x["name"].lower()))
    out = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "OpenStreetMap via Overpass API",
        "license": "ODbL",
        "count": len(rows),
        "establishments": rows
    }
    path = Path("data/paris_shops.json")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(rows)} establishments to {path}")

if __name__ == "__main__":
    main()
