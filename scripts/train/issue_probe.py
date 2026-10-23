"""Do issue threads evidence intent / architecture / planning?

Same discipline as artemis.code_corpus: count DISTINCT signals, never
occurrences, require MIN_SCORE evidence and a MARGIN over the nearest rival.
Signals are deliberately conservative -- vocabulary that is hard to produce by
accident -- because the failure mode being guarded against is inventing labels
the data does not support, which is exactly why these three domains are empty.
"""
import re, sys
import pyarrow.parquet as pq

STRONG, WEAK = 2, 1
SIGNALS = {
    "intent": [
        (r"\buser stor(?:y|ies)\b", STRONG),
        (r"\bas a (?:user|developer|admin|customer)\b.{0,40}\bI (?:would like|want|need)\b", STRONG),
        (r"\b(?:feature request|motivation|rationale|use case)\b", STRONG),
        (r"\bacceptance criteria\b", STRONG),
        (r"\b(?:it would be (?:nice|great|useful)|I'd like to be able to)\b", WEAK),
        (r"\b(?:expected behaviou?r|desired behaviou?r)\b", WEAK),
    ],
    "architecture": [
        (r"\b(?:UML|sequence diagram|class diagram|ER diagram|component diagram)\b", STRONG),
        (r"\b(?:architecture|architectural)\b", STRONG),
        (r"\b(?:design (?:doc|document|proposal)|RFC)\b", STRONG),
        (r"\b(?:decoupl|abstraction layer|separation of concerns|single responsibility)\w*", STRONG),
        (r"\b(?:refactor|module boundar|interface contract|data model)\w*", WEAK),
        (r"\b(?:trade-?off|scalab|maintainab)\w*", WEAK),
    ],
    "planning": [
        (r"\b(?:roadmap|milestone|backlog|sprint)\b", STRONG),
        (r"\b(?:blocked by|depends on|blocker for)\b", STRONG),
        (r"\b(?:phase \d|step \d of|breakdown|sub-?task)\w*", STRONG),
        (r"\b(?:priorit|estimate[sd]?|timeline|deadline)\w*", WEAK),
        (r"- \[[ x]\].*\n.*- \[[ x]\]", WEAK),        # a real checklist, 2+ items
        (r"\b(?:TODO|follow-?up)\b", WEAK),
    ],
}
C = {d: [(re.compile(p, re.I | re.M), w) for p, w in s] for d, s in SIGNALS.items()}
MIN_SCORE, MARGIN, SCAN = 2, 1.5, 20_000

def classify(text):
    head = text[:SCAN]
    sc = {d: sum(w for p, w in sig if p.search(head)) for d, sig in C.items()}
    rank = sorted(sc.items(), key=lambda kv: -kv[1])
    top, ts = rank[0]
    ru = rank[1][1] if len(rank) > 1 else 0
    if ts < MIN_SCORE: return None
    if ru and ts < MARGIN * ru: return None
    return top

f = pq.ParquetFile(sys.argv[1])
n = 0; hits = {"intent": 0, "architecture": 0, "planning": 0}; chars = {k: 0 for k in hits}
for batch in f.iter_batches(batch_size=20000, columns=["content"]):
    for c in batch.to_pydict()["content"]:
        if not c: continue
        n += 1
        d = classify(c)
        if d: hits[d] += 1; chars[d] += len(c)
    if n >= 60000: break
print(f"threads examined : {n:,}")
tot = sum(hits.values())
for d in hits:
    print(f"  {d:14} {hits[d]:>7,} threads  {100*hits[d]/n:5.2f}%   ~{chars[d]/1e6:7.1f} MB of text")
print(f"  {'LABELLED':14} {tot:>7,}          {100*tot/n:5.2f}%")
