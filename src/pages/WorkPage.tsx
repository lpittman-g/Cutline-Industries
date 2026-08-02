import { Link } from 'react-router-dom'

export function WorkPage() {
  return (
    <div className="public-page">
      <div className="page-head">
        <div>
          <h1>Work</h1>
          <p>Cutline cuts gaming VODs into Shorts and content packs ready for YouTube.</p>
        </div>
      </div>

      <section className="public-section panel panel-pad">
        <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Shorts factory</h2>
        <p style={{ color: 'var(--muted)' }}>
          Drop a VOD. Get a batch of vertical clips with titles, hooks, and tags — built for daily
          posting, not one-off edits.
        </p>
      </section>

      <section className="public-section panel panel-pad">
        <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Sponsor packs</h2>
        <p style={{ color: 'var(--muted)' }}>
          Spark, Surge, and Eclipse packages for brands that want gaming Shorts with clear delivery
          and usage terms.
        </p>
        <Link className="btn btn-primary" to="/deals">
          View packages
        </Link>
      </section>
    </div>
  )
}
