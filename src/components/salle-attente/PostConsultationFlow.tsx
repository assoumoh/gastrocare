import React, { useState } from 'react';
import ExamRequestModal from './ExamRequestModal';
import PostConsultationModal from './PostConsultationModal';
import PrescriptionForm from '../prescriptions/PrescriptionForm';
import { X, SkipForward } from 'lucide-react';

interface PostConsultationFlowProps {
    entryId: string;
    patientName: string;
    appointmentId?: string;
    patientId: string;
    consultationId?: string;
    onClose: () => void;
}

type FlowStep = 'exams' | 'prescription' | 'checklist';

export default function PostConsultationFlow({
    entryId,
    patientName,
    appointmentId,
    patientId,
    consultationId,
    onClose,
}: PostConsultationFlowProps) {
    const [step, setStep] = useState<FlowStep>('exams');

    // Step 1: Demande d'examens
    if (step === 'exams') {
        return (
            <ExamRequestModal
                patientId={patientId}
                patientName={patientName}
                consultationId={consultationId}
                onComplete={() => setStep('prescription')}
                onClose={onClose}
            />
        );
    }

    // Step 2: Saisie ordonnance
    if (step === 'prescription') {
        return (
            <div className="fixed inset-0 z-50">
                {/* Skip button overlay */}
                <div className="fixed top-4 right-4 z-[60] print:hidden">
                    <button
                        onClick={() => setStep('checklist')}
                        className="inline-flex items-center px-4 py-2 border border-orange-300 rounded-md shadow-sm text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100"
                    >
                        <SkipForward className="h-4 w-4 mr-2" />
                        Passer l'ordonnance
                    </button>
                </div>
                <PrescriptionForm
                    patientId={patientId}
                    consultationId={consultationId}
                    onClose={() => setStep('checklist')}
                />
            </div>
        );
    }

    // Step 3: Checklist post-consultation (existante)
    return (
        <PostConsultationModal
            entryId={entryId}
            patientName={patientName}
            appointmentId={appointmentId}
            patientId={patientId}
            consultationId={consultationId}
            onClose={onClose}
        />
    );
}
