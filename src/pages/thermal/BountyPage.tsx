import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { DEMO_BOUNTY_CLIPS } from '../../data/thermal'
import {
  fetchBountyClips,
  mediaUrl,
  tierPriceLabel,
  type ThermalClip,
} from '../../lib/thermalApi'

type BoardClip = {
  id: string
  title: string
  streamer: string
  game: string
  heatScore: number
  msgPerMin: number
  durationSec: number
  priceLabel: string
  thumbnailUrl: string | null
  status: string
}

function fromDemo(clip: (typeof DEMO_BOUNTY_CLIPS)[number]): BoardClip {
  return {
    id: clip.id,
    title: clip.title,
    streamer: clip.streamer,
    game: clip.game,
    heatScore: clip.heatScore,
    msgPerMin: clip.msgPerMin,
    durationSec: clip.durationSec,
    priceLabel: clip.priceLabel,
    thumbnailUrl: null,
    status: 'unclaimed',
  }
}

function fromApi(clip: ThermalClip): BoardClip {
  return {
    id: String(clip.id),
    title: clip.title ?? `Clip #${clip.id}`,
    streamer: clip.streamer_username ?? 'unknown',
    game: clip.game ?? '—',
    heatScore: Math.min(99, 70 + (clip.duration_sec ?? 20)),
    msgPerMin: 120,
    durationSec: clip.duration_sec ?? 22,
    priceLabel: tierPriceLabel(clip.tier),
    thumbnailUrl: mediaUrl(clip.thumbnail_url),
    status: clip.status,
  }
}

export function BountyPage() {
  const [q, setQ] = useState('')
  const [clips, setClips] = useState<BoardClip[]>([])
  const [source, setSource] = useState<'live' | 'demo'>('demo')

  useEffect(() => {
    fetchBountyClips()
      .then((data) => {
        if (data.clips.length) {
          setClips(data.clips.map(fromApi))
          setSource('live')
        } else {
          setClips(DEMO_BOUNTY_CLIPS.map(fromDemo))
          setSource('demo')
        }
      })
      .catch(() => {
        setClips(DEMO_BOUNTY_CLIPS.map(fromDemo))
        setSource('demo')
      })
  }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return clips
    return clips.filter(
      (c) =>
        c.title.toLowerCase().includes(needle) ||
        c.streamer.toLowerCase().includes(needle) ||
        c.game.toLowerCase().includes(needle),
    )
  }, [q, clips])

  return (
    <div className="public-page thermal-page">
      <div className="page-head">
        <div>
          <h1>Bounty Board</h1>
          <p>Live heat feed — watermarked previews. Unlock clean 4K when you’re ready to claim.</p>
        </div>
        {source === 'demo' && (
          <p className="chip warn" style={{ alignSelf: 'flex-start' }}>
            Demo clips — connect DATABASE_URL for live heat clips
          </p>
        )}
      </div>

      <label className="bounty-search">
        <span>Search heat</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Streamer, game, or moment…"
        />
      </label>

      <div className="bounty-grid">
        {filtered.map((clip) => (
          <article key={clip.id} className="bounty-card">
            <div className="bounty-preview">
              {clip.thumbnailUrl ? (
                <img
                  src={clip.thumbnailUrl}
                  alt={clip.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                />
              ) : null}
              <span className="heat-pill">HEAT {clip.heatScore}</span>
              <span className="wm-label">THERMAL PREVIEW</span>
              <p>
                {clip.msgPerMin} msg/min · {clip.durationSec}s · {clip.priceLabel}
              </p>
            </div>
            <h3>{clip.title}</h3>
            <p>
              @{clip.streamer} · {clip.game}
            </p>
            {clip.status === 'claimed' ? (
              <span className="chip ok">Claimed</span>
            ) : (
              <Link className="btn btn-primary" to={`/checkout/${clip.id}`}>
                Unlock Clean 4K Version
              </Link>
            )}
          </article>
        ))}
      </div>
      {!filtered.length && <p style={{ color: 'var(--muted)' }}>No heat matches that search.</p>}
    </div>
  )
}
