// client/src/pages/admin/FormTemplates.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import adminService from '../../services/adminService';
import '../../styles/components/admin/AdminFormList.css';

// Import SVG icons (adjust paths as needed)
import searchIcon from '../../assets/icons/search_icon.svg';
import viewIcon from '../../assets/icons/view_icon.svg';
import editIcon from '../../assets/icons/edit_icon.svg';
import deleteIcon from '../../assets/icons/delete_icon.svg';

const AdminFormTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    totalCreated: 0,
    active: 0,
    inactive: 0,
    entries: 0
  });
  
  const navigate = useNavigate();
  
  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        const data = await adminService.getTemplates();
        
        // Check if data has the expected structure
        if (data && data.success && Array.isArray(data.templates)) {
          setTemplates(data.templates);
          calculateStats(data.templates);
        } else if (Array.isArray(data)) {
          setTemplates(data);
          calculateStats(data);
        } else {
          console.error('Templates data is not in expected format:', data);
          setTemplates([]);
          setError('Failed to load templates in the expected format.');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching templates:', error);
        setError('Failed to load templates. Please try again.');
        setTemplates([]);
        setLoading(false);
      }
    };
    
    fetchTemplates();
  }, []);
  
  // Calculate statistics for the dashboard
  const calculateStats = (templateData) => {
    const stats = {
      totalCreated: templateData.length,
      active: templateData.filter(t => t.status === 'active' || t.isDefault).length,
      inactive: templateData.filter(t => t.status === 'inactive' && !t.isDefault).length,
      entries: templateData.reduce((sum, template) => sum + (template.entriesCount || 0), 0)
    };
    
    setStats(stats);
  };
  
  // Handle template deletion
  const confirmDelete = (template) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };
  
  const handleDelete = async () => {
    if (!templateToDelete) return;
    
    try {
      await adminService.deleteTemplate(templateToDelete._id);
      
      // Update local state
      const updatedTemplates = templates.filter(t => t._id !== templateToDelete._id);
      setTemplates(updatedTemplates);
      calculateStats(updatedTemplates);
      
      // Close dialog
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    } catch (error) {
      console.error('Error deleting template:', error);
      setError('Failed to delete template. Please try again.');
    }
  };
  
  // Duplicate a template
  const duplicateTemplate = async (template) => {
    try {
      // Create a new template based on the selected one
      const newTemplate = {
        ...template,
        name: `${template.name} (Copy)`,
        isDefault: false
      };
      
      // Remove the _id field to create a new document
      delete newTemplate._id;
      
      const createdTemplate = await adminService.createTemplate(newTemplate);
      
      // Add the new template to the list
      const updatedTemplates = [...templates, createdTemplate];
      setTemplates(updatedTemplates);
      calculateStats(updatedTemplates);
    } catch (error) {
      console.error('Error duplicating template:', error);
      setError('Failed to duplicate template. Please try again.');
    }
  };
  
  // Handle search filtering
  const filteredTemplates = templates.filter(template => 
    template.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div className="admin-template-management-content">
      <div className="admin-template-management-header">
        <h1>Journal Template Management</h1>
        <p>Manage, customize, and assign journal templates for personalized user experiences.</p>
      </div>
      
      {/* Stats Cards */}
      <div className="admin-stats-cards-container">
        <div className="admin-stats-card">
          <h3 className="admin-stats-label">Templates I Created</h3>
          <div className="admin-stats-value-container">
            <div className="admin-stats-value">{stats.totalCreated}</div>
          </div>
        </div>
        
        <div className="admin-stats-card">
          <h3 className="admin-stats-label">Active Templates</h3>
          <div className="admin-stats-value-container">
            <div className="admin-stats-value">{stats.active}</div>
          </div>
        </div>
        
        <div className="admin-stats-card">
          <h3 className="admin-stats-label">Inactive Templates</h3>
          <div className="admin-stats-value-container">
            <div className="admin-stats-value">{stats.inactive}</div>
          </div>
        </div>
        
        <div className="admin-stats-card">
          <h3 className="admin-stats-label">Entries (To My Templates)</h3>
          <div className="admin-stats-value-container">
            <div className="admin-stats-value">{stats.entries}</div>
          </div>
        </div>
      </div>
      
      {/* Error Alert */}
      {error && (
        <div className="admin-error-alert">
          <span className="admin-alert-title">Error:</span> {error}
        </div>
      )}
      
      {/* Search and Add */}
      <div className="admin-template-actions-bar">
        <div className="admin-search-box">
          <img src={searchIcon} alt="Search" className="admin-search-icon" />
          <input
            type="text"
            placeholder="Search templates"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <button className="admin-add-template-button" onClick={() => navigate('/admin/templates/create')}>
          <span className="admin-button-icon">+</span> Add a Journal Template
        </button>
      </div>
      
      {/* Templates Table */}
      {loading ? (
        <div className="admin-loading-container">
          <div className="admin-loading-spinner"></div>
        </div>
      ) : !Array.isArray(templates) || templates.length === 0 ? (
        <div className="admin-empty-state">
          <h3>No templates found</h3>
          <p>Create your first journal template to get started.</p>
          <button className="admin-add-template-button" onClick={() => navigate('/admin/templates/create')}>
            <span className="admin-button-icon">+</span> Create Template
          </button>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-template-table">
            <thead>
              <tr>
                <th>Template Name</th>
                <th>Created By (Doctor)</th>
                <th>Assigned To</th>
                <th>Date Created</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.map((template, index) => (
                <tr key={template._id || `template-${index}`}>
                  <td data-label="Template Name">{template.name || 'Untitled'}</td>
                  <td data-label="Created By">{template.createdBy || 'N/A'}</td>
                  <td data-label="Assigned To">{template.assignedTo || 'No assignments'}</td>
                  <td data-label="Date Created">
                    {new Date(template.createdAt).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </td>
                  <td data-label="Status">
                    <span className={`admin-status-indicator ${template.isDefault || template.status === 'active' ? 'active' : 'inactive'}`}>
                      {template.isDefault || template.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td data-label="Actions">
                    <div className="admin-action-icons">
                      <img 
                        src={viewIcon} 
                        alt="View" 
                        className="admin-action-icon view" 
                        onClick={() => navigate(`/admin/templates/${template._id}`)}
                        title="View Template"
                      />
                      <img 
                        src={editIcon} 
                        alt="Edit" 
                        className="admin-action-icon edit" 
                        onClick={() => navigate(`/admin/templates/${template._id}/edit`)}
                        title="Edit Template"
                      />
                      <img 
                        src={deleteIcon} 
                        alt="Delete" 
                        className="admin-action-icon delete" 
                        onClick={() => confirmDelete(template)}
                        title="Delete Template"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Pagination */}
      <div className="admin-pagination">
        <button className="admin-pagination-button" disabled={true}>&laquo;</button>
        <div className="admin-pagination-numbers">
          <button className="admin-pagination-number active">1</button>
          <button className="admin-pagination-number">2</button>
          <button className="admin-pagination-number">3</button>
        </div>
        <button className="admin-pagination-button">&raquo;</button>
      </div>
      
      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && (
        <div className="admin-dialog-overlay">
          <div className="admin-dialog-content">
            <h2>Confirm Deletion</h2>
            <p>
              Are you sure you want to delete the template "{templateToDelete?.name}"? 
              This action cannot be undone and may affect patients who are currently 
              using this template.
            </p>
            <div className="admin-dialog-actions">
              <button className="admin-dialog-button cancel" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </button>
              <button className="admin-dialog-button delete" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFormTemplates;