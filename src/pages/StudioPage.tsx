import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { NICHE_LABELS } from '../data/catalog'
import { useCutline } from '../context/cutlineContextObject'
import type { GameNiche } from '../types'
import { clamp, formatTime, parseTimestamp } from '../lib/utils'

export function StudioPage() {
  const {
    activeProject,
    projectClips,
    selectedClip,
    selectedClipId,
    setSelectedClipId,
    updateProject,
    addClip,
    updateClip,
    deleteClip,
    duplicateClip,
    regenerateCopy,
    markRange,
    attachVod,
    clearVod,
  } = useCutline()

  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [markIn, setMarkIn] = useState('0:00')
  const [markOut, setMarkOut] = useState('0:25')
  const [duration, setDuration] = useState(activeProject?.vodDuration || 600)

  useEffect(() => {
    setDuration(activeProject?.vodDuration || 600)
  }, [activeProject?.id, activeProject?.vodDuration])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      }
      if (e.key === 'i' || e.key === 'I') {
        setMarkIn(formatTime(currentTime))
      }
      if (e.key === 'o' || e.key === 'O') {
        setMarkOut(formatTime(currentTime))
      }
      if (e.key === 'm' || e.key === 'M') {
        commitMark()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, markIn, markOut, activeProject])

  const markInSec = parseTimestamp(markIn) ?? 0
  const markOutSec = parseTimestamp(markOut) ?? markInSec + 20

  const avgScore = useMemo(() => {
    if (!projectClips.length) return 0
    return Math.round(projectClips.reduce((a, c) => a + c.score, 0) / projectClips.length)
  }, [projectClips])

  if (!activeProject) {
    return (
      <div className="empty panel panel-pad">
        <p>Create a project to start cutting Shorts.</p>
      </div>
    )
  }

  function togglePlay() {
    const v = videoRef.current
    if (!v || !activeProject?.vodObjectUrl) {
      setPlaying((p) => !p)
      return
    }
    if (v.paused) {
      void v.play()
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }

  function seek(to: number) {
    const next = clamp(to, 0, duration || 0)
    setCurrentTime(next)
    if (videoRef.current) videoRef.current.currentTime = next
  }

  function onTrackClick(e: MouseEvent<HTMLDivElement>) {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || !duration) return
    const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1)
    seek(ratio * duration)
  }

  function commitMark() {
    const start = Math.min(markInSec, markOutSec)
    const end = Math.max(markInSec, markOutSec)
    if (end - start < 1) return
    markRange(start, end)
  }

  function onFile(file: File | null) {
    if (!file) return
    const url = URL.createObjectURL(file)
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    probe.src = url
    probe.onloadedmetadata = () => {
      attachVod(file, probe.duration || 0, url)
      setDuration(probe.duration || 0)
      setCurrentTime(0)
    }
  }

  function nudge(seconds: number) {
    seek(currentTime + seconds)
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Studio</h1>
          <p>
            Drop a VOD, mark moments with <span className="kbd">I</span>/<span className="kbd">O</span>
            , save with <span className="kbd">M</span>, then pack Shorts for daily posting.
          </p>
        </div>
        <div className="btn-row">
          <button className="btn" type="button" onClick={() => fileRef.current?.click()}>
            Upload VOD
          </button>
          <button className="btn btn-primary" type="button" onClick={() => addClip()}>
            New clip
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: '1rem' }}>
        <div className="panel stat">
          <div className="label">Clips</div>
          <div className="value lime">{projectClips.length}</div>
        </div>
        <div className="panel stat">
          <div className="label">Avg score</div>
          <div className="value cyan">{avgScore}</div>
        </div>
        <div className="panel stat">
          <div className="label">VOD length</div>
          <div className="value">{formatTime(duration)}</div>
        </div>
      </div>

      <div className="studio-layout">
        <section className="panel panel-pad">
          <div className="grid-2" style={{ marginBottom: '0.85rem' }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Project name</label>
              <input
                value={activeProject.name}
                onChange={(e) => updateProject(activeProject.id, { name: e.target.value })}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Game</label>
              <input
                value={activeProject.game}
                onChange={(e) => updateProject(activeProject.id, { game: e.target.value })}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Niche</label>
              <select
                value={activeProject.niche}
                onChange={(e) =>
                  updateProject(activeProject.id, { niche: e.target.value as GameNiche })
                }
              >
                {Object.entries(NICHE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Source file</label>
              <input value={activeProject.vodFileName ?? 'Demo timeline (upload to replace)'} readOnly />
            </div>
          </div>

          <div className="player-wrap">
            {activeProject.vodObjectUrl ? (
              <video
                ref={videoRef}
                src={activeProject.vodObjectUrl}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration
                  setDuration(d)
                  updateProject(activeProject.id, { vodDuration: d })
                }}
              />
            ) : (
              <div className="player-placeholder">
                <div>
                  <strong>Timeline armed</strong>
                  Demo duration is loaded so you can cut packs immediately.
                  <br />
                  Upload a VOD when you want real playback.
                  {activeProject.vodFileName ? null : (
                    <div style={{ marginTop: '0.75rem' }}>
                      <button className="btn btn-primary" type="button" onClick={() => fileRef.current?.click()}>
                        Choose video file
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="transport">
            <button className="btn" type="button" onClick={() => nudge(-5)}>
              −5s
            </button>
            <button className="btn btn-primary" type="button" onClick={togglePlay}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <button className="btn" type="button" onClick={() => nudge(5)}>
              +5s
            </button>
            {activeProject.vodObjectUrl ? (
              <button className="btn btn-ghost" type="button" onClick={clearVod}>
                Detach VOD
              </button>
            ) : null}
            <span className="timecode">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="timeline">
            <div className="timeline-track" ref={trackRef} onClick={onTrackClick}>
              <div
                className="timeline-range"
                style={{
                  left: `${(Math.min(markInSec, markOutSec) / duration) * 100}%`,
                  width: `${(Math.abs(markOutSec - markInSec) / duration) * 100}%`,
                }}
              />
              {projectClips.map((c) => (
                <div
                  key={c.id}
                  className={`timeline-clip ${selectedClipId === c.id ? 'selected' : ''}`}
                  style={{
                    left: `${(c.start / duration) * 100}%`,
                    width: `${Math.max(((c.end - c.start) / duration) * 100, 1.2)}%`,
                  }}
                  title={c.title}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedClipId(c.id)
                    seek(c.start)
                  }}
                >
                  {c.label}
                </div>
              ))}
              <div
                className="timeline-playhead"
                style={{ left: `${(currentTime / Math.max(duration, 1)) * 100}%` }}
              />
            </div>

            <div className="mark-row">
              <div className="field">
                <label>In (I)</label>
                <input value={markIn} onChange={(e) => setMarkIn(e.target.value)} />
              </div>
              <div className="field">
                <label>Out (O)</label>
                <input value={markOut} onChange={(e) => setMarkOut(e.target.value)} />
              </div>
              <button className="btn btn-primary" type="button" onClick={commitMark}>
                Save mark (M)
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setMarkIn(formatTime(currentTime))
                  setMarkOut(formatTime(Math.min(currentTime + 25, duration)))
                }}
              >
                Mark from playhead
              </button>
            </div>
          </div>
        </section>

        <aside className="panel panel-pad inspector">
          <h3>Clip inspector</h3>
          {!selectedClip ? (
            <div className="empty">Select a clip on the timeline or from the list.</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span className={`chip ${selectedClip.status}`}>{selectedClip.status}</span>
                <div
                  className="score-ring"
                  style={{ ['--p' as string]: selectedClip.score }}
                  title="Retention readiness score"
                >
                  <span>{selectedClip.score}</span>
                </div>
              </div>

              <div className="field">
                <label>Label</label>
                <input
                  value={selectedClip.label}
                  onChange={(e) => updateClip(selectedClip.id, { label: e.target.value })}
                />
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Start (sec)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedClip.start}
                    onChange={(e) =>
                      updateClip(selectedClip.id, { start: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="field">
                  <label>End (sec)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedClip.end}
                    onChange={(e) =>
                      updateClip(selectedClip.id, { end: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
              <div className="field">
                <label>Hook (first line / spoken open)</label>
                <input
                  value={selectedClip.hook}
                  onChange={(e) => updateClip(selectedClip.id, { hook: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Title</label>
                <input
                  value={selectedClip.title}
                  onChange={(e) => updateClip(selectedClip.id, { title: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Description</label>
                <textarea
                  value={selectedClip.description}
                  onChange={(e) => updateClip(selectedClip.id, { description: e.target.value })}
                />
              </div>
              <div className="field">
                <label>CTA</label>
                <input
                  value={selectedClip.cta}
                  onChange={(e) => updateClip(selectedClip.id, { cta: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Hashtags</label>
                <div className="hashtag-row">
                  {selectedClip.hashtags.map((tag) => (
                    <span className="hashtag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Status</label>
                <select
                  value={selectedClip.status}
                  onChange={(e) =>
                    updateClip(selectedClip.id, {
                      status: e.target.value as typeof selectedClip.status,
                    })
                  }
                >
                  <option value="draft">draft</option>
                  <option value="ready">ready</option>
                  <option value="exported">exported</option>
                  <option value="published">published</option>
                </select>
              </div>
              <div className="btn-row">
                <button className="btn" type="button" onClick={() => regenerateCopy(selectedClip.id)}>
                  Regen copy
                </button>
                <button className="btn" type="button" onClick={() => duplicateClip(selectedClip.id)}>
                  Duplicate
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => seek(selectedClip.start)}
                >
                  Jump in
                </button>
                <button
                  className="btn btn-danger"
                  type="button"
                  onClick={() => deleteClip(selectedClip.id)}
                >
                  Delete
                </button>
              </div>
            </>
          )}

          <h3 style={{ marginTop: '1.5rem' }}>Clip library</h3>
          <div className="clip-list">
            {projectClips.map((c) => (
              <div
                key={c.id}
                className={`clip-card ${selectedClipId === c.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedClipId(c.id)
                  seek(c.start)
                }}
              >
                <div className="score-ring" style={{ ['--p' as string]: c.score }}>
                  <span>{c.score}</span>
                </div>
                <div>
                  <h4>{c.label}</h4>
                  <p>
                    {formatTime(c.start)} → {formatTime(c.end)} · {c.title}
                  </p>
                </div>
                <span className={`chip ${c.status}`}>{c.status}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
