import React from 'react'
import './Loader.css'

const Loader = ({ size = 'medium', fullPage = false, text = '' }) => {
  const sizeClass = `loader-${size}`
  
  if (fullPage) {
    return (
      <div className="loader-fullpage">
        <div className="loader-content">
          <div className={`loader ${sizeClass}`}>
            <div className="loader-spinner"></div>
          </div>
          {text && <p className="loader-text">{text}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="loader-container">
      <div className={`loader ${sizeClass}`}>
        <div className="loader-spinner"></div>
      </div>
      {text && <p className="loader-text">{text}</p>}
    </div>
  )
}

export default Loader
