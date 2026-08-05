import { useEffect, useState } from 'react'
import {
  fetchRampAuthorizeUrl,
  fetchRampStatus,
  fetchRampTransactions,
  formatRampUsd,
  type RampStatus,
  type RampTxn,
} from '../../lib/rampApi'

export function RampSpendPage() {
  const [status, setStatus] = useState<RampStatus | null>(null)
  const [txns, setTxns] = useState<RampTxn[]>([])
  const [meta, setMeta] = useState<{
    count: number
    totalAmount: number
    authSource?: string
    scope?: string
    pages?: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setBusy(true)
    try {
      const st = await fetchRampStatus()
      setStatus(st)
      if (!st.configured) {
        setError('Set RAMP_CLIENT_ID and RAMP_CLIENT_SECRET in .env')
        setTxns([])
        setMeta(null)
        return
      }
      const data = await fetchRampTransactions(25, 3)
      setTxns(data.transactions)
      setMeta({
        count: data.count,
        totalAmount: data.totalAmount,
        authSource: data.authSource,
        scope: data.scope,
        pages: data.pages,
      })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ramp unavailable')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const startOauth = async () => {
    try {
      const { url } = await fetchRampAuthorizeUrl()
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build authorize URL')
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Ramp spend</h1>
          <p>Demo Ramp Developer API — transactions via client credentials or OAuth.</p>
        </div>
        <p className="chip">
          Ramp: {status?.env ?? '…'}
          {status?.configured ? '' : ' · not configured'}
        </p>
      </div>

      {error && <p className="chip warn">{error}</p>}

      <div className="grid-3" style={{ marginBottom: '1rem' }}>
        <div className="panel stat">
          <div className="label">Transactions loaded</div>
          <div className="value">{meta?.count ?? '—'}</div>
        </div>
        <div className="panel stat">
          <div className="label">Sum (page set)</div>
          <div className="value lime">
            {meta ? formatRampUsd(meta.totalAmount) : '—'}
          </div>
        </div>
        <div className="panel stat">
          <div className="label">Auth</div>
          <div className="value" style={{ fontSize: '1rem' }}>
            {meta?.authSource ?? (status?.hasStoredUserToken ? 'stored' : '—')}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button type="button" className="btn" onClick={() => void load()} disabled={busy}>
          {busy ? 'Loading…' : 'Refresh'}
        </button>
        <button type="button" className="btn" onClick={() => void startOauth()}>
          Authorize (browser)
        </button>
      </div>

      <section className="panel panel-pad">
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Recent transactions</h3>
        {txns.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>
            No transactions yet. If you see a grant-type error, re-enable{' '}
            <strong>Client credentials</strong> on the demo Developer app.
          </p>
        ) : (
          <ul style={{ color: 'var(--muted)', lineHeight: 1.8, margin: 0, paddingLeft: '1.1rem' }}>
            {txns.map((t) => (
              <li key={t.id}>
                {t.merchant_name || 'Merchant'} · {formatRampUsd(Number(t.amount) || 0)} ·{' '}
                {t.state || '—'}
                {t.user_transaction_time
                  ? ` · ${new Date(t.user_transaction_time).toLocaleString()}`
                  : ''}
                {t.card_holder?.name ? ` · ${t.card_holder.name}` : ''}
              </li>
            ))}
          </ul>
        )}
        {meta?.scope && (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 0 }}>
            Scope: {meta.scope}
            {meta.pages != null ? ` · pages: ${meta.pages}` : ''}
          </p>
        )}
      </section>
    </div>
  )
}
