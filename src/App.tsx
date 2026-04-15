/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Finance from './pages/Finance';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Appointments from './pages/Appointments';
import Consultations from './pages/Consultations';
import Medicaments from './pages/Medicaments';
import ImportMedicaments from './pages/ImportMedicaments';
import Exams from './pages/Exams';
import Documents from './pages/Documents';
import Payments from './pages/Payments';
import Admin from './pages/Admin';
import VeoVideo from './pages/VeoVideo';
import Prescriptions from './pages/Prescriptions';
import SettingsCabinet from './pages/SettingsCabinet';
import SalleAttente from './pages/SalleAttente';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, appUser, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Chargement...</div>;
  if (!currentUser || !appUser) return <Navigate to="/login" />;
  return <>{children}</>;
};

const RoleGuard = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
  const { appUser, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Chargement...</div>;

  if (appUser && allowedRoles.includes(appUser.role)) {
    return <>{children}</>;
  }

  return <Navigate to="/" />;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="finance" element={<RoleGuard allowedRoles={['admin', 'medecin']}><Finance /></RoleGuard>} />
            <Route path="patients" element={<Patients />} />
            <Route path="patients/:id" element={<PatientDetail />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="salle-attente" element={<SalleAttente />} />
            <Route path="consultations" element={<RoleGuard allowedRoles={['admin', 'medecin']}><Consultations /></RoleGuard>} />
            <Route path="prescriptions" element={<RoleGuard allowedRoles={['admin', 'medecin', 'assistante']}><Prescriptions /></RoleGuard>} />
            <Route path="medicaments" element={<RoleGuard allowedRoles={['admin', 'medecin']}><Medicaments /></RoleGuard>} />
            <Route path="medicaments/import" element={<RoleGuard allowedRoles={['admin']}><ImportMedicaments /></RoleGuard>} />
            <Route path="exams" element={<RoleGuard allowedRoles={['admin', 'medecin']}><Exams /></RoleGuard>} />
            <Route path="documents" element={<Documents />} />
            <Route path="payments" element={<Payments />} />
            <Route path="admin" element={<RoleGuard allowedRoles={['admin']}><Admin /></RoleGuard>} />
            <Route path="settings" element={<RoleGuard allowedRoles={['admin', 'medecin']}><SettingsCabinet /></RoleGuard>} />
            <Route path="veo" element={<RoleGuard allowedRoles={['admin', 'medecin']}><VeoVideo /></RoleGuard>} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
