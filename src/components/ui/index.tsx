import React, { forwardRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { clsx } from 'clsx'
import type { Toast, ToastType } from '../../hooks/useToast'

// ── Button ────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

const btnVariants: Record<BtnVariant, string> = {
  primary:   'bg-blue-600 hover:bg-blue-700 text-white border border-blue-600',
  secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300',
  danger:    'bg-red-600 hover:bg-red-700 text-white border border-red-600',
  success:   'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600',
  ghost:     'bg-transparent hover:bg-gray-100 text-gray-600 border border-transparent',
}
const btnSizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' }

export const Button = forwardRef<HTMLButtonElement, BtnProps>(
  ({ variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center gap-2 font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed',
        btnVariants[variant], btnSizes[size], className
      )}
      {...props}
    >
      {loading ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : icon}
      {children}
    </button>
  )
)
Button.displayName = 'Button'

// ── Input ─────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>}
      <input
        ref={ref}
        className={clsx(
          'border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          error ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:border-gray-400',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  )
)
Input.displayName = 'Input'

// ── Select ────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string | number; label: string }[]
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>}
      <select
        ref={ref}
        className={clsx(
          'border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          error ? 'border-red-400' : 'border-gray-300 hover:border-gray-400',
          className
        )}
        {...props}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
)
Select.displayName = 'Select'

// ── Textarea ──────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>}
      <textarea
        ref={ref}
        className={clsx(
          'border rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 transition-colors resize-none',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          error ? 'border-red-400' : 'border-gray-300 hover:border-gray-400',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
)
Textarea.displayName = 'Textarea'

// ── Modal ─────────────────────────────────────────────────────────────────
interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: React.ReactNode
}
const modalSizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' }

export function Modal({ open, onClose, title, children, size = 'md', footer }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx('relative bg-white rounded-2xl shadow-2xl w-full flex flex-col max-h-[90vh]', modalSizes[size])}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────
type BadgeColor = 'blue' | 'green' | 'red' | 'yellow' | 'gray' | 'purple'
const badgeColors: Record<BadgeColor, string> = {
  blue:   'bg-blue-100 text-blue-700',
  green:  'bg-emerald-100 text-emerald-700',
  red:    'bg-red-100 text-red-700',
  yellow: 'bg-amber-100 text-amber-700',
  gray:   'bg-gray-100 text-gray-600',
  purple: 'bg-purple-100 text-purple-700',
}
export function Badge({ color = 'gray', children }: { color?: BadgeColor; children: React.ReactNode }) {
  return <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold', badgeColors[color])}>{children}</span>
}

