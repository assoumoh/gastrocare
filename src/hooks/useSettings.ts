import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { SettingsCabinet } from '../types';
import { DEFAULT_CABINET_SETTINGS } from '../lib/defaultSettings';

export function useSettings() {
    const [settings, setSettings] = useState<SettingsCabinet>(DEFAULT_CABINET_SETTINGS);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onSnapshot(
            doc(db, 'settings', 'cabinet'),
            (docSnap) => {
                if (docSnap.exists()) {
                    // Fusionner avec les valeurs par défaut (pour les champs manquants)
                    setSettings({ ...DEFAULT_CABINET_SETTINGS, ...docSnap.data() } as SettingsCabinet);
                } else {
                    // Premier lancement : créer les settings par défaut
                    setDoc(doc(db, 'settings', 'cabinet'), DEFAULT_CABINET_SETTINGS);
                    setSettings(DEFAULT_CABINET_SETTINGS);
                }
                setLoading(false);
            },
            (error) => {
                console.error('Erreur chargement settings:', error);
                setSettings(DEFAULT_CABINET_SETTINGS);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    return { settings, loading };
}
