import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Calendar, Stethoscope, Edit, DollarSign, FileText, Pill } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import ConsultationForm from '../consultations/ConsultationForm';
import SmartFilterBar from '../shared/SmartFilterBar';
import { matchPeriod, type PeriodId } from '../../utils/filterHelpers';

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
  const [searchParams] = useSearchParams();
  const [consultations, setConsultations] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingConsultation, setEditingConsultation] = useState<any | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);

  // Smart filters
  const [search, setSearch]         = useState('');
  const [period, setPeriod]         = useState<PeriodId>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd]     = useState('');
  const [statut, setStatut]         = useState<string>('all');

  useEffect(() => {
    // Essayer avec orderBy, fallback sans orderBy si index manquant
    const q = query(
      collection(db, 'consultations'),
      where('patient_id', '==', patientId),
      orderBy('date_consultation', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setConsultations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.warn('Index manquant pour consultations, fallback sans orderBy:', error);
      // Fallback: query sans orderBy, tri côté client
      const qFallback = query(
        collection(db, 'consultations'),
        where('patient_id', '==', patientId)
      );
      const unsubFallback = onSnapshot(qFallback, (snap) => {
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a: any, b: any) => (b.date_consultation || '').localeCompare(a.date_consultation || ''));
        setConsultations(data);
        setLoading(false);
      });
      return () => unsubFallback();
    });

    return () => unsubscribe();
  }, [patientId]);

  // Auto-ouverture de la consultation active si on vient de la salle d'attente
  useEffect(() => {
    if (autoOpened || loading || consultations.length === 0) return;
    const mode = searchParams.get('consultationMode');
    if (mode === 'active') {
      const today = new Date().toISOString().split('T')[0];
      const todayConsult = consultations.find(c =>
        c.date_consultation === today &&
        (c.statutConsultation === 'pre_consultation' || c.statutConsultation === 'en_cours' || c.statutConsultation === 'en_attente')
      );
      if (todayConsult) {
        setEditingConsultation(todayConsult);
      }
      setAutoOpened(true);
    }
  }, [consultations, loading, searchParams, autoOpened]);

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

  // ── Comptage par statut pour les chips ─────────────────────────────
  const statutCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of consultations) {
      const s = c.statutConsultation || 'pre_consultation';
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [consultations]);

  // ── Filtrage intelligent ───────────────────────────────────────────
  const filteredConsultations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return consultations.filter(c => {
      // Période
      if (!matchPeriod(c.date_consultation, period, customStart, customEnd)) return false;

      // Statut
      if (statut !== 'all' && (c.statutConsultation || 'pre_consultation') !== statut) return false;

      // Recherche full-text
      if (q) {
        const haystack = [
          c.motif, c.examen_clinique, c.diagnostic_principal, c.synthese,
          c.prescription, c.observations, c.commentaire_assistante, c.allergies,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [consultations, search, period, customStart, customEnd, statut]);

  const hasActiveFilters = !!search || period !== 'all' || statut !== 'all';
  const resetFilters = () => {
    setSearch(''); setPeriod('all'); setCustomStart(''); setCustomEnd(''); setStatut('all');
  };

  if (loading) {
    return <div className="p-4 text-center text-slate-500">Chargement des consultations...</div>;
  }

  return (
    <div className="space-y-6">
      <SmartFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Rechercher motif, diagnostic, synthèse…"
        period={period}
        onPeriodChange={setPeriod}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
        chipGroups={[
          {
            key:     'statut',
            label:   'Statut',
            active:  statut,
            onChange: setStatut,
            options: [
              { id: 'pre_consultation', label: 'Pré-consultation', count: statutCounts['pre_consultation'], color: 'amber' },
              { id: 'en_attente',       label: 'En attente',       count: statutCounts['en_attente'],       color: 'amber' },
              { id: 'en_cours',         label: 'En cours',         count: statutCounts['en_cours'],         color: 'blue'  },
              { id: 'terminee',         label: 'Terminée',         count: statutCounts['terminee'],         color: 'green' },
            ].filter(o => o.count && o.count > 0),
          },
        ]}
        totalCount={consultations.length}
        filteredCount={filteredConsultations.length}
        itemLabel="consultation"
        hasActiveFilters={hasActiveFilters}
        onReset={resetFilters}
      />

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
                              {new Date(consultation.date_consultation + 'T12:00:00').toLocaleDateString('fr-FR')}
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
