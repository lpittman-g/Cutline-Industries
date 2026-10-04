import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { execSync } from 'node:child_process';

const PORT = 9000;
const SECRET = process.env.DEPLOY_SECRET || '';
const REPO_DIR = process.env.REPO_DIR || '/srv/repo';

function verify(sig, body) {
  if (!SECRET) return true;
  const expected = 'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(sig || ''), Buffer.from(expected));
  } catch { return false; }
}

function deploy(branch) {
  console.log(`[deploy] branch=${branch} dir=${REPO_DIR}`);
  const out = execSync(
    `cd ${REPO_DIR} && git fetch origin ${branch} && git reset --hard origin/${branch} && docker compose up -d --build --remove-orphans && docker compose exec -T api node --import tsx/esm db/migrate.ts 2>/dev/null || true`,
    { stdio: 'pipe', timeout: 600_000 }
  ).toString();
  console.log(out.slice(-2000));
  return out;
}

let deploying = false;

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200).end('ok');
    return;
  }
  if (req.method !== 'POST' || req.url !== '/deploy') {
    res.writeHead(404).end('not found');
    return;
  }
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const sig = req.headers['x-gitea-signature'] || req.headers['x-hub-signature-256'] || '';
    if (!verify(sig, body)) {
      console.warn('[deploy] bad signature');
      res.writeHead(401).end('unauthorized');
      return;
    }
    let payload;
    try { payload = JSON.parse(body.toString()); } catch { payload = {}; }
    const ref = payload.ref || 'refs/heads/main';
    const branch = ref.replace('refs/heads/', '');
    if (branch !== 'main') {
      res.writeHead(200).end(`skipped branch ${branch}`);
      return;
    }
    if (deploying) {
      res.writeHead(202).end('deploy already in progress');
      return;
    }
    deploying = true;
    res.writeHead(202).end('deploy started');
    setImmediate(() => {
      try { deploy(branch); } catch (e) { console.error('[deploy] failed', e.message); }
      finally { deploying = false; }
    });
  });
});

server.listen(PORT, () => console.log(`deploy-agent listening on :${PORT}`));
