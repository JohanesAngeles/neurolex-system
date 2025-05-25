/**
 * Tenant field extension
 * Adds tenant-specific fields to schemas
 */
const mongoose = require('mongoose');

/**
 * Applies tenant-specific fields to a schema
 * @param {Schema} schema - Mongoose schema
 * @returns {Schema} Schema with tenant fields
 */
function applyTenantFields(schema) {
  // Clone the schema to avoid modifying the original
  const schemaObj = schema.obj ? { ...schema.obj } : schema;
  const tenantSchema = new mongoose.Schema(schemaObj, schema.options || {});
  
  // Add tenant ID field if it doesn't exist
  if (!tenantSchema.path('tenantId')) {
    tenantSchema.add({
      tenantId: {
        type: String,
        required: true,
        index: true
      }
    });
  }
  
  // Add tenant-specific validation
  tenantSchema.methods.belongsToTenant = function(tenantId) {
    return this.tenantId === tenantId;
  };
  
  return tenantSchema;
}

module.exports = {
  applyTenantFields
};