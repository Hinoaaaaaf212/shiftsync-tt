'use client'

import { ReactNode } from 'react'

interface FadeInProps {
  children: ReactNode
  className?: string
}

export function FadeIn({ children, className = '' }: FadeInProps) {
  return (
    <div className={`animate-in fade-in duration-500 ${className}`}>
      {children}
    </div>
  )
}

interface StaggerContainerProps {
  children: ReactNode
  className?: string
}

export function StaggerContainer({ children, className = '' }: StaggerContainerProps) {
  return (
    <div className={className}>
      {children}
    </div>
  )
}
