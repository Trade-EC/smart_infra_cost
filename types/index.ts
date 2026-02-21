// Client types
export interface Client {
  id: string
  name: string
  notes: string | null
  created_at: string
}

export interface CreateClientData {
  name: string
  notes?: string | null
}

export interface UpdateClientData {
  name?: string
  notes?: string | null
}

// Application types
export interface Application {
  id: string
  name: string
  responsable: string
  price: number
  date: string
  clients?: ApplicationClient[]
}

export interface ApplicationClient {
  id: string
  name: string
}

export interface CreateApplicationData {
  name: string
  responsable: string
  price: number
  date: string
}

export interface ApplicationFilters {
  dateFrom?: string
  dateTo?: string
  clientFilter?: string
  applicationFilter?: string
}

// Monthly Cost types
export interface MonthlyCost {
  id: string
  month: string
  total_amount: number
  created_by: string
  created_at: string
}

export interface CostAllocation {
  id: string
  monthly_cost_id: string
  application_id: string
  total_amount: number
}

export interface CostDistribution {
  id: string
  cost_allocation_id: string
  client_id: string
  allocation_percentage: number
  allocated_amount: number
}

export interface CreateMonthlyCostData {
  month: string
  totalAmount: number
  allocations: MonthlyCostAllocation[]
}

export interface MonthlyCostAllocation {
  applicationId: string
  applicationPrice: number
  clientIds: string[]
}

// Transaction types
export interface Transaction {
  id: string
  month: string
  quantity: number
  cost_per_transaction: number
  total_cost: number
  description: string | null
  created_by: string
  created_at: string
}

export interface CreateTransactionData {
  month: string
  quantity: number
  costPerTransaction: number
  description?: string | null
  clientIds: string[]
}

// UI Component types
export interface TableColumn<T> {
  key: keyof T | string
  header: string
  render?: (item: T) => React.ReactNode
  className?: string
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  children: React.ReactNode
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
  children: React.ReactNode
}

// Navigation types
export interface NavItem {
  key: string
  href: string
  icon: string
}

// Supabase response types
export interface SupabaseApplicationRow {
  id: string
  name: string
  responsable: string
  price: number
  date: string
  application_clients?: SupabaseApplicationClientRelation[]
}

export interface SupabaseApplicationClientRelation {
  clients: {
    id: string
    name: string
  }
}

export interface SupabaseUpdateData {
  name?: string
  notes?: string | null
}
