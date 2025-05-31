import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

// Import TenantProvider
import { TenantProvider } from './context/TenantContext';

// Socket Service Initialization
import { initializeSocket } from './services/socketService';
import NotificationHandler from './components/comunnication/NotificationHandler';

// Auth Components
import Register from './components/auth/Register';
import EmailVerification from './components/auth/EmailVerification';
import Login from './components/auth/Login';
import ForgotPassword from './components/auth/Forgot_Password';
import DoctorVerification from './components/auth/DoctorVerification';
import Onboarding from './components/onboarding/Onboarding';

// Doctor Registration Components
import ProfessionalRegistration from './components/doctors/ProfessionalRegistration';
import VerificationPendingPage from './components/doctors/VerificationPending';

// Dashboard Components
import DashboardLayout from './components/dashboard/DashboardLayout';
import Dashboard from './components/dashboard/Dashboard';
import Messages from './components/comunnication/Messaging';
import TokenTest from './components/comunnication/TokenTest';
import CallPage from './pages/communication/CallPage';

// Journal Components
import JournalInsights from './components/journal/JournalLogList';
import JournalForm from './components/journal/JournalForm';
import FindDoctor from './components/find_doctor/FindDoctor';

// Doctor Components
import DoctorLayout from './components/doctors/layout/DoctorLayout';

// Doctor Pages - Import these from your pages directory
import DoctorDashboard from './pages/doctors/DoctorDashboard';
import FormTemplates from './pages/doctors/FormTemplates';
import FormEditor from './pages/doctors/FormEditor';
import AssignTemplate from './pages/doctors/AssignTemplate';
import JournalEntries from './pages/doctors/JournalEntries';
import JournalEntryDetail from './pages/doctors/JournalEntryDetail';
import PatientList from './pages/doctors/PatientList';

// Add PatientDetails import
import PatientDetails from './components/doctors/PatientManagement/PatientDetails';

// Doctor Appointments Component
import DoctorAppointments from './components/doctors/Appointments/DoctorAppointments';

// Admin Components
import AdminLayout from './components/admin/layout/AdminLayout';
import AdminDashboard from './components/admin/AdminDashboard';
import ProfessionalVerification from './components/admin/ProfessionalVerification';

// ✅ Import SystemSettings component
import SystemSettings from './components/admin/SystemSettings';

// 🆕 NEW: Import TenantManagement component
import TenantManagement from './components/admin/TenantManagement';

// 🆕 NEW: Import AdminFormTemplates component
import AdminFormTemplates from './components/admin/FormTemplates';

// User Management Components
import UserManagement from '../src/components/admin/UserManagement';
import UserForm from '../src/pages/admin/user_management/UserForm';
import UserDetail from '../src/pages/admin/user_management/UserDetail';

// Admin Login Component
import AdminLogin from './pages/admin/AdminLogin';

// Auth Service
import authService from './services/authService';

// Create simple placeholder component for other pages
const OtherPage = () => (
  <div className="inner-page">
    <div className="inner-page-content">
      <h1>Other Page</h1>
      <p>Other page content will go here.</p>
    </div>
  </div>
);

// Create simple placeholder components for other routes
const PlaceholderComponent = ({ name }) => (
  <div className="placeholder-container">
    <h1>{name} Component</h1>
    <p>This component is under development.</p>
  </div>
);

