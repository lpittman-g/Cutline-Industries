import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { DEMO_BOUNTY_CLIPS } from '../../data/thermal'
import {
  fetchBountyPosts,
  formatUsd,
  mediaUrl,
  type ThermalBountyPost,
} from '../../lib/thermalApi'

type BoardItem = {
  clipId: number
  title: string
  streamer: string
  game: string
  durationSec: number
  thumbnailUrl: string | null
  clipStatus: string
  platform: string
  postUrl: string | null
  views: number
  engagement: number
}

function fromPost(post: ThermalBountyPost): BoardItem {
  return {
    clipId: post.clip_id,
    title: post.clip_title ?? `Clip #${post.clip_id}`,
    streamer: post.streamer_username ?? 'unknown',
    game: post.game ?? '—',
    durationSec: post.duration_sec ?? 22,
    thumbnailUrl: mediaUrl(post.thumbnail_url),
    clipStatus: post.clip_status,
    platform: post.platform,
    postUrl: post.post_url,
    views: post.views,
    engagement: post.engagement,
  }
}

export function BountyPage() {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<BoardItem[]>([])
  const [source, setSource] = useState<'live' | 'demo'>('demo')

  useEffect(() => {
    fetchBountyPosts()
      .then((data) => {
        const posted = data.posts.filter((p) => p.status === 'posted')
        if (posted.length) {
          setItems(posted.map(fromPost))
          setSource('live')
        } else {
          setItems(
            DEMO_BOUNTY_CLIPS.map((c) => ({
              clipId: Number(c.id.replace(/\D/g, '')) || 0,
              title: c.title,
              streamer: c.streamer,
              game: c.game,
              durationSec: c.durationSec,
              thumbnailUrl: null,
              clipStatus: 'unclaimed',
              platform: 'x',
              postUrl: null,
              views: 0,
              engagement: 0,
            })),
          )
          setSource('demo')
        }
      })
      .catch(() => {
        setSource('demo')
        setItems(
          DEMO_BOUNTY_CLIPS.map((c) => ({
            clipId: 0,
            title: c.title,
            streamer: c.streamer,
            game: c.game,
            durationSec: c.durationSec,
            thumbnailUrl: null,
            clipStatus: 'unclaimed',
            platform: 'x',
            postUrl: null,
            views: 0,
            engagement: 0,
          })),
        )
      })
  }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return items
    return items.filter(
      (c) =>
        c.title.toLowerCase().includes(needle) ||
        c.streamer.toLowerCase().includes(needle) ||
        c.game.toLowerCase().includes(needle),
    )
  }, [q, items])

  return (
    <div className="public-page thermal-page">
      <div className="page-head">
        <div>
          <h1>Bounty Board</h1>
          <p>Posted heat clips on X and TikTok — unlock clean 4K for {formatUsd(5000)}.</p>
        </div>
        {source === 'demo' && (
          <p className="chip warn" style={{ alignSelf: 'flex-start' }}>
            Demo clips — ops must mark bounty posts live in Mission Control
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
        {filtered.map((item) => (
          <article key={`${item.clipId}-${item.platform}`} className="bounty-card">
            <div className="bounty-preview">
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt={item.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                />
              ) : null}
              <span className="heat-pill">{item.platform.toUpperCase()}</span>
              <span className="wm-label">THERMAL PREVIEW</span>
              <p>
                {item.durationSec}s · {item.views} views · {formatUsd(5000)} bounty
              </p>
            </div>
            <h3>{item.title}</h3>
            <p>
              @{item.streamer} · {item.game}
            </p>
            {item.postUrl && (
              <p style={{ fontSize: '0.85rem' }}>
                <a href={item.postUrl} target="_blank" rel="noreferrer">
                  View post
                </a>
              </p>
            )}
            {item.clipStatus === 'claimed' ? (
              <span className="chip ok">Claimed</span>
            ) : item.clipId ? (
              <Link className="btn btn-primary" to={`/checkout/${item.clipId}`}>
                Unlock Clean 4K Version
              </Link>
            ) : (
              <span className="chip warn">Demo only</span>
            )}
          </article>
        ))}
      </div>
      {!filtered.length && <p style={{ color: 'var(--muted)' }}>No heat matches that search.</p>}
    </div>
  )
}
