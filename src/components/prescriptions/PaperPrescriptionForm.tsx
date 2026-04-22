import React, { useState } from 'react';
import { addDoc, updateDoc, doc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { X, Save, Loader2, FileUp, FileSignature } from 'lucide-react';

interface PaperPrescriptionFormProps {
    patientId: string;
    prescription?: any; // si présent → mode édition
    onClose: () => void;
}

export default function PaperPrescriptionForm({
    patientId,
    prescription,
    onClose,
}: PaperPrescriptionFormProps) {
    const { appUser } = useAuth();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        date_prescription: prescription?.date_prescription || new Date().toISOString().split('T')[0],
        prescripteur: prescription?.prescripteur || '',
        contenu: prescription?.contenu || '',
        commentaire: prescription?.commentaire || '',
    });
    const [file, setFile] = useState<File | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.contenu.trim() && !file) {
            alert('Veuillez saisir le contenu de l\'ordonnance ou joindre un fichier PDF.');
            return;
        }

        setLoading(true);
        try {
            let fichier_url = prescription?.fichier_url || '';
            let fichier_nom = prescription?.fichier_nom || '';
            let storage_path = prescription?.storage_path || '';

            if (file) {
                storage_path = `prescriptions_papier/${patientId}/${Date.now()}_${file.name}`;
                const storageRef = ref(storage, storage_path);
                await uploadBytes(storageRef, file);
                fichier_url = await getDownloadURL(storageRef);
                fichier_nom = file.name;
            }

            const now = new Date().toISOString();
            const payload: Record<string, any> = {
                patient_id: patientId,
                date_prescription: formData.date_prescription,
                prescripteur: formData.prescripteur.trim(),
                contenu: formData.contenu.trim(),
                commentaire: formData.commentaire.trim(),
                fichier_url,
                fichier_nom,
                storage_path,
                type: 'papier', // flag distinctif
                medicaments: [], // vide, pour compat avec l'affichage existant
                updated_at: now,
                updated_by: appUser?.uid || '',
            };

            if (prescription?.id) {
                await updateDoc(doc(db, 'prescriptions', prescription.id), payload);
            } else {
                await addDoc(collection(db, 'prescriptions'), {
                    ...payload,
                    created_by: appUser?.uid || '',
                    created_at: now,
                });
            }

            onClose();
        } catch (err) {
            console.error('Erreur sauvegarde ordonnance papier:', err);
            alert('Erreur lors de la sauvegarde.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
                <div className="flex justify-between items-center p-5 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <FileSignature className="w-5 h-5 text-amber-700" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">
                                {prescription ? 'Modifier' : 'Nouvelle'} ordonnance papier (historique)
                            </h2>
                            <p className="text-xs text-slate-500">
                                Pour répertorier une ordonnance externe ou antérieure
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                            <input
                                required
                                type="date"
                                name="date_prescription"
                                value={formData.date_prescription}
                                onChange={handleChange}
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Prescripteur</label>
                            <input
                                type="text"
                                name="prescripteur"
                                value={formData.prescripteur}
                                onChange={handleChange}
                                placeholder="Nom du médecin prescripteur"
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Contenu de l'ordonnance
                        </label>
                        <textarea
                            name="contenu"
                            rows={6}
                            value={formData.contenu}
                            onChange={handleChange}
                            placeholder="Ex: Doliprane 1000mg 3x/j pendant 5 jours, Spasfon 1cp matin et soir..."
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                        <p className="mt-1 text-xs text-slate-400">Saisie libre — traitement prescrit</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Commentaire</label>
                        <input
                            type="text"
                            name="commentaire"
                            value={formData.commentaire}
                            onChange={handleChange}
                            placeholder="Contexte, source, remarque..."
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                            Fichier PDF / image (optionnel)
                        </label>
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-md cursor-pointer hover:bg-slate-50 text-sm text-slate-600">
                                <FileUp className="w-4 h-4" />
                                {file ? file.name : 'Choisir un fichier'}
                                <input
                                    type="file"
                                    accept=".pdf,image/*"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    className="hidden"
                                />
                            </label>
                            {prescription?.fichier_url && !file && (
                                <a
                                    href={prescription.fichier_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-indigo-600 hover:underline"
                                >
                                    Voir fichier actuel : {prescription.fichier_nom || 'fichier'}
                                </a>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
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
}
