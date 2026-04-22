import React, { useState } from 'react';
import {
    addDoc,
    collection,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../hooks/useSettings';
import { buildDocuments, printDocuments } from '../../utils/examPrint';
import {
    X,
    Plus,
    Trash2,
    Printer,
    Loader2,
    SkipForward,
    Save,
    CheckCircle,
} from 'lucide-react';

interface ExamRequestModalProps {
    patientId: string;
    patientName: string;
    consultationId?: string;
    onComplete: () => void;
    onClose: () => void;
}

interface ExamEntry {
    type_examen: string;
    nom_examen: string;
    commentaire: string;
}

const EXAM_TYPES: Record<string, string[]> = {
    Biologie: [
        'NFS', 'Bilan hépatique', 'Bilan rénal', 'Ionogramme', 'CRP',
        'VS', 'Glycémie', 'HbA1c', 'Bilan lipidique', 'TSH',
        'Ferritine', 'Vitamine B12', 'Folates', 'Albumine',
        'TP/INR', 'Sérologie Hépatite B', 'Sérologie Hépatite C',
        'Sérologie HIV', 'Calprotectine fécale', 'Hémoccult',
        'Marqueurs tumoraux (ACE, CA19-9, AFP)', 'Autre biologie',
    ],
    Imagerie: [
        'Échographie abdominale', 'Scanner abdominal', 'IRM abdominale',
        'IRM hépatique', 'ASP', 'Transit baryté',
        'Entéro-IRM', 'Entéro-scanner', 'Autre imagerie',
    ],
    Endoscopie: [
        'FOGD (Fibroscopie)', 'Coloscopie', 'Rectosigmoïdoscopie',
        'Écho-endoscopie', 'CPRE', 'Entéroscopie',
        'Vidéocapsule', 'Autre endoscopie',
    ],
    Fonctionnel: [
        'pHmétrie', 'Manométrie œsophagienne',
        'Manométrie ano-rectale', 'Breath test',
        'Test respiratoire au lactose', 'Électrogastrographie',
        'Autre examen fonctionnel',
    ],
    Anapath: [
        'Biopsie gastrique', 'Biopsie colique', 'Biopsie hépatique',
        'Cytologie', 'Autre anapath',
    ],
    Autre: ['Autre'],
};

// ─────────────────────────────────────────────────────────────────────────────

const ExamRequestModal: React.FC<ExamRequestModalProps> = ({
    patientId,
    patientName,
    consultationId,
    onComplete,
    onClose,
}) => {
    const { appUser } = useAuth();
    const { settings } = useSettings();
    const [exams, setExams] = useState<ExamEntry[]>([
        { type_examen: 'Biologie', nom_examen: EXAM_TYPES['Biologie'][0], commentaire: '' },
    ]);
    const [savedExams, setSavedExams] = useState<ExamEntry[]>([]);
    const [saving, setSaving]         = useState(false);
    const [saved, setSaved]           = useState(false);

    const handleAddExam = () => {
        setExams(prev => [...prev, { type_examen: 'Biologie', nom_examen: EXAM_TYPES['Biologie'][0], commentaire: '' }]);
    };

    const handleRemoveExam = (index: number) => {
        setExams(prev => prev.filter((_, i) => i !== index));
    };

    const handleChangeExam = (index: number, field: keyof ExamEntry, value: string) => {
        setExams(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            if (field === 'type_examen') {
                const names = EXAM_TYPES[value] || ['Autre'];
                updated[index].nom_examen = names[0];
            }
            return updated;
        });
    };

    const handleSave = async () => {
        if (exams.length === 0) { onComplete(); return; }

        setSaving(true);
        try {
            const now      = new Date().toISOString();
            const today    = now.split('T')[0];
            // Identifiant unique partagé par tous les examens de cette demande
            const demandeId = `dmnd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

            for (const exam of exams) {
                await addDoc(collection(db, 'exams'), {
                    patient_id:      patientId,
                    consultation_id: consultationId || null,
                    demande_id:      demandeId,
                    type_examen:     exam.type_examen,
                    nom_examen:      exam.nom_examen,
                    commentaire:     exam.commentaire || '',
                    statut:          'demandé',
                    date_demande:    today,
                    date_examen:     today,
                    created_by:      appUser?.uid || '',
                    created_at:      now,
                    updated_at:      now,
                });
            }

            setSavedExams([...exams]);
            setSaved(true);
        } catch (error) {
            console.error('Erreur sauvegarde examens:', error);
            alert('Erreur lors de la sauvegarde des examens.');
        } finally {
            setSaving(false);
        }
    };

    // ======= VUE APRÈS SAUVEGARDE =======
    if (saved) {
        const documents = buildDocuments(savedExams);

        return (
            <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">

                    {/* Header */}
                    <div className="flex items-center justify-between p-5 border-b border-slate-200">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-slate-900">
                                    {savedExams.length} examen{savedExams.length > 1 ? 's' : ''} enregistré{savedExams.length > 1 ? 's' : ''}
                                </h2>
                                <p className="text-xs text-slate-500">
                                    {documents.length} document{documents.length > 1 ? 's' : ''} prêt{documents.length > 1 ? 's' : ''} à imprimer
                                </p>
                            </div>
                        </div>
                        <button onClick={onComplete} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Récapitulatif des documents */}
                    <div className="p-5 space-y-3 max-h-[50vh] overflow-y-auto">
                        {documents.map((docu, idx) => (
                            <div key={docu.key} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">
                                    {idx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800">
                                        {docu.exams.length === 1 ? docu.exams[0].nom_examen : `Biologie (${docu.exams.length} examens)`}
                                    </p>
                                    {docu.note && (
                                        <p className="text-xs text-slate-500 mt-0.5 truncate">Note : {docu.note}</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-center p-5 border-t border-slate-200">
                        <button
                            onClick={() => printDocuments(documents, patientName, settings)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            <Printer className="w-4 h-4" />
                            Imprimer {documents.length} document{documents.length > 1 ? 's' : ''}
                        </button>
                        <button
                            onClick={onComplete}
                            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                        >
                            Continuer
                            <SkipForward className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ======= VUE FORMULAIRE SAISIE =======
    return (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Demande d'examens</h2>
                        <p className="text-sm text-gray-500 mt-1">{patientName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Liste des examens */}
                <div className="p-6 space-y-4">
                    {exams.map((exam, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-gray-700">Examen #{index + 1}</span>
                                {exams.length > 1 && (
                                    <button onClick={() => handleRemoveExam(index)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Type d'examen</label>
                                    <select
                                        value={exam.type_examen}
                                        onChange={e => handleChangeExam(index, 'type_examen', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {Object.keys(EXAM_TYPES).map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Nom de l'examen</label>
                                    <select
                                        value={exam.nom_examen}
                                        onChange={e => handleChangeExam(index, 'nom_examen', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {(EXAM_TYPES[exam.type_examen] || ['Autre']).map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Commentaire (optionnel)</label>
                                <input
                                    type="text"
                                    value={exam.commentaire}
                                    onChange={e => handleChangeExam(index, 'commentaire', e.target.value)}
                                    placeholder="Précisions, contexte clinique..."
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    ))}

                    <button
                        onClick={handleAddExam}
                        className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Ajouter un examen
                    </button>
                </div>

                {/* Boutons */}
                <div className="flex justify-between items-center p-6 border-t">
                    <button
                        onClick={onComplete}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        <SkipForward className="w-4 h-4" />
                        Passer sans examen
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || exams.length === 0}
                        className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {saving ? (
                            <><Loader2 className="w-4 h-4 animate-spin" />Enregistrement...</>
                        ) : (
                            <><Save className="w-4 h-4" />Enregistrer les examens</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExamRequestModal;
