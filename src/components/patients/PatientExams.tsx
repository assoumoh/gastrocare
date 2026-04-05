import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Plus, Edit, Trash2, FileText, DollarSign, Paperclip, Calendar, Clock, CheckCircle } from 'lucide-react';
import ExamForm from '../exams/ExamForm';
import DocumentForm from '../documents/DocumentForm';
import { useAuth } from '../../contexts/AuthContext';

interface PatientExamsProps {
  patientId: string;
}

const STATUS_COLORS = {
  'demande': 'bg-yellow-100 text-yellow-800',
  'en_attente_resultat': 'bg-blue-100 text-blue-800',
  'apporte': 'bg-purple-100 text-purple-800',
  'analyse': 'bg-green-100 text-green-800'
};

const STATUS_LABELS = {
  'demande': 'Demandé',
  'en_attente_resultat': 'En attente',
  'apporte': 'Apporté',
  'analyse': 'Analysé'
};

export default function PatientExams({ patientId }: PatientExamsProps) {
  const [exams, setExams] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDocFormOpen, setIsDocFormOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const { appUser } = useAuth();
  
  // Filters
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'exams'),
      where('patient_id', '==', patientId),
      orderBy('date_examen', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [patientId]);

  useEffect(() => {
    const qPayments = query(
      collection(db, 'payments'),
      where('patient_id', '==', patientId)
    );

    const unsubscribePayments = onSnapshot(qPayments, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribePayments();
  }, [patientId]);

  useEffect(() => {
    const qDocs = query(
      collection(db, 'documents'),
      where('patient_id', '==', patientId)
    );

    const unsubscribeDocs = onSnapshot(qDocs, (snapshot) => {
      setDocuments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribeDocs();
  }, [patientId]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet examen ?')) {
      try {
        await deleteDoc(doc(db, 'exams', id));
      } catch (error) {
        console.error("Error deleting exam:", error);
        alert("Erreur lors de la suppression de l'examen.");
      }
    }
  };

  const handleEdit = (exam: any) => {
    setSelectedExam(exam);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setSelectedExam(null);
    setIsFormOpen(true);
  };

  const handleAddDocument = (exam: any) => {
    setSelectedExam(exam);
    setIsDocFormOpen(true);
  };

  const filteredExams = exams.filter(e => {
    if (dateDebut && e.date_examen < dateDebut) return false;
    if (dateFin && e.date_examen > dateFin) return false;
    return true;
  });

  if (loading) return <div className="text-center py-4">Chargement des examens...</div>;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-wrap gap-4 items-end">
        <div>
          <label htmlFor="dateDebut" className="block text-sm font-medium text-slate-700 mb-1">Date de début</label>
          <input
            type="date"
            id="dateDebut"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="dateFin" className="block text-sm font-medium text-slate-700 mb-1">Date de fin</label>
          <input
            type="date"
            id="dateFin"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
          />
        </div>
        {(dateDebut || dateFin) && (
          <button
            onClick={() => { setDateDebut(''); setDateFin(''); }}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
          >
            Effacer les filtres
          </button>
        )}
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-slate-900">Examens du patient</h3>
        {appUser?.role !== 'assistante' && (
          <button
            onClick={handleAddNew}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="-ml-0.5 mr-2 h-4 w-4" />
            Ajouter un examen
          </button>
        )}
      </div>

      {filteredExams.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
          <FileText className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">Aucun examen</h3>
          {appUser?.role !== 'assistante' && (
            <p className="mt-1 text-sm text-slate-500">
              Commencez par ajouter un nouvel examen pour ce patient.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md border border-slate-200">
          <ul className="divide-y divide-slate-200">
            {filteredExams.map((exam) => {
              const examDocs = documents.filter(d => d.examen_id === exam.id);
              const examPayments = payments.filter(p => p.examen_id === exam.id);
              const status = exam.statutExamen || 'demande';
              
              return (
                <li key={exam.id} className="p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-base font-medium text-indigo-600 truncate">
                          {exam.nom_examen} <span className="text-sm text-slate-500 font-normal">({exam.type_examen})</span>
                        </p>
                        <div className="ml-2 flex-shrink-0 flex space-x-2">
                          <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'bg-slate-100 text-slate-800'}`}>
                            {STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3 text-sm text-slate-500">
                        <div className="flex items-center">
                          <Calendar className="mr-1.5 h-4 w-4 text-slate-400" />
                          <span>Demandé: {exam.dateDemande || exam.date_examen}</span>
                        </div>
                        {exam.dateApport && (
                          <div className="flex items-center">
                            <Clock className="mr-1.5 h-4 w-4 text-slate-400" />
                            <span>Apporté: {exam.dateApport}</span>
                          </div>
                        )}
                        {exam.dateAnalyse && (
                          <div className="flex items-center">
                            <CheckCircle className="mr-1.5 h-4 w-4 text-slate-400" />
                            <span>Analysé: {exam.dateAnalyse}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-2 sm:flex sm:justify-between">
                        <div className="sm:flex flex-col space-y-1">
                          <p className="flex items-center text-sm text-slate-500">
                            <span className="font-medium mr-1">Lieu:</span> {exam.lieu || 'Non spécifié'}
                          </p>
                          <p className="flex items-center text-sm text-slate-500">
                            <span className="font-medium mr-1">Prescripteur:</span> {exam.medecin_prescripteur || 'Non spécifié'}
                          </p>
                        </div>
                      </div>
                      
                      {exam.resultat_examen && (
                        <div className="mt-3 text-sm text-slate-700 bg-slate-50 p-3 rounded-md border border-slate-100">
                          <span className="font-medium block mb-1">Résultat:</span>
                          <p className="whitespace-pre-wrap">{exam.resultat_examen}</p>
                        </div>
                      )}
                      
                      {exam.commentaire && (
                        <div className="mt-2 text-sm text-slate-500 italic">
                          Note: {exam.commentaire}
                        </div>
                      )}

                      {/* Documents liés */}
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                            <Paperclip className="h-3 w-3 mr-1" />
                            Documents joints ({examDocs.length})
                          </h4>
                          <button
                            onClick={() => handleAddDocument(exam)}
                            className="text-xs text-indigo-600 hover:text-indigo-900 font-medium flex items-center"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Ajouter
                          </button>
                        </div>
                        
                        {examDocs.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {examDocs.map(doc => (
                              <a 
                                key={doc.id} 
                                href={doc.url_fichier || doc.fileUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-2.5 py-1.5 border border-slate-200 shadow-sm text-xs font-medium rounded text-indigo-700 bg-white hover:bg-slate-50"
                              >
                                <FileText className="mr-1.5 h-3 w-3 text-indigo-500" />
                                {doc.titre || doc.nom || doc.type_document || doc.typeDocument || 'Document'}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Paiements liés */}
                      {examPayments.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-100">
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
                            <DollarSign className="h-3 w-3 mr-1" />
                            Paiements liés
                          </h4>
                          <div className="space-y-2">
                            {examPayments.map(payment => (
                              <div key={payment.id} className="flex justify-between items-center text-sm bg-white p-2 rounded border border-slate-100">
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-slate-900">{Number(payment.montant).toLocaleString('fr-MA')} MAD</span>
                                  <span className="text-slate-500">- {payment.mode_paiement}</span>
                                </div>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize
                                  ${(payment.statut_paiement === 'payé' || payment.statut_paiement === 'réglé') ? 'bg-green-100 text-green-800' : 
                                    (payment.statut_paiement === 'non payé' || payment.statut_paiement === 'en_attente') ? 'bg-red-100 text-red-800' : 
                                    'bg-orange-100 text-orange-800'}`}>
                                  {payment.statut_paiement}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {appUser?.role !== 'assistante' && (
                      <div className="ml-5 flex-shrink-0 flex space-x-2">
                        <button
                          onClick={() => handleEdit(exam)}
                          className="p-2 text-slate-400 hover:text-indigo-600 rounded-full hover:bg-indigo-50"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(exam.id)}
                          className="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {isFormOpen && (
        <ExamForm
          exam={selectedExam}
          patientId={patientId}
          onClose={() => setIsFormOpen(false)}
        />
      )}

      {isDocFormOpen && (
        <DocumentForm
          patientId={patientId}
          examenId={selectedExam?.id}
          onClose={() => setIsDocFormOpen(false)}
        />
      )}
    </div>
  );
}
