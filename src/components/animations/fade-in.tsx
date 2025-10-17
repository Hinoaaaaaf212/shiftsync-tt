'use client'

import { ReactNode } from 'react'
import { useScrollAnimation } from '@/hooks/use-scroll-animation'

interface FadeInProps {
  children: ReactNode
  delay?: number
  duration?: number
  className?: string
  triggerOnce?: boolean
}

/**
 * FadeIn Component
 *
 * Wraps children in a fade-in animation that triggers when scrolled into view
 *
 * @example
 * <FadeIn delay={200}>
 *   <h1>This fades in</h1>
 * </FadeIn>
 */
export function FadeIn({
  children,
  delay = 0,
  duration = 600,
  className = '',
  triggerOnce = true,
}: FadeInProps) {
  const { ref, isVisible } = useScrollAnimation({}, triggerOnce)

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transition: `opacity ${duration}ms ease-out ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}
