// client/src/services/billingService.js
import axios from 'axios';

// Setup base URL for API requests - FIXED URL STRUCTURE
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const API_URL = `${API_BASE_URL}/doctor/billing`;

// Create axios instance with auth token and tenant headers
const billingApi = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token and tenant header to requests
billingApi.interceptors.request.use(
  (config) => {
    console.log(`🔗 Making billing request to: ${config.baseURL}${config.url}`);
    
    // Add authentication token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
      console.log('🔐 Added auth token');
    } else {
      console.warn('⚠️ No auth token found');
    }
    
    // Add tenant header - CRITICAL for multi-tenant
    const tenant = localStorage.getItem('tenant');
    if (tenant) {
      try {
        const tenantData = JSON.parse(tenant);
        if (tenantData && tenantData._id) {
          config.headers['X-Tenant-ID'] = tenantData._id;
          console.log(`🏢 Added tenant header: ${tenantData._id}`);
        } else {
          console.warn('⚠️ Tenant data exists but no _id found:', tenantData);
        }
      } catch (error) {
        console.error('❌ Error parsing tenant data:', error);
      }
    } else {
      console.warn('⚠️ No tenant data found in localStorage');
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling
billingApi.interceptors.response.use(
  (response) => {
    console.log(`✅ Billing API response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('❌ Billing API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      tenantId: error.config?.headers?.['X-Tenant-ID']
    });
    
    // Handle 404 errors specifically
    if (error.response?.status === 404) {
      console.error('🚫 Route not found - check if billing routes are properly registered');
    }
    
    return Promise.reject(error);
  }
);

const billingService = {
  // Get payment methods for the doctor
  getPaymentMethods: async () => {
    try {
      console.log('🔍 Fetching payment methods...');
      const response = await billingApi.get('/payment-methods');
      console.log('✅ Payment methods fetched successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching payment methods:', error);
      throw error;
    }
  },

  // Update payment methods - FIXED METHOD
  updatePaymentMethods: async (paymentMethods) => {
    try {
      console.log('🔄 Updating payment methods:', paymentMethods);
      const response = await billingApi.put('/payment-methods', paymentMethods);
      console.log('✅ Payment methods updated successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error updating payment methods:', error);
      throw error;
    }
  },

  // Upload QR code image - FIXED METHOD with multi-tenant support
  uploadQRCode: async (type, file) => {
    try {
      console.log(`🔄 Uploading ${type} QR code...`);
      
      const formData = new FormData();
      formData.append('qrCode', file);
      formData.append('type', type);

      // Get tenant info for logging
      const tenant = localStorage.getItem('tenant');
      let tenantId = 'unknown';
      if (tenant) {
        try {
          const tenantData = JSON.parse(tenant);
          tenantId = tenantData._id || 'unknown';
        } catch (e) {
          console.warn('Could not parse tenant data for logging');
        }
      }

      console.log(`📤 Uploading to tenant: ${tenantId}`);

      const response = await billingApi.post('/upload-qr', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log('✅ QR code uploaded successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error uploading QR code:', error);
      
      // Enhanced error logging for debugging
      if (error.response) {
        console.error('Response error details:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        console.error('Request error details:', error.request);
      }
      
      throw error;
    }
  },

  // Add bank account
  addBankAccount: async (bankAccountData) => {
    try {
      console.log('🔄 Adding bank account:', bankAccountData);
      const response = await billingApi.post('/bank-accounts', bankAccountData);
      console.log('✅ Bank account added successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error adding bank account:', error);
      throw error;
    }
  },

  // Remove bank account
  removeBankAccount: async (accountId) => {
    try {
      console.log(`🔄 Removing bank account: ${accountId}`);
      const response = await billingApi.delete(`/bank-accounts/${accountId}`);
      console.log('✅ Bank account removed successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error removing bank account:', error);
      throw error;
    }
  },

  // Get all billing records for the doctor
  getBillingRecords: async (filters = {}) => {
    try {
      console.log('🔍 Fetching billing records...');
      const params = new URLSearchParams();
      
      if (filters.patientId) params.append('patientId', filters.patientId);
      if (filters.status) params.append('status', filters.status);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (filters.search) params.append('search', filters.search);
      
      const response = await billingApi.get(`/?${params.toString()}`);
      console.log('✅ Billing records fetched successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching billing records:', error);
      throw error;
    }
  },

  // Get a specific billing record
  getBillingRecord: async (billingId) => {
    try {
      console.log(`🔍 Fetching billing record: ${billingId}`);
      const response = await billingApi.get(`/${billingId}`);
      console.log('✅ Billing record fetched successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching billing record:', error);
      throw error;
    }
  },

  // Create a billing record for an appointment
  createBillingRecord: async (billingData) => {
    try {
      console.log('🔄 Creating billing record:', billingData);
      const response = await billingApi.post('/', billingData);
      console.log('✅ Billing record created successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error creating billing record:', error);
      throw error;
    }
  },

  // Update billing record status
  updateBillingStatus: async (billingId, status, paymentDetails = {}) => {
    try {
      console.log(`🔄 Updating billing status for ${billingId} to ${status}`);
      const response = await billingApi.put(`/${billingId}/status`, {
        status,
        ...paymentDetails
      });
      console.log('✅ Billing status updated successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error updating billing status:', error);
      throw error;
    }
  },

  // Mark billing as paid
  markAsPaid: async (billingId, paymentDetails) => {
    try {
      console.log(`🔄 Marking billing ${billingId} as paid:`, paymentDetails);
      const response = await billingApi.put(`/${billingId}/mark-paid`, paymentDetails);
      console.log('✅ Billing marked as paid successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error marking billing as paid:', error);
      throw error;
    }
  },

  // Get billing statistics
  getBillingStats: async (period = 'month') => {
    try {
      console.log(`🔍 Fetching billing stats for period: ${period}`);
      const response = await billingApi.get(`/stats?period=${period}`);
      console.log('✅ Billing stats fetched successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching billing stats:', error);
      throw error;
    }
  },

  // Generate billing report
  generateBillingReport: async (filters = {}) => {
    try {
      console.log('🔄 Generating billing report with filters:', filters);
      const params = new URLSearchParams();
      
      if (filters.patientId) params.append('patientId', filters.patientId);
      if (filters.status) params.append('status', filters.status);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      
      const response = await billingApi.get(`/report?${params.toString()}`, {
        responseType: 'blob'
      });
      console.log('✅ Billing report generated successfully');
      return response;
    } catch (error) {
      console.error('❌ Error generating billing report:', error);
      throw error;
    }
  },

  // Tenant-aware helper function to check connection
  checkConnection: async () => {
    try {
      console.log('🔍 Checking billing service connection...');
      
      // Try to get payment methods as a connection test
      const response = await billingApi.get('/payment-methods');
      
      console.log('✅ Billing service connection successful');
      return {
        success: true,
        tenantId: response.data?.tenantId,
        connected: true
      };
    } catch (error) {
      console.error('❌ Billing service connection failed:', error);
      return {
        success: false,
        connected: false,
        error: error.message
      };
    }
  },

  // Get tenant context for debugging
  getTenantContext: () => {
    const tenant = localStorage.getItem('tenant');
    const token = localStorage.getItem('token');
    
    try {
      return {
        tenant: tenant ? JSON.parse(tenant) : null,
        hasToken: !!token,
        tenantId: tenant ? JSON.parse(tenant)?._id : null
      };
    } catch (error) {
      console.error('Error getting tenant context:', error);
      return {
        tenant: null,
        hasToken: !!token,
        tenantId: null,
        error: error.message
      };
    }
  },

  // Export billing data to PDF
  exportBillingToPDF: async (billingData, doctorInfo = {}) => {
    try {
      console.log('🔄 Exporting billing data to PDF...');
      
      // Dynamic import of jsPDF to reduce bundle size
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      // Set up document styles
      const primaryColor = [76, 175, 80]; // #4CAF50 in RGB
      const textColor = [51, 51, 51]; // #333333 in RGB
      const grayColor = [102, 102, 102]; // #666666 in RGB
      
      // Add header with logo space
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, 210, 30, 'F');
      
      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('Neurolex - Billing Report', 20, 20);
      
      // Doctor info
      doc.setTextColor(...textColor);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Dr. ${doctorInfo.firstName || ''} ${doctorInfo.lastName || ''}`, 20, 45);
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}`, 20, 55);
      
      // Summary section
      let yPosition = 75;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary', 20, yPosition);
      
      yPosition += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const totalAmount = billingData.reduce((sum, record) => sum + (record.sessionFee || 0), 0);
      const paidAmount = billingData.filter(record => record.status === 'paid')
        .reduce((sum, record) => sum + (record.sessionFee || 0), 0);
      const pendingAmount = billingData.filter(record => record.status === 'pending')
        .reduce((sum, record) => sum + (record.sessionFee || 0), 0);
      
      doc.text(`Total Records: ${billingData.length}`, 20, yPosition);
      yPosition += 8;
      doc.text(`Total Amount: ${totalAmount.toFixed(2)}`, 20, yPosition);
      yPosition += 8;
      doc.text(`Paid Amount: ${paidAmount.toFixed(2)}`, 20, yPosition);
      yPosition += 8;
      doc.text(`Pending Amount: ${pendingAmount.toFixed(2)}`, 20, yPosition);
      
      // Table header
      yPosition += 20;
      doc.setFillColor(248, 249, 250);
      doc.rect(20, yPosition - 5, 170, 10, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Date', 25, yPosition);
      doc.text('Patient', 55, yPosition);
      doc.text('Amount', 110, yPosition);
      doc.text('Status', 140, yPosition);
      doc.text('Payment Method', 165, yPosition);
      
      // Table rows
      yPosition += 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      billingData.forEach((record, index) => {
        // Check if we need a new page
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        
        const appointmentDate = new Date(record.appointmentDate);
        const dateStr = appointmentDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
        
        // Alternate row backgrounds
        if (index % 2 === 0) {
          doc.setFillColor(250, 250, 250);
          doc.rect(20, yPosition - 3, 170, 8, 'F');
        }
        
        doc.setTextColor(...textColor);
        doc.text(dateStr, 25, yPosition);
        doc.text(record.patientName || 'Unknown', 55, yPosition);
        doc.text(`${(record.sessionFee || 0).toFixed(2)}`, 110, yPosition);
        
        // Status with color
        const status = record.status || 'pending';
        if (status === 'paid') {
          doc.setTextColor(21, 87, 36); // Green
        } else if (status === 'pending') {
          doc.setTextColor(133, 100, 4); // Yellow
        } else {
          doc.setTextColor(114, 28, 36); // Red
        }
        doc.text(status.charAt(0).toUpperCase() + status.slice(1), 140, yPosition);
        
        doc.setTextColor(...textColor);
        doc.text(record.paymentMethod || '-', 165, yPosition);
        
        yPosition += 8;
      });
      
      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(...grayColor);
        doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
        doc.text('Generated by Neurolex', 105, 295, { align: 'center' });
      }
      
      // Save the PDF
      const fileName = `billing-report-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      console.log('✅ PDF exported successfully:', fileName);
      return { success: true, fileName };
    } catch (error) {
      console.error('❌ Error exporting to PDF:', error);
      throw error;
    }
  },

  // Send payment reminder to patient
  sendPaymentReminder: async (billingId, message = '') => {
    try {
      console.log(`🔄 Sending payment reminder for billing: ${billingId}`);
      const response = await billingApi.post(`/${billingId}/reminder`, { message });
      console.log('✅ Payment reminder sent successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error sending payment reminder:', error);
      throw error;
    }
  },

  // Get payment analytics
  getPaymentAnalytics: async (dateRange = {}) => {
    try {
      console.log('🔍 Fetching payment analytics:', dateRange);
      const params = new URLSearchParams();
      
      if (dateRange.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange.endDate) params.append('endDate', dateRange.endDate);
      
      const response = await billingApi.get(`/analytics?${params.toString()}`);
      console.log('✅ Payment analytics fetched successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching payment analytics:', error);
      throw error;
    }
  }
};

export default billingService;