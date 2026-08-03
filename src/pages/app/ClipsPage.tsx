import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchClips,
  formatUsd,
  mediaUrl,
  rerunClipAutopilot,
  tierPriceLabel,
  type ThermalClip,
} from '../../lib/thermalApi'

export function ClipsPage() {
  const [clips, setClips] = useState<ThermalClip[]>([])
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState<number | null>(null)
  const [rerunning, setRerunning] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchClips()
        setClips(data.clips)
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Clips unavailable')
      }
    }
    load()
    const t = setInterval(load, 12_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Clip Vault</h1>
          <p>Real heat-generated clips — thumbnails, playback, gateway tier ($15).</p>
        </div>
      </div>

      {error && <p className="chip warn">{error}</p>}

      <section className="panel panel-pad">
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Cutline queue</h3>
        {clips.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No clips yet — force a heat spike on Streams.</p>
        ) : (
          <div className="project-grid">
            {clips.map((clip) => {
              const thumb = mediaUrl(clip.thumbnail_url)
              const video = mediaUrl(clip.media_url)
              return (
                <article key={clip.id} className="panel panel-pad">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={clip.title ?? 'clip'}
                      style={{ width: '100%', borderRadius: 8, marginBottom: '0.75rem' }}
                    />
                  ) : (
                    <div
                      style={{
                        height: 120,
                        background: 'var(--panel-2)',
                        borderRadius: 8,
                        marginBottom: '0.75rem',
                      }}
                    />
                  )}
                  <strong>{clip.title ?? `Clip #${clip.id}`}</strong>
                  <p style={{ color: 'var(--muted)', margin: '0.35rem 0' }}>
                    @{clip.streamer_username} · {clip.game} · {clip.duration_sec ?? '?'}s ·{' '}
                    {clip.status} · {tierPriceLabel(clip.tier)}
                    {clip.sale_amount_cents ? ` · sold ${formatUsd(clip.sale_amount_cents)}` : ''}
                  </p>
                  {clip.autopilot_status && (
                    <p className={clip.autopilot_status === 'failed' ? 'chip warn' : 'chip ready'}>
                      AI autopilot: {clip.autopilot_status}
                    </p>
                  )}
                  {clip.autopilot_error && (
                    <p className="chip warn" style={{ whiteSpace: 'pre-wrap' }}>
                      Autopilot notes: {clip.autopilot_error}
                    </p>
                  )}
                  {clip.autopilot_error && (
                    <p className="chip warn" style={{ whiteSpace: 'pre-wrap' }}>
                      Autopilot notes: {clip.autopilot_error}
                    </p>
                  )}
                  {clip.ai_caption && (
                    <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                      X: {clip.ai_caption}
                    </p>
                  )}
                  {clip.ai_tiktok_caption && (
                    <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                      TikTok: {clip.ai_tiktok_caption}
                    </p>
                  )}
                  <div className="btn-row">
                    {video && (
                      <button type="button" className="btn" onClick={() => setPlaying(clip.id)}>
                        {playing === clip.id ? 'Hide' : 'Play preview'}
                      </button>
                    )}
                    {clip.media_url && (
                      <button
                        type="button"
                        className="btn"
                        disabled={rerunning === clip.id}
                        onClick={() => {
                          setRerunning(clip.id)
                          void rerunClipAutopilot(clip.id)
                            .then((result) => {
                              if (result.clip) {
                                setClips((prev) =>
                                  prev.map((row) => (row.id === clip.id ? result.clip! : row)),
                                )
                              }
                              setError(null)
                            })
                            .catch((e) =>
                              setError(e instanceof Error ? e.message : 'Autopilot retry failed'),
                            )
                            .finally(() => setRerunning(null))
                        }}
                      >
                        {rerunning === clip.id ? 'Running…' : 'Retry AI autopilot'}
                      </button>
                    )}
                    {clip.status !== 'claimed' && (
                      <Link className="btn btn-primary" to={`/checkout/${clip.id}`}>
                        Claim {formatUsd(clip.tier === 'bounty' ? 5000 : 1500)}
                      </Link>
                    )}
                  </div>
                  {playing === clip.id && video && (
                    <video
                      src={video}
                      controls
                      playsInline
                      style={{ width: '100%', marginTop: '0.75rem', borderRadius: 8 }}
                    />
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
