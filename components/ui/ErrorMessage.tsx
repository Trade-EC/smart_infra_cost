import React from 'react'

interface ErrorMessageProps {
  message: string
  className?: string
}

export default function ErrorMessage({
  message,
  className = '',
}: ErrorMessageProps) {
  if (!message) return null

  return (
    <div
      className={`rounded-md bg-red-50 p-4 ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <p className="text-sm text-red-800">{message}</p>
    </div>
  )
}
