import apiClient from './api';

// Contacts API
export const contactsApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/contacts/${query ? `?${query}` : ''}`);
  },
  
  getById: (id) => apiClient.get(`/contacts/${id}`),
  
  search: (query, params = {}) => {
    const searchParams = new URLSearchParams({ query, ...params }).toString();
    return apiClient.get(`/contacts/search?${searchParams}`);
  },
  
  create: (data) => apiClient.post('/contacts', data),
  
  update: (id, data) => apiClient.put(`/contacts/${id}`, data),
  
  delete: (id) => apiClient.delete(`/contacts/${id}`),

  // Filter options
  getFilterOptions: () => apiClient.get('/contacts/filters/options'),

  // Excel upload methods
  downloadTemplate: () => apiClient.downloadFile('/contacts/template', 'contacts_template.xlsx'),
  
  bulkUpload: (file, asyncMode = false) => {
    const endpoint = `/contacts/bulk-upload${asyncMode ? '?async_mode=true' : ''}`;
    return apiClient.uploadFile(endpoint, file);
  },
  
  getUploadProgress: (taskId) => apiClient.get(`/contacts/upload-progress/${taskId}`),
};

// Leads API
export const leadsApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/leads/${query ? `?${query}` : ''}`);
  },
  
  getById: (id) => apiClient.get(`/leads/${id}`),
  
  getByStatus: (status, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/leads/status/${status}${query ? `?${query}` : ''}`);
  },
  
  create: (data) => apiClient.post('/leads', data),
  
  update: (id, data) => apiClient.put(`/leads/${id}`, data),
  
  delete: (id) => apiClient.delete(`/leads/${id}`),

  // Filter options
  getFilterOptions: () => apiClient.get('/leads/filters/options'),

  // Summary statistics
  getSummary: () => apiClient.get('/leads/summary'),

  // Excel upload methods
  downloadTemplate: () => apiClient.downloadFile('/leads/template', 'leads_template.xlsx'),
  
  bulkUpload: (file, asyncMode = false) => {
    const endpoint = `/leads/bulk-upload${asyncMode ? '?async_mode=true' : ''}`;
    return apiClient.uploadFile(endpoint, file);
  },
  
  getUploadProgress: (taskId) => apiClient.get(`/leads/upload-progress/${taskId}`),
};

// Opportunities API
export const opportunitiesApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/opportunities/${query ? `?${query}` : ''}`);
  },
  
  getById: (id) => apiClient.get(`/opportunities/${id}`),
  
  getByStage: (stage, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/opportunities/stage/${stage}${query ? `?${query}` : ''}`);
  },
  
  create: (data) => apiClient.post('/opportunities', data),
  
  update: (id, data) => apiClient.put(`/opportunities/${id}`, data),
  
  delete: (id) => apiClient.delete(`/opportunities/${id}`),

  // Filter options
  getFilterOptions: () => apiClient.get('/opportunities/filters/options'),

  // Excel upload methods
  downloadTemplate: () => apiClient.downloadFile('/opportunities/template', 'opportunities_template.xlsx'),
  
  bulkUpload: (file, asyncMode = false) => {
    const endpoint = `/opportunities/bulk-upload${asyncMode ? '?async_mode=true' : ''}`;
    return apiClient.uploadFile(endpoint, file);
  },
  
  getUploadProgress: (taskId) => apiClient.get(`/opportunities/upload-progress/${taskId}`),
};

// Accounts API
export const accountsApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/accounts/${query ? `?${query}` : ''}`);
  },
  
  getById: (id) => apiClient.get(`/accounts/${id}`),
  
  create: (data) => apiClient.post('/accounts', data),
  
  update: (id, data) => apiClient.put(`/accounts/${id}`, data),
  
  delete: (id) => apiClient.delete(`/accounts/${id}`),

  // Filter options
  getFilterOptions: () => apiClient.get('/accounts/filters/options'),

  // Excel upload methods
  downloadTemplate: () => apiClient.downloadFile('/accounts/template', 'accounts_template.xlsx'),
  
  bulkUpload: (file, asyncMode = false) => {
    const endpoint = `/accounts/bulk-upload${asyncMode ? '?async_mode=true' : ''}`;
    return apiClient.uploadFile(endpoint, file);
  },
  
  getUploadProgress: (taskId) => apiClient.get(`/accounts/upload-progress/${taskId}`),
};

