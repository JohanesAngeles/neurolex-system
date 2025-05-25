// server/scripts/addClinics.js
require('dotenv').config();
const { connectMaster } = require('../src/config/dbMaster');
const dbManager = require('../src/utils/dbManager');

/**
 * Script to add three clinics to the master database
 */
async function addClinics() {
  try {
    console.log('Connecting to master database...');

    // Connect to master database
    const masterConn = await connectMaster();

    // Initialize models
    dbManager.initializeMasterModels();

    // Get Tenant model
    const Tenant = masterConn.model('Tenant');

    // Define the three clinics to add
    const clinics = [
      {
        name: 'Mental Health Center of Manila',
        dbName: 'neurolex_mhcm',
        adminEmail: 'admin@mhcm.com',
        logoUrl: '/logos/mhcm-logo.svg',
        primaryColor: '#2563eb', // Blue
        secondaryColor: '#f1f5f9',
        active: true
      },
      {
        name: 'Marikina Wellness Clinic',
        dbName: 'neurolex_mwc',
        adminEmail: 'admin@mwc.com',
        logoUrl: '/logos/mwc-logo.svg',
        primaryColor: '#16a34a', // Green
        secondaryColor: '#f0fdf4',
        active: true
      },
      {
        name: 'PH Psychology Associates',
        dbName: 'neurolex_phpa',
        adminEmail: 'admin@phpa.com',
        logoUrl: '/logos/phpa-logo.svg',
        primaryColor: '#9333ea', // Purple
        secondaryColor: '#f5f3ff',
        active: true
      }
    ];

    console.log('Adding clinics to the database...');

    // Add each clinic if it doesn't already exist
    for (const clinic of clinics) {
      const existingClinic = await Tenant.findOne({ dbName: clinic.dbName });

      if (!existingClinic) {
        console.log(`Creating new clinic: ${clinic.name}`);
        const newClinic = new Tenant(clinic);
        await newClinic.save();
        console.log(`Clinic created: ${clinic.name} with ID: ${newClinic._id}`);
      } else {
        console.log(`Clinic already exists: ${clinic.name}`);
      }
    }

    console.log('All clinics added successfully');
  } catch (error) {
    console.error('Error adding clinics:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the function
addClinics();