// Context for Auth State
const AuthContext = React.createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState(null);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuthStatus = async () => {
      try {
        console.log("AuthProvider: Checking auth status");
        
        // First check if a token exists
        if (authService.isAuthenticated()) {
          console.log("AuthProvider: Token exists, attempting to get user data");
          
          // Try to get tenant info
          const tenantInfo = authService.getCurrentTenant();
          if (tenantInfo) {
            console.log("AuthProvider: Found tenant info:", tenantInfo);
            setTenant(tenantInfo);
          }
          
          // Check localStorage first as fallback
          try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
              const localUser = JSON.parse(userStr);
              console.log("AuthProvider: Found user in localStorage", localUser);
              // Set initial user data from localStorage while API loads
              setUser(localUser);
            }
          } catch (e) {
            console.error("Error getting user from localStorage:", e);
          }
          
          // Only try to get the user data if we have a token
          try {
            console.log("AuthProvider: Fetching current user from API");
            const response = await authService.getCurrentUser();
            console.log("AuthProvider: Got response:", response);
            
            // Handle the actual structure from your API
            if (response && response.data) {
              console.log("AuthProvider: Setting user from response.data");
              setUser(response.data);
            } else if (response && response.user) {
              console.log("AuthProvider: Setting user from response.user");
              setUser(response.user);
            } else if (response && response.success === true) {
              console.log("AuthProvider: Success but no user data in response");
              // If success but no user data, keep using localStorage data
            } else {
              console.log("AuthProvider: No usable data in API response, clearing auth");
              // Don't clear token here, as it might be a temporary API issue
              // localStorage.removeItem('token');
              // setUser(null);
            }
          } catch (err) {
            console.error("Error fetching user data:", err);
            // Don't remove token on network errors, just use localStorage data
          }
        } else {
          console.log("AuthProvider: No authentication token found");
          setUser(null);
        }
      } catch (error) {
        console.log("No active session found:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const login = (userData) => {
    console.log("AuthProvider: login called", userData);
    setUser(userData);
    
    // Check for tenant info on login
    if (userData && userData.tenant) {
      setTenant(userData.tenant);
    }
  };

  const logout = () => {
    console.log("AuthProvider: logout called");
    authService.logout();
    setUser(null);
    setTenant(null);
  };

  // Return with the tenant in context
  return (
    <AuthContext.Provider value={{ user, login, logout, loading, tenant }}>
      {children}
    </AuthContext.Provider>
  );
};

// Make AuthContext available for import
export const useAuth = () => React.useContext(AuthContext);

// Home redirect component that uses the user context
const HomeRedirect = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // First check for admin token
    const adminToken = localStorage.getItem('adminToken');
    
    if (adminToken) {
      // If admin token exists, redirect to admin dashboard
      navigate('/admin');
      return;
    }
    
    // Otherwise, check regular user authentication
    if (authService.isAuthenticated()) {
      // Get user role from localStorage
      const userRole = authService.getUserRole();
      
      // Redirect based on role
      if (userRole === 'doctor') {
        navigate('/doctor');
      } else {
        // Default to patient dashboard
        navigate('/dashboard');
      }
    } else {
      // If not authenticated, redirect to login
      navigate('/login');
    }
  }, [navigate]);
  
  return null; // This component just handles redirection
};

// Protected Route Component with role checking for regular users
const ProtectedRoute = ({ children, requiredRole }) => {
  const location = useLocation();
  const isAuthenticated = authService.isAuthenticated();
  
  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // If a specific role is required, check if user has that role
  if (requiredRole) {
    const userRole = authService.getUserRole();
    
    if (userRole !== requiredRole) {
      // Redirect based on user's actual role
      if (userRole === 'doctor') {
        return <Navigate to="/doctor" replace />;
      } else if (userRole === 'admin') {
        return <Navigate to="/admin" replace />;
      } else {
        return <Navigate to="/dashboard" replace />;
      }
    }
  }
  
  // If authenticated and has required role (or no specific role required), show the children
  return children;
};

// Special Protected Route Component for Admin routes
const ProtectedAdminRoute = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Check specifically for admin token
    const adminToken = localStorage.getItem('adminToken');
    
    if (!adminToken) {
      // If no admin token, redirect to admin login
      navigate('/admin/login', { 
        state: { from: location },
        replace: true
      });
    }
  }, [location, navigate]);
  
  // Check for admin token
  const adminToken = localStorage.getItem('adminToken');
  
  if (!adminToken) {
    // Return null while redirection happens in useEffect
    return null;
  }
  
  // If admin token exists, render the admin content
  return children;
};

