// server/src/services/cloudinary.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // dm7qxemt
  api_key: process.env.CLOUDINARY_API_KEY,       // 291968957346711
  api_secret: process.env.CLOUDINARY_API_SECRET, // gwMDx_iKxQ6FC3dR616am_MVGTY
});

// ✅ ADDED: Direct upload function for buffer uploads
const uploadToCloudinary = async (buffer, options = {}) => {
  try {
    console.log('📤 Uploading buffer to Cloudinary with options:', options);
    
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: options.folder || `${process.env.CLOUDINARY_FOLDER || 'neurolex'}/uploads`,
          public_id: options.public_id,
          overwrite: options.overwrite || true,
          resource_type: options.resource_type || 'auto',
          transformation: options.transformation || [
            { width: 400, height: 400, crop: 'limit' },
            { quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            console.error('❌ Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('✅ Cloudinary upload success:', result.secure_url);
            resolve(result);
          }
        }
      ).end(buffer);
    });
  } catch (error) {
    console.error('❌ Error in uploadToCloudinary:', error);
    throw error;
  }
};

// ✅ Multi-tenant logo storage
const logoStorage = (tenantId) => new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: `${process.env.CLOUDINARY_FOLDER || 'neurolex'}/tenants/${tenantId}/logos`,
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
    transformation: [
      { width: 400, height: 400, crop: 'limit' },
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ],
    public_id: (req, file) => {
      const timestamp = Date.now();
      const isDark = req.body.variant === 'dark' || file.originalname.toLowerCase().includes('dark');
      return `logo_${isDark ? 'dark' : 'light'}_${timestamp}`;
    }
  }
});

// ✅ Multi-tenant favicon storage
const faviconStorage = (tenantId) => new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: `${process.env.CLOUDINARY_FOLDER || 'neurolex'}/tenants/${tenantId}/favicons`,
    allowed_formats: ['png', 'ico', 'svg'],
    transformation: [
      { width: 64, height: 64, crop: 'scale' },
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ],
    public_id: (req, file) => {
      const timestamp = Date.now();
      const isDark = req.body.variant === 'dark' || file.originalname.toLowerCase().includes('dark');
      return `favicon_${isDark ? 'dark' : 'light'}_${timestamp}`;
    }
  }
});

// ✅ Helper function to delete old images
const deleteCloudinaryImage = async (publicId) => {
  try {
    if (publicId) {
      console.log('🗑️ Deleting image from Cloudinary:', publicId);
      const result = await cloudinary.uploader.destroy(publicId);
      console.log('✅ Cloudinary deletion result:', result);
      return result;
    }
  } catch (error) {
    console.error('❌ Error deleting image from Cloudinary:', error);
  }
};

// ✅ Extract public ID from Cloudinary URL
const extractPublicId = (cloudinaryUrl) => {
  try {
    if (!cloudinaryUrl || !cloudinaryUrl.includes('cloudinary.com')) {
      return null;
    }
    
    console.log('🔍 Extracting public ID from URL:', cloudinaryUrl);
    
    const urlParts = cloudinaryUrl.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    
    if (uploadIndex === -1) return null;
    
    let pathParts = urlParts.slice(uploadIndex + 1);
    
    // Remove version if present (starts with 'v' followed by numbers)
    if (pathParts[0] && pathParts[0].match(/^v\d+$/)) {
      pathParts = pathParts.slice(1);
    }
    
    // Join path parts and remove file extension
    const publicId = pathParts.join('/').replace(/\.[^.]+$/, '');
    console.log('✅ Extracted public ID:', publicId);
    return publicId;
  } catch (error) {
    console.error('❌ Error extracting public ID:', error);
    return null;
  }
};

module.exports = {
  cloudinary,
  logoStorage,
  faviconStorage,
  deleteCloudinaryImage,
  extractPublicId,
  uploadToCloudinary // ✅ ADDED: Export the new function
};