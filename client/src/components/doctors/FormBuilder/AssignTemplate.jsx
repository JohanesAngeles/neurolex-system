// client/src/components/doctors/FormBuilder/AssignTemplate.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  ListItemButton,
  ListItemIcon,
  TextField,
  InputAdornment,
  CircularProgress,
  Tabs,
  Tab,
  Alert,
  IconButton
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import doctorService from '../../../services/doctorService';

const AssignTemplate = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [template, setTemplate] = useState(null);
  const [patients, setPatients] = useState([]);
  const [groups, setGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('individuals');
  const [selectedPatients, setSelectedPatients] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Fetch template and patients
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch template
        const templateData = await doctorService.getTemplate(id);
        setTemplate(templateData);
        
        // Initialize selected patients and groups from template
        if (templateData.assignedPatients) {
          setSelectedPatients(templateData.assignedPatients.map(p => 
            typeof p === 'object' ? p._id : p
          ));
        }
        
        if (templateData.assignedGroups) {
          setSelectedGroups(templateData.assignedGroups.map(g => 
            typeof g === 'object' ? g._id : g
          ));
        }
        
        // Fetch patients
        const patientsData = await doctorService.getPatients();
        setPatients(patientsData);
        
        // Fetch patient groups
        const groupsData = await doctorService.getPatientGroups();
        setGroups(groupsData);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load data. Please try again.');
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);
  
  // Handle patient selection
  const togglePatientSelection = (patientId) => {
    if (selectedPatients.includes(patientId)) {
      setSelectedPatients(selectedPatients.filter(id => id !== patientId));
    } else {
      setSelectedPatients([...selectedPatients, patientId]);
    }
  };
  
  // Handle group selection
  const toggleGroupSelection = (groupId) => {
    if (selectedGroups.includes(groupId)) {
      setSelectedGroups(selectedGroups.filter(id => id !== groupId));
    } else {
      setSelectedGroups([...selectedGroups, groupId]);
    }
  };
  
  // Save assignments
  const handleSaveAssignments = async () => {
    try {
      setSaving(true);
      setError(null);
      
      await doctorService.assignTemplate(id, {
        patients: selectedPatients,
        groups: selectedGroups
      });
      
      setSuccess(true);
      setTimeout(() => {
        navigate('/doctor/form-templates');
      }, 2000);
    } catch (error) {
      console.error('Error assigning template:', error);
      setError('Failed to save assignments. Please try again.');
      setSaving(false);
    }
  };
  
  // Filter patients by search term
  const filteredPatients = patients.filter(patient => 
    `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Filter groups by search term
  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (!template) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Template not found</Alert>
      </Box>
    );
  }
  
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/doctor/form-templates')} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5">
          Assign Template: {template.name}
        </Typography>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Template assignments saved successfully!
        </Alert>
      )}
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs 
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
          >
            <Tab value="individuals" label="Individual Patients" icon={<PersonIcon />} iconPosition="start" />
            <Tab value="groups" label="Patient Groups" icon={<GroupIcon />} iconPosition="start" />
          </Tabs>
        </Box>
        
        <TextField
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          fullWidth
          margin="normal"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        
        {activeTab === 'individuals' && (
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredPatients.length === 0 ? (
              <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                No patients found
              </Typography>
            ) : (
              filteredPatients.map(patient => (
                <ListItem 
                  key={patient._id}
                  disablePadding
                  secondaryAction={
                    <Checkbox
                      edge="end"
                      checked={selectedPatients.includes(patient._id)}
                      onChange={() => togglePatientSelection(patient._id)}
                    />
                  }
                >
                  <ListItemButton onClick={() => togglePatientSelection(patient._id)}>
                    <ListItemAvatar>
                      <Avatar>
                        {patient.firstName?.[0]}{patient.lastName?.[0]}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText 
                      primary={`${patient.firstName} ${patient.lastName}`}
                      secondary={patient.email}
                    />
                  </ListItemButton>
                </ListItem>
              ))
            )}
          </List>
        )}
        
        {activeTab === 'groups' && (
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredGroups.length === 0 ? (
              <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                No groups found
              </Typography>
            ) : (
              filteredGroups.map(group => (
                <ListItem 
                  key={group._id}
                  disablePadding
                  secondaryAction={
                    <Checkbox
                      edge="end"
                      checked={selectedGroups.includes(group._id)}
                      onChange={() => toggleGroupSelection(group._id)}
                    />
                  }
                >
                  <ListItemButton onClick={() => toggleGroupSelection(group._id)}>
                    <ListItemIcon>
                      <GroupIcon />
                    </ListItemIcon>
                    <ListItemText 
                      primary={group.name}
                      secondary={`${group.patients.length} patients`}
                    />
                  </ListItemButton>
                </ListItem>
              ))
            )}
          </List>
        )}
      </Paper>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button 
          variant="outlined" 
          onClick={() => navigate('/doctor/form-templates')}
          sx={{ mr: 2 }}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSaveAssignments}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Assignments'}
        </Button>
      </Box>
    </Box>
  );
};

export default AssignTemplate;