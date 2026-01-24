// Navigation items
export const NAVIGATION_ITEMS = [
  { key: 'dashboard', href: '/dashboard', icon: '📊' },
  { key: 'clients', href: '/clients', icon: '👥' },
  { key: 'applications', href: '/applications', icon: '📱' },
  { key: 'costs', href: '/costs', icon: '💰' },
  { key: 'transactions', href: '/transactions', icon: '💳' },
  { key: 'reports', href: '/reports', icon: '📈' },
] as const

// Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  CLIENTS: '/clients',
  APPLICATIONS: '/applications',
  COSTS: '/costs',
  TRANSACTIONS: '/transactions',
  REPORTS: '/reports',
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
