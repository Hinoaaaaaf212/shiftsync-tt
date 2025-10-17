'use client'

import { ReactElement, cloneElement, Children } from 'react'
import { useStaggeredAnimation } from '@/hooks/use-scroll-animation'

interface StaggerContainerProps {
  children: ReactElement[]
  delay?: number
  className?: string
}

/**
 * StaggerContainer Component
 *
 * Animates children one by one with a stagger delay (cascade effect)
 *
 * @example
 * <StaggerContainer delay={100}>
 *   <Card>Item 1</Card>
 *   <Card>Item 2</Card>
 *   <Card>Item 3</Card>
 * </StaggerContainer>
 */
export function StaggerContainer({
  children,
  delay = 100,
  className = '',
}: StaggerContainerProps) {
  const childrenArray = Children.toArray(children) as ReactElement[]
  const { setRef, visibleItems } = useStaggeredAnimation(childrenArray.length, delay)

  return (
    <div className={className}>
      {childrenArray.map((child, index) =>
        cloneElement(child, {
          ref: setRef(index),
          style: {
            opacity: visibleItems[index] ? 1 : 0,
            transform: visibleItems[index] ? 'translateY(0)' : 'translateY(30px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
            ...child.props.style,
          },
        })
      )}
    </div>
  )
}
