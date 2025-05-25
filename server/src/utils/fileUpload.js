// server/src/utils/fileUpload.js

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Simple local file upload function (for development)
 * In production, replace with S3 or similar cloud storage
 * 
 * @param {Object} file - Multer file object
 * @param {String} targetPath - Target path for the file
 * @returns {String} - URL to the uploaded file
 */
exports.uploadToLocal = async (file, targetPath) => {
  try {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Create target directory if it doesn't exist
    const targetDir = path.join(uploadsDir, path.dirname(targetPath));
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Generate unique filename
    const fileExt = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExt}`;
    
    // Full path to save the file
    const fullPath = path.join(uploadsDir, path.dirname(targetPath), fileName);
    
    // Write file to disk
    fs.writeFileSync(fullPath, file.buffer);
    
    // Return relative URL to the file
    return `/uploads/${path.dirname(targetPath)}/${fileName}`;
  } catch (error) {
    console.error('File upload error:', error);
    throw new Error('File upload failed');
  }
};

/**
 * Placeholder for S3 upload function
 * For now, just use local file upload
 */
exports.uploadToS3 = async (file, targetPath) => {
  // Since S3 config is not set up, fall back to local upload for now
  console.log('S3 upload not configured, falling back to local upload');
  return this.uploadToLocal(file, targetPath);
};