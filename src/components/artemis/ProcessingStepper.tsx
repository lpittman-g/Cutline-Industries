import { PROCESS_STEPS, type ProcessStepId, type StepStatus } from '../../lib/artemis'

const MARK: Record<StepStatus, string> = {
  in_progress: '◉',
  done: '✓',
  pending: '○',
}

export function ProcessingStepper({
  statuses,
}: {
  statuses: Record<ProcessStepId, StepStatus>
}) {
  return (
    <ol className="artemis-stepper" aria-label="Processing">
      {PROCESS_STEPS.map((step) => {
        const status = statuses[step.id]
        return (
          <li key={step.id} className={`is-${status}`}>
            <span aria-hidden="true">{MARK[status]}</span>
            {step.label}
          </li>
        )
      })}
    </ol>
  )
}
