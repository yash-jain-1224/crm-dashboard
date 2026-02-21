import React from 'react'
import { X, AlertTriangle } from 'lucide-react'
import './ConfirmationModal.css'

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "danger", // 'danger', 'warning', 'info'
  loading = false
}) => {
  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      onClose()
    }
  }

  return (
    <div className="confirmation-modal-overlay" onClick={handleBackdropClick}>
      <div className="confirmation-modal">
        <div className="confirmation-modal-header">
          <h2>{title}</h2>
          <button 
            className="confirmation-modal-close" 
            onClick={onClose}
            disabled={loading}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="confirmation-modal-body">
          <div className={`confirmation-modal-icon confirmation-modal-icon-${type}`}>
            <AlertTriangle size={48} />
          </div>
          <p className="confirmation-modal-message">{message}</p>
        </div>
        
        <div className="confirmation-modal-footer">
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button 
            className={`btn btn-${type}`}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-small"></span>
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmationModal
