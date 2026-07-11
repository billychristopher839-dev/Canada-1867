#!/usr/bin/env python3
"""Parse canada_trivia.md and canada_pm_milestones.md into js/data.js"""
import re, json, random

random.seed(1867)

TRIVIA = "/mnt/user-data/uploads/canada_trivia.md"
MILES = "/mnt/user-data/uploads/canada_pm_milestones.md"

# ---------- Parse trivia ----------
questions = []
part = None
section = None
with open(TRIVIA, encoding="utf-8") as f:
    lines = f.read().splitlines()

i = 0
qre = re.compile(r"^\*\*Q(\d+):\*\*\s*(.+)$")
are = re.compile(r"^\*\*A:\*\*\s*(.+)$")
while i < len(lines):
    ln = lines[i].strip()
    if ln.startswith("# PART"):
        part = ln.split("—")[-1].strip().title()
    elif ln.startswith("### "):
        section = ln[4:].strip()
    else:
        m = qre.match(ln)
        if m:
            qnum = int(m.group(1))
            qtext = m.group(2).strip()
            # find answer line (next non-empty)
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            am = are.match(lines[j].strip())
            assert am, f"No answer for Q{qnum} at line {j}: {lines[j]}"
            questions.append({
                "n": qnum, "q": qtext, "a": am.group(1).strip(),
                "part": part, "sec": section
            })
            i = j
    i += 1

assert len(questions) == 622, f"got {len(questions)} questions"
assert [q["n"] for q in questions] == list(range(1, 623))

# ---------- Distractor generation ----------
PROVINCES = {"ontario","quebec","nova scotia","new brunswick","manitoba","british columbia",
             "prince edward island","saskatchewan","alberta","newfoundland","newfoundland and labrador",
             "yukon","northwest territories","nunavut"}

def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()

def answer_type(a):
    la = norm(a)
    if re.fullmatch(r"(about |approximately |roughly )?(1[6-9]\d\d|20[0-2]\d)([ –-]+(1[6-9]\d\d|20[0-2]\d|\d\d))?", la):
        return "year"
    if la in PROVINCES:
        return "province"
    if re.search(r"^(sir |lord )", a.lower()) or re.search(r"\b(macdonald|laurier|borden|mackenzie king|diefenbaker|pearson|trudeau|mulroney|chr[ée]tien|harper|carney|riel|cartier|champlain|cabot|secord|brant|dumont|poundmaker|tecumseh|brock|howe|banting|bethune|mcclung|murphy|casgrain|douglas|l[ée]vesque|bourassa|duplessis|smallwood|bennett|meighen|abbott|thompson|bowell|tupper|st\. laurent|clark|turner|campbell|martin)\b", a.lower()):
        return "person"
    if re.fullmatch(r"(about |approximately |roughly |over |around )?[\d,.]+( ?(%|percent|per cent|million|billion|km|kilometres|kilometers|years?|seats?|percent))?.*", la) and re.match(r"^(about|approximately|roughly|over|around)?\s*[\d,.]", la):
        return "number"
    return "text"

by_type = {}
by_sec = {}
for q in questions:
    t = answer_type(q["a"])
    q["_t"] = t
    by_type.setdefault(t, []).append(q)
    by_sec.setdefault(q["sec"], []).append(q)

def pick_distractors(q, k=3):
    correct = norm(q["a"])
    seen = {correct}
    out = []
    # candidate pools in priority order
    pools = []
    t = q["_t"]
    if t in ("year", "province", "person", "number"):
        # same type AND same section first, then same type anywhere
        pools.append([c for c in by_sec[q["sec"]] if c["_t"] == t and c["n"] != q["n"]])
        pools.append([c for c in by_type[t] if c["n"] != q["n"]])
    # same section (any type), then same part — but never mix bare years/numbers into text questions
    def ok(c):
        return t == c["_t"] or (t not in ("year","number") and c["_t"] not in ("year","number"))
    pools.append([c for c in by_sec[q["sec"]] if c["n"] != q["n"] and ok(c)])
    pools.append([c for c in questions if c["part"] == q["part"] and c["n"] != q["n"] and ok(c)])
    pools.append([c for c in questions if c["n"] != q["n"] and ok(c)])
    pools.append([c for c in questions if c["n"] != q["n"]])
    for pool in pools:
        pool = pool[:]
        random.shuffle(pool)
        for c in pool:
            na = norm(c["a"])
            if na in seen or not na:
                continue
            # avoid distractors that are substrings of correct or vice versa
            if na in correct or correct in na:
                continue
            seen.add(na)
            out.append(c["a"])
            if len(out) == k:
                return out
    return out

