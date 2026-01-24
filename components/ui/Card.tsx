import React from 'react'

interface CardProps {
  title?: string
  children: React.ReactNode
  className?: string
  headerActions?: React.ReactNode
}

export default function Card({
  title,
  children,
  className = '',
  headerActions,
}: CardProps) {
  return (
    <div className={`rounded-lg bg-white p-4 shadow ${className}`}>
      {title && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          {headerActions && <div>{headerActions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
