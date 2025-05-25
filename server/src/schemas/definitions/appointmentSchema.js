// server/src/schemas/definitions/appointmentSchema.js - FIXED WITH 8x8.vc SUPPORT
const mongoose = require('mongoose');

function createAppointmentSchema() {
  const schema = new mongoose.Schema({
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    appointmentDate: {
      type: Date,
      required: true
    },
    duration: {
      type: Number,
      required: true,
      default: 30
    },
    appointmentType: {
      type: String,
      required: true,
      enum: ['Initial Consultation', 'Follow-up', 'Therapy Session', 'Assessment']
    },
    status: {
      type: String,
      required: true,
      enum: ['Pending', 'Scheduled', 'Completed', 'Cancelled', 'Declined', 'No-show'],
      default: 'Pending'
    },
    notes: {
      type: String
    },
    // Doctor response fields
    doctorResponse: {
      responseDate: {
        type: Date
      },
      responseMessage: {
        type: String,
        maxlength: 500
      }
    },
    // Patient notification tracking
    patientNotified: {
      type: Boolean,
      default: false
    },
    // Payment information
    payment: {
      amount: {
        type: Number,
        required: true,
        default: 0
      },
      status: {
        type: String,
        enum: ['pending', 'paid', 'refunded', 'failed'],
        default: 'pending'
      },
      proofOfPayment: {
        type: String, // URL/path to uploaded proof of payment image
        default: null
      },
      paymentDate: {
        type: Date,
        default: null
      },
      paymentMethod: {
        type: String,
        enum: ['cash', 'bank_transfer', 'gcash', 'paymaya', 'credit_card'],
        default: null
      },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      verifiedAt: {
        type: Date,
        default: null
      }
    },
    // ✅ FIXED: Video Conference Integration Fields - Now includes 8x8.vc
    meetingLink: {
      type: String,
      default: null,
      validate: {
        validator: function(v) {
          if (!v) return true; // Allow null/empty values
          
          try {
            const url = new URL(v);
            
            // ✅ ULTIMATE FIX: Added ALL working Jitsi domains
            const allowedHosts = [
              'meet.google.com',      // Google Meet
              'meet.jit.si',          // Jitsi Meet (original)
              '8x8.vc',               // 8x8 Jitsi Meet
              'jitsi.riot.im',        // ✅ Element's Jitsi instance (MOST RELIABLE)
              'meet.ffmuc.net',       // ✅ German public Jitsi instance (VERY GOOD)
              'jitsi.ow2.org',        // ✅ OW2 public Jitsi instance (RELIABLE)
              'meet.golem.de',        // ✅ Golem's Jitsi instance
              'jitsi.members.fsf.org', // ✅ FSF's Jitsi instance
              'zoom.us',              // Zoom
              'teams.microsoft.com',  // Microsoft Teams
              'us02web.zoom.us',      // Zoom variants
              'us04web.zoom.us',
              'us05web.zoom.us'
            ];
            
            // Check if hostname matches any allowed platform
            const isAllowedHost = allowedHosts.some(host => 
              url.hostname === host || url.hostname.includes(host)
            );
            
            // Also allow custom Jitsi domains (ends with jit.si or contains jitsi)
            const isJitsiDomain = url.hostname.endsWith('.jit.si') || 
                                  url.hostname.includes('jitsi') ||
                                  url.hostname === '8x8.vc' ||
                                  url.hostname === 'jitsi.riot.im' ||
                                  url.hostname === 'meet.ffmuc.net' ||
                                  url.hostname === 'jitsi.ow2.org';
            
            return isAllowedHost || isJitsiDomain;
          } catch (error) {
            return false;
          }
        },
        message: 'Meeting link must be a valid video conference URL (Google Meet, Jitsi Meet, Element Jitsi, etc.)'
      }
    },
    meetingGenerated: {
      type: Boolean,
      default: false
    },
    meetingGeneratedAt: {
      type: Date,
      default: null
    },
    meetingEndedAt: {
      type: Date,
      default: null
    },
    // ✅ NEW: Meeting type field to track platform
    meetingType: {
      type: String,
      enum: ['google', 'jitsi', 'zoom', 'teams', 'other'],
      default: 'jitsi' // Default to Jitsi Meet
    },
    // ✅ NEW: Room name for Jitsi Meet
    roomName: {
      type: String,
      default: null
    },
    sessionNotes: {
      type: String,
      maxlength: 2000,
      default: ''
    },
    // Meeting participants tracking (optional - for future use)
    meetingParticipants: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      joinedAt: {
        type: Date
      },
      leftAt: {
        type: Date
      },
      duration: {
        type: Number, // in minutes
        default: 0
      }
    }],
    // Multi-tenant support
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: false,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  });

  // Update the updatedAt field on save
  schema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
  });

  // Virtual field to check if meeting is ready
  schema.virtual('meetingReady').get(function() {
    return this.status === 'Scheduled' && !!this.meetingLink;
  });

  // Virtual field to check if appointment is starting soon (within 15 minutes)
  schema.virtual('isStartingSoon').get(function() {
    if (!this.appointmentDate) return false;
    const now = new Date();
    const diff = this.appointmentDate.getTime() - now.getTime();
    const diffMinutes = diff / (1000 * 60);
    return diffMinutes <= 15 && diffMinutes >= -5; // 15 min before to 5 min after
  });

  // Virtual field to check if appointment is currently active
  schema.virtual('isActive').get(function() {
    if (!this.appointmentDate) return false;
    const now = new Date();
    const diff = this.appointmentDate.getTime() - now.getTime();
    const diffMinutes = diff / (1000 * 60);
    return diffMinutes <= 5 && diffMinutes >= -60; // 5 min before to 60 min after
  });

  // ✅ UPDATED: Instance method to generate meeting link (now supports 8x8.vc)
  schema.methods.generateMeetingLink = function(platform = 'jitsi') {
    if (this.meetingLink) return this.meetingLink;
    
    const timestamp = new Date(this.appointmentDate).getTime();
    const appointmentId = this._id.toString();
    
    if (platform === 'jitsi' || platform === '8x8') {
      // Generate Jitsi Meet room with 8x8.vc domain
      const crypto = require('crypto');
      const hash = crypto
        .createHash('sha256')
        .update(`${appointmentId}-${timestamp}-neurolex`)
        .digest('hex')
        .substring(0, 12);
      
      const roomName = `neurolex-therapy-${hash}`;
      // ✅ UPDATED: Use most reliable Jitsi domain (Element's instance)
      this.meetingLink = `https://jitsi.riot.im/${roomName}`;
      this.meetingType = 'jitsi';
      this.roomName = roomName;
    } else {
      // Generate Google Meet room (legacy)
      const doctorId = this.doctor.toString();
      const patientId = this.patient.toString();
      const combined = `${doctorId}${patientId}${timestamp}`;
      const hash = combined
        .split('')
        .reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0);
      
      const positiveHash = Math.abs(hash);
      const meetingId = `neurolex-${positiveHash.toString(36).substring(0, 8)}`;
      this.meetingLink = `https://meet.google.com/${meetingId}`;
      this.meetingType = 'google';
    }
    
    this.meetingGenerated = true;
    this.meetingGeneratedAt = new Date();
    
    return this.meetingLink;
  };

  // Instance method to end meeting session
  schema.methods.endMeeting = function(sessionNotes = '') {
    this.meetingEndedAt = new Date();
    this.sessionNotes = sessionNotes;
    if (this.status === 'Scheduled') {
      this.status = 'Completed';
    }
  };

  // Static method to find appointments with upcoming meetings
  schema.statics.findUpcomingMeetings = function(userId, userRole = 'patient') {
    const query = {
      status: 'Scheduled',
      meetingLink: { $exists: true, $ne: null },
      appointmentDate: { $gte: new Date() }
    };
    
    if (userRole === 'doctor') {
      query.doctor = userId;
    } else {
      query.patient = userId;
    }
    
    return this.find(query)
      .populate('doctor', 'firstName lastName profilePicture')
      .populate('patient', 'firstName lastName profilePicture')
      .sort({ appointmentDate: 1 });
  };

  // Create indexes for efficient queries
  schema.index({ doctor: 1, appointmentDate: 1 });
  schema.index({ patient: 1, appointmentDate: 1 });
  schema.index({ appointmentDate: 1, status: 1 });
  schema.index({ status: 1, doctor: 1 });
  schema.index({ 'payment.status': 1, patient: 1 });
  schema.index({ meetingLink: 1 }, { sparse: true });
  schema.index({ status: 1, meetingGenerated: 1 });
  schema.index({ appointmentDate: 1, meetingLink: 1 });
  schema.index({ meetingType: 1 }, { sparse: true }); // ✅ NEW: Index for meeting type
  schema.index({ roomName: 1 }, { sparse: true }); // ✅ NEW: Index for room names
  schema.index({ tenantId: 1 }, { sparse: true });
  
  // Ensure virtuals are included in JSON output
  schema.set('toJSON', { virtuals: true });
  schema.set('toObject', { virtuals: true });
  
  return schema;
}

module.exports = createAppointmentSchema;