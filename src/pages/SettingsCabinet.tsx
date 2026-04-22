import React, { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../hooks/useSettings';
import { DEFAULT_CABINET_SETTINGS } from '../lib/defaultSettings';
import type { SettingsCabinet, ChampPreConsultation, CreneauHoraire } from '../types';
import { Save, Plus, Trash2, Clock, Stethoscope, CreditCard, ClipboardList } from 'lucide-react';

type TabKey = 'general' | 'horaires' | 'preconsult' | 'paiement';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: 'general', label: 'Général', icon: Stethoscope },
    { key: 'horaires', label: 'Horaires', icon: Clock },
    { key: 'preconsult', label: 'Pré-consultation', icon: ClipboardList },
    { key: 'paiement', label: 'Paiement', icon: CreditCard },
];

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const JOURS_LABELS: Record<string, string> = {
    lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi', jeudi: 'Jeudi',
    vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche',
};

const MODES_PAIEMENT_OPTIONS = [
    { value: 'especes', label: 'Espèces' },
    { value: 'carte', label: 'Carte bancaire' },
    { value: 'cheque', label: 'Chèque' },
    { value: 'virement', label: 'Virement' },
    { value: 'mutuelle', label: 'Mutuelle directe' },
];

// Liste exhaustive des spécialités médicales (France + Maroc + Généraliste)
const SPECIALITES_MEDICALES = [
    // --- Médecine générale ---
    'Médecine générale',
    // --- Spécialités médicales ---
    'Allergologie',
    'Anatomie et cytologie pathologiques',
    'Anesthésie-réanimation',
    'Angiologie - Médecine vasculaire',
    'Cardiologie',
    'Dermatologie et vénérologie',
    'Endocrinologie - Diabétologie - Nutrition',
    'Gastro-entérologie et hépatologie',
    'Génétique médicale',
    'Gériatrie - Gérontologie',
    'Gynécologie médicale',
    'Gynécologie-obstétrique',
    'Hématologie',
    'Hépatologie',
    'Immunologie clinique',
    'Infectiologie - Maladies infectieuses',
    'Médecine du sport',
    'Médecine du travail',
    'Médecine d\'urgence',
    'Médecine interne',
    'Médecine légale',
    'Médecine nucléaire',
    'Médecine physique et de réadaptation',
    'Néphrologie',
    'Neurologie',
    'Nutrition',
    'Oncologie médicale',
    'Oncologie radiothérapie',
    'Ophtalmologie',
    'Oto-rhino-laryngologie (ORL)',
    'Pédiatrie',
    'Pharmacologie clinique',
    'Pneumologie',
    'Psychiatrie',
    'Pédopsychiatrie',
    'Radiologie et imagerie médicale',
    'Rhumatologie',
    'Santé publique et médecine sociale',
    // --- Spécialités chirurgicales ---
    'Chirurgie cardiaque',
    'Chirurgie digestive - viscérale',
    'Chirurgie générale',
    'Chirurgie infantile - pédiatrique',
    'Chirurgie maxillo-faciale',
    'Chirurgie orthopédique et traumatologique',
    'Chirurgie plastique, reconstructrice et esthétique',
    'Chirurgie thoracique',
    'Chirurgie urologique',
    'Chirurgie vasculaire',
    'Neurochirurgie',
    // --- Spécialités dentaires ---
    'Chirurgie dentaire',
    'Orthodontie',
    'Parodontologie',
    // --- Biologie / Pharmacie ---
    'Biologie médicale',
    'Pharmacie',
    // --- Médecines complémentaires (reconnues au Maroc / France) ---
    'Médecine esthétique',
    'Médecine de la douleur - Algologie',
    'Médecine palliative',
    'Addictologie',
    'Sexologie',
    'Médecine tropicale',
    'Néonatologie',
    'Réanimation médicale',
    // --- Autre ---
    'Autre spécialité',
];

