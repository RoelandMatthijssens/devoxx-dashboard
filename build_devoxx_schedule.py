#!/usr/bin/env python3
"""Build self-contained Devoxx Belgium schedules from public Devoxx data."""
import argparse, csv, json
from pathlib import Path
from urllib.request import Request, urlopen

KEY = "AIzaSyCYchLM8E9V0bpMiwIdAuNdzM5OjihdU8g"
BASE = "https://firestore.googleapis.com/v1/projects/cfp-dev-mobile-app/databases/(default)/documents"

def get(path):
    req = Request(f"{BASE}/{path}?pageSize=1000&key={KEY}", headers={"User-Agent": "DevoxxScheduleArchive/1.0"})
    with urlopen(req) as r:
        return json.load(r)

def dec(v):
    for k in ("stringValue", "timestampValue", "booleanValue", "doubleValue", "nullValue"):
        if k in v: return v[k]
    if "integerValue" in v: return int(v["integerValue"])
    if "arrayValue" in v: return [dec(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v: return {k: dec(x) for k, x in v["mapValue"].get("fields", {}).items()}

def doc(d): return {k: dec(v) for k, v in d.get("fields", {}).items()}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("year", nargs="?", type=int, default=2025)
    args = parser.parse_args()
    slug = f"dvbe{str(args.year)[-2:]}"
    out = Path(f"devoxx-belgium-{args.year}-schedule.html")
    days_raw = [doc(x) for x in get(f"scheduleSlots/{slug}/days")["documents"]]
    talks = [doc(x) for x in get(f"talks/{slug}/items")["documents"]]
    slides_file = Path(__file__).with_name("devoxx_slides.json")
    slides = json.loads(slides_file.read_text()).get(str(args.year), {}) if slides_file.exists() else {}
    ratings = {}
    ratings_file = Path(__file__).with_name(f"devoxx{args.year}-2cents(Talks).csv")
    if ratings_file.exists():
        with ratings_file.open(encoding="utf-8", errors="replace", newline="") as f:
            for row in csv.DictReader(f):
                title = row.get("Title", "").strip()
                if title and row.get("Avg rating", "").strip():
                    ratings[title] = {"rating": float(row["Avg rating"]), "reviews": int(row["# Reviews"])}
    details = {str(t.get("id")): t for t in talks}
    days = []
    for d in days_raw:
        slots = []
        for s in d["slots"]:
            t = s.get("talk") or s.get("proposal")
            if t:
                full = details.get(str(t.get("id")), {})
                t["youtubeUrl"] = full.get("youtubeUrl", "")
                t["description"] = full.get("description", "")
                # Public Devoxx attendee bookmarks.
                t["totalFavourites"] = full.get("totalFavourites", 0)
                t["slidesUrl"] = slides.get(t.get("title", ""), "")
                t["teamRating"] = ratings.get(t.get("title", ""))
            slots.append({"from": s["fromDate"], "to": s["toDate"], "room": s.get("roomName", ""),
                          "kind": s.get("sessionType", {}).get("name", "Session"), "pause": s.get("sessionType", {}).get("pause", False),
                          "talk": t})
        days.append({"name": d["day"].title(), "date": slots[0]["from"][:10], "slots": slots})
    days.sort(key=lambda d: d["date"])
    data = json.dumps(days, ensure_ascii=False).replace("</", "<\\/")
    template = Path(__file__).with_name("devoxx_schedule_template.html").read_text()
    page = template.replace("/*__DATA__*/", data)
    page = page.replace("Devoxx Belgium 2025", f"Devoxx Belgium {args.year}")
    page = page.replace("October 6–10", f"October {int(days[0]['date'][8:])}–{int(days[-1]['date'][8:])}")
    page = page.replace("devoxx-belgium-2025-seen", f"devoxx-belgium-{args.year}-seen")
    out.write_text(page, encoding="utf-8")
    print(f"Wrote {out} ({sum(len(d['slots']) for d in days)} scheduled items, {len(talks)} talks, {sum(bool(t.get('youtubeUrl')) for t in talks)} videos)")

if __name__ == "__main__": main()
