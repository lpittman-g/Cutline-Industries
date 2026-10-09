"""Minimal ADLS Gen2 / Blob wrapper for the tokenization pipeline.

Reads a container SAS from /etc/artemis/sas-datasets (the write-scoped token installed on the
ingest VM) so no account key is needed in the process. Only the handful of operations
prepare_lake needs: list, get bytes, download to file, upload file, put text.
"""
from __future__ import annotations

from pathlib import Path
from typing import Callable, Iterator

ACCOUNT_URL = "https://artemistrainingdata.blob.core.windows.net"
SAS_PATH = "/etc/artemis/sas-datasets"


class BlobLake:
    def __init__(self, account_url: str, sas: str):
        from azure.storage.blob import BlobServiceClient
        self._svc = BlobServiceClient(account_url=account_url, credential=sas)

    @classmethod
    def from_env(cls, sas_path: str = SAS_PATH) -> "BlobLake":
        return cls(ACCOUNT_URL, Path(sas_path).read_text().strip())

    def _container(self, container: str):
        return self._svc.get_container_client(container)

    def list(self, container: str, prefix: str) -> list[str]:
        return [b.name for b in self._container(container).list_blobs(name_starts_with=prefix)
                if not b.name.endswith("/")]

    def get(self, container: str, blob: str) -> bytes:
        return self._container(container).get_blob_client(blob).download_blob().readall()

    def download(self, container: str, blob: str, dest: Path) -> None:
        with open(dest, "wb") as fh:
            self._container(container).get_blob_client(blob).download_blob().readinto(fh)

    def put_text(self, container: str, blob: str, text: str) -> None:
        self._container(container).get_blob_client(blob).upload_blob(text.encode(), overwrite=True)

    def uploader(self, container: str, dest_prefix: str) -> Callable[[Path, str], None]:
        cc = self._container(container)

        def _upload(local: Path, name: str) -> None:
            with open(local, "rb") as fh:
                cc.get_blob_client(f"{dest_prefix}/{name}").upload_blob(fh, overwrite=True)

        return _upload
