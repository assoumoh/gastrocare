import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_CABINET_SETTINGS } from '../lib/defaultSettings';
import type { SettingsCabinet } from '../types';

export function useSettings() {
    const [settings, setSettings] = useState<SettingsCabinet>(DEFAULT_CABINET_SETTINGS);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const docRef = doc(db, 'settings', 'cabinet');

        const unsubscribe = onSnapshot(
            docRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data() as Partial<SettingsCabinet>;
                    // Merge avec les défauts pour garantir que tous les champs existent
                    setSettings({
                        ...DEFAULT_CABINET_SETTINGS,
                        ...data,
                        champs_pre_consultation:
                            data.champs_pre_consultation && data.champs_pre_consultation.length > 0
                                ? data.champs_pre_consultation
                                : DEFAULT_CABINET_SETTINGS.champs_pre_consultation,
                        creneaux_horaires:
                            data.creneaux_horaires && Object.keys(data.creneaux_horaires).length > 0
                                ? { ...DEFAULT_CABINET_SETTINGS.creneaux_horaires, ...data.creneaux_horaires }
                                : DEFAULT_CABINET_SETTINGS.creneaux_horaires,
                    });
                } else {
                    // Créer le document avec les valeurs par défaut
                    setDoc(docRef, {
                        ...DEFAULT_CABINET_SETTINGS,
                        updated_at: new Date().toISOString(),
                    }).catch((err) => console.error('Erreur création settings/cabinet:', err));
                }
                setLoading(false);
            },
            (error) => {
                console.error('Erreur lecture settings/cabinet:', error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    return { settings, loading };
}
