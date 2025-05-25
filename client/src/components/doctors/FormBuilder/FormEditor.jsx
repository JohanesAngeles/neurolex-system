import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import doctorService from '../../../services/doctorService'; // Import doctorService
import '../../../styles/components/doctor/JournalTemplateForm.css';

const JournalTemplateForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  
  const [template, setTemplate] = useState({
    name: '',
    description: '',
    isDefault: false,
    fields: []
  });
  
  const [currentField, setCurrentField] = useState(null);
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Fetch template data if editing
  useEffect(() => {
    if (isEditing) {
      const fetchTemplate = async () => {
        try {
          setLoading(true);
          // Use doctorService instead of direct fetch
          const response = await doctorService.getTemplate(id);
          
          if (response && response.data) {
            // Make sure fields is always an array
            const processedData = {
              ...response.data,
              fields: Array.isArray(response.data.fields) ? response.data.fields : []
            };
            setTemplate(processedData);
          } else {
            setError('Invalid template data received. Please try again.');
          }
        } catch (error) {
          console.error('Error fetching template:', error);
          setError('Failed to load template. Please try again.');
        } finally {
          setLoading(false);
        }
      };
      
      fetchTemplate();
    }
  }, [id, isEditing]);
  
  // Move field up in order
  const handleMoveUp = (index) => {
    if (index === 0) return; // Already at the top
    
    const newFields = [...template.fields];
    const temp = newFields[index];
    newFields[index] = newFields[index - 1];
    newFields[index - 1] = temp;
    
    setTemplate({
      ...template,
      fields: newFields
    });
  };
  
  // Move field down in order
  const handleMoveDown = (index) => {
    if (index === template.fields.length - 1) return; // Already at the bottom
    
    const newFields = [...template.fields];
    const temp = newFields[index];
    newFields[index] = newFields[index + 1];
    newFields[index + 1] = temp;
    
    setTemplate({
      ...template,
      fields: newFields
    });
  };
  
  // Add a new field
  const handleAddField = () => {
    setCurrentField({
      id: `field_${Date.now()}`,
      type: 'text',
      label: '',
      placeholder: '',
      required: false,
      options: []
    });
    setFieldDialogOpen(true);
  };
  
  // Edit an existing field
  const handleEditField = (field) => {
    setCurrentField({ ...field });
    setFieldDialogOpen(true);
  };
  
  // Save field (add or update)
  const handleSaveField = () => {
    if (!currentField || !currentField.label || !currentField.label.trim()) {
      return;
    }
    
    const fieldIndex = template.fields.findIndex(f => f.id === currentField.id);
    const newFields = [...template.fields];
    
    if (fieldIndex >= 0) {
      // Update existing field
      newFields[fieldIndex] = currentField;
    } else {
      // Add new field
      newFields.push(currentField);
    }
    
    setTemplate({
      ...template,
      fields: newFields
    });
    
    setFieldDialogOpen(false);
  };
  
  // Delete a field
  const handleDeleteField = (fieldId) => {
    setTemplate({
      ...template,
      fields: template.fields.filter(field => field.id !== fieldId)
    });
  };
  
  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, checked } = e.target;
    setTemplate({
      ...template,
      [name]: name === 'isDefault' ? checked : value
    });
  };
  
  // Save entire template
  const handleSaveTemplate = async () => {
    if (!template.name || !template.name.trim()) {
      setError('Template name is required');
      return;
    }
    
    if (!template.fields || template.fields.length === 0) {
      setError('At least one field is required');
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      // Clone the template to avoid reference issues
      const templateToSave = {
        ...JSON.parse(JSON.stringify(template))
      };
      
      // Ensure all fields have proper IDs and no invalid properties
      templateToSave.fields = (templateToSave.fields || []).map(field => {
        // Filter out any undefined or null values
        return Object.fromEntries(
          Object.entries(field).filter(([_, v]) => v !== undefined && v !== null)
        );
      });
      
      console.log('Attempting to save template:', templateToSave);
      
      // Use doctorService instead of direct fetch
      let result;
      if (isEditing) {
        result = await doctorService.updateTemplate(id, templateToSave);
      } else {
        result = await doctorService.createTemplate(templateToSave);
      }
      
      console.log('Save result:', result);
      
      setSaveSuccess(true);
      setTimeout(() => {
        navigate('/doctor/form-templates');
      }, 1500);
    } catch (error) {
      console.error('Error saving template:', error);
      
      if (error.response && error.response.data && error.response.data.message) {
        setError(`Server error: ${error.response.data.message}`);
      } else if (error.message) {
        setError(error.message);
      } else {
        setError('Failed to save template. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="ntx-loading-container">
        <div className="ntx-loading-spinner"></div>
      </div>
    );
  }
  
  // This component is already inside doctor-content-container from the layout
  return (
    <div className="ntx-journal-template-container">
      <div className="ntx-journal-template-header">
        <button className="ntx-back-button" onClick={() => navigate('/doctor/form-templates')}>
          <i className="ntx-arrow-left-icon">←</i>
        </button>
        <h1 className="ntx-template-title">Add a Journal Template</h1>
        <div className="ntx-edit-icon-container">
          <span className="ntx-edit-icon">✏️</span>
        </div>
      </div>
      
      <p className="ntx-template-subtitle">Design a custom form to help guide your patients through reflections, exercises, or tasks.</p>
      
      <hr className="ntx-divider" />
      
      {error && (
        <div className="ntx-error-alert">
          <span className="ntx-alert-title">Error:</span> {error}
        </div>
      )}
      
      {saveSuccess && (
        <div className="ntx-success-alert">
          <span className="ntx-alert-title">Success:</span> Template saved successfully!
        </div>
      )}
      
      {/* Template Information Section */}
      <div className="ntx-template-section">
        <div className="ntx-template-content-container">
          <h2 className="ntx-section-title">Template Information</h2>
          <div className="ntx-form-group">
            <label className="ntx-form-label">Title</label>
            <input
              type="text"
              className="ntx-form-input"
              name="name"
              value={template.name || ''}
              onChange={handleInputChange}
              placeholder="Write the title of the form..."
              required
            />
          </div>
          
          <div className="ntx-form-group">
            <label className="ntx-form-label">Description</label>
            <textarea
              className="ntx-form-textarea"
              name="description"
              value={template.description || ''}
              onChange={handleInputChange}
              placeholder="Write a short description or instructions for the form..."
              rows="4"
            />
          </div>
        </div>
      </div>
      
      {/* Form Fields Section */}
      <div className="ntx-template-section">
        <div className="ntx-template-content-container">
          <div className="ntx-section-header">
            <h2 className="ntx-section-title">Form Fields</h2>
            <button 
              className="ntx-add-field-button"
              onClick={handleAddField}
            >
              + Add Field
            </button>
          </div>
          {/* SIMPLIFIED FIELD LIST IMPLEMENTATION (NO DRAG & DROP) */}
          <div className="ntx-fields-list">
            {template.fields.length === 0 ? (
              <div className="ntx-empty-fields-message">
                No fields added yet. Click "Add Field" to create your first field.
              </div>
            ) : (
              template.fields.map((field, index) => (
                <div key={field.id} className="ntx-field-item">
                  <div className="ntx-field-order-controls">
                    <button 
                      className="ntx-field-up-button" 
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      title="Move Up"
                    >
                      ↑
                    </button>
                    <div className="ntx-field-index">{index + 1}</div>
                    <button 
                      className="ntx-field-down-button" 
                      onClick={() => handleMoveDown(index)}
                      disabled={index === template.fields.length - 1}
                      title="Move Down"
                    >
                      ↓
                    </button>
                  </div>
                  <div className="ntx-field-content">
                    <div className="ntx-field-label">{field.label || 'Unnamed Field'}</div>
                    <div className="ntx-field-type">
                      {field.type || 'text'}{field.required ? ' • Required' : ''}
                    </div>
                  </div>
                  <div className="ntx-field-actions">
                    <button 
                      className="ntx-field-edit-button" 
                      onClick={() => handleEditField(field)}
                      title="Edit Field"
                    >
                      ✏️
                    </button>
                    <button 
                      className="ntx-field-delete-button"
                      onClick={() => handleDeleteField(field.id)}
                      title="Delete Field"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
      {/* Bottom Navigation */}
      <div className="ntx-template-actions">
        <button 
          className="ntx-cancel-button"
          onClick={() => navigate('/doctor/form-templates')}
          disabled={saving}
        >
          Cancel
        </button>
        <button 
          className="ntx-save-button"
          onClick={handleSaveTemplate}
          disabled={saving || !template.name || template.fields.length === 0}
        >
          Save Template
        </button>
      </div>
      
      {/* Field Dialog */}
      {fieldDialogOpen && (
        <div className="ntx-modal-overlay">
          <div className="ntx-modal-content">
            <div className="ntx-modal-header">
              <h3 className="ntx-modal-title">
                {currentField && currentField.id ? 'Edit Field' : 'Add Field'}
              </h3>
              <button 
                className="ntx-modal-close"
                onClick={() => setFieldDialogOpen(false)}
              >
                &times;
              </button>
            </div>
            <div className="ntx-modal-body">
              {currentField && (
                <div className="ntx-modal-form-content">
                  <div className="ntx-form-group">
                    <label className="ntx-form-label">Field Type</label>
                    <select
                      className="ntx-form-select"
                      value={currentField.type || 'text'}
                      onChange={(e) => setCurrentField({ 
                        ...currentField, 
                        type: e.target.value,
                        options: ['select', 'radio', 'checkbox', 'mood-scale'].includes(e.target.value) 
                          ? (currentField.options && currentField.options.length) ? currentField.options : [{ label: '', value: '' }]
                          : []
                      })}
                    >
                      <option value="text">Text Input</option>
                      <option value="textarea">Text Area</option>
                      <option value="select">Dropdown Select</option>
                      <option value="radio">Radio Buttons</option>
                      <option value="checkbox">Checkboxes</option>
                      <option value="mood-scale">Mood Scale</option>
                      <option value="date">Date Picker</option>
                      <option value="time">Time Picker</option>
                    </select>
                  </div>
                  
                  <div className="ntx-form-group">
                    <label className="ntx-form-label">Field Label</label>
                    <input
                      type="text"
                      className="ntx-form-input"
                      value={currentField.label || ''}
                      onChange={(e) => setCurrentField({ ...currentField, label: e.target.value })}
                      placeholder="Enter field label"
                      required
                    />
                    {currentField.label && !currentField.label.trim() && (
                      <div className="ntx-input-error">Field label is required</div>
                    )}
                  </div>
                  
                  <div className="ntx-form-group">
                    <label className="ntx-form-label">Placeholder</label>
                    <input
                      type="text"
                      className="ntx-form-input"
                      value={currentField.placeholder || ''}
                      onChange={(e) => setCurrentField({ ...currentField, placeholder: e.target.value })}
                      placeholder="Enter field placeholder text"
                    />
                  </div>
                  
                  <div className="ntx-form-group ntx-checkbox-group">
                    <label className="ntx-checkbox-container">
                      <input
                        type="checkbox"
                        checked={currentField.required || false}
                        onChange={(e) => setCurrentField({ ...currentField, required: e.target.checked })}
                      />
                      <span className="ntx-checkbox-label">Required field</span>
                    </label>
                  </div>
                  
                  {/* Options editor for select, radio, checkbox fields */}
                  {['select', 'radio', 'checkbox', 'mood-scale'].includes(currentField.type) && (
                    <div className="ntx-options-editor">
                      <h4 className="ntx-options-title">Options</h4>
                      {(currentField.options || []).map((option, index) => (
                        <div key={index} className="ntx-option-row">
                          <input
                            type="text"
                            className="ntx-form-input"
                            value={option.label || ''}
                            onChange={(e) => {
                              const newOptions = [...(currentField.options || [])];
                              newOptions[index] = { 
                                ...newOptions[index],
                                label: e.target.value,
                                value: option.value || e.target.value.toLowerCase().replace(/\s+/g, '_')
                              };
                              setCurrentField({ ...currentField, options: newOptions });
                            }}
                            placeholder="Option label"
                          />
                          
                          {currentField.type === 'mood-scale' && (
                            <input
                              type="text"
                              className="ntx-form-input ntx-icon-input"
                              value={option.icon || ''}
                              onChange={(e) => {
                                const newOptions = [...(currentField.options || [])];
                                newOptions[index] = { ...newOptions[index], icon: e.target.value };
                                setCurrentField({ ...currentField, options: newOptions });
                              }}
                              placeholder="Icon"
                            />
                          )}
                          
                          <input
                            type="text"
                            className="ntx-form-input ntx-value-input"
                            value={option.value || ''}
                            onChange={(e) => {
                              const newOptions = [...(currentField.options || [])];
                              newOptions[index] = { ...newOptions[index], value: e.target.value };
                              setCurrentField({ ...currentField, options: newOptions });
                            }}
                            placeholder="Value"
                          />
                          
                          <button 
                            className="ntx-delete-option-button"
                            onClick={() => {
                              const newOptions = [...(currentField.options || [])];
                              newOptions.splice(index, 1);
                              setCurrentField({ ...currentField, options: newOptions });
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                      
                      <button
                        className="ntx-add-option-button"
                        onClick={() => {
                          const newOptions = [...(currentField.options || []), { label: '', value: '' }];
                          setCurrentField({ ...currentField, options: newOptions });
                        }}
                      >
                        + Add Option
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="ntx-modal-footer">
              <button 
                className="ntx-modal-cancel-button"
                onClick={() => setFieldDialogOpen(false)}
              >
                Cancel
              </button>
              <button 
                className="ntx-modal-save-button"
                onClick={handleSaveField}
                disabled={!currentField || !currentField.label || !currentField.label.trim()}
              >
                Save Field
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JournalTemplateForm;