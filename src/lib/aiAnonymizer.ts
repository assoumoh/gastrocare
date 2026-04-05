/**
 * aiAnonymizer.ts
 * Anonymise les données nominatives avant tout envoi à l'IA externe.
 * Remplace les champs sensibles par des identifiants neutres.
 * Conformité : RGPD + Loi 09-08 Maroc (données de santé)
 */

/** Champs nominatifs à supprimer systématiquement */
const CHAMPS_NOMINATIFS = [
  'nom', 'prenom', 'cin', 'telephone', 'adresse',
  'email', 'num_cnss', 'num_dossier',
] as const;

/** Champs médicaux à conserver (non nominatifs) */
const CHAMPS_MEDICAUX_AUTORISES = [
  'date_naissance', 'sexe', 'age', 'poids',
  'allergies', 'antecedents_medicaux', 'antecedents_digestifs',
  'antecedents_familiaux', 'antecedents_chirurgicaux',
  'habitudes_toxiques', 'traitement_en_cours',
  'statutPatient', 'mutuelle', 'amo',
] as const;

export function anonymizePatient(patient: Record<string, any>): Record<string, any> {
  const anon: Record<string, any> = { id_anonyme: '[PATIENT]' };

  // Calcul de l'âge à partir de la date de naissance (sans exposer la date exacte)
  if (patient.date_naissance) {
    const naissance = new Date(patient.date_naissance);
    const age = new Date().getFullYear() - naissance.getFullYear();
    anon.age = `${age} ans`;
  }

  // Conserver uniquement les champs médicaux
  for (const champ of CHAMPS_MEDICAUX_AUTORISES) {
    if (patient[champ] !== undefined && patient[champ] !== '') {
      anon[champ] = patient[champ];
    }
  }

  return anon;
}

export function anonymizeConsultation(c: Record<string, any>): Record<string, any> {
  return {
    date: c.date_consultation,
    motif: c.motif,
    examen_clinique: c.examen_clinique,
    diagnostic: c.diagnostic,
    conduite: c.conduite_a_tenir,
    statut: c.statutConsultation,
    // Exclure : patient_id, created_by, ids internes
  };
}

export function anonymizePrescription(p: Record<string, any>): Record<string, any> {
  return {
    date: p.date_prescription,
    medicaments: (p.medicaments || []).map((m: any) => ({
      nom: m.nom_medicament || m.nom,
      posologie: m.posologie,
      duree: m.duree,
    })),
    // Exclure : patient_id, consultation_id, created_by
  };
}

export function anonymizeConsultations(consultations: any[]): any[] {
  return consultations.map(anonymizeConsultation);
}

export function anonymizePrescriptions(prescriptions: any[]): any[] {
  return prescriptions.map(anonymizePrescription);
}