for q in questions:
    q["d"] = pick_distractors(q)
    assert len(q["d"]) == 3, q

# ---------- Parse milestones ----------
pms = []
milestones = []
pm_re = re.compile(r"^## (\d+)\. (.+?) \((.+?)\) — (.+)$")
ms_re = re.compile(r"^- \*\*(\d{4})(?:[–-]\d{2,4})?\*\* — (.+)$")
with open(MILES, encoding="utf-8") as f:
    cur_pm = -1
    for ln in f.read().splitlines():
        ln = ln.strip()
        m = pm_re.match(ln)
        if m:
            pms.append({"num": int(m.group(1)), "name": m.group(2), "party": m.group(3), "term": m.group(4)})
            cur_pm = len(pms) - 1
            continue
        if ln.startswith("## "):  # A Note on Method
            cur_pm = -1
            continue
        m = ms_re.match(ln)
        if m and cur_pm >= 0:
            milestones.append({"year": int(m.group(1)), "text": m.group(2), "pm": cur_pm})

assert len(pms) == 24, len(pms)
assert len(milestones) == 311, len(milestones)

# ---------- Provinces / territories data (authored) ----------
provinces = [
  {"id":"ON","name":"Ontario","type":"Province","capital":"Toronto","joined":1867,
   "motto":"Ut incepit fidelis sic permanet — Loyal she began, loyal she remains",
   "desc":"Canada's most populous province and its economic engine, home to the national capital, Ottawa, and the financial hub of Toronto. One of the four founding provinces of Confederation.",
   "unique":["Ottawa, the national capital, sits on the Ontario side of the Ottawa River","Niagara Falls and the Canadian side's Horseshoe Falls","Produces a large share of Canada's manufacturing output, especially autos","Home to the Toronto Stock Exchange and Bay Street","More than 250,000 lakes — about a fifth of the world's fresh water touches its borders"]},
  {"id":"QC","name":"Quebec","type":"Province","capital":"Quebec City","joined":1867,
   "motto":"Je me souviens — I remember",
   "desc":"The heart of French-speaking North America and a founding province of Confederation. Its distinct language, civil-law tradition, and culture have shaped Canadian politics from 1867 to today.",
   "unique":["The only province with French as its sole official language","Old Quebec is a UNESCO World Heritage site — the only walled city north of Mexico","Produces about 70% of the world's maple syrup","Hydro-Québec's dams make it one of the world's largest hydroelectric producers","Held sovereignty referendums in 1980 and 1995"]},
  {"id":"NS","name":"Nova Scotia","type":"Province","capital":"Halifax","joined":1867,
   "motto":"Munit haec et altera vincit — One defends and the other conquers",
   "desc":"A founding Atlantic province built on the sea: fishing, shipbuilding, and the great harbour of Halifax, long the Royal Navy's key North American base.",
   "unique":["The Bay of Fundy has the highest tides on Earth — up to 16 metres","Halifax was the closest major port to the Titanic sinking; many victims are buried there","The Halifax Explosion of 1917 was the largest man-made blast before the atomic bomb","Cape Breton's Cabot Trail is one of the world's great scenic drives","Birthplace of ice hockey claims and of Confederation critic Joseph Howe"]},
  {"id":"NB","name":"New Brunswick","type":"Province","capital":"Fredericton","joined":1867,
   "motto":"Spem reduxit — Hope restored",
   "desc":"A founding province settled heavily by Loyalists and Acadians, where the Saint John River and the forests drove the timber economy that helped build Confederation.",
   "unique":["Canada's only officially bilingual province (English and French)","Hopewell Rocks are carved by the Bay of Fundy's giant tides","The Reversing Falls in Saint John flow backwards at high tide","Hartland has the world's longest covered bridge (391 m)","Heartland of Acadian culture and the Acadian flag"]},
  {"id":"MB","name":"Manitoba","type":"Province","capital":"Winnipeg","joined":1870,
   "motto":"Gloriosus et liber — Glorious and free",
   "desc":"Created by the Manitoba Act of 1870 after the Red River Resistance led by Louis Riel — the 'postage stamp province' that grew into the keystone of the Prairies.",
   "unique":["Born from Louis Riel's Red River Resistance — Riel is its founding father","Churchill is the 'Polar Bear Capital of the World' and a beluga whale hotspot","Winnipeg's Exchange District and 'Portage and Main', Canada's most famous intersection","Home of the Canadian Mint's coin-producing facility","Lake Winnipeg is one of the largest freshwater lakes on Earth"]},
  {"id":"BC","name":"British Columbia","type":"Province","capital":"Victoria","joined":1871,
   "motto":"Splendor sine occasu — Splendour without diminishment",
   "desc":"The Pacific province that joined Confederation in 1871 on the promise of a transcontinental railway — a promise kept with the Last Spike at Craigellachie in 1885.",
   "unique":["Joined Canada on the condition a railway be built to the Pacific","Vancouver consistently ranks among the world's most livable cities","Home to Canada's largest port and gateway to Asia-Pacific trade","Ancient temperate rainforests and 1,000-year-old cedars","The Kootenays, the Okanagan wine valley, and Whistler's slopes"]},
  {"id":"PE","name":"Prince Edward Island","type":"Province","capital":"Charlottetown","joined":1873,
   "motto":"Parva sub ingenti — The small under the protection of the great",
   "desc":"The 'Cradle of Confederation' — the 1864 Charlottetown Conference launched the union PEI itself only joined in 1873. Canada's smallest province, mightiest in charm.",
   "unique":["Hosted the 1864 Charlottetown Conference that began Confederation","Smallest province by both size and population","Lucy Maud Montgomery's Anne of Green Gables was set here","The 12.9 km Confederation Bridge is the world's longest over ice-covered water","Famous red-sand beaches and world-class potatoes"]},
  {"id":"SK","name":"Saskatchewan","type":"Province","capital":"Regina","joined":1905,
   "motto":"Multis e gentibus vires — From many peoples, strength",
   "desc":"Carved from the Northwest Territories in 1905, the wheat province became the breadbasket of the world — and the birthplace of Canadian medicare under Tommy Douglas.",
   "unique":["Birthplace of universal public healthcare (Tommy Douglas, 1947–1962)","Grows a huge share of the world's durum wheat, lentils, and canola","World's largest potash reserves","RCMP Depot Division in Regina has trained Mounties since 1885","The Arrogant Worms immortalized its 'Last Saskatchewan Pirate'"]},
  {"id":"AB","name":"Alberta","type":"Province","capital":"Edmonton","joined":1905,
   "motto":"Fortis et liber — Strong and free",
   "desc":"Created in 1905 and transformed by the 1947 Leduc oil strike, Alberta is Canada's energy powerhouse — ranchlands, Rockies, and the oil sands.",
   "unique":["The Leduc No. 1 oil strike (1947) launched Canada's modern energy industry","Home of the oil sands, one of the world's largest petroleum deposits","The Calgary Stampede — 'The Greatest Outdoor Show on Earth'","Banff (1885) is Canada's first national park","Dinosaur Provincial Park holds some of the richest fossil beds anywhere"]},
  {"id":"NL","name":"Newfoundland and Labrador","type":"Province","capital":"St. John's","joined":1949,
   "motto":"Quaerite prime regnum Dei — Seek ye first the kingdom of God",
   "desc":"A separate British dominion until it voted to join Canada in 1949 under Joey Smallwood — the last province in, with the oldest European roots of all.",
   "unique":["Last province to join Confederation (March 31, 1949)","L'Anse aux Meadows: the only confirmed Viking site in North America","St. John's is North America's oldest English-founded city","Its own time zone, half an hour ahead of Atlantic time","Gander sheltered 6,600 stranded air passengers on 9/11 ('Come From Away')"]},
  {"id":"YT","name":"Yukon","type":"Territory","capital":"Whitehorse","joined":1898,
   "motto":"Larger than life",
   "desc":"Created in 1898 at the height of the Klondike Gold Rush, when 100,000 stampeders raced for Dawson City's creeks. The land of the midnight sun.",
   "unique":["Born of the Klondike Gold Rush of 1896–1899","Mount Logan (5,959 m) is Canada's highest peak","Midnight sun in summer, aurora borealis in winter","The Yukon Quest, one of the world's toughest sled-dog races","Robert Service wrote 'The Cremation of Sam McGee' here"]},
  {"id":"NT","name":"Northwest Territories","type":"Territory","capital":"Yellowknife","joined":1870,
   "motto":"—",
   "desc":"The vast lands transferred from the Hudson's Bay Company in 1870, from which Manitoba, Saskatchewan, Alberta, Yukon, and Nunavut were all carved.",
   "unique":["Original 1870 territory from which five provinces/territories were carved","Yellowknife is one of the best places on Earth to see the aurora","Great Bear and Great Slave Lakes are among the world's ten largest","Canada's diamond mines made it a top global producer","Eleven official languages — more than anywhere else in Canada"]},
  {"id":"NU","name":"Nunavut","type":"Territory","capital":"Iqaluit","joined":1999,
   "motto":"Nunavut sannginivut — Our land, our strength",
   "desc":"Canada's newest territory, created April 1, 1999 from the eastern Arctic through the largest Indigenous land-claim agreement in Canadian history — an Inuit homeland.",
   "unique":["Created in 1999 through the Nunavut Land Claims Agreement","Means 'Our Land' in Inuktitut; about 85% of residents are Inuit","Covers a fifth of Canada — larger than any other province or territory","Home to Alert, the northernmost permanently inhabited place on Earth","No roads connect its 25 communities; travel is by air and sea"]}
]

