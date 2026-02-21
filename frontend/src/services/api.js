// API Configuration
// In production (Databricks), use relative path. In development, use localhost.
const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.MODE === 'production' ? '/api/v1' : 'http://localhost:8000/api/v1');

 const IS_DEV = import.meta.env.DEV;

// API Client with error handling
class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (IS_DEV) {
      console.debug('API Request:', { url, method: config.method || 'GET', body: options.body });
    }

    try {
      const response = await fetch(url, config);

      if (IS_DEV) {
        console.debug('API Response:', { url, status: response.status, statusText: response.statusText });
      }
      
      if (!response.ok) {
        // Try to get error details from response
        let errorMessage;
        try {
          const errorData = await response.json();
          if (IS_DEV) {
            console.debug('API Error Data:', errorData);
          }
          errorMessage = errorData.detail || errorData.message || `HTTP error! status: ${response.status}`;
        } catch {
          // If response is not JSON, use status text
          errorMessage = `HTTP error! status: ${response.status} - ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (IS_DEV) {
        console.debug(`API Error: ${endpoint}`, error);
      }
      
      // Provide more specific error messages
      if (error.message === 'Failed to fetch') {
        throw new Error('Unable to connect to the server.');
      }
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection and ensure the backend server is accessible.');
      }
      
      throw error;
    }
  }

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // Upload file (Excel, etc.)
  async uploadFile(endpoint, file, additionalData = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const formData = new FormData();
    formData.append('file', file);
    
    // Add any additional form data
    Object.keys(additionalData).forEach(key => {
      formData.append(key, additionalData[key]);
    });

    if (IS_DEV) {
      console.debug('API File Upload:', { url, filename: file.name, size: file.size });
    }

    // Create abort controller with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 120000); // 2 minute timeout for large files

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        // Don't set Content-Type header - browser will set it with boundary
      });
      
      clearTimeout(timeout);

      if (IS_DEV) {
        console.debug('API Upload Response:', { url, status: response.status, statusText: response.statusText });
      }
      
      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          if (IS_DEV) {
            console.debug('API Upload Error Data:', errorData);
          }
          
          // Handle validation errors with details
          if (errorData.detail && typeof errorData.detail === 'object') {
            if (errorData.detail.errors && Array.isArray(errorData.detail.errors)) {
              errorMessage = errorData.detail.errors.join('\n');
            } else {
              errorMessage = errorData.detail.message || JSON.stringify(errorData.detail);
            }
          } else {
            errorMessage = errorData.detail || errorData.message || `HTTP error! status: ${response.status}`;
          }
        } catch {
          errorMessage = `HTTP error! status: ${response.status} - ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeout);
      if (IS_DEV) {
        console.debug(`API Upload Error: ${endpoint}`, error);
      }
      
      // Handle abort/timeout
      if (error.name === 'AbortError') {
        throw new Error('Upload timeout. The file may be too large or your connection is slow.');
      }
      
      // Handle network errors
      if (error.message === 'Failed to fetch') {
        throw new Error('Network error. Please check your connection and try again.');
      }
      
      throw error;
    }
  }

  // Download file
  async downloadFile(endpoint, filename) {
    const url = `${this.baseURL}${endpoint}`;

    if (IS_DEV) {
      console.debug('API File Download:', { url, filename });
    }

    try {
      const response = await fetch(url, { method: 'GET' });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      
      // Create a temporary link and trigger download
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      return true;
    } catch (error) {
      if (IS_DEV) {
        console.debug(`API Download Error: ${endpoint}`, error);
      }
      throw error;
    }
  }
}

const apiClient = new ApiClient(API_BASE_URL);

export default apiClient;
