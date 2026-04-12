import React, { useState, useEffect } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../hooks/useSettings';
import { Settings, Clock, Calendar, CreditCard, Stethoscope, Save, Plus, Trash2, GripVertical } from 'lucide-react';
import { SettingsCabinet as SettingsCabinetType, ChampPreConsultation, CreneauHoraire } from '../types';

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const JOURS_LABELS: Record<string, string> = {
    lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi', jeudi: 'Jeudi',
    vendredi: 'Vendredi', samedi: 'Samedi', dimanche: 'Dimanche',
};

export default function SettingsCabinetPage() {
    const { appUser } = useAuth();
    const { settings: currentSettings, loading } = useSettings();
    const [formData, setFormData] = useState<SettingsCabinetType | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [activeTab, setActiveTab] = useState<'general' | 'horaires' | 'preconsult' | 'paiement'>('general');

    useEffect(() => {
        if (!loading && currentSettings) {
            setFormData({ ...currentSettings });
        }
    }, [currentSettings, loading]);

    if (loading || !formData) {
        return <div className="flex h-64 items-center justify-center text-slate-500">Chargement des paramètres...</div>;
    }

    const handleSave = async () => {
        setSaving(true);
        setSaveMessage('');
        try {
            await setDoc(doc(db, 'settings', 'cabinet'), {
                ...formData,
                updated_at: new Date().toISOString(),
                updated_by: appUser?.uid || '',
            });
            setSaveMessage('Paramètres enregistrés avec succès');
            setTimeout(() => setSaveMessage(''), 3000);
        } catch (error) {
            console.error('Erreur sauvegarde settings:', error);
            setSaveMessage('Erreur lors de la sauvegarde');
        } finally {
            setSaving(false);
        }
    };

    const updateField = (field: keyof SettingsCabinetType, value: any) => {
        setFormData(prev => prev ? { ...prev, [field]: value } : prev);
    };

    const updateCreneau = (jour: string, field: keyof CreneauHoraire, value: any) => {
        setFormData(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                creneaux_horaires: {
                    ...prev.creneaux_horaires,
                    [jour]: { ...prev.creneaux_horaires[jour], [field]: value },
                },
            };
        });
    };

    const updateChampPreConsult = (index: number, field: keyof ChampPreConsultation, value: any) => {
        setFormData(prev => {
            if (!prev) return prev;
            const champs = [...prev.champs_pre_consultation];
            champs[index] = { ...champs[index], [field]: value };
            return { ...prev, champs_pre_consultation: champs };
        });
    };

    const addChampPreConsult = () => {
        setFormData(prev => {
            if (!prev) return prev;
            const newChamp: ChampPreConsultation = {
                id: `custom_${Date.now()}`,
                label: '',
                type: 'number',
                unite: '',
                actif: true,
                ordre: prev.champs_pre_consultation.length + 1,
            };
            return { ...prev, champs_pre_consultation: [...prev.champs_pre_consultation, newChamp] };
        });
    };

    const removeChampPreConsult = (index: number) => {
        setFormData(prev => {
            if (!prev) return prev;
            const champs = prev.champs_pre_consultation.filter((_, i) => i !== index);
            return { ...prev, champs_pre_consultation: champs };
        });
    };

    const tabs = [
        { id: 'general' as const, label: 'Général', icon: Stethoscope },
        { id: 'horaires' as const, label: 'Horaires', icon: Calendar },
        { id: 'preconsult' as const, label: 'Pré-consultation', icon: Clock },
        { id: 'paiement' as const, label: 'Paiement', icon: CreditCard },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold text-slate-900 flex items-center">
                    <Settings className="h-7 w-7 mr-3 text-indigo-600" />
                    Paramètres du cabinet
                </h1>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
            </div>

            {saveMessage && (
                <div className={`p-3 rounded-md text-sm ${saveMessage.includes('Erreur') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                    {saveMessage}
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-slate-200">
                <nav className="-mb-px flex space-x-8">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                                    ? 'border-indigo-500 text-indigo-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                }`}
                        >
                            <tab.icon className={`-ml-0.5 mr-2 h-5 w-5 ${activeTab === tab.id ? 'text-indigo-500' : 'text-slate-400'}`} />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="bg-white shadow rounded-lg p-6">

                {/* ── TAB GÉNÉRAL ── */}
                {activeTab === 'general' && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-medium text-slate-900 border-b pb-2">Informations générales</h3>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Spécialité du cabinet</label>
                                <input
                                    type="text"
                                    value={formData.specialite}
                                    onChange={(e) => updateField('specialite', e.target.value)}
                                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Durée moyenne consultation (min)</label>
                                <input
                                    type="number"
                                    min={5}
                                    max={120}
                                    value={formData.duree_consultation}
                                    onChange={(e) => updateField('duree_consultation', parseInt(e.target.value) || 20)}
                                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                                />
                                <p className="mt-1 text-xs text-slate-500">Utilisée pour estimer les temps d'attente</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Durée pré-consultation (min)</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={30}
                                    value={formData.duree_pre_consultation}
                                    onChange={(e) => updateField('duree_pre_consultation', parseInt(e.target.value) || 5)}
                                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Délai de relance par défaut (jours)</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={365}
                                    value={formData.delai_relance_defaut}
                                    onChange={(e) => updateField('delai_relance_defaut', parseInt(e.target.value) || 30)}
                                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-slate-700">Message de rappel RDV</label>
                                <textarea
                                    rows={3}
                                    value={formData.message_rappel_rdv}
                                    onChange={(e) => updateField('message_rappel_rdv', e.target.value)}
                                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                                />
                                <p className="mt-1 text-xs text-slate-500">Variables disponibles : {'{patient_prenom}'}, {'{patient_nom}'}, {'{heure}'}, {'{date}'}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB HORAIRES ── */}
                {activeTab === 'horaires' && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-medium text-slate-900 border-b pb-2">Créneaux horaires</h3>
                        <div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700">Durée d'un créneau RDV (min)</label>
                                <input
                                    type="number"
                                    min={5}
                                    max={120}
                                    value={formData.duree_creneau_rdv}
                                    onChange={(e) => updateField('duree_creneau_rdv', parseInt(e.target.value) || 20)}
                                    className="mt-1 block w-48 rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                                />
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Jour</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actif</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Début</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fin</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Pause début</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Pause fin</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-200">
                                        {JOURS.map(jour => {
                                            const creneau = formData.creneaux_horaires[jour] || { actif: false, debut: '09:00', fin: '18:00' };
                                            return (
                                                <tr key={jour} className={!creneau.actif ? 'opacity-50' : ''}>
                                                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{JOURS_LABELS[jour]}</td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={creneau.actif}
                                                            onChange={(e) => updateCreneau(jour, 'actif', e.target.checked)}
                                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input type="time" value={creneau.debut} onChange={(e) => updateCreneau(jour, 'debut', e.target.value)}
                                                            disabled={!creneau.actif} className="rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-2 py-1" />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input type="time" value={creneau.fin} onChange={(e) => updateCreneau(jour, 'fin', e.target.value)}
                                                            disabled={!creneau.actif} className="rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-2 py-1" />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input type="time" value={creneau.pause_debut || ''} onChange={(e) => updateCreneau(jour, 'pause_debut', e.target.value)}
                                                            disabled={!creneau.actif} className="rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-2 py-1" />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input type="time" value={creneau.pause_fin || ''} onChange={(e) => updateCreneau(jour, 'pause_fin', e.target.value)}
                                                            disabled={!creneau.actif} className="rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-2 py-1" />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB PRÉ-CONSULTATION ── */}
                {activeTab === 'preconsult' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h3 className="text-lg font-medium text-slate-900">Champs de pré-consultation</h3>
                            <button
                                type="button"
                                onClick={addChampPreConsult}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                            >
                                <Plus className="h-4 w-4 mr-1" /> Ajouter un champ
                            </button>
                        </div>
                        <p className="text-sm text-slate-500">
                            Configurez les mesures que l'assistante doit saisir lors de la pré-consultation. Vous pouvez ajouter des champs personnalisés.
                        </p>
                        <div className="space-y-3">
                            {formData.champs_pre_consultation
                                .sort((a, b) => a.ordre - b.ordre)
                                .map((champ, index) => (
                                    <div key={champ.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-md border border-slate-200">
                                        <GripVertical className="h-5 w-5 text-slate-300 flex-shrink-0" />
                                        <input
                                            type="checkbox"
                                            checked={champ.actif}
                                            onChange={(e) => updateChampPreConsult(index, 'actif', e.target.checked)}
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <input
                                            type="text"
                                            value={champ.label}
                                            onChange={(e) => updateChampPreConsult(index, 'label', e.target.value)}
                                            placeholder="Nom du champ"
                                            className="flex-1 rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-1.5"
                                        />
                                        <select
                                            value={champ.type}
                                            onChange={(e) => updateChampPreConsult(index, 'type', e.target.value)}
                                            className="rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-2 py-1.5"
                                        >
                                            <option value="number">Nombre</option>
                                            <option value="text">Texte</option>
                                            <option value="select">Liste</option>
                                        </select>
                                        <input
                                            type="text"
                                            value={champ.unite || ''}
                                            onChange={(e) => updateChampPreConsult(index, 'unite', e.target.value)}
                                            placeholder="Unité"
                                            className="w-20 rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-2 py-1.5"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeChampPreConsult(index)}
                                            className="text-red-400 hover:text-red-600 p-1"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                {/* ── TAB PAIEMENT ── */}
                {activeTab === 'paiement' && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-medium text-slate-900 border-b pb-2">Paramètres de paiement</h3>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Tarif consultation par défaut (MAD)</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={formData.tarif_consultation}
                                    onChange={(e) => updateField('tarif_consultation', parseInt(e.target.value) || 0)}
                                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border px-3 py-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Modes de paiement acceptés</label>
                                <div className="mt-2 space-y-2">
                                    {['especes', 'carte', 'cheque', 'virement'].map(mode => (
                                        <label key={mode} className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={formData.modes_paiement.includes(mode)}
                                                onChange={(e) => {
                                                    const modes = e.target.checked
                                                        ? [...formData.modes_paiement, mode]
                                                        : formData.modes_paiement.filter(m => m !== mode);
                                                    updateField('modes_paiement', modes);
                                                }}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="ml-2 text-sm text-slate-700 capitalize">{mode === 'especes' ? 'Espèces' : mode}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
