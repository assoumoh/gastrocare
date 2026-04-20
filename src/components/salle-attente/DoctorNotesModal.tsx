import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { X, FileText, ArrowRight, Loader2 } from 'lucide-react';

interface DoctorNotesModalProps {
    consultationId?: string;
    patientName: string;
    onContinue: () => void;
    onClose: () => void;
}

export default function DoctorNotesModal({
    consultationId,
    patientName,
    onContinue,
    onClose,
}: DoctorNotesModalProps) {
    const [loading, setLoading] = useState(true);
    const [consultationData, setConsultationData] = useState<any>(null);

    useEffect(() => {
        const fetchConsultation = async () => {
            if (!consultationId) {
                setLoading(false);
                return;
            }
            try {
                const snap = await getDoc(doc(db, 'consultations', consultationId));
                if (snap.exists()) {
                    setConsultationData(snap.data());
                }
            } catch (err) {
                console.error('Erreur chargement consultation:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchConsultation();
    }, [consultationId]);

    const notes = consultationData?.notes || '';
    const diagnostic = consultationData?.diagnostic_principal || '';
    const conduiteATenir = consultationData?.conduite_a_tenir || '';
    const synthese = consultationData?.synthese || '';
    const observations = consultationData?.observations || '';
    const noteAssistante = consultationData?.note_pour_assistante || '';


    const hasContent = notes || diagnostic || conduiteATenir || synthese || observations;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 z-50 max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <FileText className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">Notes du médecin</h3>
                            <p className="text-sm text-slate-500">{patientName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto grow">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                            <span className="ml-2 text-sm text-slate-500">Chargement...</span>
                        </div>
                    ) : !hasContent ? (
                        <div className="text-center py-8">
                            <FileText className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                            <p className="text-sm text-slate-500">Aucune note du médecin pour cette consultation.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {diagnostic && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                    <h4 className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1">Diagnostic</h4>
                                    <p className="text-sm text-slate-800">{diagnostic}</p>
                                </div>
                            )}
                            {conduiteATenir && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <h4 className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">Conduite à tenir</h4>
                                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{conduiteATenir}</p>
                                </div>
                            )}
                            {synthese && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <h4 className="text-xs font-semibold text-green-800 uppercase tracking-wider mb-1">Synthèse</h4>
                                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{synthese}</p>
                                </div>
                            )}
                            {observations && (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                    <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">Observations</h4>
                                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{observations}</p>
                                </div>
                            )}
                            {notes && (
                                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                                    <h4 className="text-xs font-semibold text-indigo-800 uppercase tracking-wider mb-1">Notes</h4>
                                    <p className="text-sm text-slate-800 whitespace-pre-wrap font-mono">{notes}</p>
                                </div>
                            )}
                            {noteAssistante && (
                                <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                                    <h4 className="text-xs font-semibold text-teal-800 uppercase tracking-wider mb-1">Message du médecin pour vous</h4>
                                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{noteAssistante}</p>
                                </div>
                            )}

                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-5 border-t border-slate-200 shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        Fermer
                    </button>
                    <button
                        onClick={onContinue}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                    >
                        Continuer
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