// Tasks API
export const tasksApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/tasks/${query ? `?${query}` : ''}`);
  },
  
  getById: (id) => apiClient.get(`/tasks/${id}`),
  
  getByStatus: (status, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/tasks/status/${status}${query ? `?${query}` : ''}`);
  },
  
  create: (data) => apiClient.post('/tasks', data),
  
  update: (id, data) => apiClient.put(`/tasks/${id}`, data),
  
  delete: (id) => apiClient.delete(`/tasks/${id}`),

  // Filter options
  getFilterOptions: () => apiClient.get('/tasks/filters/options'),

  // Excel upload methods
  downloadTemplate: () => apiClient.downloadFile('/tasks/template', 'tasks_template.xlsx'),
  
  bulkUpload: (file, asyncMode = false) => {
    const endpoint = `/tasks/bulk-upload${asyncMode ? '?async_mode=true' : ''}`;
    return apiClient.uploadFile(endpoint, file);
  },
  
  getUploadProgress: (taskId) => apiClient.get(`/tasks/upload-progress/${taskId}`),
};

// Calendar API
export const calendarApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/calendar/${query ? `?${query}` : ''}`);
  },
  
  getById: (id) => apiClient.get(`/calendar/${id}`),
  
  create: (data) => apiClient.post('/calendar', data),
  
  update: (id, data) => apiClient.put(`/calendar/${id}`, data),
  
  delete: (id) => apiClient.delete(`/calendar/${id}`),

  // Filter options
  getFilterOptions: () => apiClient.get('/calendar/filters/options'),

  // Excel upload methods
  downloadTemplate: () => apiClient.downloadFile('/calendar/template', 'calendar_events_template.xlsx'),
  
  bulkUpload: (file, asyncMode = false) => {
    const endpoint = `/calendar/bulk-upload${asyncMode ? '?async_mode=true' : ''}`;
    return apiClient.uploadFile(endpoint, file);
  },
  
  getUploadProgress: (taskId) => apiClient.get(`/calendar/upload-progress/${taskId}`),
};

// Email Campaigns API
export const emailCampaignsApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/email-campaigns/${query ? `?${query}` : ''}`);
  },
  
  getById: (id) => apiClient.get(`/email-campaigns/${id}`),
  
  create: (data) => apiClient.post('/email-campaigns', data),
  
  update: (id, data) => apiClient.put(`/email-campaigns/${id}`, data),
  
  delete: (id) => apiClient.delete(`/email-campaigns/${id}`),

  // Filter options
  getFilterOptions: () => apiClient.get('/email-campaigns/filters/options'),

  // Summary statistics
  getSummary: () => apiClient.get('/email-campaigns/summary'),

  // Excel upload methods
  downloadTemplate: () => apiClient.downloadFile('/email-campaigns/template', 'email_campaigns_template.xlsx'),
  
  bulkUpload: (file, asyncMode = false) => {
    const endpoint = `/email-campaigns/bulk-upload${asyncMode ? '?async_mode=true' : ''}`;
    return apiClient.uploadFile(endpoint, file);
  },
  
  getUploadProgress: (taskId) => apiClient.get(`/email-campaigns/upload-progress/${taskId}`),
};

// Reports API
export const reportsApi = {
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/reports/${query ? `?${query}` : ''}`);
  },
  
  getById: (id) => apiClient.get(`/reports/${id}`),
  
  create: (data) => apiClient.post('/reports', data),
  
  update: (id, data) => apiClient.put(`/reports/${id}`, data),
  
  delete: (id) => apiClient.delete(`/reports/${id}`),

  analytics: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/reports/analytics${query ? `?${query}` : ''}`);
  },
};

// Dashboard API
export const dashboardApi = {
  getStats: () => apiClient.get('/dashboard/stats'),
  
  getRevenue: () => apiClient.get('/dashboard/revenue'),

  getTrends: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiClient.get(`/dashboard/trends${query ? `?${query}` : ''}`);
  },
};

// User API
export const userApi = {
  getCurrentUser: () => apiClient.get('/user/me'),
};
