import { NICHE_LABELS } from '../data/catalog'
import { useCutline } from '../context/CutlineContext'
import type { GameNiche } from '../types'

export function ProjectsPage() {
  const {
    state,
    activeProject,
    setActiveProjectId,
    createProject,
    updateProject,
    deleteProject,
    projectClips,
  } = useCutline()

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p>Each project is one VOD (or stream recording) that Autopilot can cut and post from.</p>
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" type="button" onClick={() => createProject()}>
            New project
          </button>
        </div>
      </div>

      <div className="project-grid">
        {state.projects.map((p) => {
          const count = state.clips.filter((c) => c.projectId === p.id).length
          return (
            <article
              key={p.id}
              className={`panel project-card ${activeProject?.id === p.id ? 'active' : ''}`}
              onClick={() => setActiveProjectId(p.id)}
            >
              <h3>{p.name}</h3>
              <p>
                {p.game} · {NICHE_LABELS[p.niche]} · {count} clips
              </p>
              <p style={{ marginTop: '0.55rem' }}>
                {p.vodFileName ? `File: ${p.vodFileName}` : 'No file attached (demo timeline)'}
              </p>
              <div className="btn-row" style={{ marginTop: '0.85rem' }} onClick={(e) => e.stopPropagation()}>
                <button className="btn btn-danger" type="button" onClick={() => deleteProject(p.id)}>
                  Delete
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {activeProject ? (
        <section className="panel panel-pad" style={{ marginTop: '1.25rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', marginTop: 0 }}>Active project</h2>
          <div className="grid-2">
            <div className="field">
              <label>Name</label>
              <input
                value={activeProject.name}
                onChange={(e) => updateProject(activeProject.id, { name: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Game</label>
              <input
                value={activeProject.game}
                onChange={(e) => updateProject(activeProject.id, { game: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Niche</label>
              <select
                value={activeProject.niche}
                onChange={(e) =>
                  updateProject(activeProject.id, { niche: e.target.value as GameNiche })
                }
              >
                {Object.entries(NICHE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Notes</label>
              <input
                value={activeProject.notes}
                onChange={(e) => updateProject(activeProject.id, { notes: e.target.value })}
              />
            </div>
          </div>
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            Studio has {projectClips.length} clips for this project.
          </p>
        </section>
      ) : null}
    </div>
  )
}
