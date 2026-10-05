"""Generate same-origin API rewrites after the application gateway is deployed."""
import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit

parser = argparse.ArgumentParser()
parser.add_argument("--gateway-url", required=True)
args = parser.parse_args()
url = urlsplit(args.gateway_url)
if url.scheme != "https" or not url.hostname or url.username or url.password or url.query or url.fragment or url.path not in ("", "/"):
    parser.error("Use the HTTPS gateway origin without credentials, paths, or query parameters.")
origin = args.gateway_url.rstrip("/")
target = Path(__file__).resolve().parent.parent / "site" / "vercel.json"
config = json.loads(target.read_text()) if target.exists() else {}
config["rewrites"] = [rule for rule in config.get("rewrites", []) if rule.get("source") not in ("/api/:path*", "/v1/:path*")]
config["rewrites"] += [{"source": "/api/:path*", "destination": origin+"/api/:path*"}, {"source": "/v1/:path*", "destination": origin+"/v1/:path*"}]
target.write_text(json.dumps(config, indent=2)+"\n")
print(target)
