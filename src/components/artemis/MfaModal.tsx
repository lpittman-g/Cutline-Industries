import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { disableMfa, enableMfa } from '../../lib/authApi'

type Props = {
  mfaEnabled: boolean
  onClose: () => void
  onChanged: (enabled: boolean) => void
}

export function MfaModal({ mfaEnabled, onClose, onChanged }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [secret, setSecret] = useState('')
  const [recovery, setRecovery] = useState('')
  const [uri, setUri] = useState('')
  const [phase, setPhase] = useState<'idle' | 'setup' | 'done' | 'disable-confirm'>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'secret' | 'recovery' | null>(null)

  useEffect(() => {
    if (uri && canvasRef.current) {
      void QRCode.toCanvas(canvasRef.current, uri, { width: 200, margin: 2, color: { dark: '#000', light: '#fff' } })
    }
  }, [uri])

  const handleEnable = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await enableMfa()
      setSecret(r.secret)
      setRecovery(r.recoveryCode)
      setUri(r.otpauthUri)
      setPhase('setup')
      onChanged(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable MFA')
    } finally {
      setBusy(false)
    }
  }

  const handleDisable = async () => {
    setBusy(true)
    setError(null)
    try {
      await disableMfa()
      onChanged(false)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable MFA')
    } finally {
      setBusy(false)
    }
  }

  const copy = (value: string, kind: 'secret' | 'recovery') => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(kind)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div className="artemis-modal-backdrop" onClick={onClose}>
      <div
        className="artemis-modal artemis-mfa-modal"
        role="dialog"
        aria-labelledby="mfa-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="artemis-command-kicker">Account Security</p>
        <h2 id="mfa-modal-title">Two-Factor Authentication</h2>

        {error && <p className="artemis-error">{error}</p>}

        {phase === 'idle' && !mfaEnabled && (
          <>
            <p style={{ color: 'var(--artemis-muted, #9ca3af)', marginBottom: '1.25rem' }}>
              Add a second layer of protection. Use any TOTP app — Google Authenticator, Authy, 1Password, etc.
            </p>
            <div className="artemis-hero-actions">
              <button type="button" className="artemis-cta-primary artemis-cta-compact" disabled={busy} onClick={() => void handleEnable()}>
                {busy ? 'Generating…' : 'Enable Two-Factor Auth'}
              </button>
              <button type="button" className="artemis-cta-secondary artemis-cta-compact" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}

        {phase === 'idle' && mfaEnabled && phase !== 'disable-confirm' && (
          <>
            <p style={{ color: 'var(--artemis-muted, #9ca3af)', marginBottom: '1.25rem' }}>
              Two-factor authentication is <strong style={{ color: '#4ade80' }}>active</strong> on your account.
            </p>
            <div className="artemis-hero-actions">
              <button
                type="button"
                className="artemis-cta-secondary artemis-cta-compact"
                onClick={() => setPhase('disable-confirm')}
              >
                Disable 2FA
              </button>
              <button type="button" className="artemis-cta-secondary artemis-cta-compact" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}

        {phase === 'disable-confirm' && (
          <>
            <p style={{ color: '#f87171', marginBottom: '1.25rem' }}>
              This will remove two-factor authentication from your account. Are you sure?
            </p>
            <div className="artemis-hero-actions">
              <button type="button" className="artemis-cta-primary artemis-cta-compact" style={{ background: '#ef4444' }} disabled={busy} onClick={() => void handleDisable()}>
                {busy ? 'Disabling…' : 'Yes, Disable 2FA'}
              </button>
              <button type="button" className="artemis-cta-secondary artemis-cta-compact" onClick={() => setPhase('idle')}>
                Cancel
              </button>
            </div>
          </>
        )}

        {phase === 'setup' && (
          <div className="artemis-mfa-setup">
            <p style={{ color: 'var(--artemis-muted, #9ca3af)', marginBottom: '1rem' }}>
              Scan the QR code with your authenticator app, then sign in as usual — you'll be prompted for a 6-digit code.
            </p>
            <div className="artemis-mfa-qr">
              <canvas ref={canvasRef} />
            </div>
            <div className="artemis-mfa-field">
              <label>Manual entry key</label>
              <div className="artemis-mfa-copy-row">
                <code>{secret}</code>
                <button type="button" className="artemis-chip-btn" onClick={() => copy(secret, 'secret')}>
                  {copied === 'secret' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <div className="artemis-mfa-field">
              <label>Recovery code — save this now</label>
              <div className="artemis-mfa-copy-row">
                <code>{recovery}</code>
                <button type="button" className="artemis-chip-btn" onClick={() => copy(recovery, 'recovery')}>
                  {copied === 'recovery' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <small style={{ color: '#f87171', marginTop: '0.35rem', display: 'block' }}>
                Store this somewhere safe. It bypasses your authenticator if you lose your device.
              </small>
            </div>
            <div className="artemis-hero-actions" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="artemis-cta-primary artemis-cta-compact" onClick={() => { setPhase('done'); onClose() }}>
                Done — I've saved my recovery code
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
