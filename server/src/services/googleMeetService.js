// server/src/services/googleMeetService.js - REAL GOOGLE MEET INTEGRATION
const { google } = require('googleapis');
const path = require('path');

class GoogleMeetService {
  constructor() {
    // You need to create a Google Service Account and download the JSON key
    // Instructions: https://developers.google.com/workspace/guides/create-credentials#service-account
    const keyFilePath = path.join(__dirname, '../../config/google-service-account.json');
    
    this.auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ],
    });
    
    this.calendar = google.calendar('v3');
  }

  /**
   * Create a REAL Google Meet room for therapy session
   */
  async createMeetingRoom(appointmentData) {
    try {
      console.log('🎥 Creating REAL Google Meet room for appointment:', appointmentData._id);
      
      const authClient = await this.auth.getClient();
      
      // Calculate end time
      const startTime = new Date(appointmentData.appointmentDate);
      const endTime = new Date(startTime.getTime() + (appointmentData.duration || 30) * 60000);
      
      // Create calendar event with Google Meet
      const event = {
        summary: `Neurolex Therapy Session`,
        description: `
          Therapy Session Details:
          - Doctor: Dr. ${appointmentData.doctor.firstName} ${appointmentData.doctor.lastName}
          - Patient: ${appointmentData.patient.firstName} ${appointmentData.patient.lastName}
          - Type: ${appointmentData.appointmentType}
          - Appointment ID: ${appointmentData._id}
          
          This is a confidential therapy session. Please ensure privacy.
        `,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: 'Asia/Manila', // Your timezone
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'Asia/Manila',
        },
        attendees: [
          { 
            email: appointmentData.doctor.email,
            displayName: `Dr. ${appointmentData.doctor.firstName} ${appointmentData.doctor.lastName}`,
            responseStatus: 'accepted'
          },
          { 
            email: appointmentData.patient.email,
            displayName: `${appointmentData.patient.firstName} ${appointmentData.patient.lastName}`,
            responseStatus: 'needsAction'
          },
        ],
        // This is the KEY part - request Google Meet conference
        conferenceData: {
          createRequest: {
            requestId: `neurolex-${appointmentData._id}-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        },
        // Make sure the event supports conferencing
        conferenceDataVersion: 1,
      };

      console.log('📅 Creating calendar event with Google Meet...');
      
      // Create the event
      const response = await this.calendar.events.insert({
        auth: authClient,
        calendarId: 'primary', // Use primary calendar
        resource: event,
        conferenceDataVersion: 1, // Required for Google Meet
        sendUpdates: 'all', // Send invites to attendees
      });

      const createdEvent = response.data;
      
      // Extract the Google Meet link
      const meetingLink = createdEvent.conferenceData?.entryPoints?.find(
        entry => entry.entryPointType === 'video'
      )?.uri;

      const meetingId = createdEvent.conferenceData?.conferenceId;

      if (!meetingLink) {
        throw new Error('Failed to create Google Meet link');
      }

      console.log('✅ Google Meet room created successfully:', meetingLink);

      return {
        success: true,
        meetingLink,
        meetingId,
        calendarEventId: createdEvent.id,
        conferenceData: createdEvent.conferenceData,
        attendees: createdEvent.attendees
      };

    } catch (error) {
      console.error('❌ Error creating Google Meet room:', error);
      throw new Error(`Failed to create Google Meet room: ${error.message}`);
    }
  }

  /**
   * Update existing meeting
   */
  async updateMeeting(calendarEventId, updates) {
    try {
      const authClient = await this.auth.getClient();
      
      const response = await this.calendar.events.update({
        auth: authClient,
        calendarId: 'primary',
        eventId: calendarEventId,
        resource: updates,
      });

      return {
        success: true,
        event: response.data
      };
    } catch (error) {
      console.error('Error updating meeting:', error);
      throw error;
    }
  }

  /**
   * Delete meeting
   */
  async deleteMeeting(calendarEventId) {
    try {
      const authClient = await this.auth.getClient();
      
      await this.calendar.events.delete({
        auth: authClient,
        calendarId: 'primary',
        eventId: calendarEventId,
        sendUpdates: 'all'
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting meeting:', error);
      throw error;
    }
  }
}

module.exports = GoogleMeetService;