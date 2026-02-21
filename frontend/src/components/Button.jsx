import React from 'react'
import './Button.css'

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'medium', 
  icon, 
  onClick, 
  disabled = false,
  loading = false,
  className = '',
  type = 'button',
  style = {}
}) => {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${loading ? 'btn-loading' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
      type={type}
      style={style}
    >
      {loading ? (
        <>
          <span className="btn-spinner"></span>
          {children}
        </>
      ) : (
        <>
          {icon && <span className="btn-icon">{icon}</span>}
          {children}
        </>
      )}
    </button>
  )
}

export default Button