// ── StatCard ──────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  color?: string
  sub?: string
}
export function StatCard({ label, value, icon, color = 'text-blue-600', sub }: StatCardProps) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={clsx('p-2.5 rounded-xl bg-gray-50', color)}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-extrabold text-gray-900 tracking-tight mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────
interface Column<T> {
  key: string
  header: string
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (row: T, i: number) => React.ReactNode
}
interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyFn: (row: T) => string | number
  onRowClick?: (row: T) => void
  selectedKey?: string | number | null
  emptyText?: string
  loading?: boolean
}
export function Table<T>({ columns, data, keyFn, onRowClick, selectedKey, emptyText = 'Tidak ada data', loading }: TableProps<T>) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {columns.map(c => (
                <th key={c.key} style={{ width: c.width }}
                  className={clsx('px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide',
                    c.align === 'center' ? 'text-center' : c.align === 'right' ? 'text-right' : 'text-left')}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400">
                <div className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Memuat data...
                </div>
              </td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400 text-sm">{emptyText}</td></tr>
            ) : data.map((row, i) => {
              const k = keyFn(row)
              return (
                <tr key={k}
                  onClick={() => onRowClick?.(row)}
                  className={clsx(
                    'transition-colors',
                    onRowClick ? 'cursor-pointer hover:bg-blue-50' : '',
                    selectedKey === k ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                  )}>
                  {columns.map(c => (
                    <td key={c.key}
                      className={clsx('px-4 py-3 text-gray-700',
                        c.align === 'center' ? 'text-center' : c.align === 'right' ? 'text-right' : 'text-left')}>
                      {c.render ? c.render(row, i) : (row as any)[c.key] ?? '-'}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── SearchBar ─────────────────────────────────────────────────────────────
import { Search } from 'lucide-react'
export function SearchBar({ value, onChange, placeholder = 'Cari...' }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full text-gray-900 placeholder-gray-400"
      />
    </div>
  )
}

// ── Confirm Dialog ────────────────────────────────────────────────────────
export function ConfirmDialog({ open, onConfirm, onCancel, title, message, danger = false }: {
  open: boolean; onConfirm: () => void; onCancel: () => void
  title: string; message: string; danger?: boolean
}) {
  return (
    <Modal open={open} onClose={onCancel} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onCancel}>Batal</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {danger ? 'Hapus' : 'Konfirmasi'}
        </Button>
      </>}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={clsx('w-5 h-5 mt-0.5 shrink-0', danger ? 'text-red-500' : 'text-amber-500')} />
        <div>
          <p className="font-semibold text-gray-900">{title}</p>
          <p className="text-sm text-gray-500 mt-1">{message}</p>
        </div>
      </div>
    </Modal>
  )
}

// ── Toast Container ───────────────────────────────────────────────────────
const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4 text-emerald-500" />,
  error:   <AlertCircle className="w-4 h-4 text-red-500" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  info:    <Info className="w-4 h-4 text-blue-500" />,
}
const toastColors: Record<ToastType, string> = {
  success: 'border-emerald-200 bg-emerald-50',
  error:   'border-red-200 bg-red-50',
  warning: 'border-amber-200 bg-amber-50',
  info:    'border-blue-200 bg-blue-50',
}
export function ToastContainer({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={clsx('flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg pointer-events-auto animate-in slide-in-from-right-4', toastColors[t.type])}>
          {toastIcons[t.type]}
          <span className="text-sm font-medium text-gray-800">{t.message}</span>
          <button onClick={() => remove(t.id)} className="ml-2 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
        </div>
      ))}
    </div>
  )
}


// ── InfoTooltip ───────────────────────────────────────────────────────────
// Ikon ⓘ kecil yang menampilkan tooltip saat di-hover
// Contoh: <InfoTooltip text="NISN dipakai sebagai kunci import nilai" />
export function InfoTooltip({ text, position = 'top' }: { text: string; position?: 'top' | 'bottom' | 'left' | 'right' }) {
  const [show, setShow] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef = React.useRef<HTMLButtonElement>(null)

  function updateCoords() {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    let top = 0, left = 0
    if (position === 'top')    { top = r.top - 8;       left = r.left + r.width / 2 }
    if (position === 'bottom') { top = r.bottom + 8;    left = r.left + r.width / 2 }
    if (position === 'left')   { top = r.top + r.height / 2; left = r.left - 8 }
    if (position === 'right')  { top = r.top + r.height / 2; left = r.right + 8 }
    setCoords({ top, left })
  }

  const transformClass: Record<string, string> = {
    top:    '-translate-x-1/2 -translate-y-full',
    bottom: '-translate-x-1/2',
    left:   '-translate-x-full -translate-y-1/2',
    right:  '-translate-y-1/2',
  }

  return (
    <span className="relative inline-flex items-center" style={{ verticalAlign: 'middle' }}>
      <button
        ref={btnRef}
        type="button"
        onMouseEnter={() => { updateCoords(); setShow(true) }}
        onMouseLeave={() => setShow(false)}
        onFocus={() => { updateCoords(); setShow(true) }}
        onBlur={() => setShow(false)}
        className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center text-[10px] font-bold leading-none transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 shrink-0"
        aria-label="Info"
      >
        i
      </button>
      {show && typeof window !== 'undefined' && ReactDOM.createPortal(
        <span
          className={clsx('fixed z-[9999] w-64 bg-gray-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl pointer-events-none', transformClass[position])}
          style={{ top: coords.top, left: coords.left }}
        >
          {text}
          <span className={clsx('absolute w-2 h-2 bg-gray-900 rotate-45',
            position === 'top'    ? 'top-full left-1/2 -translate-x-1/2 -mt-1' :
            position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 mb-[-4px]' :
            position === 'left'   ? 'left-full top-1/2 -translate-y-1/2 -ml-1' :
                                    'right-full top-1/2 -translate-y-1/2 mr-[-4px]'
          )} />
        </span>,
        document.body
      )}
    </span>
  )
}

// ── Page Header ───────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }: {
  title: string; subtitle?: string; actions?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 ml-4">{actions}</div>}
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }: {
  icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 bg-gray-100 rounded-2xl mb-4 text-gray-400">{icon}</div>
      <h3 className="font-semibold text-gray-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-400 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return <div className={clsx('w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin', className)} />
}

// ── Section Card ──────────────────────────────────────────────────────────
export function SectionCard({ title, children, className }: {
  title?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={clsx('card p-5', className)}>
      {title && <h3 className="text-sm font-bold text-gray-700 mb-4 pb-3 border-b border-gray-100">{title}</h3>}
      {children}
    </div>
  )
}
