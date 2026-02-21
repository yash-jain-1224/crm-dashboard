import React from 'react'
import './Card.css'

const Card = ({ title, children, className = '', action }) => {
  return (
    <div className={`card ${className}`}>
      {title && (
        <div className="card-header">
          <h3 className="card-title">{title}</h3>
          {action && <div className="card-action">{action}</div>}
        </div>
      )}
      <div className="card-content">
        {children}
      </div>
    </div>
  )
}

export default Card
