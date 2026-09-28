// Demo cast. Every demo login uses the same password, read from DEMO_PASSWORD in .env.local — never
// committed, because the repository is public. Everything here is removed by resetting staging
// (see scripts/demo/README.md). Emails use the reserved-for-demo domain redux.demo.
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? ''
if (!DEMO_PASSWORD) throw new Error('Set DEMO_PASSWORD in .env.local before seeding the demo')

export type DemoUser = {
  key: string
  email: string
  name: string
  role: 'super_admin' | 'cc_exec' | 'surveyor' | 'customer'
  phone?: string
  city?: string
}

export const DEMO_STAFF: DemoUser[] = [
  { key: 'admin', email: 'vikram@redux.demo', name: 'Vikram Sethi', role: 'super_admin', phone: '+919811000001' },
  { key: 'priya', email: 'priya@redux.demo', name: 'Priya Nair', role: 'cc_exec', phone: '+919811000002', city: 'Delhi' },
  { key: 'arjun', email: 'arjun@redux.demo', name: 'Arjun Malhotra', role: 'cc_exec', phone: '+919811000003', city: 'Gurugram' },
  { key: 'ankit', email: 'ankit@redux.demo', name: 'Ankit Verma', role: 'surveyor', phone: '+919811000004', city: 'Delhi' },
  { key: 'sunil', email: 'sunil@redux.demo', name: 'Sunil Rawat', role: 'surveyor', phone: '+919811000005', city: 'Gurugram' },
]

// Portal logins: customers sign in by phone OTP; in demo mode the OTP is shown in the demo outbox
export const DEMO_CUSTOMERS: DemoUser[] = [
  { key: 'orchid', email: 'anita@grandorchid.redux.demo', name: 'Anita Sharma', role: 'customer', phone: '+919810011001' },
  { key: 'mehra', email: 'rohit.mehra@redux.demo', name: 'Rohit Mehra', role: 'customer', phone: '+919810011002' },
]
