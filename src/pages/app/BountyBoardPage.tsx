import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchBountyPosts,
  fetchClips,
  markBountyPosted,
  mediaUrl,
  queueBountyPost,
  updateBountyMetrics,
  type ThermalBountyPost,
  type ThermalClip,
} from '../../lib/thermalApi'

export function BountyBoardPage() {
  const [posts, setPosts] = useState<ThermalBountyPost[]>([])
  const [clips, setClips] = useState<ThermalClip[]>([])
  const [error, setError] = useState<string | null>(null)
  const [queueClipId, setQueueClipId] = useState('')
  const [queuePlatform, setQueuePlatform] = useState<'x' | 'tiktok'>('x')
  const [markingId, setMarkingId] = useState<number | null>(null)
  const [postUrl, setPostUrl] = useState('')

  const load = async () => {
    try {
      const [postData, clipData] = await Promise.all([fetchBountyPosts(), fetchClips()])
      setPosts(postData.posts)
      setClips(clipData.clips.filter((c) => c.media_url))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bounty data unavailable')
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [])

  const handleQueue = async () => {
    const clipId = Number(queueClipId)
    if (!clipId) return
    try {
      await queueBountyPost(clipId, queuePlatform)
      setQueueClipId('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Queue failed')
    }
  }

  const handleMarkPosted = async (id: number) => {
    if (!postUrl.trim()) return
    try {
      await markBountyPosted(id, { postUrl: postUrl.trim() })
      setMarkingId(null)
      setPostUrl('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mark posted failed')
    }
  }

  const handleMetrics = async (post: ThermalBountyPost) => {
    const views = prompt('Views', String(post.views ?? 0))
    const engagement = prompt('Engagement (likes+comments)', String(post.engagement ?? 0))
    if (views == null || engagement == null) return
    try {
      await updateBountyMetrics(post.id, {
        views: Number(views),
        engagement: Number(engagement),
      })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Metrics update failed')
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Bounty Board</h1>
          <p>Queue clips for X/TikTok, mark posted with real URLs, sync engagement.</p>
        </div>
        <Link className="btn" to="/bounty" target="_blank" rel="noreferrer">
          Public board ↗
        </Link>
      </div>

      {error && <p className="chip warn">{error}</p>}

      <section className="panel panel-pad" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Queue for bounty ($50)</h3>
        <div className="btn-row" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <select
            value={queueClipId}
            onChange={(e) => setQueueClipId(e.target.value)}
            className="btn"
            style={{ minWidth: 200 }}
          >
            <option value="">Select clip…</option>
            {clips.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.id} {c.title ?? 'clip'} · @{c.streamer_username}
              </option>
            ))}
          </select>
          <select
            value={queuePlatform}
            onChange={(e) => setQueuePlatform(e.target.value as 'x' | 'tiktok')}
            className="btn"
          >
            <option value="x">X</option>
            <option value="tiktok">TikTok</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={() => void handleQueue()}>
            Queue bounty post
          </button>
        </div>
      </section>

      <section className="panel panel-pad">
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Distribution queue</h3>
        {posts.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No bounty posts — queue a clip above.</p>
        ) : (
          <div className="project-grid">
            {posts.map((post) => {
              const thumb = mediaUrl(post.thumbnail_url)
              return (
                <article key={post.id} className="panel panel-pad">
                  {thumb && (
                    <img
                      src={thumb}
                      alt={post.clip_title ?? 'clip'}
                      style={{ width: '100%', borderRadius: 8, marginBottom: '0.75rem' }}
                    />
                  )}
                  <strong>{post.clip_title ?? `Clip #${post.clip_id}`}</strong>
                  <p style={{ color: 'var(--muted)', margin: '0.35rem 0' }}>
                    @{post.streamer_username} · {post.game} · {post.platform.toUpperCase()} ·{' '}
                    {post.status}
                  </p>
                  {post.post_url && (
                    <p style={{ margin: '0.35rem 0' }}>
                      <a href={post.post_url} target="_blank" rel="noreferrer">
                        {post.post_url}
                      </a>
                    </p>
                  )}
                  {post.notes && (
                    <p style={{ color: 'var(--muted)', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                      Caption: {post.notes}
                    </p>
                  )}
                  <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    {post.views} views · {post.engagement} engagement · clip {post.clip_status}
                  </p>
                  <div className="btn-row">
                    {post.status === 'queued' && (
                      <>
                        {markingId === post.id ? (
                          <>
                            <input
                              value={postUrl}
                              onChange={(e) => setPostUrl(e.target.value)}
                              placeholder="https://x.com/… or TikTok URL"
                              style={{ flex: 1, minWidth: 180 }}
                            />
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => void handleMarkPosted(post.id)}
                            >
                              Save URL
                            </button>
                            <button type="button" className="btn" onClick={() => setMarkingId(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => {
                              setMarkingId(post.id)
                              setPostUrl('')
                            }}
                          >
                            Mark as posted
                          </button>
                        )}
                      </>
                    )}
                    {post.status === 'posted' && (
                      <button type="button" className="btn" onClick={() => void handleMetrics(post)}>
                        Update metrics
                      </button>
                    )}
                    <Link
                      className="btn"
                      to={`/checkout/${post.clip_id}?tier=bounty`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Claim CTA ↗
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
