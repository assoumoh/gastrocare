import React, { useState, useEffect } from 'react';
import {
    doc,
    getDoc,
    updateDoc,
    addDoc,
    collection,
    query,
    where,
    getDocs,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import { X, Save, Loader2 } from 'lucide-react';

interface PreConsultationFormProps {
    entry: {
        id: string;
        patient_id: string;
        consultation_id?: string;
        appointment_id?: string;
    };
    patientName: string;
    onClose: () => void;
}

// Champs par défaut si settings.champs_pre_consultation n'existe pas
const DEFAULT_CHAMPS = [
    { nom: 'poids', label: 'Poids', unite: 'kg', type: 'number', obligatoire: false, actif: true },
    { nom: 'tension_systolique', label: 'Tension systolique', unite: 'mmHg', type: 'number', obligatoire: false, actif: true },
    { nom: 'tension_diastolique', label: 'Tension diastolique', unite: 'mmHg', type: 'number', obligatoire: false, actif: true },
    { nom: 'temperature', label: 'Température', unite: '°C', type: 'number', obligatoire: false, actif: true },
    { nom: 'glycemie', label: 'Glycémie', unite: 'g/L', type: 'number', obligatoire: false, actif: true },
    { nom: 'saturation_o2', label: 'Saturation O₂', unite: '%', type: 'number', obligatoire: false, actif: true },
    { nom: 'frequence_cardiaque', label: 'Fréquence cardiaque', unite: 'bpm', type: 'number', obligatoire: false, actif: true },
];

const PreConsultationForm: React.FC<PreConsultationFormProps> = ({
    entry,
    patientName,
    onClose,
}) => {
    const { appUser } = useAuth();
    const { settings } = useSettings();
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [patient, setPatient] = useState<any>(null);

    const [formData, setFormData] = useState<Record<string, any>>({
        poids: '',
        tension_systolique: '',
        tension_diastolique: '',
        temperature: '',
        glycemie: '',
        saturation_o2: '',
        frequence_cardiaque: '',
        allergies: '',
        observations_pre_consultation: '',
    });

    // Champs dynamiques depuis les settings, avec déduplication par nom
    const champsPreConsultation = (() => {
        const raw = settings?.champs_pre_consultation?.filter(
            (c: any) => c.actif !== false
        );
        if (!raw || raw.length === 0) return DEFAULT_CHAMPS;

        // Fusionner : settings + DEFAULT_CHAMPS manquants
        const seen = new Set<string>();
        const merged: any[] = [];
        raw.forEach((c: any) => {
            if (!seen.has(c.nom)) {
                seen.add(c.nom);
                merged.push(c);
            }
        });
        // Ajouter les champs par défaut qui ne sont pas dans les settings
        DEFAULT_CHAMPS.forEach((c) => {
            if (!seen.has(c.nom)) {
                seen.add(c.nom);
                merged.push(c);
            }
        });
        return merged;
    })();


    // Charger données patient + consultation existante
    useEffect(() => {
        const loadData = async () => {
            try {
                const patientDoc = await getDoc(doc(db, 'patients', entry.patient_id));
                if (patientDoc.exists()) {
                    const patientData = patientDoc.data();
                    setPatient(patientData);
                    setFormData((prev) => ({
                        ...prev,
                        allergies: patientData.allergies || '',
                        poids: patientData.poids || '',
                    }));
                }

                const today = new Date().toISOString().split('T')[0];
                let consultationData: any = null;

                if (entry.consultation_id) {
                    const consultDoc = await getDoc(doc(db, 'consultations', entry.consultation_id));
                    if (consultDoc.exists()) {
                        consultationData = consultDoc.data();
                    }
                } else {
                    const q = query(
                        collection(db, 'consultations'),
                        where('patient_id', '==', entry.patient_id),
                        where('date_consultation', '==', today)
                    );
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                        consultationData = { id: snap.docs[0].id, ...snap.docs[0].data() };
                    }
                }

                if (consultationData?.pre_consultation) {
                    const pc = consultationData.pre_consultation;
                    setFormData((prev) => ({
                        ...prev,
                        poids: pc.poids || prev.poids,
                        tension_systolique: pc.tension_systolique || prev.tension_systolique,
                        tension_diastolique: pc.tension_diastolique || prev.tension_diastolique,
                        temperature: pc.temperature || prev.temperature,
                        glycemie: pc.glycemie || prev.glycemie,
                        saturation_o2: pc.saturation_o2 || prev.saturation_o2,
                        frequence_cardiaque: pc.frequence_cardiaque || prev.frequence_cardiaque,
                        allergies: pc.allergies || prev.allergies,
                        observations_pre_consultation: pc.observations_pre_consultation || prev.observations_pre_consultation,
                    }));
                }
            } catch (error) {
                console.error('Erreur chargement données pré-consultation:', error);
            } finally {
                setInitialLoading(false);
            }
        };
        loadData();
    }, [entry.patient_id, entry.consultation_id]);

    const handleChange = (field: string, value: any) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const tensionStr =
                formData.tension_systolique && formData.tension_diastolique
                    ? `${formData.tension_systolique}/${formData.tension_diastolique}`
                    : '';

            const preConsultPayload: Record<string, any> = {
                poids: formData.poids ? parseFloat(formData.poids) : null,
                tension_systolique: formData.tension_systolique ? parseFloat(formData.tension_systolique) : null,
                tension_diastolique: formData.tension_diastolique ? parseFloat(formData.tension_diastolique) : null,
                tension: tensionStr,
                temperature: formData.temperature ? parseFloat(formData.temperature) : null,
                glycemie: formData.glycemie ? parseFloat(formData.glycemie) : null,
                saturation_o2: formData.saturation_o2 ? parseFloat(formData.saturation_o2) : null,
                frequence_cardiaque: formData.frequence_cardiaque ? parseFloat(formData.frequence_cardiaque) : null,
                allergies: formData.allergies || '',
                observations_pre_consultation: formData.observations_pre_consultation || '',
                realise_par: appUser?.uid || '',
                realise_par_nom: appUser?.prenom ? `${appUser.prenom} ${appUser.nom}` : '',
                date_realisation: new Date().toISOString(),
            };

            // Ajouter les champs dynamiques supplémentaires
            champsPreConsultation.forEach((champ: any) => {
                if (formData[champ.nom] !== undefined && preConsultPayload[champ.nom] === undefined) {
                    preConsultPayload[champ.nom] =
                        champ.type === 'number' && formData[champ.nom]
                            ? parseFloat(formData[champ.nom])
                            : formData[champ.nom] || null;
                }
            });

            const today = new Date().toISOString().split('T')[0];
            let consultationId = entry.consultation_id;

            // ===== DÉBUT MODIFICATION =====
            // Construire pre_consultation_data au format attendu par ConsultationForm (clé id)
            const preConsultDataFormatted: Record<string, any> = {
                poids: preConsultPayload.poids,
                tension_systolique: preConsultPayload.tension_systolique,
                tension_diastolique: preConsultPayload.tension_diastolique,
                temperature: preConsultPayload.temperature,
                glycemie: preConsultPayload.glycemie,
                saturation_o2: preConsultPayload.saturation_o2,
                frequence_cardiaque: preConsultPayload.frequence_cardiaque,
            };

            if (consultationId) {
                await updateDoc(doc(db, 'consultations', consultationId), {
                    pre_consultation: preConsultPayload,
                    pre_consultation_data: preConsultDataFormatted,
                    poids: preConsultPayload.poids,
                    tension: tensionStr,
                    allergies: formData.allergies,
                    commentaire_assistante: formData.observations_pre_consultation,
                    statutConsultation: 'pre_consultation',
                    updated_at: new Date().toISOString(),
                });
            } else {
                const newConsult = await addDoc(collection(db, 'consultations'), {
                    patient_id: entry.patient_id,
                    date_consultation: today,
                    pre_consultation: preConsultPayload,
                    pre_consultation_data: preConsultDataFormatted,
                    poids: preConsultPayload.poids,
                    tension: tensionStr,
                    allergies: formData.allergies,
                    commentaire_assistante: formData.observations_pre_consultation,
                    statutConsultation: 'pre_consultation',
                    created_by: appUser?.uid || '',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });
                consultationId = newConsult.id;
            }
            // ===== FIN MODIFICATION =====

            // Mettre à jour le patient (poids + allergies)
            const patientUpdate: Record<string, any> = {
                updated_at: new Date().toISOString(),
            };
            if (preConsultPayload.poids) patientUpdate.poids = preConsultPayload.poids;
            if (formData.allergies) patientUpdate.allergies = formData.allergies;
            await updateDoc(doc(db, 'patients', entry.patient_id), patientUpdate);

            // Mettre à jour l'entrée file d'attente
            await updateDoc(doc(db, 'file_attente', entry.id), {
                consultation_id: consultationId,
                pre_consultation: preConsultPayload,
                statut: 'pre_consultation_terminee',
                updated_at: new Date().toISOString(),
            });

            onClose();
        } catch (error) {
            console.error('Erreur sauvegarde pré-consultation:', error);
            alert('Erreur lors de la sauvegarde. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    };

    const buildLabel = (champ: any): string => {
        if (!champ.unite) return champ.label;
        if (champ.label.includes(`(${champ.unite})`)) return champ.label;
        return `${champ.label} (${champ.unite})`;
    };

    if (initialLoading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="fixed inset-0 bg-black/50" />
                <div className="relative bg-white rounded-xl p-8 flex items-center gap-3 z-50">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                    <span>Chargement...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto z-50">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Pré-consultation</h2>
                        <p className="text-sm text-gray-500 mt-1">{patientName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Formulaire */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Constantes vitales */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                            Constantes vitales
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            {champsPreConsultation.map((champ: any) => (
                                <div key={champ.nom}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {buildLabel(champ)}
                                    </label>
                                    <input
                                        type={champ.type === 'number' ? 'number' : 'text'}
                                        step={champ.type === 'number' ? '0.1' : undefined}
                                        value={formData[champ.nom] ?? ''}
                                        onChange={(e) => handleChange(champ.nom, e.target.value)}
                                        placeholder={champ.unite || ''}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Allergies */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                            Allergies
                        </h3>
                        <input
                            type="text"
                            value={formData.allergies}
                            onChange={(e) => handleChange('allergies', e.target.value)}
                            placeholder="Allergies connues..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>

                    {/* Observations */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                            Observations pré-consultation
                        </h3>
                        <textarea
                            value={formData.observations_pre_consultation}
                            onChange={(e) => handleChange('observations_pre_consultation', e.target.value)}
                            placeholder="Observations, remarques de l'assistante..."
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>

                    {/* Boutons */}
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Enregistrement...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Enregistrer
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PreConsultationForm;
