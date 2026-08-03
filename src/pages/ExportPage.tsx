import { useMemo, useState } from 'react'
import { useCutline } from '../context/cutlineContextObject'
import {
  clipsToChapters,
  clipsToCsv,
  clipsToFfmpegScript,
  clipsToJson,
  clipsToYoutubeDraft,
} from '../lib/export'
import { downloadText } from '../lib/utils'

export function ExportPage() {
  const { activeProject, projectClips } = useCutline()
  const [filter, setFilter] = useState<'all' | 'ready'>('ready')

  const clips = useMemo(() => {
    const list = filter === 'ready'
      ? projectClips.filter((c) => c.status === 'ready' || c.status === 'exported')
      : projectClips
    return list.length ? list : projectClips
  }, [filter, projectClips])

  if (!activeProject) {
    return <div className="empty panel panel-pad">Select a project first.</div>
  }

  const base = activeProject.name.replace(/\s+/g, '_').slice(0, 40)

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Export</h1>
          <p>
            Manual exports for CapCut / FFmpeg. For hands-off posting, use Autopilot — it cuts and
            uploads without you clicking export.
          </p>
        </div>
        <div className="btn-row">
          <button
            className={`btn ${filter === 'ready' ? 'btn-primary' : ''}`}
            type="button"
            onClick={() => setFilter('ready')}
          >
            Ready only
          </button>
          <button
            className={`btn ${filter === 'all' ? 'btn-primary' : ''}`}
            type="button"
            onClick={() => setFilter('all')}
          >
            All clips
          </button>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel panel-pad">
          <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Download</h3>
          <div className="btn-row">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => downloadText(`${base}_clips.json`, clipsToJson(activeProject, clips), 'application/json')}
            >
              JSON
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => downloadText(`${base}_clips.csv`, clipsToCsv(clips), 'text/csv')}
            >
              CSV
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => downloadText(`${base}_cut_shorts.sh`, clipsToFfmpegScript(activeProject, clips), 'text/x-shellscript')}
            >
              FFmpeg script
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => downloadText(`${base}_youtube_drafts.txt`, clipsToYoutubeDraft(clips))}
            >
              YouTube drafts
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => downloadText(`${base}_chapters.txt`, clipsToChapters(clips))}
            >
              Chapters
            </button>
          </div>
          <p style={{ color: 'var(--muted)', marginTop: '1rem' }}>
            Exporting {clips.length} clips from <strong>{activeProject.name}</strong>.
          </p>
        </section>

        <section className="panel panel-pad">
          <h3 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Preview</h3>
          <pre
            style={{
              margin: 0,
              maxHeight: 360,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              color: 'var(--muted)',
              fontSize: '0.78rem',
            }}
          >
            {clipsToYoutubeDraft(clips.slice(0, 3)) || 'No clips to preview.'}
          </pre>
        </section>
      </div>
    </div>
  )
}
