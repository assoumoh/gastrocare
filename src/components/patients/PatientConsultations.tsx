import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Calendar, Stethoscope, Edit, DollarSign, FileText, Pill, Search } from 'lucide-react';
import ConsultationForm from '../consultations/ConsultationForm';

interface PatientConsultationsProps {
  patientId: string;
}

const STATUT_BADGES: Record<string, { label: string, className: string }> = {
  'pre_consultation': { label: 'Pré-consultation', className: 'bg-yellow-100 text-yellow-800' },
  'en_attente': { label: 'En attente', className: 'bg-orange-100 text-orange-800' },
  'en_cours': { label: 'En cours', className: 'bg-blue-100 text-blue-800' },
  'terminee': { label: 'Terminé', className: 'bg-green-100 text-green-800' },
};

export default function PatientConsultations({ patientId }: PatientConsultationsProps) {
  const [consultations, setConsultations] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingConsultation, setEditingConsultation] = useState<any | null>(null);
  
  // Filters
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'consultations'),
      where('patient_id', '==', patientId),
      orderBy('date_consultation', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setConsultations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
    const qExams = query(
      collection(db, 'exams'),
      where('patient_id', '==', patientId)
    );

    const unsubscribeExams = onSnapshot(qExams, (snapshot) => {
      setExams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribeExams();
  }, [patientId]);

  useEffect(() => {
    const qPrescriptions = query(
      collection(db, 'prescriptions'),
      where('patient_id', '==', patientId)
    );

    const unsubscribePrescriptions = onSnapshot(qPrescriptions, (snapshot) => {
      setPrescriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribePrescriptions();
  }, [patientId]);

  const filteredConsultations = consultations.filter(c => {
    if (dateDebut && c.date_consultation < dateDebut) return false;
    if (dateFin && c.date_consultation > dateFin) return false;
    return true;
  });

  if (loading) {
    return <div className="p-4 text-center text-slate-500">Chargement des consultations...</div>;
  }

  return (
    <div className="space-y-6">
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
        <div className="flex-grow"></div>
        {(dateDebut || dateFin) && (
          <button
            onClick={() => { setDateDebut(''); setDateFin(''); }}
            className="text-sm text-indigo-600 hover:text-indigo-900 font-medium"
          >
            Effacer les filtres
          </button>
        )}
      </div>

      {filteredConsultations.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Stethoscope className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <p>Aucune consultation trouvée pour ces critères.</p>
        </div>
      ) : (
        <div className="flow-root">
          <ul className="-mb-8">
            {filteredConsultations.map((consultation, eventIdx) => {
              const statusInfo = STATUT_BADGES[consultation.statutConsultation || 'pre_consultation'] || STATUT_BADGES['pre_consultation'];
              const linkedExams = exams.filter(e => e.consultationId === consultation.id);
              const linkedPrescriptions = prescriptions.filter(p => p.consultationId === consultation.id);
              const linkedPayments = payments.filter(p => p.consultation_id === consultation.id);

              return (
                <li key={consultation.id}>
                  <div className="relative pb-8">
                    {eventIdx !== filteredConsultations.length - 1 ? (
                      <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                    ) : null}
                    <div className="relative flex space-x-3">
                      <div>
                        <span className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center ring-8 ring-white">
                          <Stethoscope className="h-4 w-4 text-indigo-600" />
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                        <div className="w-full">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-sm text-slate-500 flex items-center">
                              <Calendar className="mr-1.5 h-4 w-4 text-slate-400" />
                              {new Date(consultation.date_consultation).toLocaleDateString('fr-FR')}
                            </p>
                            <div className="flex items-center space-x-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}>
                                {statusInfo.label}
                              </span>
                              <button
                                onClick={() => setEditingConsultation(consultation)}
                                className="text-indigo-600 hover:text-indigo-900"
                                title="Modifier"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-4">
                            {/* Pré-consultation */}
                            <div>
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Pré-consultation</h4>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div><span className="text-slate-500">Poids:</span> {consultation.poids ? `${consultation.poids} kg` : '-'}</div>
                                <div><span className="text-slate-500">Tension:</span> {consultation.tension || '-'}</div>
                                <div className="col-span-2"><span className="text-slate-500">Allergies:</span> <span className="text-red-600 font-medium">{consultation.allergies || '-'}</span></div>
                                <div className="col-span-2"><span className="text-slate-500">Observations:</span> {consultation.commentaire_assistante || '-'}</div>
                              </div>
                            </div>

                            {/* Consultation Médicale */}
                            {(consultation.motif || consultation.examen_clinique || consultation.diagnostic_principal) && (
                              <div className="pt-3 border-t border-slate-200">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Consultation Médicale</h4>
                                <div className="space-y-2 text-sm">
                                  {consultation.motif && <div><span className="text-slate-500">Motif:</span> {consultation.motif}</div>}
                                  {consultation.examen_clinique && <div><span className="text-slate-500">Examen clinique:</span> {consultation.examen_clinique}</div>}
                                  {consultation.diagnostic_principal && <div><span className="text-slate-500">Diagnostic:</span> {consultation.diagnostic_principal}</div>}
                                  {consultation.synthese && <div><span className="text-slate-500">Synthèse:</span> {consultation.synthese}</div>}
                                  {consultation.prescription && <div><span className="text-slate-500">Prescription:</span> {consultation.prescription}</div>}
                                  {consultation.observations && <div><span className="text-slate-500">Observations:</span> {consultation.observations}</div>}
                                </div>
                              </div>
                            )}

                            {/* Examens liés */}
                            {linkedExams.length > 0 && (
                              <div className="pt-3 border-t border-slate-200">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
                                  <FileText className="h-3 w-3 mr-1" />
                                  Examens liés
                                </h4>
                                <ul className="space-y-2">
                                  {linkedExams.map(exam => (
                                    <li key={exam.id} className="text-sm bg-white p-2 rounded border border-slate-100 flex justify-between items-center">
                                      <span className="font-medium text-slate-900">{exam.type}</span>
                                      <span className="text-xs text-slate-500">{exam.statutExamen || 'demande'}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Ordonnances liées */}
                            {linkedPrescriptions.length > 0 && (
                              <div className="pt-3 border-t border-slate-200">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
                                  <Pill className="h-3 w-3 mr-1" />
                                  Ordonnances liées
                                </h4>
                                <ul className="space-y-2">
                                  {linkedPrescriptions.map(prescription => (
                                    <li key={prescription.id} className="text-sm bg-white p-2 rounded border border-slate-100 flex justify-between items-center">
                                      <span className="font-medium text-slate-900">{new Date(prescription.date).toLocaleDateString('fr-FR')}</span>
                                      <span className="text-xs text-slate-500">{prescription.medicaments?.length || 0} médicament(s)</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Paiements liés */}
                            {linkedPayments.length > 0 && (
                              <div className="pt-3 border-t border-slate-200">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
                                  <DollarSign className="h-3 w-3 mr-1" />
                                  Paiements liés
                                </h4>
                                <div className="space-y-2">
                                  {linkedPayments.map(payment => (
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
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {editingConsultation && (
        <ConsultationForm
          consultation={editingConsultation}
          patientId={patientId}
          onClose={() => setEditingConsultation(null)}
        />
      )}
    </div>
  );
}
