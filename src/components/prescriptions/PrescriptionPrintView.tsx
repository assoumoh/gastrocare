import React, { useEffect } from 'react';
import { X, Printer } from 'lucide-react';

interface PrescriptionPrintViewProps {
  prescription: any;
  patient: any;
  medicaments: Record<string, any>;
  onClose: () => void;
}

export default function PrescriptionPrintView({ prescription, patient, medicaments, onClose }: PrescriptionPrintViewProps) {
  
  const handlePrint = () => {
    window.print();
  };

  const calculateAge = (birthDateString: string) => {
    if (!birthDateString) return '';
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `${age} ans`;
  };

  const age = calculateAge(patient?.date_naissance);

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 sm:p-6 z-50 overflow-y-auto print:bg-white print:p-0">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-8 relative print:shadow-none print:my-0 print:max-w-none print:rounded-none flex flex-col max-h-[90vh] print:max-h-none print:h-auto">
        
        {/* Header - Hidden on print */}
        <div className="flex justify-between items-center p-4 border-b border-slate-200 print:hidden shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">Aperçu de l'ordonnance</h2>
          <div className="flex space-x-2">
            <button 
              onClick={handlePrint}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimer
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-500 rounded-full hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Printable Area */}
        <div className="p-12 print:p-8 bg-white text-black overflow-y-auto grow" id="printable-prescription">
          
          {/* Doctor Header */}
          <div className="text-center mb-12 border-b-2 border-slate-800 pb-6">
            <h1 className="text-2xl font-bold uppercase tracking-wider text-slate-900">Docteur Elidrissi Laila</h1>
            <p className="text-sm text-slate-600 mt-1">Spécialiste en Gastro-entérologie et Hépatologie</p>
            <p className="text-sm text-slate-600">339, immeuble FENNI, bd Mohamed V</p>
          </div>

          <div className="text-center mb-10">
            <h2 className="text-xl font-bold uppercase tracking-widest text-slate-900 border-2 border-slate-900 inline-block px-6 py-2">
              Ordonnance Médicale
            </h2>
          </div>

          <div className="flex justify-between items-start mb-12 text-base">
            <div className="space-y-1">
              <p><span className="font-semibold">Patient :</span> {patient?.nom} {patient?.prenom}</p>
              <p>
                {age && <span>{age}</span>}
                {patient?.poids && <span>, {patient.poids} kg</span>}
              </p>
              {patient?.allergies && (
                <p className="text-red-600 font-medium mt-2">Allergies : {patient.allergies}</p>
              )}
            </div>
            <div className="text-right">
              <p>Le {new Date(prescription?.date_prescription || new Date()).toLocaleDateString('fr-FR')}</p>
            </div>
          </div>

          <div className="space-y-6 mb-16 min-h-[300px]">
            {prescription?.medicaments?.map((med: any, idx: number) => {
              const medInfo = medicaments[med.medicament_id];
              const nomMedicament = medInfo ? (medInfo.nomMedicament || medInfo.nom_commercial) : 'Médicament inconnu';
              const dosage = medInfo?.dosage ? ` ${medInfo.dosage} ${medInfo.uniteDosage || ''}` : '';
              const forme = medInfo?.forme ? ` - ${medInfo.forme}` : '';
              
              return (
                <div key={idx} className="pl-4 border-l-4 border-slate-200">
                  <p className="font-bold text-lg text-slate-900">
                    • {nomMedicament}{dosage}{forme}
                  </p>
                  <p className="text-base text-slate-800 mt-1 ml-4">
                    <span className="font-semibold">Posologie :</span> {med.posologie}
                  </p>
                  <p className="text-base text-slate-800 ml-4">
                    <span className="font-semibold">Durée :</span> {med.duree}
                  </p>
                  {med.instructions_speciales && (
                    <p className="text-sm text-slate-600 italic ml-4 mt-1">
                      Note : {med.instructions_speciales}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {prescription?.notes && (
            <div className="mb-12 pt-6 border-t border-slate-200">
              <p className="font-semibold mb-2">Autres indications :</p>
              <p className="whitespace-pre-wrap text-slate-800">{prescription.notes}</p>
            </div>
          )}

          <div className="flex justify-end mt-20">
            <div className="text-center">
              <p className="font-semibold mb-16">Signature / Cachet</p>
              <div className="w-48 border-b border-slate-300"></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
