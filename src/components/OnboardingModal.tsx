import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OnboardingModalProps {
  onClose: () => void;
  onNext: () => void;
  onBack: () => void;
}

export function OnboardingModal({ onClose, onNext, onBack }: OnboardingModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 pointer-events-auto"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        className="relative bg-slate-800 text-white rounded-lg shadow-xl p-6 max-w-md pointer-events-auto"
        style={{
          position: 'absolute',
          top: '20%',
          right: '10%',
        }}
      >
        {/* Arrow pointing to filters */}
        <div
          className="absolute -top-2 right-20 w-0 h-0 border-l-[8px] border-r-[8px] border-b-[8px] border-transparent border-b-slate-800"
        />

        {/* Content */}
        <p className="text-sm leading-relaxed mb-6">
          The grooming calendar allows you to easily view services by color and filter your schedule by day, week, month, and employee.
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-700 rounded transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <Button
            onClick={onNext}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-6 py-2 text-sm font-medium"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
