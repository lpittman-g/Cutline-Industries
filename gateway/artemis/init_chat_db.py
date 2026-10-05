"""Initialize additive chat/business tables using the configured persistent database."""
import os
from .store import Store
from .conversations import Conversations


def main():
    url = os.environ.get('DATABASE_URL') or os.environ.get('ARTEMIS_DATABASE_URL', '')
    if not url.startswith(('postgresql://', 'postgres://')):
        raise SystemExit('Set DATABASE_URL to the intended persistent PostgreSQL database first.')
    db = Store(url)
    try:
        Conversations(db)
        print('Chat and business tables initialized. No existing conversation rows were removed.')
    finally:
        db.conn.close()


if __name__ == '__main__': main()
