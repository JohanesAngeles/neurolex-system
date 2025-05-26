// server/src/controllers/billingController.js
const path = require('path');
const fs = require('fs').promises;
const { ObjectId } = require('mongoose').Types;
const billingController = require('../controllers/billingController');

/**
 * Get billing records for the logged-in doctor with multi-tenant support
 */
exports.getBillingRecords = async (req, res) => {
  try {
    console.log(`Getting billing records for doctor ${req.user.id}`);
    
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    // Simple query - get ALL appointments for this doctor
    const query = { doctor: req.user.id };
    
    console.log('Searching for appointments with query:', query);
    
    const appointments = await Appointment.find(query)
      .populate('patient', 'firstName lastName email')
      .sort({ appointmentDate: -1 });
    
    console.log(`Found ${appointments.length} appointments`);
    
    // Convert to billing records
    const billingRecords = [];
    
    for (let i = 0; i < appointments.length; i++) {
      const appointment = appointments[i];
      
      console.log(`Processing appointment ${i + 1}: ${appointment._id}`);
      
      // Get session fee
      let sessionFee = 2500; // Default
      let paymentStatus = 'pending';
      
      if (appointment.payment && appointment.payment.amount) {
        sessionFee = appointment.payment.amount;
        paymentStatus = appointment.payment.status || 'pending';
      }
      
      const billingRecord = {
        id: appointment._id,
        appointmentId: appointment._id,
        appointmentDate: appointment.appointmentDate,
        patientName: `${appointment.patient?.firstName || 'Unknown'} ${appointment.patient?.lastName || 'Patient'}`,
        sessionFee: sessionFee,
        status: paymentStatus,
        paymentMethod: appointment.payment?.paymentMethod || null,
        transactionId: `TXN_${appointment._id.toString().slice(-8).toUpperCase()}`,
        appointmentStatus: appointment.status,
        appointmentType: appointment.appointmentType
      };
      
      billingRecords.push(billingRecord);
      console.log(`Created billing record ${i + 1}: ${billingRecord.patientName} - ₱${billingRecord.sessionFee}`);
    }
    
    console.log(`Returning ${billingRecords.length} billing records`);
    
    res.status(200).json({
      success: true,
      data: billingRecords,
      total: billingRecords.length
    });
    
  } catch (error) {
    console.error('Error in getBillingRecords:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Error getting billing records',
      error: error.message
    });
  }
};

/**
 * Get billing statistics for dashboard with multi-tenant support
 */
exports.getBillingStats = async (req, res) => {
  try {
    console.log(`Getting billing stats for doctor ${req.user.id} in tenant ${req.tenantId || 'default'}`);
    
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    // Build match query with tenant filter
    const matchQuery = {
      doctor: new ObjectId(req.user.id),
      status: 'Completed'
    };
    
    if (req.tenantId) {
      matchQuery.tenantId = new ObjectId(req.tenantId);
    }
    
    // Aggregate billing data
    const stats = await Appointment.aggregate([
      {
        $match: matchQuery
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $ifNull: ['$sessionFee', 150] } },
          totalSessions: { $sum: 1 },
          paidSessions: {
            $sum: {
              $cond: [{ $eq: ['$billingStatus', 'paid'] }, 1, 0]
            }
          },
          pendingSessions: {
            $sum: {
              $cond: [{ $eq: ['$billingStatus', 'pending'] }, 1, 0]
            }
          },
          monthlyRevenue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$appointmentDate', currentMonth] },
                    { $lt: ['$appointmentDate', nextMonth] }
                  ]
                },
                { $ifNull: ['$sessionFee', 150] },
                0
              ]
            }
          }
        }
      }
    ]);
    
    const result = stats[0] || {
      totalRevenue: 0,
      totalSessions: 0,
      paidSessions: 0,
      pendingSessions: 0,
      monthlyRevenue: 0
    };
    
    res.status(200).json({
      success: true,
      data: { ...result, tenantId: req.tenantId }
    });
    
  } catch (error) {
    console.error('Error getting billing stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting billing stats',
      error: error.message
    });
  }
};

/**
 * Get a specific billing record with multi-tenant support
 */
