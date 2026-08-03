import { useEffect, useState } from 'react'
import { PUBLISH_CHECKLIST } from '../data/catalog'

const KEY = 'cutline.checklist.v1'

export function PlaybookPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setChecked(JSON.parse(raw) as Record<string, boolean>)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(checked))
  }, [checked])

  const done = PUBLISH_CHECKLIST.filter((c) => checked[c.id]).length

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Playbook</h1>
          <p>
            Autopilot posts for you. This playbook is the growth rules it follows — and the one-time
            channel setup only you can do.
          </p>
        </div>
        <div className="chip ready">
          {done}/{PUBLISH_CHECKLIST.length} checks
        </div>
      </div>

      <div className="grid-2">
        <section className="panel panel-pad">
          <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>One-time (you)</h3>
          <ol style={{ color: 'var(--muted)', paddingLeft: '1.1rem', lineHeight: 1.7 }}>
            <li>Create your YouTube channel on the Google account you want to grow.</li>
            <li>
              Enable <strong>YouTube Data API v3</strong> and <strong>Gmail API</strong> in Google
              Cloud (same account / project).
            </li>
            <li>
              Create a <strong>Web</strong> OAuth client with redirect{' '}
              <code>https://developers.google.com/oauthplayground</code> → save{' '}
              <code>client_secret.json</code>.
            </li>
            <li>
              Set <code>GOOGLE_CLOUD_PROJECT</code> and <code>GOOGLE_WORKSPACE_SENDER_EMAIL</code> in{' '}
              <code>.env</code>.
            </li>
            <li>
              Add yourself as an OAuth test user, then authorize YouTube + <code>gmail.send</code>{' '}
              (Autopilot <strong>Open OAuth</strong> or OAuth Playground).
            </li>
            <li>
              Exchange the code or paste the refresh token on Autopilot → writes{' '}
              <code>token.json</code>.
            </li>
            <li>
              Drop VODs into <code>inbox/</code> and run <code>npm run autopilot</code>.
            </li>
            <li>
              Point <code>cutline-industries.studio</code> DNS at your deployed site host.
            </li>
          </ol>
          <p style={{ color: 'var(--cyan)' }}>
            After that, Autopilot cuts Shorts and uploads on a schedule with no clicks from you.
          </p>
        </section>

        <section className="panel panel-pad">
          <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Always-on rules</h3>
          <div className="checklist">
            {PUBLISH_CHECKLIST.map((item) => (
              <label key={item.id}>
                <input
                  type="checkbox"
                  checked={Boolean(checked[item.id])}
                  onChange={(e) =>
                    setChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))
                  }
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
