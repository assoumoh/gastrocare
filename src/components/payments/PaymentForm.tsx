import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { X } from 'lucide-react';

interface PaymentFormProps {
  payment?: any;
  patientId?: string;
  onClose: () => void;
}

export default function PaymentForm({ payment, patientId, onClose }: PaymentFormProps) {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    patient_id: payment?.patient_id || patientId || '',
    type_paiement: payment?.type_paiement || 'consultation',
    consultation_id: payment?.consultation_id || '',
    examen_id: payment?.examen_id || '',
    montant: payment?.montant || '',
    mode_paiement: payment?.mode_paiement || 'espèces',
    statut_paiement: payment?.statut_paiement || 'réglé',
    date_paiement: payment?.date_paiement || new Date().toISOString().split('T')[0],
    reference: payment?.reference || '',
    notes: payment?.notes || '',
  });

  useEffect(() => {
    const q = query(collection(db, 'patients'), orderBy('nom'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (formData.patient_id) {
      const qConsultations = query(collection(db, 'consultations'), where('patient_id', '==', formData.patient_id));
      const unsubConsultations = onSnapshot(qConsultations, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        docs.sort((a: any, b: any) => (b.date_consultation || '').localeCompare(a.date_consultation || ''));
        setConsultations(docs);
      });

      const qExams = query(collection(db, 'exams'), where('patient_id', '==', formData.patient_id));
      const unsubExams = onSnapshot(qExams, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        docs.sort((a: any, b: any) => (b.date_examen || '').localeCompare(a.date_examen || ''));
        setExams(docs);
      });

      return () => {
        unsubConsultations();
        unsubExams();
      };
    } else {
      setConsultations([]);
      setExams([]);
    }
  }, [formData.patient_id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.name === 'montant' ? parseFloat(e.target.value) : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dataToSave = { ...formData };
      
      // Nettoyage des champs non pertinents
      if (dataToSave.type_paiement === 'consultation') {
        dataToSave.examen_id = '';
      } else if (dataToSave.type_paiement === 'examen') {
        dataToSave.consultation_id = '';
      } else {
        dataToSave.consultation_id = '';
        dataToSave.examen_id = '';
      }

      if (payment?.id) {
        await updateDoc(doc(db, 'payments', payment.id), {
          ...dataToSave,
          updated_at: new Date().toISOString(),
        });
      } else {
        await addDoc(collection(db, 'payments'), {
          ...dataToSave,
          created_by: appUser?.uid || 'unknown',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      onClose();
    } catch (error) {
      console.error("Error saving payment:", error);
      alert("Erreur lors de l'enregistrement du paiement.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 sm:p-6 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8 relative">
        <div className="flex justify-between items-center p-6 border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            {payment ? 'Modifier le paiement' : 'Nouveau paiement'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Patient *</label>
            <select required name="patient_id" value={formData.patient_id} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" disabled={!!patientId}>
              <option value="">Sélectionner un patient</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Type de paiement *</label>
              <select required name="type_paiement" value={formData.type_paiement} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2">
                <option value="consultation">Consultation</option>
                <option value="examen">Examen</option>
                <option value="geste_medical">Geste médical</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Date *</label>
              <input required type="date" name="date_paiement" value={formData.date_paiement} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
            </div>
          </div>

          {formData.type_paiement === 'consultation' && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Consultation liée</label>
              <select name="consultation_id" value={formData.consultation_id} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2">
                <option value="">Sélectionner une consultation (optionnel)</option>
                {consultations.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.date_consultation ? new Date(c.date_consultation).toLocaleDateString('fr-FR') : 'Date inconnue'} - {c.motif || 'Sans motif'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.type_paiement === 'examen' && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Examen lié</label>
              <select name="examen_id" value={formData.examen_id} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2">
                <option value="">Sélectionner un examen (optionnel)</option>
                {exams.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.date_examen ? new Date(e.date_examen).toLocaleDateString('fr-FR') : 'Date inconnue'} - {e.nom_examen || e.type_examen || 'Sans nom'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">Montant (MAD) *</label>
            <input required type="number" step="0.01" name="montant" value={formData.montant} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Mode de paiement *</label>
              <select required name="mode_paiement" value={formData.mode_paiement} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2">
                <option value="espèces">Espèces</option>
                <option value="carte">Carte bancaire</option>
                <option value="chèque">Chèque</option>
                <option value="virement">Virement</option>
                <option value="assurance">Assurance</option>
                <option value="mutuelle">Mutuelle</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Statut *</label>
              <select required name="statut_paiement" value={formData.statut_paiement} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2">
                <option value="réglé">Réglé</option>
                <option value="en_attente">En attente</option>
                <option value="partiel">Partiel</option>
                <option value="payé">Payé (Ancien)</option>
                <option value="non payé">Non payé (Ancien)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Référence (Chèque, Virement...)</label>
            <input type="text" name="reference" value={formData.reference} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Notes</label>
            <textarea name="notes" rows={2} value={formData.notes} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50">
              Annuler
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