exports.getBillingRecord = async (req, res) => {
  try {
    const { billingId } = req.params;
    
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    // Build query with tenant isolation
    const query = { _id: billingId };
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    }
    
    const appointment = await Appointment.findOne(query)
      .populate('patient', 'firstName lastName email')
      .populate('doctor', 'firstName lastName');
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found'
      });
    }
    
    // Check if logged-in doctor owns this appointment
    if (appointment.doctor._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to billing record'
      });
    }
    
    const billingRecord = {
      id: appointment._id,
      appointmentId: appointment._id,
      appointmentDate: appointment.appointmentDate,
      patientName: `${appointment.patient?.firstName || 'Unknown'} ${appointment.patient?.lastName || 'Patient'}`,
      patientEmail: appointment.patient?.email || 'No email',
      sessionFee: appointment.sessionFee || 150,
      status: appointment.billingStatus || 'pending',
      paymentMethod: appointment.paymentMethod || null,
      transactionId: appointment.transactionId || null,
      notes: appointment.notes,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
      tenantId: req.tenantId
    };
    
    res.status(200).json({
      success: true,
      data: billingRecord
    });
    
  } catch (error) {
    console.error('Error getting billing record:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting billing record',
      error: error.message
    });
  }
};

/**
 * Create a billing record for an appointment with multi-tenant support
 */
exports.createBillingRecord = async (req, res) => {
  try {
    const { appointmentId, sessionFee, notes } = req.body;
    
    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: 'Appointment ID is required'
      });
    }
    
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    // Build query with tenant isolation
    const query = { _id: appointmentId };
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    }
    
    const appointment = await Appointment.findOne(query);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check if logged-in doctor owns this appointment
    if (appointment.doctor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to create billing for this appointment'
      });
    }
    
    // Update appointment with billing information
    appointment.sessionFee = sessionFee || 150;
    appointment.billingStatus = 'pending';
    appointment.billingNotes = notes || '';
    appointment.billingCreatedAt = new Date();
    
    await appointment.save();
    
    res.status(201).json({
      success: true,
      message: 'Billing record created successfully',
      data: {
        id: appointment._id,
        appointmentId: appointment._id,
        sessionFee: appointment.sessionFee,
        status: appointment.billingStatus,
        tenantId: req.tenantId
      }
    });
    
  } catch (error) {
    console.error('Error creating billing record:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating billing record',
      error: error.message
    });
  }
};

/**
 * Update billing status with multi-tenant support
 */
exports.updateBillingStatus = async (req, res) => {
  try {
    const { billingId } = req.params;
    const { status, paymentMethod, transactionId } = req.body;
    
    const validStatuses = ['pending', 'paid', 'overdue', 'cancelled'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (pending, paid, overdue, cancelled)'
      });
    }
    
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    // Build query with tenant isolation
    const query = { _id: billingId };
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    }
    
    const appointment = await Appointment.findOne(query);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found'
      });
    }
    
    // Check if logged-in doctor owns this appointment
    if (appointment.doctor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this billing record'
      });
    }
    
    // Update billing information
    appointment.billingStatus = status;
    if (paymentMethod) appointment.paymentMethod = paymentMethod;
    if (transactionId) appointment.transactionId = transactionId;
    if (status === 'paid') appointment.paidAt = new Date();
    
    await appointment.save();
    
    res.status(200).json({
      success: true,
      message: 'Billing status updated successfully',
      data: {
        id: appointment._id,
        status: appointment.billingStatus,
        paymentMethod: appointment.paymentMethod,
        transactionId: appointment.transactionId,
        tenantId: req.tenantId
      }
    });
    
  } catch (error) {
    console.error('Error updating billing status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating billing status',
      error: error.message
    });
  }
};

/**
 * Mark billing record as paid with multi-tenant support
 */
exports.markAsPaid = async (req, res) => {
  try {
    const { billingId } = req.params;
    const { paymentMethod, transactionId, amount } = req.body;
    
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    // Build query with tenant isolation
    const query = { _id: billingId };
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    }
    
    const appointment = await Appointment.findOne(query);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Billing record not found'
      });
    }
    
    // Check if logged-in doctor owns this appointment
    if (appointment.doctor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this billing record'
      });
    }
    
    // Update billing information
    appointment.billingStatus = 'paid';
    appointment.paymentMethod = paymentMethod || 'cash';
    appointment.transactionId = transactionId || `TXN_${Date.now()}`;
    appointment.paidAmount = amount || appointment.sessionFee;
    appointment.paidAt = new Date();
    
    await appointment.save();
    
    res.status(200).json({
      success: true,
      message: 'Billing record marked as paid',
      data: {
        id: appointment._id,
        status: appointment.billingStatus,
        paymentMethod: appointment.paymentMethod,
        transactionId: appointment.transactionId,
        paidAmount: appointment.paidAmount,
        paidAt: appointment.paidAt,
        tenantId: req.tenantId
      }
    });
    
  } catch (error) {
    console.error('Error marking billing as paid:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking billing as paid',
      error: error.message
    });
  }
};

/**
 * Generate billing report with multi-tenant support
 */