# Map milestone index at which each province "joins" the map: first milestone whose year >= joined year
join_ms = {}
for p in provinces:
    for idx, ms in enumerate(milestones):
        if ms["year"] >= p["joined"]:
            join_ms[p["id"]] = idx
            break
for p in provinces:
    p["joinMs"] = join_ms[p["id"]]

tracks = [
 {"src":"assets/audio/01-o-canada.mp3","title":"O Canada (Instrumental)"},
 {"src":"assets/audio/02-maple-leaf-forever.mp3","title":"The Maple Leaf Forever (Instrumental)"},
 {"src":"assets/audio/03-in-canada.mp3","title":"In Canada"},
 {"src":"assets/audio/04-alberta-bound.mp3","title":"Alberta Bound"},
 {"src":"assets/audio/05-are-you-from-bevan.mp3","title":"Are You from Bevan? (BC folk song)"},
 {"src":"assets/audio/06-something-to-sing-about.mp3","title":"Something to Sing About (This Land of Ours)"},
 {"src":"assets/audio/07-last-saskatchewan-pirate.mp3","title":"The Last Saskatchewan Pirate — The Arrogant Worms"},
 {"src":"assets/audio/08-young-man-from-canada.mp3","title":"Young Man from Canada"},
 {"src":"assets/audio/09-la-ziguezon.mp3","title":"La Ziguezon"},
 {"src":"assets/audio/10-men-of-dieppe.mp3","title":"Men of Dieppe (Quick March)"},
 {"src":"assets/audio/11-canadian-medley.mp3","title":"Canadian Medley (Quick March)"},
]

out = {
  "questions": [{"n":q["n"],"q":q["q"],"a":q["a"],"d":q["d"],"part":q["part"],"sec":q["sec"]} for q in questions],
  "milestones": milestones,
  "pms": pms,
  "provinces": provinces,
  "tracks": tracks,
}

with open("js/data.js","w",encoding="utf-8") as f:
    f.write("// Auto-generated from canada_trivia.md and canada_pm_milestones.md\n")
    f.write("window.GAME_DATA = ")
    json.dump(out, f, ensure_ascii=False, separators=(",",":"))
    f.write(";\n")

print("questions:", len(questions), "milestones:", len(milestones), "pms:", len(pms))
print("parts:", sorted(set(q["part"] for q in questions)))
# sanity: show a few generated MCQs
for q in random.sample(questions, 5):
    print(f"\nQ{q['n']} [{q['_t']}] {q['q']}\n  ✓ {q['a']}\n  ✗ {q['d']}")
