import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Terjadi kesalahan pada aplikasi.',
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#090C0B] text-[#F3F6F4] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#151B18] border border-white/10 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-[#EF4444]">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="text-lg font-semibold text-[#F3F6F4]">
                Kendala Memuat Halaman
              </h2>
            </div>
            <p className="text-sm text-[#9CA8A2] leading-relaxed break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#10B981] text-[#052E1F] rounded-lg hover:bg-[#059669] transition-colors whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
