import { useEffect, useRef, useState } from 'react'

/**
 * Custom hook for scroll-triggered animations using Intersection Observer
 *
 * @param options - IntersectionObserver options
 * @param triggerOnce - Whether to trigger animation only once (default: true)
 * @returns ref to attach to element and isVisible state
 *
 * @example
 * const { ref, isVisible } = useScrollAnimation()
 * return <div ref={ref} className={isVisible ? 'animate-fade-in' : 'opacity-0'}>Content</div>
 */
export function useScrollAnimation<T extends HTMLElement = HTMLDivElement>(
  options: IntersectionObserverInit = {},
  triggerOnce = true
) {
  const ref = useRef<T>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true)
        if (triggerOnce) {
          observer.unobserve(element)
        }
      } else if (!triggerOnce) {
        setIsVisible(false)
      }
    }, {
      threshold: 0.1,
      rootMargin: '50px',
      ...options,
    })

    observer.observe(element)

    return () => {
      if (element) {
        observer.unobserve(element)
      }
    }
  }, [options.threshold, options.rootMargin, triggerOnce])

  return { ref, isVisible }
}

/**
 * Hook for staggered animations (cascade effect)
 *
 * @param count - Number of items to animate
 * @param delay - Delay between each item (in ms)
 * @returns array of refs and visible states for each item
 */
export function useStaggeredAnimation(count: number, delay = 100) {
  const refs = useRef<(HTMLElement | null)[]>([])
  const [visibleItems, setVisibleItems] = useState<boolean[]>(new Array(count).fill(false))

  useEffect(() => {
    const observers: IntersectionObserver[] = []

    refs.current.forEach((element, index) => {
      if (!element) return

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setTimeout(() => {
              setVisibleItems((prev) => {
                const newState = [...prev]
                newState[index] = true
                return newState
              })
            }, index * delay)
            observer.unobserve(element)
          }
        },
        {
          threshold: 0.1,
          rootMargin: '50px',
        }
      )

      observer.observe(element)
      observers.push(observer)
    })

    return () => {
      observers.forEach((observer) => observer.disconnect())
    }
  }, [count, delay])

  const setRef = (index: number) => (element: HTMLElement | null) => {
    refs.current[index] = element
  }

  return { setRef, visibleItems }
}
