import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Landing from './pages/Landing';
import VehicleDetails from './pages/VehicleDetails';
import Bookings from './pages/Bookings';
import Notifications from './pages/Notifications';
import Onboarding from './pages/Onboarding';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import PublishVehicleWizard from './pages/PublishVehicleWizard';
import MyVehicles from './pages/MyVehicles';
import PublisherApplications from './pages/PublisherApplications';
import Subscription from './pages/Subscription';
import AdminVehicleReview from './pages/admin/AdminVehicleReview';
import AdminDisputes from './pages/admin/AdminDisputes';
import AdminDocusealTemplates from './pages/admin/AdminDocusealTemplates';
import { useNotificationPolling } from './hooks/useNotificationPolling';
import { useAuth } from './context/AuthContext';
import { UIProvider } from './context/UIContext';
import LoginModal from './components/modals/LoginModal';
import SubscriptionModal from './components/modals/SubscriptionModal';
import { useAxiosInterceptors } from './hooks/useAxiosInterceptors';
import MagicLogin from './pages/MagicLogin';
import ContractSignerPage from './pages/ContractSignerPage';
import SsoCallback from './pages/SsoCallback';

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  // Fast-path: authenticated users hitting marketing landing should go to app dashboard
  if (user && location.pathname === '/') {
    return <Navigate to="/app" replace />;
  }

  // Admins bypass onboarding entirely
  if (user && user.role === 'admin') {
    if (location.pathname === '/onboarding') {
      return <Navigate to="/" replace />;
    }
    return <>{children}</>;
  }

  // If user is logged in but hasn't completed onboarding, redirect to onboarding
  // Exception: Allow access to contract signing pages so they can complete enrollment
  if (user && !user.onboardingCompleted && location.pathname !== '/onboarding' && !location.pathname.startsWith('/portal/contracts/')) {
    return <Navigate to="/onboarding" replace />;
  }

  // If user has completed onboarding but is on the onboarding page, redirect to home
  if (user && user.onboardingCompleted && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  useNotificationPolling();
  useAxiosInterceptors(); // Activate interceptors

  return (
    <OnboardingGate>
      <Layout>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/onboarding" element={<PrivateRoute><Onboarding /></PrivateRoute>} />
          <Route path="/app" element={<PrivateRoute><Home /></PrivateRoute>} />
          <Route path="/vehicles/:id" element={<PrivateRoute><VehicleDetails /></PrivateRoute>} />
          <Route path="/bookings" element={<PrivateRoute><Bookings /></PrivateRoute>} />
          <Route path="/publish-vehicle" element={<PrivateRoute><PublishVehicleWizard /></PrivateRoute>} />
          <Route path="/my-vehicles" element={<PrivateRoute><MyVehicles /></PrivateRoute>} />
          <Route path="/applications" element={<PrivateRoute><PublisherApplications /></PrivateRoute>} />
          <Route path="/subscription" element={<PrivateRoute><Subscription /></PrivateRoute>} />
          <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
          <Route path="/admin/vehicles" element={<PrivateRoute><AdminVehicleReview /></PrivateRoute>} />
          <Route path="/admin/disputes" element={<PrivateRoute><AdminDisputes /></PrivateRoute>} />
          <Route path="/admin/templates" element={<PrivateRoute><AdminDocusealTemplates /></PrivateRoute>} />
          <Route path="/magic-login" element={<MagicLogin />} />
          <Route path="/sso/callback" element={<SsoCallback />} />
          <Route path="/portal/contracts/:id" element={<PrivateRoute><ContractSignerPage /></PrivateRoute>} />
        </Routes>
      </Layout>
      <LoginModal />
      <SubscriptionModal />
    </OnboardingGate>
  );
}

export default function App() {
  return (
    <Router>
      <UIProvider>
        <AppContent />
      </UIProvider>
    </Router>
  );
}
