import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Search, CreditCard, User, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import PaymentForm from '../components/payments/PaymentForm';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

export default function Payments() {
  const [payments, setPayments] = useState<any[]>([]);
  const [patients, setPatients] = useState<Record<string, any>>({});
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  useEffect(() => {
    const unsubPatients = onSnapshot(collection(db, 'patients'), (snapshot) => {
      const pts: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        pts[doc.id] = doc.data();
      });
      setPatients(pts);
    });
    return () => unsubPatients();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'payments'), orderBy('date_paiement', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const filteredPayments = payments.filter(p => {
    const patient = patients[p.patient_id];
    const patientName = patient ? `${patient.nom} ${patient.prenom}`.toLowerCase() : '';
    return patientName.includes(search.toLowerCase()) || p.reference?.toLowerCase().includes(search.toLowerCase());
  });

  const handleEdit = (payment: any) => {
    setSelectedPayment(payment);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setSelectedPayment(null);
    setIsFormOpen(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'payé':
      case 'réglé': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'non payé':
      case 'en_attente': return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'partiel': return <AlertCircle className="h-5 w-5 text-orange-500" />;
      default: return <CreditCard className="h-5 w-5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Paiements</h1>
        <div className="mt-4 sm:mt-0">
          <button 
            onClick={() => {
              setSelectedPayment(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Nouveau Paiement
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="relative rounded-md shadow-sm max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full rounded-md border-slate-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2 border"
              placeholder="Rechercher par patient, référence..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <ul className="divide-y divide-slate-200">
          {filteredPayments.map((payment) => {
            const patient = patients[payment.patient_id];
            return (
              <li key={payment.id} className="hover:bg-slate-50 transition-colors p-4 sm:px-6 cursor-pointer" onClick={() => handleEdit(payment)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mt-1">
                      {getStatusIcon(payment.statut_paiement)}
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <User className="mr-1.5 h-4 w-4 text-slate-400" />
                        <Link to={`/patients/${payment.patient_id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-900" onClick={(e) => e.stopPropagation()}>
                          {patient ? `${patient.nom} ${patient.prenom}` : 'Patient inconnu'}
                        </Link>
                        <span className="mx-2 text-slate-300">•</span>
                        <Calendar className="mr-1.5 h-4 w-4 text-slate-400" />
                        <span className="text-sm text-slate-500">
                          {new Date(payment.date_paiement).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-slate-900">
                        <span className="font-medium">{payment.montant} MAD</span>
                        <span className="ml-2 text-slate-500 text-xs capitalize">
                          (Par {payment.mode_paiement})
                        </span>
                        {payment.type_paiement && (
                          <span className="ml-2 text-indigo-600 text-xs capitalize bg-indigo-50 px-2 py-0.5 rounded-full">
                            {payment.type_paiement}
                          </span>
                        )}
                      </div>
                      {payment.reference && (
                        <div className="mt-1 text-xs text-slate-500">
                          Réf: {payment.reference}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    <span className={clsx(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize",
                      (payment.statut_paiement === 'payé' || payment.statut_paiement === 'réglé') ? 'bg-green-100 text-green-800' : 
                      (payment.statut_paiement === 'non payé' || payment.statut_paiement === 'en_attente') ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                    )}>
                      {payment.statut_paiement}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
          {filteredPayments.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-500">
              Aucun paiement trouvé.
            </li>
          )}
        </ul>
      </div>

      {isFormOpen && <PaymentForm payment={selectedPayment} onClose={handleCloseForm} />}
    </div>
  );
}
