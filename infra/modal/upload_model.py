"""
Upload Artemis model weights to the Modal Volume.

Usage:
  # From the machine that has the weights:
  MODEL_LOCAL_PATH=/path/to/artemis modal run infra/modal/upload_model.py

  # Or pull from Azure Blob Storage (set AZURE_STORAGE_CONNECTION_STRING):
  AZURE_BLOB_CONTAINER=artemis-models AZURE_BLOB_PREFIX=serve/artemis \
    modal run infra/modal/upload_model.py --from-azure
"""

import os
import modal

volume = modal.Volume.from_name("artemis-model", create_if_missing=True)
app = modal.App("artemis-upload")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("azure-storage-blob", "tqdm")
)


@app.function(volumes={"/model": volume}, timeout=7200)
def upload_from_azure(container: str, prefix: str, conn_str: str):
    from azure.storage.blob import BlobServiceClient
    from tqdm import tqdm
    import pathlib

    client = BlobServiceClient.from_connection_string(conn_str)
    cc = client.get_container_client(container)
    blobs = list(cc.list_blobs(name_starts_with=prefix))
    print(f"Uploading {len(blobs)} blobs from Azure → /model/artemis/")
    for blob in tqdm(blobs):
        rel = blob.name[len(prefix):].lstrip("/")
        dest = pathlib.Path(f"/model/artemis/{rel}")
        dest.parent.mkdir(parents=True, exist_ok=True)
        with dest.open("wb") as f:
            f.write(cc.download_blob(blob.name).readall())
    volume.commit()
    print("Done. Volume committed.")


@app.local_entrypoint()
def main(from_azure: bool = False):
    if from_azure:
        conn_str = os.environ["AZURE_STORAGE_CONNECTION_STRING"]
        container = os.environ.get("AZURE_BLOB_CONTAINER", "artemis-models")
        prefix = os.environ.get("AZURE_BLOB_PREFIX", "serve/artemis")
        upload_from_azure.remote(container, prefix, conn_str)
    else:
        local = os.environ.get("MODEL_LOCAL_PATH")
        if not local:
            raise SystemExit("Set MODEL_LOCAL_PATH or use --from-azure")
        print(f"Use 'modal volume put artemis-model {local} /artemis' to upload local weights.")
        print("See: https://modal.com/docs/reference/cli/volume")
