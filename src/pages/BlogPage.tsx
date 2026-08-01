import { AdSlot } from '../components/AdSlot'

const POSTS = [
  {
    slug: 'rank-reset-survival-guide',
    title: 'Rank Reset Survival Guide: What to Do in Your First 10 Games',
    excerpt:
      'A practical climb framework you can film as an 8–10 minute video and cut into Shorts the same day.',
  },
  {
    slug: 'patch-notes-that-break-meta',
    title: 'Patch Notes That Break the Meta (And How to Content Them Fast)',
    excerpt:
      'Turn every patch drop into longform + Shorts without waiting for the algorithm to move on.',
  },
  {
    slug: 'youtube-shorts-to-adsense',
    title: 'From Shorts Views to AdSense: Cutline Monetization Stack',
    excerpt:
      'How YPP, site AdSense, sponsors, and Stripe packs work together for gaming channels.',
  },
]

export function BlogPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Guides Blog</h1>
          <p>
            Companion monetization layer for search traffic outside YouTube — AdSense-ready gaming
            guides hosted with the Cutline OS.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <AdSlot />
      </div>

      <div className="project-grid">
        {POSTS.map((post) => (
          <article key={post.slug} className="panel pack-card">
            <div className="chip ready">guide</div>
            <h3>{post.title}</h3>
            <p style={{ color: 'var(--muted)' }}>{post.excerpt}</p>
            <p style={{ color: 'var(--cyan)', fontSize: '0.8rem' }}>/blog/{post.slug}</p>
          </article>
        ))}
      </div>

      <section className="panel panel-pad" style={{ marginTop: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Why this exists</h3>
        <p style={{ color: 'var(--muted)' }}>
          YouTube pays through YPP. The companion blog captures Google search intent and monetizes
          with AdSense while funneling readers into Cutline packs, media kit, and sponsor CTAs.
        </p>
      </section>
    </div>
  )
}
