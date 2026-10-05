"""Wire the static site to a deployed compatible chat gateway, ahead of catch-all routes."""
import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit

FRONTEND_HOSTS = {"cutline-industries.studio", "cutline-industries.vercel.app"}
API_SOURCES = {"/api/:path*", "/v1/:path*", "/api/(.*)", "/v1/(.*)", "/api/:path(.*)", "/v1/:path(.*)"}


def gateway_origin(value):
    url = urlsplit(value)
    if (url.scheme != "https" or not url.hostname or url.username is not None or url.password is not None
            or url.query or url.fragment or url.path not in ("", "/")):
        raise ValueError("Use the HTTPS gateway origin without credentials, paths, or query parameters.")
    if url.hostname.lower() in FRONTEND_HOSTS:
        raise ValueError("Use the backend gateway origin, not the frontend: that would create a proxy loop.")
    try: url.port
    except ValueError: raise ValueError("The gateway port is invalid.") from None
    return value.rstrip("/")


def prepare(gateway, directory):
    origin = gateway_origin(gateway)
    target = Path(directory) / "vercel.json"
    config = json.loads(target.read_text()) if target.exists() else {}
    # Existing unrelated headers/redirects/routes remain. API routes must precede SPA fallbacks.
    other_routes = [r for r in config.get("rewrites", []) if r.get("source") not in API_SOURCES]
    config["rewrites"] = [{"source": "/api/:path*", "destination": origin + "/api/:path*"},
                          {"source": "/v1/:path*", "destination": origin + "/v1/:path*"}] + other_routes
    target.write_text(json.dumps(config, indent=2) + "\n")
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gateway-url", required=True)
    parser.add_argument("--site-directory", type=Path, default=Path(__file__).resolve().parent.parent / "site")
    args = parser.parse_args()
    try: print(prepare(args.gateway_url, args.site_directory))
    except ValueError as error: parser.error(str(error))


if __name__ == "__main__": main()
