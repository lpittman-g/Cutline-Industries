import { useEffect, useState } from 'react'
import { fetchClips, mediaUrl, type ThermalClip } from '../../lib/thermalApi'

export function ClipsPage() {
  const [clips, setClips] = useState<ThermalClip[]>([])
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState<number | null>(null)

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
                    {clip.status}
                  </p>
                  {video && (
                    <button type="button" className="btn" onClick={() => setPlaying(clip.id)}>
                      {playing === clip.id ? 'Hide' : 'Play preview'}
                    </button>
                  )}
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
