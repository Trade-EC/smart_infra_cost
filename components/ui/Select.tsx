'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value?: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  searchable?: boolean
  clearLabel?: string
}

export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  className = '',
  searchable = false,
  clearLabel = 'Todos los clientes',
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const selectRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const updateCoords = () => {
    if (selectRef.current) {
      const rect = selectRef.current.getBoundingClientRect()
      setCoords({ top: rect.bottom, left: rect.left, width: rect.width })
    }
  }

  useEffect(() => {
    if (isOpen) {
      updateCoords()
      window.addEventListener('scroll', updateCoords, true)
      window.addEventListener('resize', updateCoords)
      if (searchable) setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setSearchText('')
    }
    return () => {
      window.removeEventListener('scroll', updateCoords, true)
      window.removeEventListener('resize', updateCoords)
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        selectRef.current &&
        !selectRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const selectedOption = options.find(opt => opt.value === value)

  const filteredOptions = searchable && searchText
    ? options.filter(opt => opt.label.toLowerCase().includes(searchText.toLowerCase()))
    : options

  const handleSelect = (val: string) => {
    onChange(val)
    setIsOpen(false)
    setSearchText('')
  }

  return (
    <div className={`relative ${className}`} ref={selectRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-between w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className={`block truncate ${selectedOption ? 'text-gray-900' : 'text-gray-500'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg className={`ml-2 h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] mt-1 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5"
          style={{ top: coords.top, left: coords.left, width: coords.width }}
        >
          {searchable && (
            <div className="p-2 border-b border-gray-100">
              <input
                ref={inputRef}
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Buscar..."
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}
          <div className="max-h-56 overflow-auto py-1">
            {!searchText && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                {clearLabel}
              </button>
            )}
            {filteredOptions.length === 0 ? (
              <p className="px-4 py-2 text-sm text-gray-400">Sin resultados</p>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${value === option.value ? 'bg-blue-50 text-blue-600' : 'text-gray-900'}`}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
