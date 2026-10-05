"""Training/inference chat markers shared without importing torch or tokenizers."""
import re

from .brains import SPECIALIST_IDS

CONTROL = re.compile(r"<\|[a-z_]+(?::[a-z_]+)?\|>")

def clean(text):
    return CONTROL.sub("", text)

CHAT_TEMPLATE = (
    "{% set brain_id = brain if brain is defined and brain in " + repr(["artemis", *SPECIALIST_IDS]) + " else 'artemis' %}"
    "{{ '<|bos|><|brain:' + brain_id + '|>' }}"
    "{% for m in messages %}{{ '<|' + m['role'] + '|>' + m['content'] + '<|end|>' }}{% endfor %}"
    "{% if add_generation_prompt %}{{ '<|assistant|>' }}{% endif %}"
)
