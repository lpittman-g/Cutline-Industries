import { PROCESS_STEPS, STEP_MARKS, type ProcessStepId, type StepStatus } from '../../lib/artemis'

export function ProcessingStepper({
  statuses,
}: {
  statuses: Record<ProcessStepId, StepStatus>
}) {
  return (
    <ol className="artemis-stepper" aria-label="Processing" aria-live="polite">
      {PROCESS_STEPS.map((step) => {
        const status = statuses[step.id]
        return (
          <li key={step.id} className={`is-${status}`}>
            <span aria-hidden="true">{STEP_MARKS[status]}</span>
            {step.label}
          </li>
        )
      })}
    </ol>
  )
}
