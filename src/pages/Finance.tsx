import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { DollarSign, TrendingUp, CreditCard, Calendar, Activity, PieChart, FileText, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function Finance() {
  const { appUser } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('month'); // 'day', 'week', 'month', 'year', 'all'

  useEffect(() => {
    const q = query(collection(db, 'payments'), orderBy('date_paiement', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Filter payments based on selected timeframe
  const getFilteredPayments = () => {
    const now = new Date();
    return payments.filter(p => {
      const pDate = new Date(p.date_paiement);
      if (filter === 'day') {
        return pDate.toDateString() === now.toDateString();
      }
      if (filter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return pDate >= weekAgo;
      }
      if (filter === 'month') {
        return pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
      }
      if (filter === 'year') {
        return pDate.getFullYear() === now.getFullYear();
      }
      return true; // 'all'
    });
  };

  const filteredPayments = getFilteredPayments();

  // Calculate KPIs
  const totalRevenue = filteredPayments.filter(p => p.statut_paiement === 'payé' || p.statut_paiement === 'réglé').reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
  const totalPending = filteredPayments.filter(p => p.statut_paiement === 'non payé' || p.statut_paiement === 'en_attente').reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
  const totalPartial = filteredPayments.filter(p => p.statut_paiement === 'partiel').reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
  const totalPayments = filteredPayments.length;
  const averagePayment = totalPayments > 0 ? totalRevenue / totalPayments : 0;
  
  const totalConsultations = filteredPayments.filter(p => p.type_paiement === 'consultation').reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
  const totalExamens = filteredPayments.filter(p => p.type_paiement === 'examen').reduce((sum, p) => sum + (Number(p.montant) || 0), 0);

  // Payment methods breakdown
  const paymentMethods = filteredPayments.reduce((acc, p) => {
    const method = p.mode_paiement || 'inconnu';
    acc[method] = (acc[method] || 0) + (Number(p.montant) || 0);
    return acc;
  }, {} as Record<string, number>);

  const pieChartData = Object.entries(paymentMethods).map(([name, value]) => ({ name, value }));

  // Revenue over time (daily for week/month, monthly for year)
  const getRevenueData = () => {
    const data: Record<string, number> = {};
    const sortedPayments = [...filteredPayments].sort((a, b) => new Date(a.date_paiement).getTime() - new Date(b.date_paiement).getTime());
    
    sortedPayments.forEach(p => {
      if (p.statut_paiement !== 'payé' && p.statut_paiement !== 'réglé') return;
      const date = new Date(p.date_paiement);
      let key = '';
      if (filter === 'year' || filter === 'all') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else {
        key = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      }
      data[key] = (data[key] || 0) + (Number(p.montant) || 0);
    });

    return Object.entries(data).map(([date, amount]) => ({ date, amount }));
  };

  const revenueData = getRevenueData();

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Chargement des données financières...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Tableau de bord financier</h1>
        <div className="mt-4 sm:mt-0 flex space-x-2">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
          >
            <option value="day">Aujourd'hui</option>
            <option value="week">7 derniers jours</option>
            <option value="month">Ce mois</option>
            <option value="year">Cette année</option>
            <option value="all">Tout</option>
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="rounded-md p-3 bg-emerald-100">
                  <DollarSign className="h-6 w-6 text-emerald-600" aria-hidden="true" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-500 truncate">Revenu Encaissé</dt>
                  <dd>
                    <div className="text-2xl font-semibold text-slate-900">{totalRevenue.toLocaleString('fr-MA')} MAD</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="rounded-md p-3 bg-red-100">
                  <AlertCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-500 truncate">En Attente / Non Payé</dt>
                  <dd>
                    <div className="text-2xl font-semibold text-slate-900">{totalPending.toLocaleString('fr-MA')} MAD</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="rounded-md p-3 bg-indigo-100">
                  <Activity className="h-6 w-6 text-indigo-600" aria-hidden="true" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-500 truncate">Consultations</dt>
                  <dd>
                    <div className="text-2xl font-semibold text-slate-900">{totalConsultations.toLocaleString('fr-MA')} MAD</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="rounded-md p-3 bg-blue-100">
                  <FileText className="h-6 w-6 text-blue-600" aria-hidden="true" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-500 truncate">Examens</dt>
                  <dd>
                    <div className="text-2xl font-semibold text-slate-900">{totalExamens.toLocaleString('fr-MA')} MAD</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts / Analysis */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white shadow rounded-lg p-6 border border-slate-200">
          <h2 className="text-lg font-medium text-slate-900 mb-4 flex items-center">
            <TrendingUp className="mr-2 h-5 w-5 text-slate-400" />
            Évolution des revenus
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `${value}`} />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${value.toLocaleString('fr-MA')} MAD`, 'Revenu']}
                />
                <Bar dataKey="amount" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6 border border-slate-200">
          <h2 className="text-lg font-medium text-slate-900 mb-4 flex items-center">
            <PieChart className="mr-2 h-5 w-5 text-slate-400" />
            Répartition par mode de paiement
          </h2>
          <div className="h-72 flex items-center justify-center">
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${value.toLocaleString('fr-MA')} MAD`, 'Montant']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </RechartsPieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500">Aucune donnée pour cette période.</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 border border-slate-200">
        <h2 className="text-lg font-medium text-slate-900 mb-4 flex items-center">
          <Calendar className="mr-2 h-5 w-5 text-slate-400" />
          Derniers paiements
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Mode</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Montant</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Statut</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredPayments.slice(0, 10).map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {new Date(payment.date_paiement).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 capitalize">
                    {payment.type_paiement || 'Consultation'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 capitalize">
                    {payment.mode_paiement}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {Number(payment.montant).toLocaleString('fr-MA')} MAD
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                      (payment.statut_paiement === 'payé' || payment.statut_paiement === 'réglé') ? 'bg-green-100 text-green-800' : 
                      (payment.statut_paiement === 'non payé' || payment.statut_paiement === 'en_attente') ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {payment.statut_paiement}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-slate-500">
                    Aucun paiement trouvé pour cette période.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
