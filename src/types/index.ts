// ============================================================
// GastroCare Pro — Types centralisés
// ============================================================

// --- Utilisateur ---
export interface AppUser {
    uid: string;
    email: string;
    nom: string;
    prenom: string;
    role: 'admin' | 'medecin' | 'assistante';
    actif: boolean;
    date_creation: string;
    specialite?: string;
    cabinet_id?: string;
}

// --- Patient ---
export interface Patient {
    id: string;
    nom: string;
    prenom: string;
    date_naissance?: string;
    sexe?: string;
    telephone?: string;
    email?: string;
    adresse?: string;
    ville?: string;
    cin?: string;
    mutuelle?: string;
    numero_mutuelle?: string;
    groupe_sanguin?: string;
    allergies?: string;
    antecedents?: string;
    statut?: string;
    deleted?: boolean;
    deletedAt?: string;
    deletedBy?: string;
    // Multi-médecin (futur)
    cabinet_id?: string;
    medecin_referent?: string;
    // Suivi long terme
    suivi_long_terme?: boolean;
    frequence_suivi?: number;
    prochaine_relance?: string;
    created_at?: string;
    updated_at?: string;
}

// --- Rendez-vous ---
export type TypeRdv = 'consultation' | 'suivi' | 'resultat' | 'urgence' | 'teleconsultation';
export type SourceRdv = 'telephone' | 'surplace' | 'en_ligne';
export type StatutRdv = 'planifie' | 'confirme' | 'en_salle' | 'en_pre_consultation' | 'en_consultation' | 'termine' | 'annule' | 'no_show';

export interface Appointment {
    id: string;
    patient_id: string;
    date_rdv: string;
    heure_rdv: string;
    statut: StatutRdv;
    motif?: string;
    notes?: string;
    type_rdv?: TypeRdv;
    duree_prevue?: number;
    rappel_envoye?: boolean;
    source?: SourceRdv;
    created_by: string;
    created_at: string;
    updated_at: string;
}

// --- Pré-consultation ---
export interface PreConsultationData {
    poids?: number;
    tension_systolique?: number;
    tension_diastolique?: number;
    glycemie?: number;
    temperature?: number;
    saturation_o2?: number;
    frequence_cardiaque?: number;
    notes_assistante?: string;
    documents_importes?: string[];
    effectuee_par?: string;
    effectuee_at?: string;
}

// --- Post-consultation ---
export interface PostConsultationData {
    ordonnance_imprimee?: boolean;
    examens_demandes?: boolean;
    prochain_rdv_pris?: boolean;
    relance_programmee?: boolean;
    paiement_effectue?: boolean;
    notes?: string;
    effectuee_par?: string;
    effectuee_at?: string;
}

// --- File d'attente ---
export type StatutFileAttente = 'en_attente' | 'en_pre_consultation' | 'pret' | 'en_consultation' | 'termine' | 'annule';
export type PrioriteFileAttente = 'normale' | 'urgente' | 'prioritaire';

export interface FileAttenteEntry {
    id: string;
    patient_id: string;
    appointment_id?: string;
    date: string;
    numero_ordre: number;
    heure_arrivee: string;
    statut: StatutFileAttente;
    priorite: PrioriteFileAttente;
    motif?: string;
    pre_consultation?: PreConsultationData;
    post_consultation?: PostConsultationData;
    temps_attente_estime?: number;
    created_by: string;
    created_at: string;
    updated_at: string;
}

// --- Relances ---
export type StatutRelance = 'a_faire' | 'en_cours' | 'fait' | 'injoignable' | 'annule';
export type TypeRelance = 'suivi' | 'resultat_examen' | 'rappel_rdv' | 'renouvellement' | 'autre';

export interface Relance {
    id: string;
    patient_id: string;
    consultation_id?: string;
    examen_id?: string;
    date_relance: string;
    motif: string;
    type: TypeRelance;
    statut: StatutRelance;
    resultat_notes?: string;
    created_by: string;
    created_at: string;
    updated_at: string;
}

// --- Paramètres Cabinet ---
export interface ChampPreConsultation {
    id: string;
    label: string;
    type: 'number' | 'text' | 'boolean';
    unite?: string;
    actif: boolean;
    ordre: number;
}

export interface CreneauHoraire {
    actif: boolean;
    debut: string;
    fin: string;
    pause_debut?: string;
    pause_fin?: string;
}

export interface SettingsCabinet {
    specialite: string;
    nom_cabinet?: string;
    adresse_cabinet?: string;
    telephone_cabinet?: string;
    duree_consultation: number;
    duree_pre_consultation: number;
    duree_creneau_rdv: number;
    tarif_consultation: number;
    delai_relance_defaut: number;
    message_rappel_rdv: string;
    modes_paiement: string[];
    champs_pre_consultation: ChampPreConsultation[];
    creneaux_horaires: Record<string, CreneauHoraire>;
    updated_at?: string;
    updated_by?: string;
}

// --- Consultation ---
export interface Consultation {
    id: string;
    patient_id: string;
    date_consultation: string;
    motif?: string;
    examen_clinique?: string;
    diagnostic?: string;
    conduite_a_tenir?: string;
    notes?: string;
    statutConsultation?: string;
    file_attente_id?: string;
    pre_consultation_data?: PreConsultationData;
    created_by: string;
    created_at: string;
    updated_at: string;
}

// --- Paiement ---
export interface Payment {
    id: string;
    patient_id: string;
    consultation_id?: string;
    montant: number;
    mode_paiement: string;
    date_paiement: string;
    notes?: string;
    created_by: string;
    created_at: string;
    updated_at: string;
}