// EmailVerification wrapper with location state
const EmailVerificationWrapper = () => {
  const location = useLocation();
  const { email } = location.state || {};
  
  // If email is not available in location state, redirect to register
  if (!email) {
    return <Navigate to="/register" />;
  }
  
  return <EmailVerification email={email} />;
};

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  
  // Initialize socket connection when app loads if user is authenticated
  useEffect(() => {
    if (authService.isAuthenticated()) {
      try {
        initializeSocket();
      } catch (error) {
        console.error("Error initializing socket:", error);
        // Continue loading the app even if socket connection fails
      }
    }
    setIsLoading(false);
  }, []);
  
  if (isLoading) {
    return <div className="app-loading">Loading...</div>;
  }
  
  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || ''}>
      <TenantProvider>
        <AuthProvider>
          <div className="app-container">
            <Router>
              {/* NotificationHandler listens for socket events and displays notifications */}
              <NotificationHandler />
              
              <Routes>
                {/* Auth routes */}
                <Route path="/register" element={<Register />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/doctor-verification" element={<DoctorVerification />} />
                
                {/* Admin Login Route - Adding the dedicated admin login page */}
                <Route path="/admin/login" element={<AdminLogin />} />
                
                {/* Doctor Registration Routes */}
                <Route path="/doctor-register" element={<ProfessionalRegistration />} />
                <Route path="/verification-pending" element={<VerificationPendingPage />} />
                
                {/* Verification routes */}
                <Route path="/verify-email" element={<EmailVerificationWrapper />} />
                <Route path="/verify-email/:token" element={<EmailVerification />} />
                
                {/* Other routes */}
                <Route path="/privacy" element={<PlaceholderComponent name="Privacy Policy" />} />
                <Route path="/terms" element={<PlaceholderComponent name="Terms of Service" />} />
                <Route path="/contact" element={<PlaceholderComponent name="Contact Us" />} />
                
                {/* Token Test Route */}
                <Route path="/token-test" element={<TokenTest />} />
                
                {/* Call route for video calls */}
                <Route path="/call/:callId" element={
                  <ProtectedRoute>
                    <CallPage />
                  </ProtectedRoute>
                } />
                
                {/* Onboarding Route */}
                <Route path="/onboarding" element={
                  <ProtectedRoute>
                    <Onboarding />
                  </ProtectedRoute>
                } />

                {/* Patient Dashboard routes - only accessible to patients */}
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute requiredRole="patient">
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route path="journal" element={<JournalInsights />} />
                  <Route path="journal/new" element={<JournalForm />} />
                  <Route path="find-doctor" element={<FindDoctor />} />
                  <Route path="messages" element={<Messages />} />
                  <Route path="other" element={<OtherPage />} />
                </Route>
                
                {/* Doctor Routes - only accessible to doctors */}
                <Route
                  path="/doctor"
                  element={
                    <ProtectedRoute requiredRole="doctor">
                      <DoctorLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<DoctorDashboard />} />
                  <Route path="appointments" element={<DoctorAppointments />} />
                  <Route path="form-templates" element={<FormTemplates />} />
                  <Route path="form-templates/create" element={<FormEditor />} />
                  <Route path="form-templates/:id/edit" element={<FormEditor />} />
                  <Route path="form-templates/:id/assign" element={<AssignTemplate />} />
                  <Route path="journal-entries" element={<JournalEntries />} />
                  <Route path="journal-entries/:id" element={<JournalEntryDetail />} />
                  {/* Patient Details route - IMPORTANT: This must come BEFORE the general patients route */}
                  <Route path="patients/:id" element={<PatientDetails />} />
                  <Route path="patients" element={<PatientList />} />
                </Route>
                
                {/* Admin Routes - using ProtectedAdminRoute instead of ProtectedRoute */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedAdminRoute>
                      <AdminLayout />
                    </ProtectedAdminRoute>
                  }
                >
                  <Route index element={<AdminDashboard />} />
                  {/* User Management Routes */}
                  <Route path="users">
                    <Route index element={<UserManagement />} />
                    <Route path="add" element={<UserForm />} />
                    <Route path=":id" element={<UserDetail />} />
                    <Route path=":id/edit" element={<UserForm />} />
                  </Route>
                  <Route path="professionals" element={<ProfessionalVerification />} />
                  {/* 🆕 NEW: Tenant Management Route */}
                  <Route path="tenants" element={<TenantManagement />} />
                  <Route path="content" element={<PlaceholderComponent name="Content Moderation" />} />
                  <Route path="reports" element={<PlaceholderComponent name="Reports" />} />
                  {/* ✅ System Settings now uses the actual SystemSettings component */}
                  <Route path="settings" element={<SystemSettings />} />
                  {/* 🆕 NEW: Admin Template Management Route - CHANGED FROM PLACEHOLDER */}
                  <Route path="templates" element={<AdminFormTemplates />} />
                  <Route path="feedback" element={<PlaceholderComponent name="Feedback Tracking" />} />
                  <Route path="backup" element={<PlaceholderComponent name="System Backup" />} />
                </Route>
                
                {/* Home redirect - will check role and redirect accordingly */}
                <Route path="/" element={<HomeRedirect />} />
                
                {/* 404 page */}
                <Route path="*" element={<PlaceholderComponent name="404 Not Found" />} />
              </Routes>
            </Router>
            
            {/* Toast notifications */}
            <ToastContainer position="bottom-right" />
          </div>
        </AuthProvider>
      </TenantProvider>
    </GoogleOAuthProvider>
  );
};

export default App;