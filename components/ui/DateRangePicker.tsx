'use client'

import { useState, useRef, useEffect } from 'react'

interface DateRangePickerProps {
  value?: { start: string; end: string } | null
  onChange: (range: { start: string; end: string } | null) => void
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function formatDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${y}/${m}/${d}`
}

function getDaysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

// Devuelve 0=lunes … 6=domingo (semana europea)
function firstWeekdayOf(y: number, m: number): number {
  const d = new Date(y, m - 1, 1).getDay()
  return d === 0 ? 6 : d - 1
}

const MONTHS_ES = [
  'Ene.', 'Feb.', 'Mar.', 'Abr.', 'May.', 'Jun.',
  'Jul.', 'Ago.', 'Sep.', 'Oct.', 'Nov.', 'Dic.',
]
const DAYS_ES = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do']

// ─── MonthCalendar ────────────────────────────────────────────────────────────
interface MonthCalendarProps {
  year: number
  month: number
  rangeStart: string
  rangeEnd: string
  hovered: string | null
  selecting: boolean // true = waiting for end date click
  onDay: (dateStr: string) => void
  onHover: (dateStr: string | null) => void
  today: string
}

function MonthCalendar({
  year, month, rangeStart, rangeEnd, hovered, selecting, onDay, onHover, today,
}: MonthCalendarProps) {
  const daysInMonth = getDaysInMonth(year, month)
  const offset = firstWeekdayOf(year, month)

  // Build 42-cell grid
  const cells: { day: number; current: boolean; dateStr: string }[] = []

  const prevM = month === 1 ? 12 : month - 1
  const prevY = month === 1 ? year - 1 : year
  const prevDays = getDaysInMonth(prevY, prevM)
  for (let i = offset - 1; i >= 0; i--) {
    const d = prevDays - i
    cells.push({ day: d, current: false, dateStr: toDateStr(prevY, prevM, d) })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, current: true, dateStr: toDateStr(year, month, d) })
  }
  const nextM = month === 12 ? 1 : month + 1
  const nextY = month === 12 ? year + 1 : year
  for (let d = 1; cells.length < 42; d++) {
    cells.push({ day: d, current: false, dateStr: toDateStr(nextY, nextM, d) })
  }

  // Effective range (including hover preview while selecting)
  let effStart = rangeStart
  let effEnd = rangeEnd
  if (selecting && hovered) {
    const a = rangeStart < hovered ? rangeStart : hovered
    const b = rangeStart < hovered ? hovered : rangeStart
    effStart = a
    effEnd = b
  }

  return (
    <div className="w-[196px]">
      <p className="mb-2 text-center text-xs font-bold text-gray-800">
        {MONTHS_ES[month - 1]} {year}
      </p>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7">
        {DAYS_ES.map((d) => (
          <div key={d} className="pb-1 text-center text-xs font-medium text-gray-400">
            {d}
          </div>
        ))}

        {/* Day cells */}
        {cells.map(({ day, current, dateStr }, idx) => {
          const isStart = current && dateStr === effStart && effStart !== ''
          const isEnd = current && dateStr === effEnd && effEnd !== ''
          const inRange =
            current && effStart && effEnd && effStart !== effEnd &&
            dateStr > effStart && dateStr < effEnd
          const isToday = current && dateStr === today
          const isSingle = isStart && isEnd

          // Range background pill (spans cell width for connected look)
          const colPos = idx % 7
          const rangeLeft = !isSingle && isStart
          const rangeRight = !isSingle && isEnd

          return (
            <div
              key={idx}
              className={[
                'relative flex h-7 items-center justify-center',
                current ? 'cursor-pointer' : 'cursor-default',
                inRange ? 'bg-blue-50' : '',
                rangeLeft ? 'rounded-l-full bg-blue-50' : '',
                rangeRight ? 'rounded-r-full bg-blue-50' : '',
              ].join(' ')}
              onClick={() => current && onDay(dateStr)}
              onMouseEnter={() => onHover(dateStr)}
              onMouseLeave={() => onHover(null)}
            >
              <span
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors',
                  isStart || isEnd
                    ? 'bg-blue-600 font-semibold text-white'
                    : isToday && current
                      ? 'border border-blue-500 font-semibold text-blue-600'
                      : current
                        ? 'text-gray-800 hover:bg-blue-100'
                        : 'text-gray-300',
                ].join(' ')}
              >
                {day}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── NavButton ────────────────────────────────────────────────────────────────
function NavBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-full text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800"
    >
      {label}
    </button>
  )
}

// ─── DateRangePicker ──────────────────────────────────────────────────────────
export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const t = todayStr()

  const [isOpen, setIsOpen] = useState(false)
  const [tempStart, setTempStart] = useState(value?.start ?? t)
  const [tempEnd, setTempEnd] = useState(value?.end ?? t)
  const [selecting, setSelecting] = useState(false) // true = clicked start, waiting for end
  const [hovered, setHovered] = useState<string | null>(null)

  // Calendar view: left month
  const initDate = value?.start ? new Date(value.start + 'T00:00:00') : new Date()
  const [viewYear, setViewYear] = useState(initDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initDate.getMonth() + 1)

  const rightMonth = viewMonth === 12 ? 1 : viewMonth + 1
  const rightYear = viewMonth === 12 ? viewYear + 1 : viewYear

  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (value) {
      setTempStart(value.start)
      setTempEnd(value.end)
    }
  }, [value])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSelecting(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const prevYear = () => setViewYear((y) => y - 1)
  const prevMonth = () => {
    if (viewMonth === 1) { setViewYear((y) => y - 1); setViewMonth(12) }
    else setViewMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 12) { setViewYear((y) => y + 1); setViewMonth(1) }
    else setViewMonth((m) => m + 1)
  }
  const nextYear = () => setViewYear((y) => y + 1)

  const handleDay = (dateStr: string) => {
    if (!selecting) {
      // First click: mark start
      setTempStart(dateStr)
      setTempEnd(dateStr)
      setSelecting(true)
    } else {
      // Second click: confirm range
      const s = tempStart < dateStr ? tempStart : dateStr
      const e = tempStart < dateStr ? dateStr : tempStart
      setTempStart(s)
      setTempEnd(e)
      setSelecting(false)
      onChange({ start: s, end: e })
      setIsOpen(false)
    }
  }

  const handleClear = () => {
    setTempStart(t)
    setTempEnd(t)
    setSelecting(false)
    onChange(null)
    setIsOpen(false)
  }

  const displayText = value
    ? `${formatDisplay(value.start)}  ~  ${formatDisplay(value.end)}`
    : `${formatDisplay(t)}  ~  ${formatDisplay(t)}`

  const hint = selecting
    ? 'Selecciona la fecha de fin'
    : `${formatDisplay(tempStart)}  ~  ${formatDisplay(tempEnd)}`

  return (
    <div className="relative" ref={pickerRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setIsOpen((o) => !o); setSelecting(false) }}
        className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-gray-400">
          <path d="M8 2v4" /><path d="M16 2v4" />
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M3 10h18" />
        </svg>
        {displayText}
      </button>

      {/* Dropdown calendar */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
          {/* Navigation */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex gap-1">
              <NavBtn label="«" onClick={prevYear} />
              <NavBtn label="‹" onClick={prevMonth} />
            </div>
            <div className="flex gap-1">
              <NavBtn label="›" onClick={nextMonth} />
              <NavBtn label="»" onClick={nextYear} />
            </div>
          </div>

          {/* Two-month grid */}
          <div className="flex gap-5">
            <MonthCalendar
              year={viewYear} month={viewMonth}
              rangeStart={tempStart} rangeEnd={tempEnd}
              hovered={hovered} selecting={selecting}
              onDay={handleDay} onHover={setHovered}
              today={t}
            />
            <div className="w-px bg-gray-100" />
            <MonthCalendar
              year={rightYear} month={rightMonth}
              rangeStart={tempStart} rangeEnd={tempEnd}
              hovered={hovered} selecting={selecting}
              onDay={handleDay} onHover={setHovered}
              today={t}
            />
          </div>

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="text-sm text-gray-500">{hint}</span>
            <button
              type="button"
              onClick={handleClear}
              className="rounded-full border border-gray-200 bg-gray-50 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Limpiar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
