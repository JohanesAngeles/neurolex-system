// server/src/schemas/extensions/passwordHashing.js

const bcrypt = require('bcryptjs');

/**
 * Applies password hashing middleware to a schema
 * @param {Schema} schema - The schema to apply middleware to
 * @returns {Schema} The enhanced schema
 */
function applyPasswordHashingMiddleware(schema) {
  // Check if middleware is already applied
  const middlewareExists = schema.pre && 
    schema._pre && 
    schema._pre.some(hook => 
      hook.fn && hook.fn.toString().includes('isModified(\'password\')'));
  
  if (middlewareExists) {
    console.log('Password hashing middleware already exists on schema');
    return schema;
  }

  // Add pre-save middleware for password hashing
  schema.pre('save', async function(next) {
    // Only hash password if it's been modified or is new
    if (!this.isModified('password')) {
      return next();
    }

    try {
      console.log(`Hashing password for user: ${this.email || 'new user'}`);
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
      console.log('Password hashed successfully');
      next();
    } catch (error) {
      console.error('Error hashing password:', error);
      next(error);
    }
  });

  // Add comparePassword method if it doesn't exist
  if (!schema.methods.comparePassword) {
    schema.methods.comparePassword = async function(candidatePassword) {
      try {
        console.log(`Comparing password for user: ${this.email}`);
        return await bcrypt.compare(candidatePassword, this.password);
      } catch (error) {
        console.error('Error comparing passwords:', error);
        return false;
      }
    };
  }

  return schema;
}

module.exports = applyPasswordHashingMiddleware;