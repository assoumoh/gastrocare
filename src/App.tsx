import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Pages
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Finance from './pages/Finance';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Appointments from './pages/Appointments';
import SalleAttente from './pages/SalleAttente';
import Consultations from './pages/Consultations';
import Prescriptions from './pages/Prescriptions';
import Medicaments from './pages/Medicaments';
import ImportMedicaments from './pages/ImportMedicaments';
import Exams from './pages/Exams';
import Documents from './pages/Documents';
import Payments from './pages/Payments';
import Admin from './pages/Admin';
import VeoVideo from './pages/VeoVideo';
import SettingsCabinet from './pages/SettingsCabinet';

// Route protégée
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
};

// Garde de rôle
const RoleGuard: React.FC<{ allowedRoles: string[]; children: React.ReactNode }> = ({
  allowedRoles,
  children,
}) => {
  const { user } = useAuth();
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/" />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route index element={<Dashboard />} />
                    <Route
                      path="finance"
                      element={
                        <RoleGuard allowedRoles={['admin', 'medecin']}>
                          <Finance />
                        </RoleGuard>
                      }
                    />
                    <Route path="patients" element={<Patients />} />
                    <Route path="patients/:id" element={<PatientDetail />} />
                    <Route path="appointments" element={<Appointments />} />
                    <Route path="salle-attente" element={<SalleAttente />} />
                    <Route
                      path="consultations"
                      element={
                        <RoleGuard allowedRoles={['admin', 'medecin']}>
                          <Consultations />
                        </RoleGuard>
                      }
                    />
                    {/* *** CHANGEMENT : prescriptions accessible aussi par l'assistante *** */}
                    <Route
                      path="prescriptions"
                      element={
                        <RoleGuard allowedRoles={['admin', 'medecin', 'assistante']}>
                          <Prescriptions />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="medicaments"
                      element={
                        <RoleGuard allowedRoles={['admin', 'medecin']}>
                          <Medicaments />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="medicaments/import"
                      element={
                        <RoleGuard allowedRoles={['admin']}>
                          <ImportMedicaments />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="exams"
                      element={
                        <RoleGuard allowedRoles={['admin', 'medecin']}>
                          <Exams />
                        </RoleGuard>
                      }
                    />
                    <Route path="documents" element={<Documents />} />
                    <Route path="payments" element={<Payments />} />
                    <Route
                      path="admin"
                      element={
                        <RoleGuard allowedRoles={['admin']}>
                          <Admin />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="settings"
                      element={
                        <RoleGuard allowedRoles={['admin', 'medecin']}>
                          <SettingsCabinet />
                        </RoleGuard>
                      }
                    />
                    <Route
                      path="veo"
                      element={
                        <RoleGuard allowedRoles={['admin', 'medecin']}>
                          <VeoVideo />
                        </RoleGuard>
                      }
                    />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
