'use client'

import { ReactNode } from 'react'
import { useScrollAnimation } from '@/hooks/use-scroll-animation'

type Direction = 'up' | 'down' | 'left' | 'right'

interface SlideInProps {
  children: ReactNode
  direction?: Direction
  delay?: number
  duration?: number
  distance?: number
  className?: string
  triggerOnce?: boolean
}

/**
 * SlideIn Component
 *
 * Wraps children in a slide-in animation that triggers when scrolled into view
 *
 * @example
 * <SlideIn direction="up" delay={200}>
 *   <h1>This slides up</h1>
 * </SlideIn>
 */
export function SlideIn({
  children,
  direction = 'up',
  delay = 0,
  duration = 600,
  distance = 30,
  className = '',
  triggerOnce = true,
}: SlideInProps) {
  const { ref, isVisible } = useScrollAnimation({}, triggerOnce)

  const getTransform = () => {
    if (isVisible) return 'translate(0, 0)'

    switch (direction) {
      case 'up':
        return `translate(0, ${distance}px)`
      case 'down':
        return `translate(0, -${distance}px)`
      case 'left':
        return `translate(${distance}px, 0)`
      case 'right':
        return `translate(-${distance}px, 0)`
      default:
        return 'translate(0, 0)'
    }
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: getTransform(),
        transition: `opacity ${duration}ms ease-out ${delay}ms, transform ${duration}ms ease-out ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}
