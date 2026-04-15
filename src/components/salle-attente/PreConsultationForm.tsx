import React, { useState, useEffect } from 'react';
import { doc, updateDoc, addDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import { X, ClipboardList, Save } from 'lucide-react';
import { format } from 'date-fns';

interface PreConsultationFormProps {
    entry: {
        id: string;
        patient_id: string;
        motif?: string;
        appointment_id?: string;
    };
    patientName: string;
    onClose: () => void;
}

export default function PreConsultationForm({ entry, patientName, onClose }: PreConsultationFormProps) {
    const { appUser } = useAuth();
    const { settings } = useSettings();
    const [loading, setLoading] = useState(false);
    const [patientData, setPatientData] = useState<any>(null);

    const [formData, setFormData] = useState({
        poids: '',
        tension_systolique: '',
        tension_diastolique: '',
        glycemie: '',
        temperature: '',
        saturation_o2: '',
        frequence_cardiaque: '',
        allergies: '',
        observations: '',
    });

    // Charger les données existantes du patient
    useEffect(() => {
        const loadPatient = async () => {
            try {
                const { onSnapshot: snap } = await import('firebase/firestore');
                const unsub = snap(doc(db, 'patients', entry.patient_id), (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setPatientData(data);
                        setFormData((prev) => ({
                            ...prev,
                            allergies: data.allergies || prev.allergies,
                            poids: data.poids || prev.poids,
                        }));
                    }
                });
                return unsub;
            } catch (err) {
                console.error('Erreur chargement patient:', err);
            }
        };

        // Charger pré-consult existante si reprise
        const loadExisting = async () => {
            try {
                const today = format(new Date(), 'yyyy-MM-dd');
                const q = query(
                    collection(db, 'consultations'),
                    where('patient_id', '==', entry.patient_id),
                    where('date_consultation', '==', today)
                );
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const data = snap.docs[0].data();
                    setFormData((prev) => ({
                        ...prev,
                        poids: data.poids || prev.poids,
                        tension_systolique: data.tension_systolique || (data.tension ? data.tension.split('/')[0] : '') || prev.tension_systolique,
                        tension_diastolique: data.tension_diastolique || (data.tension ? data.tension.split('/')[1] : '') || prev.tension_diastolique,
                        glycemie: data.glycemie || prev.glycemie,
                        temperature: data.temperature || prev.temperature,
                        saturation_o2: data.saturation_o2 || prev.saturation_o2,
                        frequence_cardiaque: data.frequence_cardiaque || prev.frequence_cardiaque,
                        allergies: data.allergies || prev.allergies,
                        observations: data.commentaire_assistante || prev.observations,
                    }));
                }
            } catch (err) {
                console.error('Erreur chargement consultation existante:', err);
            }
        };

        loadPatient();
        loadExisting();
    }, [entry.patient_id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const now = new Date();
            const today = format(now, 'yyyy-MM-dd');
            const tension = formData.tension_systolique && formData.tension_diastolique
                ? `${formData.tension_systolique}/${formData.tension_diastolique}`
                : '';

            // Chercher consultation existante
            const qConsult = query(
                collection(db, 'consultations'),
                where('patient_id', '==', entry.patient_id),
                where('date_consultation', '==', today)
            );
            const snapConsult = await getDocs(qConsult);

            const preConsultData = {
                poids: formData.poids,
                tension,
                tension_systolique: formData.tension_systolique,
                tension_diastolique: formData.tension_diastolique,
                glycemie: formData.glycemie,
                temperature: formData.temperature,
                saturation_o2: formData.saturation_o2,
                frequence_cardiaque: formData.frequence_cardiaque,
                allergies: formData.allergies,
                commentaire_assistante: formData.observations,
                statutConsultation: 'pre_consultation',
                motif: entry.motif || '',
                updated_at: now.toISOString(),
                updated_by: appUser?.uid,
            };

            let consultationId: string;
            if (!snapConsult.empty) {
                consultationId = snapConsult.docs[0].id;
                await updateDoc(doc(db, 'consultations', consultationId), preConsultData);
            } else {
                const newDoc = await addDoc(collection(db, 'consultations'), {
                    ...preConsultData,
                    patient_id: entry.patient_id,
                    date_consultation: today,
                    file_attente_id: entry.id,
                    created_by: appUser?.uid || 'unknown',
                    created_at: now.toISOString(),
                });
                consultationId = newDoc.id;
            }

            // Mettre à jour le patient
            await updateDoc(doc(db, 'patients', entry.patient_id), {
                allergies: formData.allergies,
                poids: formData.poids,
                updated_at: now.toISOString(),
            });

            // Mettre à jour la file d'attente : stocker pré-consult + consultation_id
            await updateDoc(doc(db, 'file_attente', entry.id), {
                consultation_id: consultationId,
                pre_consultation: {
                    poids: formData.poids,
                    tension,
                    glycemie: formData.glycemie,
                    temperature: formData.temperature,
                    saturation_o2: formData.saturation_o2,
                    frequence_cardiaque: formData.frequence_cardiaque,
                    allergies: formData.allergies,
                    observations: formData.observations,
                    effectuee_par: appUser?.uid,
                    effectuee_at: now.toISOString(),
                },
                heure_fin_pre_consultation: now.toISOString(),
                updated_at: now.toISOString(),
            });

            onClose();
        } catch (error) {
            console.error('Erreur sauvegarde pré-consultation:', error);
            alert('Erreur lors de l\'enregistrement de la pré-consultation.');
        } finally {
            setLoading(false);
        }
    };

    // Déterminer les champs dynamiques depuis les settings
    const dynamicFields = settings.champs_pre_consultation || [];
    const showField = (fieldName: string) =>
        dynamicFields.length === 0 || dynamicFields.some((f: any) => (typeof f === 'string' ? f : f.nom) === fieldName);

    return (
        <div className="fixed inset-0 bg-slate-900/50 z-50 overflow-y-auto flex justify-center items-start p-4 sm:p-6">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8 relative">
                <div className="flex justify-between items-center p-6 border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-xl">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-900 flex items-center">
                            <ClipboardList className="h-5 w-5 mr-2 text-yellow-600" />
                            Pré-consultation
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">{patientName}</p>
                        {entry.motif && <p className="text-xs text-indigo-600 mt-0.5">Motif : {entry.motif}</p>}
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                        <h4 className="text-sm font-semibold text-yellow-900 mb-3">Constantes vitales</h4>
                        <div className="grid grid-cols-2 gap-4">
                            {showField('poids') && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Poids (kg)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        name="poids"
                                        value={formData.poids}
                                        onChange={handleChange}
                                        placeholder="75.5"
                                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 bg-white"
                                    />
                                </div>
                            )}
                            {showField('tension') && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700">Tension systolique</label>
                                        <input
                                            type="number"
                                            name="tension_systolique"
                                            value={formData.tension_systolique}
                                            onChange={handleChange}
                                            placeholder="12"
                                            className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700">Tension diastolique</label>
                                        <input
                                            type="number"
                                            name="tension_diastolique"
                                            value={formData.tension_diastolique}
                                            onChange={handleChange}
                                            placeholder="8"
                                            className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 bg-white"
                                        />
                                    </div>
                                </>
                            )}
                            {showField('temperature') && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Température (°C)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        name="temperature"
                                        value={formData.temperature}
                                        onChange={handleChange}
                                        placeholder="37.0"
                                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 bg-white"
                                    />
                                </div>
                            )}
                            {showField('glycemie') && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Glycémie (g/L)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        name="glycemie"
                                        value={formData.glycemie}
                                        onChange={handleChange}
                                        placeholder="1.0"
                                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 bg-white"
                                    />
                                </div>
                            )}
                            {showField('saturation_o2') && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Saturation O2 (%)</label>
                                    <input
                                        type="number"
                                        name="saturation_o2"
                                        value={formData.saturation_o2}
                                        onChange={handleChange}
                                        placeholder="98"
                                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 bg-white"
                                    />
                                </div>
                            )}
                            {showField('frequence_cardiaque') && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700">Fréq. cardiaque (bpm)</label>
                                    <input
                                        type="number"
                                        name="frequence_cardiaque"
                                        value={formData.frequence_cardiaque}
                                        onChange={handleChange}
                                        placeholder="72"
                                        className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2 bg-white"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700">Allergies</label>
                        <input
                            type="text"
                            name="allergies"
                            value={formData.allergies}
                            onChange={handleChange}
                            placeholder="Pénicilline, Arachides..."
                            className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700">Observations pré-consultation</label>
                        <textarea
                            name="observations"
                            rows={3}
                            value={formData.observations}
                            onChange={handleChange}
                            placeholder="Patient à jeun, anxieux, accompagné par..."
                            className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                        />
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50"
                        >
                            <Save className="h-4 w-4 mr-2" />
                            {loading ? 'Enregistrement...' : 'Enregistrer la pré-consultation'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
