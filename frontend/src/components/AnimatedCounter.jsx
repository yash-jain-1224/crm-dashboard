import React, { useEffect, useState, useRef } from 'react'

const AnimatedCounter = ({ 
  value, 
  duration = 1000, 
  prefix = '', 
  suffix = '',
  decimals = 0,
  separator = ','
}) => {
  const [count, setCount] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const counterRef = useRef(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          setIsVisible(true)
          hasAnimated.current = true
        }
      },
      { threshold: 0.1 }
    )

    if (counterRef.current) {
      observer.observe(counterRef.current)
    }

    return () => {
      if (counterRef.current) {
        observer.unobserve(counterRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isVisible) return

    const targetValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0
    const startValue = 0
    const startTime = Date.now()

    const animate = () => {
      const now = Date.now()
      const progress = Math.min((now - startTime) / duration, 1)
      
      // Easing function for smooth animation (easeOutQuart)
      const easeOut = 1 - Math.pow(1 - progress, 4)
      
      const currentCount = startValue + (targetValue - startValue) * easeOut
      setCount(currentCount)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setCount(targetValue)
      }
    }

    animate()
  }, [value, duration, isVisible])

  const formatNumber = (num) => {
    const rounded = decimals > 0 ? num.toFixed(decimals) : Math.round(num)
    const parts = rounded.toString().split('.')
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator)
    return parts.join('.')
  }

  return (
    <span ref={counterRef}>
      {prefix}{formatNumber(count)}{suffix}
    </span>
  )
}

export default AnimatedCounter
