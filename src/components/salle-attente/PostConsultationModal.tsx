import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { X, CheckSquare, Square } from 'lucide-react';

interface PostConsultationModalProps {
    entryId: string;
    patientName: string;
    appointmentId?: string;
    onClose: () => void;
}

export default function PostConsultationModal({ entryId, patientName, appointmentId, onClose }: PostConsultationModalProps) {
    const { appUser } = useAuth();
    const [saving, setSaving] = useState(false);
    const [checks, setChecks] = useState({
        ordonnance_imprimee: false,
        examens_demandes: false,
        prochain_rdv_pris: false,
        relance_programmee: false,
        paiement_effectue: false,
    });
    const [notes, setNotes] = useState('');

    const toggle = (key: keyof typeof checks) => {
        setChecks(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const now = new Date().toISOString();
            await updateDoc(doc(db, 'file_attente', entryId), {
                statut: 'termine',
                post_consultation: {
                    ...checks,
                    notes,
                    effectuee_par: appUser?.uid,
                    effectuee_at: now,
                },
                updated_at: now,
            });
            if (appointmentId) {
                await updateDoc(doc(db, 'appointments', appointmentId), {
                    statut: 'réalisé',
                    updated_at: now,
                });
            }
            onClose();
        } catch (err) {
            console.error('Erreur post-consultation:', err);
            alert('Erreur lors de la sauvegarde.');
        } finally {
            setSaving(false);
        }
    };

    const items: { key: keyof typeof checks; label: string }[] = [
        { key: 'ordonnance_imprimee', label: 'Ordonnance imprimée et remise' },
        { key: 'examens_demandes', label: 'Examens complémentaires demandés' },
        { key: 'prochain_rdv_pris', label: 'Prochain rendez-vous fixé' },
        { key: 'relance_programmee', label: 'Relance / suivi programmé' },
        { key: 'paiement_effectue', label: 'Paiement effectué' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 z-50">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-medium text-slate-900">Fin de consultation</h3>
                        <p className="text-sm text-slate-500">{patientName}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
                </div>

                <div className="space-y-3 mb-4">
                    {items.map(({ key, label }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => toggle(key)}
                            className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left"
                        >
                            {checks[key]
                                ? <CheckSquare className="h-5 w-5 text-green-600 flex-shrink-0" />
                                : <Square className="h-5 w-5 text-slate-300 flex-shrink-0" />
                            }
                            <span className={`text-sm ${checks[key] ? 'text-slate-900 font-medium' : 'text-slate-600'}`}>{label}</span>
                        </button>
                    ))}
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optionnel)</label>
                    <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Remarques particulières..."
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                </div>

                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50">
                        Annuler
                    </button>
                    <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                        {saving ? 'Enregistrement...' : 'Terminer'}
                    </button>
                </div>
            </div>
        </div>
    );
}
