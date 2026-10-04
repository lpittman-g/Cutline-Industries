#!/usr/bin/env python3
"""
Artemis fine-tuning script.

Fine-tunes GPT-2 base on the Cutline Industries corpus and saves a checkpoint
that artemis-serve.py loads directly via ARTEMIS_MODEL_PATH.

Usage:
  pip install torch transformers datasets
  python scripts/train/corpus.py          # build the corpus first
  python scripts/train/train.py           # fine-tune
  # checkpoint saved to ./artemis-checkpoint

  # Then update ARTEMIS_MODEL_PATH in your container env:
  # ARTEMIS_MODEL_PATH=./artemis-checkpoint

Environment variables:
  BASE_MODEL        HuggingFace model ID to start from  (default: gpt2)
  CORPUS_FILE       path to the JSONL corpus            (default: data/artemis-corpus.jsonl)
  OUTPUT_DIR        where to save the checkpoint        (default: ./artemis-checkpoint)
  EPOCHS            training epochs                     (default: 5)
  BATCH_SIZE        per-device batch size               (default: 2)
  LR                learning rate                       (default: 5e-5)
  MAX_LEN           max token length per example        (default: 256)
"""
from __future__ import annotations

import json
import os
from pathlib import Path

BASE_MODEL = os.environ.get("BASE_MODEL", "gpt2")
CORPUS_FILE = Path(os.environ.get("CORPUS_FILE", "data/artemis-corpus.jsonl"))
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "./artemis-checkpoint"))
EPOCHS = int(os.environ.get("EPOCHS", "5"))
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "2"))
LR = float(os.environ.get("LR", "5e-5"))
MAX_LEN = int(os.environ.get("MAX_LEN", "256"))


def load_corpus(path: Path) -> list[str]:
    texts = []
    with path.open() as f:
        for line in f:
            line = line.strip()
            if line:
                obj = json.loads(line)
                texts.append(obj["text"])
    return texts


def train() -> None:
    import torch
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        DataCollatorForLanguageModeling,
        Trainer,
        TrainingArguments,
    )
    from torch.utils.data import Dataset

    print(f"[train] Base model : {BASE_MODEL}")
    print(f"[train] Corpus     : {CORPUS_FILE}")
    print(f"[train] Output     : {OUTPUT_DIR}")

    if not CORPUS_FILE.exists():
        raise FileNotFoundError(f"Corpus not found: {CORPUS_FILE}. Run corpus.py first.")

    texts = load_corpus(CORPUS_FILE)
    print(f"[train] Examples   : {len(texts)}")

    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    class ArtemisDataset(Dataset):
        def __init__(self, texts: list[str]) -> None:
            self.encodings = tokenizer(
                texts,
                truncation=True,
                max_length=MAX_LEN,
                padding="max_length",
                return_tensors="pt",
            )

        def __len__(self) -> int:
            return len(self.encodings["input_ids"])

        def __getitem__(self, idx: int) -> dict:
            return {
                "input_ids": self.encodings["input_ids"][idx],
                "attention_mask": self.encodings["attention_mask"][idx],
                "labels": self.encodings["input_ids"][idx].clone(),
            }

    dataset = ArtemisDataset(texts)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[train] Device     : {device}")

    model = AutoModelForCausalLM.from_pretrained(BASE_MODEL)
    model = model.to(device)

    args = TrainingArguments(
        output_dir=str(OUTPUT_DIR),
        num_train_epochs=EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        learning_rate=LR,
        save_strategy="epoch",
        logging_steps=10,
        fp16=device == "cuda",
        dataloader_num_workers=0,
        report_to="none",
        overwrite_output_dir=True,
        save_total_limit=1,
    )

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=dataset,
        data_collator=DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False),
    )

    print("[train] Starting fine-tune…")
    trainer.train()

    # Save final checkpoint and tokenizer
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print(f"[train] Checkpoint saved → {OUTPUT_DIR}")
    print(f"[train] Set ARTEMIS_MODEL_PATH={OUTPUT_DIR.resolve()} and restart artemis-serve.py")


if __name__ == "__main__":
    train()
