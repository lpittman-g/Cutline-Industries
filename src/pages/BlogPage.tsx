import { AdSlot } from '../components/AdSlot'

const POSTS = [
  {
    slug: 'cutline-terminal-quickstart',
    title: 'Cutline Terminal Quickstart: Command Center in Five Minutes',
    excerpt:
      'Open /terminal, orient on Command Center, and run the daily ops checklist.',
  },
  {
    slug: 'mission-control-overview',
    title: 'Mission Control Overview: Clips, Bounty, and Revenue',
    excerpt:
      'How the /app surfaces fit together for Cutline Industries operators.',
  },
  {
    slug: 'cutline-monetization-stack',
    title: 'Cutline Monetization Stack: Site, Sponsors, and Stripe',
    excerpt:
      'How site AdSense, sponsors, and Stripe packs work together for Cutline Industries.',
  },
]

export function BlogPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Guides Blog</h1>
          <p>
            Companion monetization layer for search traffic — AdSense-ready guides hosted with the
            Cutline OS.
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