export default function SettingsCabinet() {
    const { appUser } = useAuth();
    const { settings, loading } = useSettings();
    const [activeTab, setActiveTab] = useState<TabKey>('general');
    const [formData, setFormData] = useState<SettingsCabinet>(DEFAULT_CABINET_SETTINGS);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [specialiteSearch, setSpecialiteSearch] = useState('');
    const [showSpecialiteDropdown, setShowSpecialiteDropdown] = useState(false);

    useEffect(() => {
        if (!loading) {
            setFormData({ ...settings });
        }
    }, [settings, loading]);

    const handleSave = async () => {
        setSaving(true);
        setSaveMessage('');
        try {
            await setDoc(doc(db, 'settings', 'cabinet'), {
                ...formData,
                updated_at: new Date().toISOString(),
                updated_by: appUser?.uid || '',
            });
            setSaveMessage('Paramètres enregistrés avec succès.');
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (error) {
            console.error('Erreur sauvegarde:', error);
            setSaveMessage('Erreur lors de la sauvegarde.');
        } finally {
            setSaving(false);
        }
    };

    const updateField = <K extends keyof SettingsCabinet>(key: K, value: SettingsCabinet[K]) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const updateCreneau = (jour: string, field: keyof CreneauHoraire, value: string | boolean) => {
        setFormData((prev) => ({
            ...prev,
            creneaux_horaires: {
                ...prev.creneaux_horaires,
                [jour]: {
                    ...prev.creneaux_horaires[jour],
                    [field]: value,
                },
            },
        }));
    };

    const updateChampPreConsult = (index: number, field: keyof ChampPreConsultation, value: string | boolean | number) => {
        setFormData((prev) => {
            const updated = [...prev.champs_pre_consultation];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, champs_pre_consultation: updated };
        });
    };

    const addChampPreConsult = () => {
        const newChamp: ChampPreConsultation = {
            id: `custom_${Date.now()}`,
            label: 'Nouveau champ',
            type: 'number',
            unite: '',
            actif: true,
            ordre: formData.champs_pre_consultation.length + 1,
        };
        setFormData((prev) => ({
            ...prev,
            champs_pre_consultation: [...prev.champs_pre_consultation, newChamp],
        }));
    };

    const removeChampPreConsult = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            champs_pre_consultation: prev.champs_pre_consultation.filter((_, i) => i !== index),
        }));
    };

    const toggleModePaiement = (mode: string) => {
        setFormData((prev) => {
            const modes = prev.modes_paiement.includes(mode)
                ? prev.modes_paiement.filter((m) => m !== mode)
                : [...prev.modes_paiement, mode];
            return { ...prev, modes_paiement: modes };
        });
    };

    // Filtrage des spécialités pour la recherche
    const filteredSpecialites = SPECIALITES_MEDICALES.filter((s) =>
        s.toLowerCase().includes(specialiteSearch.toLowerCase())
    );

    const handleSelectSpecialite = (specialite: string) => {
        updateField('specialite', specialite);
        setSpecialiteSearch('');
        setShowSpecialiteDropdown(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-slate-500">Chargement des paramètres...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="sm:flex sm:items-center sm:justify-between">
                <h1 className="text-2xl font-semibold text-slate-900">Paramètres du Cabinet</h1>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="mt-4 sm:mt-0 inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                >
                    <Save className="-ml-1 mr-2 h-4 w-4" />
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
            </div>

            {saveMessage && (
                <div className={`rounded-md p-3 text-sm ${saveMessage.includes('succès') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {saveMessage}
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-slate-200">
                <nav className="-mb-px flex space-x-8">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${activeTab === tab.key
                                    ? 'border-indigo-500 text-indigo-600'
                                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                                }`}
                        >
                            <tab.icon className="mr-2 h-4 w-4" />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab content */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                {/* ===== ONGLET GENERAL ===== */}
                {activeTab === 'general' && (
                    <div className="space-y-6">
                        <h2 className="text-lg font-medium text-slate-900">Informations générales</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Nom du cabinet</label>
                                <input type="text" value={formData.nom_cabinet || ''} onChange={(e) => updateField('nom_cabinet', e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            </div>

                            {/* ===== COMBOBOX SPÉCIALITÉ : texte libre + liste filtrée ===== */}
                            <div className="relative">
                                <label className="block text-sm font-medium text-slate-700">Spécialité</label>
                                <p className="text-xs text-slate-400 mt-0.5">Saisissez librement ou choisissez dans la liste</p>
                                <div className="mt-1 relative">
                                    <input
                                        type="text"
                                        value={showSpecialiteDropdown ? specialiteSearch : formData.specialite}
                                        onFocus={() => {
                                            setSpecialiteSearch(formData.specialite || '');
                                            setShowSpecialiteDropdown(true);
                                        }}
                                        onChange={(e) => {
                                            setSpecialiteSearch(e.target.value);
                                            updateField('specialite', e.target.value);
                                        }}
                                        placeholder="Ex: Gastro-entérologie et Hépatologie"
                                        className="w-full rounded-md border border-slate-300 px-3 py-2 pr-8 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    />
                                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </span>

                                    {showSpecialiteDropdown && (
                                        <div className="absolute z-50 mt-1 w-full rounded-md bg-white shadow-lg border border-slate-200">
                                            <ul className="max-h-60 overflow-auto py-1">
                                                {filteredSpecialites.length === 0 ? (
                                                    <li className="px-3 py-2 text-sm text-slate-500 italic">Aucune spécialité correspondante — valeur libre conservée</li>
                                                ) : (
                                                    filteredSpecialites.map((specialite) => (
                                                        <li
                                                            key={specialite}
                                                            onMouseDown={() => handleSelectSpecialite(specialite)}
                                                            className={`cursor-pointer px-3 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 ${formData.specialite === specialite ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'}`}
                                                        >
                                                            {specialite}
                                                        </li>
                                                    ))
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                                {showSpecialiteDropdown && (
                                    <div className="fixed inset-0 z-40" onClick={() => { setShowSpecialiteDropdown(false); setSpecialiteSearch(''); }} />
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700">Adresse</label>
                                <input type="text" value={formData.adresse_cabinet || ''} onChange={(e) => updateField('adresse_cabinet', e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Téléphone</label>
                                <input type="text" value={formData.telephone_cabinet || ''} onChange={(e) => updateField('telephone_cabinet', e.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Email</label>
                                <input type="email" value={formData.email_cabinet || ''} onChange={(e) => updateField('email_cabinet', e.target.value)} placeholder="cabinet@exemple.ma" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Numéro d'ordre</label>
                                <input type="text" value={formData.numero_ordre || ''} onChange={(e) => updateField('numero_ordre', e.target.value)} placeholder="Ex : 12345" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">INPE</label>
                                <input type="text" value={formData.inpe || ''} onChange={(e) => updateField('inpe', e.target.value)} placeholder="Identifiant National du Praticien" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            </div>
                        </div>

                        <h2 className="text-lg font-medium text-slate-900 pt-4">Paramètres de consultation</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Durée consultation (min)</label>
                                <input type="number" min={5} max={120} value={formData.duree_consultation} onChange={(e) => updateField('duree_consultation', parseInt(e.target.value) || 20)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Durée pré-consultation (min)</label>
                                <input type="number" min={1} max={30} value={formData.duree_pre_consultation} onChange={(e) => updateField('duree_pre_consultation', parseInt(e.target.value) || 5)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Durée créneau RDV (min)</label>
                                <input type="number" min={5} max={60} value={formData.duree_creneau_rdv} onChange={(e) => updateField('duree_creneau_rdv', parseInt(e.target.value) || 20)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Tarif consultation (MAD)</label>
                                <input type="number" min={0} value={formData.tarif_consultation} onChange={(e) => updateField('tarif_consultation', parseInt(e.target.value) || 0)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Délai de relance par défaut (jours)</label>
                                <input type="number" min={1} max={365} value={formData.delai_relance_defaut} onChange={(e) => updateField('delai_relance_defaut', parseInt(e.target.value) || 30)} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700">Message de rappel RDV</label>
                            <textarea rows={3} value={formData.message_rappel_rdv} onChange={(e) => updateField('message_rappel_rdv', e.target.value)} placeholder="Utilisez {patient_prenom}, {date_rdv}, {heure_rdv}" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            <p className="mt-1 text-xs text-slate-500">Variables : {'{patient_prenom}'}, {'{date_rdv}'}, {'{heure_rdv}'}</p>
                        </div>
                    </div>
                )}

                {/* ===== ONGLET HORAIRES ===== */}
                {activeTab === 'horaires' && (
                    <div className="space-y-6">
                        <h2 className="text-lg font-medium text-slate-900">Créneaux horaires hebdomadaires</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead>
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Jour</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Actif</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Début</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fin</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Pause début</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Pause fin</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {JOURS.map((jour) => {
                                        const creneau = formData.creneaux_horaires[jour] || { actif: false, debut: '09:00', fin: '18:00' };
                                        return (
                                            <tr key={jour} className={creneau.actif ? '' : 'opacity-50'}>
                                                <td className="px-4 py-3 text-sm font-medium text-slate-900">{JOURS_LABELS[jour]}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <input type="checkbox" checked={creneau.actif} onChange={(e) => updateCreneau(jour, 'actif', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input type="time" value={creneau.debut} onChange={(e) => updateCreneau(jour, 'debut', e.target.value)} disabled={!creneau.actif} className="block rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-100" />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input type="time" value={creneau.fin} onChange={(e) => updateCreneau(jour, 'fin', e.target.value)} disabled={!creneau.actif} className="block rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-100" />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input type="time" value={creneau.pause_debut || ''} onChange={(e) => updateCreneau(jour, 'pause_debut', e.target.value)} disabled={!creneau.actif} className="block rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-100" />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input type="time" value={creneau.pause_fin || ''} onChange={(e) => updateCreneau(jour, 'pause_fin', e.target.value)} disabled={!creneau.actif} className="block rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-100" />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ===== ONGLET PRE-CONSULTATION ===== */}
                {activeTab === 'preconsult' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-medium text-slate-900">Champs de pré-consultation</h2>
                            <button onClick={addChampPreConsult} className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                                <Plus className="-ml-0.5 mr-1.5 h-4 w-4" />
                                Ajouter un champ
                            </button>
                        </div>
                        <div className="space-y-3">
                            {formData.champs_pre_consultation.map((champ, index) => (
                                <div key={champ.id} className="flex items-center gap-4 rounded-lg border border-slate-200 p-3">
                                    <input type="checkbox" checked={champ.actif} onChange={(e) => updateChampPreConsult(index, 'actif', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                    <input type="text" value={champ.label} onChange={(e) => updateChampPreConsult(index, 'label', e.target.value)} className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-indigo-500" placeholder="Nom du champ" />
                                    <select value={champ.type} onChange={(e) => updateChampPreConsult(index, 'type', e.target.value)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-indigo-500">
                                        <option value="number">Nombre</option>
                                        <option value="text">Texte</option>
                                        <option value="boolean">Oui/Non</option>
                                    </select>
                                    <input type="text" value={champ.unite || ''} onChange={(e) => updateChampPreConsult(index, 'unite', e.target.value)} className="w-20 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-indigo-500" placeholder="Unité" />
                                    <input type="number" value={champ.ordre} onChange={(e) => updateChampPreConsult(index, 'ordre', parseInt(e.target.value) || 0)} className="w-16 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-indigo-500" title="Ordre" />
                                    <button onClick={() => removeChampPreConsult(index)} className="rounded p-1 text-red-500 hover:bg-red-50" title="Supprimer">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ===== ONGLET PAIEMENT ===== */}
                {activeTab === 'paiement' && (
                    <div className="space-y-6">
                        <h2 className="text-lg font-medium text-slate-900">Modes de paiement acceptés</h2>
                        <div className="space-y-3">
                            {MODES_PAIEMENT_OPTIONS.map((mode) => (
                                <label key={mode.value} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
                                    <input type="checkbox" checked={formData.modes_paiement.includes(mode.value)} onChange={() => toggleModePaiement(mode.value)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                    <span className="text-sm font-medium text-slate-700">{mode.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
