# Can GitHub issues supply the three empty experts?

**Measured answer: yes, clearly — and unlike commit messages, which were tested
first and rejected. But the licensing position needs a decision that is not a
technical one.**

Measured 2026-10-23 on `bigcode/the-stack-github-issues`, shard 0 of 127
(522 MB, 243,961 threads; 31M threads and 66.6 GB in total).

## Why this was tested at all

`intent`, `architecture` and `planning` receive **zero** tokens from the code
corpus — replicated twice on independent shards at different vocabularies
(`docs/DOMAIN-COVERAGE.md`). At compute-optimal scale those three experts are
not merely idle: removing them *improves* loss on nearly every domain
(`docs/PROTO-SPECIALISATION-117M.md`). At 14B that is ~2.95B parameters making
output worse.

`artemis.code_corpus` omits those three deliberately, with a comment saying
they "stay unlabelled until a corpus that actually evidences them exists".
This is the test of whether this is that corpus.

## Length: the test commit messages failed

| | CommitPackFT (rejected) | issue threads |
| --- | ---: | ---: |
| median | 44 chars | **1,042** |
| mean | 67 | **1,923** |
| ≥ 200 chars | 4.63% | **100%** |
| ≥ 1000 chars | — | **51.6%** |

24× longer at the median. **Caveat on the 100%:** the dataset's own cleaning
drops issues under 200 total characters, so that figure is partly an artefact
of their filtering rather than a property of issues in general. The median and
the ≥1000 figure are the meaningful ones.

32.5% of threads are pull requests; the rest are issues.

## Domain signal: measured, not assumed

A draft classifier using the same discipline as `artemis.code_corpus` —
distinct signals counted, never occurrences, `MIN_SCORE 2`, `MARGIN 1.5`, with
conservative vocabulary — over 60,000 threads:

| domain | threads | share | text per 60k threads |
| --- | ---: | ---: | ---: |
| `intent` | 3,474 | 5.79% | ~9.2 MB |
| `planning` | 1,756 | 2.93% | ~5.9 MB |
| `architecture` | 814 | 1.36% | ~3.3 MB |
| **labelled** | **6,044** | **10.07%** | |

Extrapolated to 31M threads: roughly **1.2B `intent`, 0.76B `planning`, 0.43B
`architecture` tokens.** Against zero today.

90% of threads label as none of the three. That is expected and fine — most
issues are bug reports and administrative noise, and they stay unlabelled
rather than being forced into a domain.

**The classifier is a draft and its precision is unvalidated.** The signals are
plausible and conservative, but no sample has been hand-checked, so the rates
above are an upper bound on correctly-labelled volume. Validating it on a
hand-labelled sample is the next technical step, and should happen before any
corpus is built from it.

## Provenance and hygiene

The maintainers' cleaning reduced 180 GB to 54 GB:
- automated email-reply text removed; issues under 200 characters dropped;
  long comments truncated to 100 lines keeping the last 20 — removed 18%
- bot comments removed by username keyword, plus the comments that triggered
  them — removed 61% of the remaining volume
- number of distinct users used as a quality proxy
- PII masked by regex: IP addresses, email addresses, secret keys; author
  usernames replaced (threads read `username_0`, `username_1`)

That is better hygiene than most corpora. Regex masking is imperfect by nature.

## The licensing position — a decision, not a measurement

Three things that need a real answer before this trains a model you sell:

1. **The Terms of Use address code, not comments.** They say "any use of all or
   part of the **code** gathered in The Stack must abide by the terms of the
   original licenses". Issue and PR comments are not code and are generally not
   covered by a repository's licence; they are user-generated content under
   GitHub's terms. The dataset carries **no declared licence tag**.

2. **Accepting access creates an ongoing obligation.** By clicking "Access
   repository" you agree to "update your own version of The Stack to the most
   recent usable version" as validated data-removal requests are enacted.
   Weights do not update. Content removed after training has already been
   learned, and that gap is structural, not an oversight to fix later.

3. **This is for a product that will be sold.** The code corpus has a clean
   story: permissive licences, filtered per row, verifiable. This corpus does
   not have the equivalent, and the difference matters more for commercial
   weights than for research.

None of that says do not use it. It says the question deserves an answer from
someone qualified to give one, recorded before the corpus is built, rather than
assumed because the download worked.

## Recommendation

**Technically: use it.** It supplies what the code corpus cannot, by a wide
margin, and it is the corpus the classifier's comment was waiting for.

**Order of work:**
1. Settle the licensing question above. It is the only genuine blocker.
2. Validate the draft classifier on a hand-labelled sample — 200 threads is
   enough to estimate precision.
3. Extend `artemis.code_corpus` with prose signals for the three domains,
   gated on that precision.
4. Retrain the tokenizer on the combined corpus. Code-only vocabulary
   tokenises prose badly, and every prepared bin depends on it — so this
   happens once, after the mixture is final, not before.
5. Re-run the specialisation measurement. It costs 7.4 CPU hours and tells you
   whether ten experts are worth their parameters.

## Reproducing

```
python3 -I scripts/train/issue_probe.py <shard.parquet>
```