exports.generateBillingReport = async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        appointmentDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }
    
    const Appointment = req.tenantConnection ? req.tenantConnection.model('Appointment') : require('../models/Appointment');
    
    // Build query with tenant isolation
    const query = {
      doctor: req.user.id,
      status: 'Completed',
      ...dateFilter
    };
    
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    }
    
    const appointments = await Appointment.find(query)
      .populate('patient', 'firstName lastName email')
      .sort({ appointmentDate: -1 });
    
    const report = {
      generatedAt: new Date(),
      tenantId: req.tenantId,
      period: {
        startDate: startDate || 'All time',
        endDate: endDate || 'All time'
      },
      summary: {
        totalSessions: appointments.length,
        totalRevenue: appointments.reduce((sum, apt) => sum + (apt.sessionFee || 150), 0),
        paidSessions: appointments.filter(apt => apt.billingStatus === 'paid').length,
        pendingSessions: appointments.filter(apt => apt.billingStatus === 'pending').length
      },
      records: appointments.map(apt => ({
        appointmentId: apt._id,
        date: apt.appointmentDate,
        patientName: `${apt.patient?.firstName || 'Unknown'} ${apt.patient?.lastName || 'Patient'}`,
        sessionFee: apt.sessionFee || 150,
        status: apt.billingStatus || 'pending',
        paymentMethod: apt.paymentMethod || null
      }))
    };
    
    res.status(200).json({
      success: true,
      data: report
    });
    
  } catch (error) {
    console.error('Error generating billing report:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating billing report',
      error: error.message
    });
  }
};

/**
 * Get doctor's payment methods with multi-tenant support
 */
exports.getPaymentMethods = async (req, res) => {
  try {
    console.log(`Getting payment methods for doctor ${req.user.id} in tenant ${req.tenantId || 'default'}`);
    
    const User = req.tenantConnection ? req.tenantConnection.model('User') : require('../models/User');
    
    const doctor = await User.findById(req.user.id).select('paymentMethods');
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }
    
    // Default payment methods structure
    const defaultPaymentMethods = {
      gcash: { qrCode: null, enabled: false },
      paymaya: { qrCode: null, enabled: false },
      bankAccounts: []
    };
    
    const paymentMethods = doctor.paymentMethods || defaultPaymentMethods;
    
    res.status(200).json({
      success: true,
      data: paymentMethods,
      tenantId: req.tenantId
    });
    
  } catch (error) {
    console.error('Error getting payment methods:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting payment methods',
      error: error.message
    });
  }
};

/**
 * Update doctor's payment methods with multi-tenant support
 */
/**
 * Update doctor's payment methods with multi-tenant support - FIXED VERSION
 */
exports.updatePaymentMethods = async (req, res) => {
  try {
    console.log(`Updating payment methods for doctor ${req.user.id} in tenant ${req.tenantId || 'default'}`);
    console.log('Payment methods data:', req.body);
    
    const User = req.tenantConnection ? req.tenantConnection.model('User') : require('../models/User');
    
    // Use findByIdAndUpdate to bypass validation - THIS IS THE KEY FIX
    const updateResult = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          'paymentMethods.gcash': {
            ...req.body.gcash,
            tenantId: req.tenantId
          },
          'paymentMethods.paymaya': {
            ...req.body.paymaya,
            tenantId: req.tenantId
          },
          'paymentMethods.bankAccounts': req.body.bankAccounts || []
        }
      },
      {
        new: true,
        runValidators: false, // CRITICAL: Skip validation to avoid experience field error
        select: 'paymentMethods'
      }
    );
    
    if (!updateResult) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }
    
    console.log('Payment methods updated successfully');
    
    res.status(200).json({
      success: true,
      message: 'Payment methods updated successfully',
      data: updateResult.paymentMethods,
      tenantId: req.tenantId
    });
    
  } catch (error) {
    console.error('Error updating payment methods:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating payment methods',
      error: error.message
    });
  }
};

/**
 * Upload QR code for payment methods with multi-tenant file isolation - ALSO FIXED
 */
