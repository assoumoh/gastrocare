import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Plus, Edit, Trash2, DollarSign, Activity, CreditCard, FileText } from 'lucide-react';
import PaymentForm from '../payments/PaymentForm';

interface PatientFinanceProps {
  patientId: string;
}

export default function PatientFinance({ patientId }: PatientFinanceProps) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'payments'),
      where('patient_id', '==', patientId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => {
        const dateA = a.date_paiement || a.created_at || '';
        const dateB = b.date_paiement || b.created_at || '';
        return dateB.localeCompare(dateA);
      });
      setPayments(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [patientId]);

  const handleEdit = (payment: any) => {
    setSelectedPayment(payment);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) {
      try {
        await deleteDoc(doc(db, 'payments', id));
      } catch (error) {
        console.error("Error deleting payment:", error);
        alert("Erreur lors de la suppression du paiement.");
      }
    }
  };

  const handleCloseForm = () => {
    setSelectedPayment(null);
    setIsFormOpen(false);
  };

  if (loading) {
    return <div className="text-center py-4">Chargement des données financières...</div>;
  }

  const totalPaye = payments.filter(p => p.statut_paiement === 'payé' || p.statut_paiement === 'réglé').reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
  const totalEnAttente = payments.filter(p => p.statut_paiement === 'non payé' || p.statut_paiement === 'en_attente').reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
  const totalPartiel = payments.filter(p => p.statut_paiement === 'partiel').reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
  const totalConsultations = payments.filter(p => p.type_paiement === 'consultation').reduce((sum, p) => sum + (Number(p.montant) || 0), 0);
  const totalExamens = payments.filter(p => p.type_paiement === 'examen').reduce((sum, p) => sum + (Number(p.montant) || 0), 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-slate-900">Suivi Financier</h3>
        <button
          onClick={() => {
            setSelectedPayment(null);
            setIsFormOpen(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Ajouter un paiement
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200">
          <div className="p-4">
            <dt className="text-sm font-medium text-slate-500 truncate">Total Réglé</dt>
            <dd className="mt-1 text-xl font-semibold text-emerald-600">{totalPaye.toLocaleString('fr-MA')} MAD</dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200">
          <div className="p-4">
            <dt className="text-sm font-medium text-slate-500 truncate">En attente</dt>
            <dd className="mt-1 text-xl font-semibold text-red-600">{totalEnAttente.toLocaleString('fr-MA')} MAD</dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200">
          <div className="p-4">
            <dt className="text-sm font-medium text-slate-500 truncate">Partiel</dt>
            <dd className="mt-1 text-xl font-semibold text-orange-600">{totalPartiel.toLocaleString('fr-MA')} MAD</dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200">
          <div className="p-4">
            <dt className="text-sm font-medium text-slate-500 truncate">Consultations</dt>
            <dd className="mt-1 text-xl font-semibold text-indigo-600">{totalConsultations.toLocaleString('fr-MA')} MAD</dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg border border-slate-200">
          <div className="p-4">
            <dt className="text-sm font-medium text-slate-500 truncate">Examens</dt>
            <dd className="mt-1 text-xl font-semibold text-blue-600">{totalExamens.toLocaleString('fr-MA')} MAD</dd>
          </div>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md border border-slate-200">
        <ul className="divide-y divide-slate-200">
          {payments.map((payment) => (
            <li key={payment.id} className="p-4 hover:bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    {payment.type_paiement === 'consultation' ? (
                      <Activity className="h-6 w-6 text-indigo-500" />
                    ) : payment.type_paiement === 'examen' ? (
                      <FileText className="h-6 w-6 text-blue-500" />
                    ) : (
                      <DollarSign className="h-6 w-6 text-emerald-500" />
                    )}
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-slate-900 capitalize">
                      {payment.type_paiement || 'Consultation'}
                    </div>
                    <div className="text-sm text-slate-500 flex items-center mt-1">
                      <CreditCard className="h-4 w-4 mr-1" />
                      {payment.mode_paiement} • {new Date(payment.date_paiement).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900">
                      {Number(payment.montant).toLocaleString('fr-MA')} MAD
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize mt-1
                      ${(payment.statut_paiement === 'payé' || payment.statut_paiement === 'réglé') ? 'bg-green-100 text-green-800' : 
                        (payment.statut_paiement === 'non payé' || payment.statut_paiement === 'en_attente') ? 'bg-red-100 text-red-800' : 
                        'bg-orange-100 text-orange-800'}`}>
                      {payment.statut_paiement}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={() => handleEdit(payment)} className="text-slate-400 hover:text-indigo-600">
                      <Edit className="h-5 w-5" />
                    </button>
                    <button onClick={() => handleDelete(payment.id)} className="text-slate-400 hover:text-red-600">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
              {payment.notes && (
                <div className="mt-2 text-sm text-slate-500 pl-10">
                  Note: {payment.notes}
                </div>
              )}
            </li>
          ))}
          {payments.length === 0 && (
            <li className="p-4 text-center text-slate-500">Aucun paiement enregistré</li>
          )}
        </ul>
      </div>

      {isFormOpen && (
        <PaymentForm
          payment={selectedPayment}
          patientId={patientId}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
}
