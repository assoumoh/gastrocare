import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  FileText,
  Pill,
  CreditCard,
  Settings,
  LogOut,
  Search,
  Bell,
  Video,
  FileSignature,
  Files,
  TrendingUp
} from 'lucide-react';
import clsx from 'clsx';
import Chatbot from './Chatbot';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'medecin', 'assistante'] },
  { name: 'Finance', href: '/finance', icon: TrendingUp, roles: ['admin', 'medecin'] },
  { name: 'Patients', href: '/patients', icon: Users, roles: ['admin', 'medecin', 'assistante'] },
  { name: 'Rendez-vous', href: '/appointments', icon: Calendar, roles: ['admin', 'medecin', 'assistante'] },
  { name: 'Ordonnances', href: '/prescriptions', icon: FileSignature, roles: ['admin', 'medecin'] },
  { name: 'Médicaments', href: '/medicaments', icon: Pill, roles: ['admin', 'medecin'] },
  { name: 'Paiements', href: '/payments', icon: CreditCard, roles: ['admin', 'medecin', 'assistante'] },
  { name: 'Animation IA', href: '/veo', icon: Video, roles: ['admin', 'medecin'] },
];

export default function Layout() {
  const { appUser, logout } = useAuth();
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState('');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      navigate(`/patients?q=${encodeURIComponent(globalSearch.trim())}`);
      setGlobalSearch('');
    }
  };

  const filteredNavigation = navigation.filter(item =>
    appUser && item.roles.includes(appUser.role)
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <Stethoscope className="h-8 w-8 text-indigo-600 mr-2" />
          <span className="text-xl font-bold text-slate-900">GastroCare Pro</span>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-3">
            {filteredNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  clsx(
                    isActive
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors'
                  )
                }
              >
                <item.icon className="mr-3 flex-shrink-0 h-5 w-5" aria-hidden="true" />
                {item.name}
              </NavLink>
            ))}

            {appUser?.role === 'admin' && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  clsx(
                    isActive
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors'
                  )
                }
              >
                <Settings className="mr-3 flex-shrink-0 h-5 w-5" />
                Administration
              </NavLink>
            )}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center mb-4">
            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold uppercase">
              {appUser?.prenom?.[0] || ''}{appUser?.nom?.[0] || ''}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-slate-700">{appUser?.prenom} {appUser?.nom}</p>
              <p className="text-xs text-slate-500 capitalize">{appUser?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Déconnexion
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <form onSubmit={handleGlobalSearch} className="flex-1 flex">
            <div className="w-full max-w-md relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Rechercher un patient..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
              />
            </div>
          </form>
          <div className="ml-4 flex items-center md:ml-6">
            <button className="p-2 rounded-full text-slate-400 hover:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <span className="sr-only">Voir les notifications</span>
              <Bell className="h-6 w-6" />
            </button>
          </div>
        </header>

        {/* Main scrollable area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-8">
          <Outlet />
        </main>

        <Chatbot />
      </div>
    </div>
  );
}
