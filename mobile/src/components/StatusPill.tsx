import { Pill } from './ui'
import { effectiveStatus, type LocalSurvey } from '~/lib/repo'

export function StatusPill({ s }: { s: LocalSurvey }) {
  switch (effectiveStatus(s)) {
    case 'scheduled':
      return <Pill text="Scheduled" />
    case 'checked_in':
    case 'in_progress':
      return <Pill text="In progress" tone="blue" icon="location" />
    case 'submitting':
      return <Pill text="Submitting" tone="warning" icon="arrow-up" />
    case 'submitted':
      return <Pill text="Submitted" tone="ink" icon="checkmark" />
    default:
      return <Pill text={s.status} />
  }
}