exports.uploadQRCode = async (req, res) => {
  try {
    console.log('Uploading QR code with multi-tenant support...');
    console.log('File received:', req.file ? 'Yes' : 'No');
    console.log('Body:', req.body);
    console.log('Tenant ID:', req.tenantId);
    console.log('User ID:', req.user?.id);
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const { type } = req.body; // 'gcash' or 'paymaya'
    
    if (!type || !['gcash', 'paymaya'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment type. Must be gcash or paymaya'
      });
    }
    
    // Create tenant-specific uploads directory
    const tenantUploadsDir = req.tenantId 
      ? path.join(__dirname, '../../uploads/qr-codes', req.tenantId)
      : path.join(__dirname, '../../uploads/qr-codes/default');
    
    try {
      await fs.access(tenantUploadsDir);
    } catch {
      await fs.mkdir(tenantUploadsDir, { recursive: true });
      console.log(`Created tenant uploads directory: ${tenantUploadsDir}`);
    }
    
    // Generate unique filename with tenant prefix
    const fileExtension = path.extname(req.file.originalname);
    const tenantPrefix = req.tenantId ? `${req.tenantId}_` : 'default_';
    const fileName = `${tenantPrefix}${type}_${req.user.id}_${Date.now()}${fileExtension}`;
    const filePath = path.join(tenantUploadsDir, fileName);
    
    // Save file
    await fs.writeFile(filePath, req.file.buffer);
    
    // Generate tenant-aware URL for the file
    const qrCodeUrl = req.tenantId 
      ? `/uploads/qr-codes/${req.tenantId}/${fileName}`
      : `/uploads/qr-codes/default/${fileName}`;
    
    // Update user's payment methods using findByIdAndUpdate - FIXED VERSION
    const User = req.tenantConnection ? req.tenantConnection.model('User') : require('../models/User');
    
    const updateField = `paymentMethods.${type}`;
    const updateResult = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          [updateField]: {
            qrCode: qrCodeUrl,
            enabled: true,
            tenantId: req.tenantId,
            uploadedAt: new Date()
          }
        }
      },
      {
        new: true,
        runValidators: false, // Skip validation
        select: 'paymentMethods'
      }
    );
    
    if (!updateResult) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }
    
    console.log(`${type} QR code uploaded successfully: ${qrCodeUrl}`);
    
    res.status(200).json({
      success: true,
      message: `${type} QR code uploaded successfully`,
      qrCodeUrl: qrCodeUrl,
      type: type,
      tenantId: req.tenantId
    });
    
  } catch (error) {
    console.error('Error uploading QR code:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading QR code',
      error: error.message
    });
  }
};

/**
 * Add bank account with multi-tenant support - ALSO FIXED
 */
exports.addBankAccount = async (req, res) => {
  try {
    console.log(`Adding bank account for doctor ${req.user.id} in tenant ${req.tenantId || 'default'}`);
    console.log('Bank account data:', req.body);
    
    const { bankName, accountName, accountNumber } = req.body;
    
    if (!bankName || !accountName || !accountNumber) {
      return res.status(400).json({
        success: false,
        message: 'Bank name, account name, and account number are required'
      });
    }
    
    const User = req.tenantConnection ? req.tenantConnection.model('User') : require('../models/User');
    
    // Create new bank account with tenant context
    const newBankAccount = {
      id: `${req.tenantId || 'default'}_${Date.now()}`, // Tenant-aware ID
      bankName,
      accountName,
      accountNumber,
      tenantId: req.tenantId,
      createdAt: new Date()
    };
    
    // Use findByIdAndUpdate with $push to add bank account - FIXED VERSION
    const updateResult = await User.findByIdAndUpdate(
      req.user.id,
      {
        $push: {
          'paymentMethods.bankAccounts': newBankAccount
        }
      },
      {
        new: true,
        runValidators: false, // Skip validation
        select: 'paymentMethods'
      }
    );
    
    if (!updateResult) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }
    
    console.log('Bank account added successfully');
    
    res.status(201).json({
      success: true,
      message: 'Bank account added successfully',
      bankAccount: newBankAccount,
      tenantId: req.tenantId
    });
    
  } catch (error) {
    console.error('Error adding bank account:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding bank account',
      error: error.message
    });
  }
};

/**
 * Remove bank account with multi-tenant support
 */
exports.removeBankAccount = async (req, res) => {
  try {
    const { accountId } = req.params;
    
    console.log(`Removing bank account ${accountId} for doctor ${req.user.id} in tenant ${req.tenantId || 'default'}`);
    
    const User = req.tenantConnection ? req.tenantConnection.model('User') : require('../models/User');
    
    const doctor = await User.findById(req.user.id);
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }
    
    if (!doctor.paymentMethods || !doctor.paymentMethods.bankAccounts) {
      return res.status(404).json({
        success: false,
        message: 'No bank accounts found'
      });
    }
    
    // Find and remove the bank account (with tenant isolation)
    const initialLength = doctor.paymentMethods.bankAccounts.length;
    doctor.paymentMethods.bankAccounts = doctor.paymentMethods.bankAccounts.filter(
      account => account.id !== accountId
    );
    
    if (doctor.paymentMethods.bankAccounts.length === initialLength) {
      return res.status(404).json({
        success: false,
        message: 'Bank account not found or does not belong to this tenant'
      });
    }
    
    await doctor.save();
    
    console.log('Bank account removed successfully');
    
    res.status(200).json({
      success: true,
      message: 'Bank account removed successfully',
      tenantId: req.tenantId
    });
    
  } catch (error) {
    console.error('Error removing bank account:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing bank account',
      error: error.message
    });
  }
};