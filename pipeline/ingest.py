#!/usr/bin/env python3
"""Stream public datasets straight into the artemistrainingdata lake (no local disk)."""
import argparse
import logging
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from azure.storage.blob import ContainerClient
from huggingface_hub import HfApi
from huggingface_hub.hf_api import RepoFile

ACCOUNT = "https://artemistrainingdata.blob.core.windows.net"
SAS_FILE = "/etc/artemis/sas-datasets"

JOBS = {
    "hh-rlhf": {"hf": "Anthropic/hh-rlhf", "workers": 4},
    "helpsteer2": {"hf": "nvidia/HelpSteer2", "workers": 4},
    "aya": {"hf": "CohereLabs/aya_collection", "workers": 8},
    "fineweb": {"hf": "HuggingFaceFW/fineweb", "include": ["data/"], "workers": 8},
    "dolma": {
        "urls": "https://huggingface.co/datasets/allenai/dolma/resolve/main/urls/v1_7.txt",
        "strip": "https://olmo-data.org/",
        "workers": 8,
    },
}

log = logging.getLogger("ingest")


def hf_sources(repo, include):
    for f in HfApi().list_repo_tree(repo, repo_type="dataset", recursive=True):
        if not isinstance(f, RepoFile) or f.path.startswith("."):
            continue
        if include and not f.path.startswith(tuple(include)):
            continue
        yield f"https://huggingface.co/datasets/{repo}/resolve/main/{f.path}", f.path


def url_sources(list_url, strip):
    resp = requests.get(list_url, timeout=60)
    resp.raise_for_status()
    for url in resp.text.split():
        yield url, url[len(strip):] if url.startswith(strip) else url.split("://", 1)[-1]


def copy_one(container, src, name):
    blob = container.get_blob_client(name)
    if blob.exists():
        return "skip", 0
    for attempt in range(5):
        try:
            with requests.get(src, stream=True, timeout=(30, 300),
                              headers={"Accept-Encoding": "identity"}) as r:
                r.raise_for_status()
                length = int(r.headers["Content-Length"]) if "Content-Length" in r.headers else None
                blob.upload_blob(r.raw, length=length, overwrite=True, max_concurrency=4)
            return "ok", length or 0
        except requests.HTTPError as e:
            code = e.response.status_code if e.response is not None else 0
            if 400 <= code < 500 and code != 429:
                log.error("HTTP %d (not retrying) %s", code, name)
                return "fail", 0
            log.warning("retry %d/5 %s: %s", attempt + 1, name, e)
        except Exception as e:
            log.warning("retry %d/5 %s: %s", attempt + 1, name, e)
        time.sleep(15 * 2 ** attempt)
    return "fail", 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("job", choices=JOBS)
    args = ap.parse_args()
    job = JOBS[args.job]
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.getLogger("azure").setLevel(logging.WARNING)
    with open(SAS_FILE) as fh:
        sas = fh.read().strip()
    container = ContainerClient.from_container_url(f"{ACCOUNT}/datasets?{sas}")
    sources = (hf_sources(job["hf"], job.get("include")) if "hf" in job
               else url_sources(job["urls"], job["strip"]))
    counts = {"ok": 0, "skip": 0, "fail": 0}
    total = 0
    with ThreadPoolExecutor(job["workers"]) as pool:
        futures = {pool.submit(copy_one, container, src, f"{args.job}/{rel}"): rel for src, rel in sources}
        for i, fut in enumerate(as_completed(futures), 1):
            status, n = fut.result()
            counts[status] += 1
            total += n
            if status == "fail":
                log.error("FAILED %s", futures[fut])
            if i % 25 == 0 or i == len(futures):
                log.info("%s progress %d/%d ok=%d skip=%d fail=%d uploaded=%.1f GB", args.job, i,
                         len(futures), counts["ok"], counts["skip"], counts["fail"], total / 1e9)
    log.info("%s DONE %s uploaded=%.1f GB", args.job, counts, total / 1e9)
    sys.exit(1 if counts["fail"] else 0)


if __name__ == "__main__":
    main()
