"""Validate production wiring without displaying secrets or asserting model quality."""
import argparse
import os
from urllib.parse import urlsplit


def validate(env, allow_untrained=False):
    issues = []
    database = env.get('DATABASE_URL') or env.get('ARTEMIS_DATABASE_URL', '')
    if not database.startswith(('postgresql://', 'postgres://')):
        issues.append('Configure DATABASE_URL as a persistent PostgreSQL connection.')
    if env.get('ARTEMIS_COOKIE_SECURE', '1') != '1':
        issues.append('Production requires ARTEMIS_COOKIE_SECURE=1.')
    origins = [value.strip() for value in env.get('ARTEMIS_ALLOWED_ORIGINS', '').split(',') if value.strip()]
    if not origins or any(urlsplit(o).scheme != 'https' or not urlsplit(o).hostname or urlsplit(o).path not in ('', '/') or urlsplit(o).query or urlsplit(o).fragment or urlsplit(o).username is not None or urlsplit(o).password is not None for o in origins):
        issues.append('Configure ARTEMIS_ALLOWED_ORIGINS with HTTPS frontend origins.')
    url = env.get('VLLM_BASE_URL') or env.get('ARTEMIS_INFERENCE_URL', '')
    if not url and not allow_untrained:
        issues.append('Configure VLLM_BASE_URL, or explicitly use --allow-untrained for accounts-only setup.')
    if url:
        parsed = urlsplit(url)
        if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username is not None or parsed.password is not None or parsed.query or parsed.fragment:
            issues.append('Configure a valid server-side VLLM_BASE_URL without embedded credentials.')
        if not env.get('VLLM_MODEL'):
            issues.append('Set VLLM_MODEL to the actual served Artemis model name.')
    for name, default, lower, upper in [('ARTEMIS_CONTEXT_TOKENS', '4096', 512, 1000000), ('ARTEMIS_CHAT_WORKERS', '4', 1, 32)]:
        try:
            if not lower <= int(env.get(name, default)) <= upper: raise ValueError()
        except ValueError: issues.append(f'{name} must be an integer from {lower} to {upper}.')
    return issues


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--allow-untrained', action='store_true')
    parser.add_argument('--check-database', action='store_true')
    args = parser.parse_args()
    issues = validate(os.environ, args.allow_untrained)
    if issues:
        for issue in issues: print(issue)
        raise SystemExit(1)
    if args.check_database:
        import psycopg
        try:
            with psycopg.connect(os.environ.get('DATABASE_URL') or os.environ['ARTEMIS_DATABASE_URL'], connect_timeout=10) as connection:
                connection.execute('SELECT 1')
        except Exception:
            print('Database connectivity check failed. Verify access and server-side credentials.')
            raise SystemExit(1) from None
    print('Configuration checks passed. Live model quality, HTTPS/proxy behavior, and capacity still require deployment verification.')


if __name__ == '__main__': main()
