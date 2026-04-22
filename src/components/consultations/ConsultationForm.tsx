import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, updateDoc, doc, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import { X, Sparkles, FlaskConical, Pill, MessageSquare, ClipboardList } from 'lucide-react'; // *** MODIFIÉ ***
import { aiService } from '../../services/aiService';
import type { ChampPreConsultation } from '../../types';
import ExamRequestModal from '../salle-attente/ExamRequestModal';
import PrescriptionForm from '../prescriptions/PrescriptionForm';

interface ConsultationFormProps {
  consultation?: any;
  patientId?: string;
  fileAttenteId?: string;
  motif?: string;
  onClose: () => void;
}

export default function ConsultationForm({ consultation, patientId, fileAttenteId, motif: motifFromQueue, onClose }: ConsultationFormProps) {
  const { appUser } = useAuth();
  const { settings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [notesBrutes, setNotesBrutes] = useState('');

  // *** Workflow post-consultation — MODIFIÉ : ajout ask_note + write_note ***
  const [postSaveStep, setPostSaveStep] = useState<'none' | 'ask_exams' | 'exams' | 'ask_prescription' | 'prescription' | 'ask_note' | 'write_note'>('none');
  const [savedConsultationId, setSavedConsultationId] = useState<string | null>(null);
  const [savedPatientId, setSavedPatientId] = useState<string>('');
  const [savedPatientName, setSavedPatientName] = useState<string>('');
  const [noteForAssistante, setNoteForAssistante] = useState(''); // *** NOUVEAU ***

  const champsPreConsult = useMemo(() => {
    if (settings?.champs_pre_consultation && Array.isArray(settings.champs_pre_consultation)) {
      return [...settings.champs_pre_consultation]
        .filter((c: ChampPreConsultation) => c.actif)
        .sort((a: ChampPreConsultation, b: ChampPreConsultation) => a.ordre - b.ordre);
    }
    return [
      { id: 'poids', label: 'Poids', type: 'number' as const, unite: 'kg', actif: true, ordre: 1 },
      { id: 'tension_systolique', label: 'Tension systolique', type: 'number' as const, unite: 'mmHg', actif: true, ordre: 2 },
      { id: 'tension_diastolique', label: 'Tension diastolique', type: 'number' as const, unite: 'mmHg', actif: true, ordre: 3 },
    ];
  }, [settings]);

  const buildInitialFormData = () => {
    const base: Record<string, any> = {
      patient_id: consultation?.patient_id || patientId || '',
      date_consultation: consultation?.date_consultation || new Date().toISOString().split('T')[0],
      poids: consultation?.poids || '',
      tension: consultation?.tension || '',
      allergies: consultation?.allergies || '',
      commentaire_assistante: consultation?.commentaire_assistante || '',
      statutConsultation: consultation?.statutConsultation || 'pre_consultation',
      motif: consultation?.motif || motifFromQueue || '',
      symptomes: consultation?.symptomes || '',
      examen_clinique: consultation?.examen_clinique || '',
      diagnostic_principal: consultation?.diagnostic_principal || '',
      conduite_a_tenir: consultation?.conduite_a_tenir || '',
      synthese: consultation?.synthese || '',
      prescription: consultation?.prescription || '',
      observations: consultation?.observations || '',
      notes: consultation?.notes || '',
      file_attente_id: consultation?.file_attente_id || fileAttenteId || '',
    };

    champsPreConsult.forEach((champ) => {
      const key = `pre_${champ.id}`;
      if (consultation?.pre_consultation_data?.[champ.id] !== undefined) {
        base[key] = consultation.pre_consultation_data[champ.id];
      } else if (consultation?.[key] !== undefined) {
        base[key] = consultation[key];
      } else {
        base[key] = '';
      }
    });

    if (!base['pre_poids'] && consultation?.poids) {
      base['pre_poids'] = consultation.poids;
    }
    if (!base['pre_tension_systolique'] && consultation?.tension) {
      const parts = String(consultation.tension).split('/');
      if (parts.length === 2) {
        base['pre_tension_systolique'] = parts[0].trim();
        base['pre_tension_diastolique'] = parts[1].trim();
      }
    }

    return base;
  };

  const [formData, setFormData] = useState<Record<string, any>>(buildInitialFormData);

  useEffect(() => {
    const q = query(collection(db, 'patients'), orderBy('nom'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pts = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter((p: any) => !p.deleted && !p.supprime);
      setPatients(pts);

      if (!consultation?.id && (consultation?.patient_id || patientId)) {
        const pId = consultation?.patient_id || patientId;
        const p = pts.find((pt: any) => pt.id === pId);
        if (p && !formData.allergies) {
          setFormData(prev => ({ ...prev, allergies: p.allergies || '' }));
        }
      }
    });
    return () => unsubscribe();
  }, [consultation, patientId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePatientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const patient = patients.find((p: any) => p.id === selectedId);
    setFormData(prev => ({
      ...prev,
      patient_id: selectedId,
      allergies: patient?.allergies || prev.allergies || '',
    }));
  };

  const handleAiStructure = async () => {
    if (!notesBrutes.trim()) return;
    setIsAiLoading(true);
    try {
      const structuredText = await aiService.structureConsultation(notesBrutes);
      setFormData(prev => ({
        ...prev,
        notes: prev.notes + '\n\n--- Structuration IA ---\n' + structuredText
      }));
      setNotesBrutes('');
    } catch (error) {
      console.error("AI Error:", error);
      alert("Erreur lors de la structuration par l'IA.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const buildPreConsultationData = (): Record<string, any> => {
    const data: Record<string, any> = {};
    champsPreConsult.forEach((champ) => {
      const val = formData[`pre_${champ.id}`];
      if (val !== undefined && val !== '') {
        data[champ.id] = champ.type === 'number' ? parseFloat(val) || 0 : val;
      }
    });
    return data;
  };

  const extractLegacyFields = () => {
    const preData = buildPreConsultationData();
    const legacy: Record<string, any> = {};
    if (preData.poids !== undefined) legacy.poids = preData.poids;
    const sys = preData.tension_systolique;
    const dia = preData.tension_diastolique;
    if (sys && dia) legacy.tension = `${sys}/${dia}`;
    else if (sys) legacy.tension = String(sys);
    return legacy;
  };

  const getPatientName = (pId: string): string => {
    const p = patients.find((pt: any) => pt.id === pId);
    return p ? `${p.nom || ''} ${p.prenom || ''}`.trim() : 'Patient';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const preConsultData = buildPreConsultationData();
      const legacyFields = extractLegacyFields();

      let dataToSave: any;

      if (appUser?.role === 'assistante') {
        dataToSave = {
          patient_id: formData.patient_id,
          date_consultation: formData.date_consultation,
          poids: legacyFields.poids ?? formData.poids,
          tension: legacyFields.tension ?? formData.tension,
          allergies: formData.allergies,
          commentaire_assistante: formData.commentaire_assistante,
          statutConsultation: formData.statutConsultation,
          motif: formData.motif,
          pre_consultation_data: preConsultData,
        };
      } else {
        dataToSave = {
          ...formData,
          pre_consultation_data: preConsultData,
          poids: legacyFields.poids ?? formData.poids,
          tension: legacyFields.tension ?? formData.tension,
        };
        Object.keys(dataToSave).forEach(key => {
          if (key.startsWith('pre_')) delete dataToSave[key];
        });
      }

      const faId = formData.file_attente_id || fileAttenteId;
      if (faId) {
        dataToSave.file_attente_id = faId;
      }

      let consultationDocId: string;

      if (consultation?.id) {
        consultationDocId = consultation.id;
        await updateDoc(doc(db, 'consultations', consultation.id), {
          ...dataToSave,
          updated_at: now,
          updated_by: appUser?.uid
        });
      } else {
        const docRef = await addDoc(collection(db, 'consultations'), {
          ...dataToSave,
          created_by: appUser?.uid || 'unknown',
          created_at: now,
          updated_at: now,
          updated_by: appUser?.uid,
          ...(appUser?.role !== 'assistante' ? { medecin_id: appUser?.uid } : {}),
        });
        consultationDocId = docRef.id;
      }

      if (formData.patient_id) {
        try {
          const patientUpdate: Record<string, any> = { updated_at: now };
          if (formData.allergies) patientUpdate.allergies = formData.allergies;
          if (legacyFields.poids) patientUpdate.poids = legacyFields.poids;
          await updateDoc(doc(db, 'patients', formData.patient_id), patientUpdate);
        } catch (err) {
          console.warn('Impossible de mettre à jour le patient:', err);
        }
      }

      if (faId) {
        try {
          await updateDoc(doc(db, 'file_attente', faId), {
            consultation_id: consultationDocId,
            statut: consultation?.id ? undefined : 'en_consultation',
            updated_at: now,
          });
        } catch (err) {
          console.warn("Impossible de mettre à jour la file d'attente:", err);
        }
      }

      if (formData.statutConsultation === 'terminee' && appUser?.role !== 'assistante') {
        setSavedConsultationId(consultationDocId);
        setSavedPatientId(formData.patient_id);
        setSavedPatientName(getPatientName(formData.patient_id));
        setPostSaveStep('ask_exams');
      } else {
        onClose();
      }

    } catch (error) {
      console.error("Error saving consultation:", error);
      alert("Erreur lors de l'enregistrement de la consultation.");
    } finally {
      setLoading(false);
    }
  };

  // =====================================================================
  // WORKFLOW POST-CONSULTATION (6 étapes)
  // =====================================================================

  // Étape 1 : Demander examens ? Oui/Non
  if (postSaveStep === 'ask_exams') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/50" />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 z-50">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Consultation enregistrée</h3>
          <p className="text-sm text-slate-500 mb-6">{savedPatientName}</p>

          <div className="flex items-center gap-3 mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <FlaskConical className="w-6 h-6 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800 font-medium">
              Souhaitez-vous demander des examens complémentaires ?
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setPostSaveStep('ask_prescription')}
              className="flex-1 px-4 py-3 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Non, passer
            </button>
            <button
              onClick={() => setPostSaveStep('exams')}
              className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
            >
              Oui, demander
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Étape 2 : Formulaire examens
  if (postSaveStep === 'exams' && savedConsultationId) {
    return (
      <ExamRequestModal
        patientId={savedPatientId}
        patientName={savedPatientName}
        consultationId={savedConsultationId}
        onComplete={() => setPostSaveStep('ask_prescription')}
        onClose={() => setPostSaveStep('ask_prescription')}
      />
    );
  }

  // Étape 3 : Demander ordonnance ? Oui/Non — *** MODIFIÉ : "Non" → ask_note ***
  if (postSaveStep === 'ask_prescription') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/50" />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 z-50">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Ordonnance</h3>
          <p className="text-sm text-slate-500 mb-6">{savedPatientName}</p>

          <div className="flex items-center gap-3 mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <Pill className="w-6 h-6 text-indigo-600 flex-shrink-0" />
            <p className="text-sm text-indigo-800 font-medium">
              Souhaitez-vous rédiger une ordonnance ?
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setPostSaveStep('ask_note')}
              className="flex-1 px-4 py-3 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Non, passer
            </button>
            <button
              onClick={() => setPostSaveStep('prescription')}
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              Oui, prescrire
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Étape 4 : Formulaire ordonnance — *** MODIFIÉ : onClose → ask_note ***
  if (postSaveStep === 'prescription') {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
        <div className="fixed inset-0 bg-black/50" />
        <div className="relative z-50 w-full max-w-3xl mx-4 my-8">
          {/* Bandeau "Passer sans ordonnance" */}
          <div className="bg-white rounded-t-xl border-b border-slate-200 px-6 py-3 flex items-center justify-between">
            <span className="text-sm text-slate-500">Ordonnance pour <strong>{savedPatientName}</strong></span>
            <button
              onClick={() => setPostSaveStep('ask_note')}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              Passer sans ordonnance →
            </button>
          </div>
          {/* Le formulaire ordonnance — en inline, sans son propre overlay */}
          <PrescriptionForm
            patientId={savedPatientId}
            consultationId={savedConsultationId || undefined}
            onClose={() => setPostSaveStep('ask_note')}
            inline
          />
        </div>
      </div>
    );
  }

  // *** NOUVEAU — Étape 5 : Proposer de partager une note avec l'assistante ***
  if (postSaveStep === 'ask_note') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/50" />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 z-50">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Note pour l'assistante</h3>
          <p className="text-sm text-slate-500 mb-6">{savedPatientName}</p>

          <div className="flex items-center gap-3 mb-6 p-4 bg-teal-50 border border-teal-200 rounded-lg">
            <MessageSquare className="w-6 h-6 text-teal-600 flex-shrink-0" />
            <p className="text-sm text-teal-800 font-medium">
              Souhaitez-vous partager une note avec l'assistante sur cette consultation ?
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Non, terminer
            </button>
            <button
              onClick={() => setPostSaveStep('write_note')}
              className="flex-1 px-4 py-3 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
            >
              Oui, écrire
            </button>
          </div>
        </div>
      </div>
    );
  }

  // *** NOUVEAU — Étape 6 : Saisie de la note ***
  if (postSaveStep === 'write_note' && savedConsultationId) {
    const handleSaveNote = async () => {
      if (!noteForAssistante.trim()) {
        onClose();
        return;
      }
      try {
        await updateDoc(doc(db, 'consultations', savedConsultationId), {
          note_pour_assistante: noteForAssistante.trim(),
          note_pour_assistante_at: new Date().toISOString(),
          note_pour_assistante_by: appUser?.uid || '',
          updated_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Erreur sauvegarde note assistante:', err);
      }
      onClose();
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="fixed inset-0 bg-black/50" />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 z-50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-teal-100 rounded-lg">
              <MessageSquare className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Note pour l'assistante</h3>
              <p className="text-sm text-slate-500">{savedPatientName}</p>
            </div>
          </div>

          <p className="text-sm text-slate-600 mb-4">
            Cette note sera visible par l'assistante lorsqu'elle terminera le parcours du patient en salle d'attente.
          </p>

          <textarea
            rows={5}
            value={noteForAssistante}
            onChange={(e) => setNoteForAssistante(e.target.value)}
            placeholder="Ex : Programmer un contrôle dans 3 mois, remettre les résultats d'analyses, préparer le dossier CNSS..."
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:border-teal-500 focus:ring-teal-500 resize-none"
            autoFocus
          />

          <div className="flex gap-3 mt-5">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Passer
            </button>
            <button
              onClick={handleSaveNote}
              className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
            >
              Enregistrer la note
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================================
  // FORMULAIRE PRINCIPAL (inchangé)
  // =====================================================================
  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 overflow-y-auto flex justify-center items-start p-4 sm:p-6">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-8 relative">
        <div className="flex justify-between items-center p-6 border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-xl">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {consultation ? 'Modifier la consultation' : 'Nouvelle consultation'}
            </h2>
            {formData.file_attente_id && (
              <p className="text-xs text-indigo-500 mt-0.5">Lié à la file d'attente</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className={`p-6 grid grid-cols-1 ${appUser?.role !== 'assistante' ? 'lg:grid-cols-3' : ''} gap-6`}>

          {appUser?.role !== 'assistante' && (
            <div className="lg:col-span-1 border-r border-slate-200 pr-6 space-y-4">
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
                <h3 className="text-sm font-medium text-indigo-900 flex items-center mb-2">
                  <Sparkles className="h-4 w-4 mr-1 text-indigo-600" />
                  Assistant IA
                </h3>
                <p className="text-xs text-indigo-700 mb-3">
                  Prenez vos notes en vrac, l'IA se chargera de les structurer dans le dossier.
                </p>
                <textarea
                  rows={6}
                  value={notesBrutes}
                  onChange={(e) => setNotesBrutes(e.target.value)}
                  placeholder="Ex: Patient 45 ans, dlr fosse iliaque dte depuis 2j, fievre 38.5, pas de N/V..."
                  className="block w-full rounded-md border-indigo-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 bg-white"
                />
                <button
                  type="button"
                  onClick={handleAiStructure}
                  disabled={isAiLoading || !notesBrutes.trim()}
                  className="mt-3 w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isAiLoading ? 'Analyse...' : 'Structurer les notes'}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className={`${appUser?.role !== 'assistante' ? 'lg:col-span-2' : ''} space-y-4`}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Patient *</label>
                <select
                  required
                  name="patient_id"
                  value={formData.patient_id}
                  onChange={handlePatientChange}
                  disabled={!!patientId || !!consultation}
                  className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 disabled:bg-slate-100"
                >
                  <option value="">Sélectionner un patient</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.nom} {p.prenom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Date *</label>
                <input required type="date" name="date_consultation" value={formData.date_consultation} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700">Statut de la consultation</label>
                <select name="statutConsultation" value={formData.statutConsultation} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2">
                  <option value="pre_consultation">Pré-consultation saisie</option>
                  <option value="en_attente">Patient en salle d'attente</option>
                  <option value="en_cours">Consultation en cours</option>
                  <option value="terminee">Consultation terminée</option>
                </select>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
              <h4 className="text-sm font-semibold text-slate-900 mb-2">Pré-consultation (Assistante)</h4>

              {/* ── Données pré-consultation saisies par l'assistante (lecture seule) ── */}
              {(() => {
                const pc = consultation?.pre_consultation;
                if (!pc) return null;
                const FIELDS: { key: string; label: string; unite: string }[] = [
                  { key: 'poids', label: 'Poids', unite: 'kg' },
                  { key: 'tension', label: 'Tension', unite: 'mmHg' },
                  { key: 'temperature', label: 'Température', unite: '°C' },
                  { key: 'glycemie', label: 'Glycémie', unite: 'g/L' },
                  { key: 'saturation_o2', label: 'Saturation O₂', unite: '%' },
                  { key: 'frequence_cardiaque', label: 'Fréq. cardiaque', unite: 'bpm' },
                ];
                const visibleFields = FIELDS.filter(f => pc[f.key] !== null && pc[f.key] !== undefined && pc[f.key] !== '');
                if (visibleFields.length === 0 && !pc.allergies && !pc.observations_pre_consultation) return null;
                return (
                  <div className="mb-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-2">
                      Constantes saisies par l'assistante
                      {pc.realise_par_nom ? <span className="normal-case font-normal ml-1 text-indigo-500">— {pc.realise_par_nom}</span> : null}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {visibleFields.map(f => (
                        <div key={f.key} className="text-sm">
                          <span className="text-slate-500">{f.label} :</span>{' '}
                          <span className="font-medium text-slate-800">{pc[f.key]} <span className="text-xs text-slate-400">{f.unite}</span></span>
                        </div>
                      ))}
                      {pc.allergies && (
                        <div className="col-span-2 md:col-span-3 text-sm">
                          <span className="text-slate-500">Allergies :</span>{' '}
                          <span className="font-medium text-red-700">{pc.allergies}</span>
                        </div>
                      )}
                      {pc.observations_pre_consultation && (
                        <div className="col-span-2 md:col-span-3 text-sm">
                          <span className="text-slate-500">Observations :</span>{' '}
                          <span className="font-medium text-slate-800">{pc.observations_pre_consultation}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {champsPreConsult.map((champ) => (
                  <div key={champ.id}>
                    <label className="block text-sm font-medium text-slate-700">
                      {champ.label} {champ.unite && <span className="text-slate-400">({champ.unite})</span>}
                    </label>
                    <input
                      type={champ.type === 'text' ? 'text' : 'number'}
                      step={champ.type === 'number' ? 'any' : undefined}
                      name={`pre_${champ.id}`}
                      value={formData[`pre_${champ.id}`] || ''}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 bg-white"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Allergies</label>
                <input type="text" name="allergies" value={formData.allergies} onChange={handleChange} placeholder="Ex: Pénicilline, Arachides..." className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Observations Pré-consultation</label>
                <textarea name="commentaire_assistante" rows={2} value={formData.commentaire_assistante} onChange={handleChange} placeholder="Ex: Patient à jeun, anxieux..." className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 bg-white" />
              </div>
            </div>

            {appUser?.role !== 'assistante' && (
              <>
                {/* ── Évo 1 : Infos Patient (antécédents consolidés, lecture seule) ── */}
                {(() => {
                  const p = patients.find((pt: any) => pt.id === formData.patient_id);
                  if (!p) return null;
                  const items: { label: string; value: string }[] = [
                    { label: 'Antécédents médicaux', value: p.antecedents_medicaux || '' },
                    { label: 'Antécédents familiaux', value: p.antecedents_familiaux || '' },
                    { label: 'Antécédents chirurgicaux', value: p.antecedents_chirurgicaux || '' },
                    { label: 'Habitudes toxiques', value: p.habitudes_toxiques || '' },
                    { label: 'Traitement en cours', value: p.traitement_en_cours || p.traitements_chroniques || '' },
                  ];
                  const visible = items.filter(i => String(i.value).trim() !== '');
                  return (
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" />
                        Infos Patient
                      </h4>
                      {visible.length === 0 ? (
                        <p className="text-sm text-amber-700 italic">Aucun antécédent renseigné pour ce patient.</p>
                      ) : (
                        <div className="space-y-3">
                          {visible.map(i => (
                            <div key={i.label}>
                              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">{i.label}</p>
                              <p className="text-sm text-slate-800 whitespace-pre-wrap mt-0.5">{i.value}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-900 mb-4">Consultation Médicale</h4>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Motif</label>
                  <input type="text" name="motif" value={formData.motif} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Symptômes</label>
                  <textarea name="symptomes" rows={2} value={formData.symptomes} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Examen clinique</label>
                  <textarea name="examen_clinique" rows={2} value={formData.examen_clinique} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Diagnostic principal</label>
                  <input type="text" name="diagnostic_principal" value={formData.diagnostic_principal} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Synthèse</label>
                  <textarea name="synthese" rows={2} value={formData.synthese} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Conduite à tenir</label>
                  <textarea name="conduite_a_tenir" rows={2} value={formData.conduite_a_tenir} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Prescription</label>
                  <textarea name="prescription" rows={2} value={formData.prescription} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Observations</label>
                  <textarea name="observations" rows={2} value={formData.observations} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Notes (Générées par l'IA ou manuelles)</label>
                  <textarea name="notes" rows={4} value={formData.notes} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 font-mono text-xs" />
                </div>
              </>
            )}

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
    </div>
  );
}