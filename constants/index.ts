// Navigation items
export const NAVIGATION_ITEMS = [
  { key: 'dashboard', href: '/app/dashboard', icon: '📊' },
  { key: 'clients', href: '/app/clients', icon: '👥' },
  { key: 'applications', href: '/app/applications', icon: '📱' },
  { key: 'costs', href: '/app/costs', icon: '💰' },
  { key: 'transactions', href: '/app/transactions', icon: '💳' },
  { key: 'reports', href: '/app/reports', icon: '📈' },
  { key: 'users', href: '/app/users', icon: '👤' },
] as const

// Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/app/dashboard',
  CLIENTS: '/app/clients',
  APPLICATIONS: '/app/applications',
  COSTS: '/app/costs',
  TRANSACTIONS: '/app/transactions',
  REPORTS: '/app/reports',
  USERS: '/app/users',
} as const

// CSV Configuration
export const CSV_COLUMNS = {
  DATE_UTC: 'Date (UTC)',
  DESCRIPTION: 'Description',
  AMOUNT: 'Amount',
  NAME_ON_CARD: 'Name On Card',
  STATUS: 'Status',
} as const

export const CSV_STATUS = {
  SENT: 'Sent',
  FAILED: 'Failed',
} as const

// Date formats
export const DATE_FORMATS = {
  DISPLAY: 'DD/MM/YYYY',
  MONTH: 'YYYY-MM',
  ISO: 'YYYY-MM-DD',
} as const

// Validation
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 6,
} as const
