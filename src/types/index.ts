// ================================================================
// Types centralisés — GastroCare Pro
// ================================================================

// ── Utilisateur ──
export interface AppUser {
    id: string;
    uid: string;
    email: string;
    nom: string;
    prenom: string;
    role: 'medecin' | 'assistante' | 'admin';
    actif: boolean;
    date_creation: string;
}

// ── Patient ──
export interface Patient {
    id: string;
    nom: string;
    prenom: string;
    date_naissance?: string;
    sexe?: string;
    cin?: string;
    telephone: string;
    adresse?: string;
    email?: string;
    profession?: string;
    statut_familial?: string;
    num_dossier?: string;
    mutuelle?: string;
    amo?: string;
    num_cnss?: string;
    origine_patient?: string;
    detail_origine?: string;
    allergies?: string;
    poids?: number;
    antecedents_medicaux?: string;
    antecedents_digestifs?: string;
    antecedents_familiaux?: string;
    antecedents_chirurgicaux?: string;
    habitudes_toxiques?: string;
    traitement_en_cours?: string;
    traitements_chroniques?: string;
    observations_medecin?: string;
    statutPatient?: 'nouveau_patient' | 'patient_habituel';
    suivi_long_terme?: boolean;
    frequence_suivi?: 'mensuel' | 'trimestriel' | 'semestriel' | 'annuel';
    prochaine_relance?: string;
    medecin_referent?: string;
    deleted?: boolean;
    deletedAt?: string;
    deletedBy?: string;
    created_by: string;
    created_at: string;
    updated_at: string;
}

// ── Rendez-vous ──
export type TypeRdv = 'consultation' | 'suivi' | 'resultat_examen' | 'teleconsultation' | 'urgence';
export type SourceRdv = 'telephone' | 'sur_place' | 'en_ligne';

export interface Appointment {
    id: string;
    patient_id: string;
    date_rdv: string;
    heure_rdv: string;
    motif?: string;
    statut: string;
    type_rdv?: TypeRdv;
    duree_prevue?: number;
    rappel_envoye?: boolean;
    source?: SourceRdv;
    created_by: string;
    created_at: string;
    updated_at: string;
}

// ── File d'attente ──
export type StatutFileAttente = 'en_attente' | 'pre_consultation' | 'pret' | 'en_consultation' | 'termine';
export type Priorite = 'normal' | 'urgent';

export interface PreConsultationData {
    poids?: number;
    tension_systolique?: number;
    tension_diastolique?: number;
    glycemie?: number;
    temperature?: number;
    saturation_o2?: number;
    notes_assistante?: string;
    documents_apportes?: string[];
    completed_at?: string;
    completed_by?: string;
    [key: string]: any;
}

export interface PostConsultationData {
    ordonnance_imprimee: boolean;
    examens_imprimes: boolean;
    prochain_rdv_pris: boolean;
    relance_saisie: boolean;
    paiement_enregistre: boolean;
    completed_at?: string;
    completed_by?: string;
}

export interface FileAttenteEntry {
    id: string;
    patient_id: string;
    appointment_id?: string;
    date: string;
    numero_ordre: number;
    heure_arrivee: string;
    statut: StatutFileAttente;
    priorite: Priorite;
    motif?: string;
    pre_consultation: PreConsultationData;
    post_consultation: PostConsultationData;
    temps_attente_estime?: number;
    created_by: string;
    created_at: string;
    updated_at: string;
}

// ── Relance ──
export type StatutRelance = 'a_faire' | 'appele_rdv_pris' | 'appele_injoignable' | 'rappeler' | 'sms_envoye' | 'terminee';
export type TypeRelance = 'resultat_examen' | 'suivi' | 'rdv' | 'autre';

export interface Relance {
    id: string;
    patient_id: string;
    date_relance: string;
    motif: string;
    type: TypeRelance;
    statut: StatutRelance;
    resultat_notes?: string;
    consultation_id?: string;
    examen_id?: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    completed_at?: string;
    completed_by?: string;
}

// ── Paramètres Cabinet ──
export interface ChampPreConsultation {
    id: string;
    label: string;
    type: 'number' | 'text' | 'select';
    unite?: string;
    actif: boolean;
    ordre: number;
    options?: string[];
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

// ── Consultation ──
export interface Consultation {
    id: string;
    patient_id: string;
    date_consultation: string;
    motif?: string;
    examen_clinique?: string;
    diagnostic_principal?: string;
    conduite_a_tenir?: string;
    statutConsultation?: string;
    file_attente_id?: string;
    pre_consultation_data?: PreConsultationData;
    created_by: string;
    created_at: string;
    updated_at: string;
}

// ── Paiement ──
export interface Payment {
    id: string;
    patient_id: string;
    montant: number;
    mode_paiement: string;
    statut_paiement: string;
    type_paiement?: string;
    date_paiement: string;
    reference?: string;
    created_by: string;
    created_at: string;
}
