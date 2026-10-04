export function BlogPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Guides Blog</h1>
          <p>
            Companion content layer for Cutline Industries — guides, case studies, and Artemis
            deep-dives published here.
          </p>
        </div>
      </div>

      <section className="panel panel-pad">
        <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Coming soon</h3>
        <p style={{ color: 'var(--muted)' }}>
          No posts yet. Guides will appear here as they are published.
        </p>
      </section>
    </div>
  )
}
