import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, query, onSnapshot, orderBy, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { X } from 'lucide-react';

interface ExamFormProps {
  exam?: any;
  patientId?: string;
  consultationId?: string;
  onClose: () => void;
}

const EXAM_TYPES = {
  'Biologie': ['NFS', 'Bilan hépatique', 'Bilan pancréatique', 'CRP', 'Ionogramme', 'Sérologies', 'Marqueurs tumoraux'],
  'Imagerie': ['Échographie abdominale', 'Scanner abdomino-pelvien', 'IRM hépatique', 'Transit OG', 'Entéroscanner', 'Lavement baryté'],
  'Endoscopie': ['Gastroscopie', 'Coloscopie', 'Rectosigmoïdoscopie', 'Écho-endoscopie', 'CPRE', 'Capsule endoscopique'],
  'Fonctionnel': ['Manométrie', 'pH-métrie', 'Test respiratoire à l\'urée', 'Test au lactose'],
  'Anapath': ['Biopsie gastrique', 'Biopsie colique', 'Cytologie biliaire'],
  'Autre': ['Recherche sang occulte', 'Coproculture', 'Fibroscan', 'Autre à préciser']
};

const EXAM_STATUSES = [
  { value: 'demande', label: 'Demandé' },
  { value: 'en_attente_resultat', label: 'En attente de résultat' },
  { value: 'apporte', label: 'Apporté' },
  { value: 'analyse', label: 'Analysé' }
];

export default function ExamForm({ exam, patientId, consultationId, onClose }: ExamFormProps) {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [formData, setFormData] = useState({
    patientId: exam?.patientId || exam?.patient_id || patientId || '',
    consultationId: exam?.consultationId || exam?.consultation_id || consultationId || '',
    type_examen: exam?.type_examen || 'Biologie',
    nom_examen: exam?.nom_examen || 'NFS',
    statutExamen: exam?.statutExamen || 'demande',
    dateDemande: exam?.dateDemande || exam?.date_examen || new Date().toISOString().split('T')[0],
    dateApport: exam?.dateApport || '',
    dateAnalyse: exam?.dateAnalyse || '',
    lieu: exam?.lieu || '',
    medecin_prescripteur: exam?.medecin_prescripteur || '',
    resultat_examen: exam?.resultat_examen || '',
    commentaire: exam?.commentaire || '',
  });

  useEffect(() => {
    const q = query(collection(db, 'patients'), orderBy('nom'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPatients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (formData.patientId) {
      const q = query(
        collection(db, 'consultations'),
        where('patient_id', '==', formData.patientId),
        orderBy('date_consultation', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setConsultations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    } else {
      setConsultations([]);
    }
  }, [formData.patientId]);

  useEffect(() => {
    if (exam && exam.type_examen === formData.type_examen) return;
    const availableNames = EXAM_TYPES[formData.type_examen as keyof typeof EXAM_TYPES] || [];
    if (availableNames.length > 0 && !availableNames.includes(formData.nom_examen)) {
      setFormData(prev => ({ ...prev, nom_examen: availableNames[0] }));
    }
  }, [formData.type_examen, exam]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      if (name === 'statutExamen') {
        const today = new Date().toISOString().split('T')[0];
        if (value === 'apporte' && !prev.dateApport) newData.dateApport = today;
        else if (value === 'analyse' && !prev.dateAnalyse) {
          newData.dateAnalyse = today;
          if (!prev.dateApport) newData.dateApport = today;
        }
      }
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      // Payload de base
      const payload: Record<string, any> = {
        patient_id: formData.patientId,
        consultation_id: formData.consultationId || null,
        type_examen: formData.type_examen,
        nom_examen: formData.nom_examen,
        // Les 2 champs exigés par les Firestore Rules :
        statut: formData.statutExamen,
        date_demande: formData.dateDemande,
        // Champs complémentaires
        statutExamen: formData.statutExamen,
        date_examen: formData.dateDemande,
        lieu: formData.lieu,
        medecin_prescripteur: formData.medecin_prescripteur,
        resultat_examen: formData.resultat_examen,
        commentaire: formData.commentaire,
      };
      if (formData.dateApport) payload.dateApport = formData.dateApport;
      if (formData.dateAnalyse) payload.dateAnalyse = formData.dateAnalyse;

      if (exam?.id) {
        await updateDoc(doc(db, 'exams', exam.id), {
          ...payload,
          updated_at: new Date().toISOString(),
        });
      } else {
        await addDoc(collection(db, 'exams'), {
          ...payload,
          created_by: appUser?.uid || 'unknown',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      onClose();
    } catch (error: any) {
      setErrorMsg(error.message || 'Erreur lors de l\'enregistrement.');
    } finally {
      setLoading(false);
    }
  };

  const availableNames = EXAM_TYPES[formData.type_examen as keyof typeof EXAM_TYPES] || [];

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 sm:p-6 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-8 relative">
        <div className="flex justify-between items-center p-6 border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-xl">
          <h2 className="text-xl font-semibold text-slate-900">
            {exam ? 'Modifier l\'examen' : 'Nouvel examen'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errorMsg && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-900 border-b pb-2">Informations Générales</h3>
              
              <div>
                <label className="block text-sm font-medium text-slate-700">Patient *</label>
                <select required name="patientId" value={formData.patientId} onChange={handleChange} disabled={!!patientId} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 disabled:bg-slate-100">
                  <option value="">Sélectionner un patient</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Consultation liée</label>
                <select name="consultationId" value={formData.consultationId} onChange={handleChange} disabled={!!consultationId} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 disabled:bg-slate-100">
                  <option value="">Aucune consultation liée</option>
                  {consultations.map(c => (
                    <option key={c.id} value={c.id}>
                      {new Date(c.date_consultation).toLocaleDateString('fr-FR')} - {c.motif || 'Sans motif'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Type d'examen *</label>
                  <select required name="type_examen" value={formData.type_examen} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2">
                    {Object.keys(EXAM_TYPES).map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Nom de l'examen *</label>
                  <select required name="nom_examen" value={formData.nom_examen} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2">
                    {availableNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Lieu</label>
                  <input type="text" name="lieu" value={formData.lieu} onChange={handleChange} placeholder="Laboratoire, Clinique..." className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Médecin Prescripteur</label>
                  <input type="text" name="medecin_prescripteur" value={formData.medecin_prescripteur} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-900 border-b pb-2">Cycle de vie</h3>
              
              <div>
                <label className="block text-sm font-medium text-slate-700">Statut de l'examen *</label>
                <select required name="statutExamen" value={formData.statutExamen} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 font-medium">
                  {EXAM_STATUSES.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Date de demande *</label>
                  <input required type="date" name="dateDemande" value={formData.dateDemande} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                </div>
                
                {(formData.statutExamen === 'apporte' || formData.statutExamen === 'analyse' || formData.dateApport) && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Date d'apport</label>
                    <input type="date" name="dateApport" value={formData.dateApport} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                  </div>
                )}
                
                {(formData.statutExamen === 'analyse' || formData.dateAnalyse) && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Date d'analyse</label>
                    <input type="date" name="dateAnalyse" value={formData.dateAnalyse} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700">Résultat de l'examen</label>
              <textarea name="resultat_examen" rows={3} value={formData.resultat_examen} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Commentaire</label>
              <textarea name="commentaire" rows={2} value={formData.commentaire} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
            </div>
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
