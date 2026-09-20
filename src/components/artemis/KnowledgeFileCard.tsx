import { ASK_ABOUT_FILE, formatRelativeTime, type KnowledgeCard } from '../../lib/artemis'

export function KnowledgeFileCard({
  card,
  onAsk,
}: {
  card: KnowledgeCard
  onAsk: (card: KnowledgeCard) => void
}) {
  return (
    <article className="artemis-file-card">
      <h3>{card.filename}</h3>
      <p className="artemis-file-card-indexed">
        <span aria-hidden="true">✓</span> Indexed
      </p>
      <p>{card.chunkCount === 1 ? '1 chunk' : `${card.chunkCount} chunks`}</p>
      <p>Last used {formatRelativeTime(card.lastUsedAt)}</p>
      <button type="button" className="artemis-cta-primary artemis-cta-compact artemis-cta-blue" onClick={() => onAsk(card)}>
        {ASK_ABOUT_FILE}
      </button>
    </article>
  )
}
