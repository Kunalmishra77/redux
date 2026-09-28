import type { LucideIcon } from 'lucide-react'
import {
  BarChart3, Boxes, CalendarCheck, ClipboardList, FileText, Gauge, Hammer, Inbox, KanbanSquare,
  LifeBuoy, ListChecks, Receipt, Settings, Users,
} from 'lucide-react'
import type { AppRole } from '@/lib/auth/session'

export type NavItem = { href: string; label: string; icon: LucideIcon; match?: string }

// Portal screen spec "Shell": the sidebar is role-filtered — a person never sees an item they can't
// use, greyed out or otherwise.
export const NAV: Record<Exclude<AppRole, 'customer'>, NavItem[]> = {
  super_admin: [
    { href: '/staff', label: 'Dashboard', icon: Gauge, match: '^/staff$' },
    { href: '/staff/leads', label: 'Leads', icon: Users, match: '^/staff/leads(?!/board)' },
    { href: '/staff/leads/board', label: 'Pipeline', icon: KanbanSquare },
    { href: '/staff/surveys', label: 'Surveys', icon: CalendarCheck },
    { href: '/staff/quotes', label: 'Quotes', icon: FileText },
    { href: '/staff/jobs', label: 'Jobs', icon: Hammer },
    { href: '/staff/admin/invoices', label: 'Invoices', icon: Receipt },
    { href: '/staff/admin/stock', label: 'Stock', icon: Boxes },
    { href: '/staff/service-requests', label: 'Service requests', icon: LifeBuoy },
    { href: '/staff/admin/reports', label: 'Reports', icon: BarChart3 },
    { href: '/staff/admin', label: 'Admin', icon: Settings, match: '^/staff/admin(?!/(invoices|stock|reports))' },
  ],
  cc_exec: [
    { href: '/staff/leads/mine', label: 'My leads', icon: Users, match: '^/staff/leads' },
    { href: '/staff/follow-ups', label: 'Follow-ups', icon: ListChecks },
    { href: '/staff/inbox', label: 'Inbox', icon: Inbox },
    { href: '/staff/surveys', label: 'Surveys', icon: CalendarCheck },
    { href: '/staff/jobs', label: 'Jobs', icon: Hammer },
    { href: '/staff/service-requests', label: 'Service requests', icon: LifeBuoy },
    { href: '/staff/me/stats', label: 'My stats', icon: BarChart3 },
  ],
  surveyor: [
    { href: '/staff/surveys', label: 'My surveys', icon: ClipboardList },
    { href: '/staff/quotes', label: 'My quotes', icon: FileText },
    { href: '/staff/jobs', label: 'Handovers', icon: Hammer },
  ],
}

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  cc_exec: 'Care Executive',
  surveyor: 'Surveyor',
  customer: 'Customer',
}
