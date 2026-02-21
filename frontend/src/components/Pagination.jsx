import React from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import './Pagination.css'

const Pagination = ({ 
  currentPage, 
  totalPages, 
  pageSize, 
  total, 
  onPageChange,
  onPageSizeChange 
}) => {
  const pageSizeOptions = [10, 20, 50, 100]
  
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      onPageChange(newPage)
    }
  }

  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 5
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)
      
      let start = Math.max(2, currentPage - 1)
      let end = Math.min(totalPages - 1, currentPage + 1)
      
      if (currentPage <= 3) {
        end = 4
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - 3
      }
      
      if (start > 2) {
        pages.push('...')
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      if (end < totalPages - 1) {
        pages.push('...')
      }
      
      pages.push(totalPages)
    }
    
    return pages
  }

  // Handle edge cases for empty data or loading states
  const safeTotal = total || 0
  const startItem = safeTotal === 0 ? 0 : ((currentPage - 1) * pageSize) + 1
  const endItem = Math.min(currentPage * pageSize, safeTotal)

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        Showing {startItem} to {endItem} of {safeTotal} entries
      </div>
      
      <div className="pagination-controls">
        <div className="page-size-selector">
          <label htmlFor="pageSize">Show:</label>
          <select 
            id="pageSize"
            value={pageSize} 
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="page-size-select"
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>

        <div className="pagination-buttons">
          <button
            className="pagination-btn"
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            title="First page"
          >
            <ChevronsLeft size={16} />
          </button>
          
          <button
            className="pagination-btn"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            title="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          
          <div className="pagination-pages">
            {getPageNumbers().map((page, index) => (
              <React.Fragment key={index}>
                {page === '...' ? (
                  <span className="pagination-ellipsis">...</span>
                ) : (
                  <button
                    className={`pagination-page-btn ${page === currentPage ? 'active' : ''}`}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>
          
          <button
            className="pagination-btn"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            title="Next page"
          >
            <ChevronRight size={16} />
          </button>
          
          <button
            className="pagination-btn"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
            title="Last page"
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default Pagination
