// server/utils/emailService.js

const nodemailer = require('nodemailer');

// Email templates for doctor verification
const doctorVerificationApproved = (doctorName, loginLink) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Congratulations! Your Professional Account has been Approved</h2>
  <p>Hello Dr. ${doctorName},</p>
  <p>We are pleased to inform you that your professional account on Neurolex has been approved after our verification process.</p>
  <p>You can now log in and start using all the professional features of the platform.</p>
  <p><a href="${loginLink}" style="padding: 10px 15px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">Log In to Your Account</a></p>
  <p>Thank you for joining our community of mental health professionals.</p>
  <p>Best regards,<br>The Neurolex Team</p>
</div>
`;

const doctorVerificationRejected = (doctorName, rejectionReason, loginLink) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Important Information About Your Professional Account</h2>
  <p>Hello ${doctorName},</p>
  <p>Thank you for your interest in joining Neurolex as a mental health professional.</p>
  <p>After reviewing your application, we regret to inform you that we are unable to approve your professional account at this time for the following reason:</p>
  <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #dc3545; margin: 15px 0;">
    ${rejectionReason}
  </div>
  <p>If you believe this decision was made in error or if you'd like to provide additional information, please contact our support team.</p>
  <p>Best regards,<br>The Neurolex Team</p>
</div>
`;

// Function para i-send ang email
const sendEmail = async (options) => {
  try {
    // Create nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USERNAME || '',
        pass: process.env.EMAIL_PASSWORD || ''
      }
    });
    
    // Add some debugging
    console.log('Email configuration:', {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true',
      username: process.env.EMAIL_USERNAME ? '***configured***' : '***missing***',
      password: process.env.EMAIL_PASSWORD ? '***configured***' : '***missing***'
    });
    
    // Check if using template format
    let htmlContent = options.html;
    let textContent = options.text || '';
    
    // Handle template-based emails (used in doctorController.js)
    if (options.template) {
      console.log(`Using template: ${options.template}`);
      // For now, create simple HTML based on the context
      const context = options.context || {};
      
      // Simple template system
      if (options.template === 'doctorRegistrationConfirmation') {
        const doctorName = context.doctorName || 'Doctor';
        const estimatedTime = context.estimatedReviewTime || '1-3 business days';
        
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Registration Confirmation</h2>
            <p>Hello Dr. ${doctorName},</p>
            <p>Thank you for registering with Neurolex. Your professional account is being reviewed.</p>
            <p>This process typically takes ${estimatedTime}.</p>
            <p>We will notify you when your account has been verified.</p>
          </div>
        `;
        
        textContent = `Hello Dr. ${doctorName},\n\nThank you for registering with Neurolex. Your professional account is being reviewed.\n\nThis process typically takes ${estimatedTime}.\n\nWe will notify you when your account has been verified.`;
      } 
      else if (options.template === 'adminDoctorVerification') {
        const doctorName = context.doctorName || 'Unknown Doctor';
        const specialization = context.specialization || 'Not specified';
        const adminLink = context.adminDashboardLink || '#';
        
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>New Doctor Registration</h2>
            <p>A new doctor has registered and requires verification:</p>
            <ul>
              <li><strong>Name:</strong> ${doctorName}</li>
              <li><strong>Specialization:</strong> ${specialization}</li>
            </ul>
            <p><a href="${adminLink}" style="padding: 10px 15px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">Verify Doctor</a></p>
          </div>
        `;
        
        textContent = `New Doctor Registration\n\nA new doctor has registered and requires verification:\n\nName: ${doctorName}\nSpecialization: ${specialization}\n\nVerify at: ${adminLink}`;
      }
      // Add the new verification templates
      else if (options.template === 'doctorVerificationApproved') {
        const doctorName = context.doctorName || 'Doctor';
        const loginLink = context.loginLink || '#';
        
        htmlContent = doctorVerificationApproved(doctorName, loginLink);
        textContent = `Congratulations! Your Professional Account has been Approved\n\nHello Dr. ${doctorName},\n\nWe are pleased to inform you that your professional account on Neurolex has been approved after our verification process.\n\nYou can now log in and start using all the professional features of the platform.\n\nThank you for joining our community of mental health professionals.\n\nBest regards,\nThe Neurolex Team`;
      }
      else if (options.template === 'doctorVerificationRejected') {
        const doctorName = context.doctorName || 'Doctor';
        const rejectionReason = context.rejectionReason || 'No reason provided';
        const loginLink = context.loginLink || '#';
        
        htmlContent = doctorVerificationRejected(doctorName, rejectionReason, loginLink);
        textContent = `Important Information About Your Professional Account\n\nHello ${doctorName},\n\nThank you for your interest in joining Neurolex as a mental health professional.\n\nAfter reviewing your application, we regret to inform you that we are unable to approve your professional account at this time for the following reason:\n\n${rejectionReason}\n\nIf you believe this decision was made in error or if you'd like to provide additional information, please contact our support team.\n\nBest regards,\nThe Neurolex Team`;
      }
    }
    
    // Define mail options
    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: options.to,
      subject: options.subject,
      html: htmlContent,
      text: textContent // Fallback para sa non-HTML email clients
    };
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent to: ${options.to}`);
    console.log(`Message ID: ${info.messageId}`);
    
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Email could not be sent');
  }
};

module.exports = sendEmail;