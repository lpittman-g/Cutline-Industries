import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { verifyEmail } from '../../lib/authApi'

export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState<'pending' | 'ok' | 'error'>('pending')
  const [message, setMessage] = useState('Verifying…')

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      setStatus('error')
      setMessage('Missing verification token')
      return
    }
    void verifyEmail(token)
      .then((r) => {
        setStatus('ok')
        setMessage(r.message)
      })
      .catch((e) => {
        setStatus('error')
        setMessage(e instanceof Error ? e.message : 'Verification failed')
      })
  }, [params])

  return (
    <div className="public-page thermal-page">
      <div className="page-head">
        <div>
          <h1>Verify email</h1>
          <p>Cutline Industries account confirmation</p>
        </div>
      </div>
      <section className="panel panel-pad" style={{ maxWidth: 480 }}>
        <p className={status === 'ok' ? 'chip ready' : status === 'error' ? 'chip warn' : 'chip'}>
          {message}
        </p>
        {status === 'ok' && (
          <Link className="btn btn-primary" to="/signin">
            Sign in
          </Link>
        )}
      </section>
    </div>
  )
}
