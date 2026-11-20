import React, { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { BRAND_LOGO_URL } from '../data/seedData';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'settings';
  fallback?: React.ReactNode;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  fallback = null,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    if (variant === 'settings') {
      return (
        <div className="flex items-center gap-3 text-sm text-emerald-700 font-semibold">
          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 p-0.5 shrink-0 overflow-hidden">
            <img
              src={BRAND_LOGO_URL}
              alt="Kundu Enterprise app icon"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
          <span>App is installed and running in standalone mode.</span>
        </div>
      );
    }
    return <>{fallback}</>;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          variant === 'compact'
            ? 'inline-flex items-center justify-center gap-2 min-h-[40px] px-3.5 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 shadow-xs'
            : 'inline-flex items-center justify-center gap-2.5 min-h-[46px] px-5 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 active:scale-[0.98] transition-all whitespace-nowrap shadow-xs'
        }
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS || variant === 'settings') {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className={
            variant === 'compact'
              ? 'inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 rounded-lg bg-orange-600 text-white text-xs font-bold hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0'
              : 'inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-orange-200 bg-orange-50 text-orange-800 text-sm font-bold hover:bg-orange-100 transition-colors whitespace-nowrap'
          }
        >
          <Smartphone className="w-4 h-4 shrink-0" />
          <span>{isIOS ? 'Install on iPhone' : 'Install App Guide'}</span>
        </button>

        {showGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
            onClick={() => setShowGuide(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-white border-2 border-[#0B2C6F]/15 shadow-sm p-1 shrink-0 overflow-hidden">
                    <img
                      src={BRAND_LOGO_URL}
                      alt="Kundu Enterprise home screen icon"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain rounded-xl"
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-[#0B2C6F]">KUNDU ENTERPRISE</h3>
                    <p className="text-xs font-semibold text-orange-600">
                      PURE WATER, HEALTHY LIFE
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  aria-label="Close install instructions"
                  className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="mt-3 text-sm text-slate-600">
                Install this app to your phone&apos;s home screen for instant offline access during
                deliveries.
              </p>

              {isIOS ? (
                <ol className="mt-4 space-y-3 text-sm text-slate-700">
                  <li className="flex items-start gap-3">
                    <span className="font-mono font-bold text-orange-600">1.</span>
                    <span>
                      Tap the <Share className="inline w-4 h-4 mx-0.5 text-sky-700" />{' '}
                      <strong className="text-slate-900">Share</strong> button in Safari.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="font-mono font-bold text-orange-600">2.</span>
                    <span>
                      Scroll down and tap <strong className="text-slate-900">Add to Home Screen</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="font-mono font-bold text-orange-600">3.</span>
                    <span>
                      Tap <strong className="text-slate-900">Add</strong> to place the Kundu Enterprise icon on your home screen.
                    </span>
                  </li>
                </ol>
              ) : (
                <ol className="mt-4 space-y-3 text-sm text-slate-700">
                  <li className="flex items-start gap-3">
                    <span className="font-mono font-bold text-orange-600">1.</span>
                    <span>Open this app in Chrome or Edge on Android or Desktop.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="font-mono font-bold text-orange-600">2.</span>
                    <span>
                      Tap the browser menu (<strong className="text-slate-900">⋮</strong>) and choose{' '}
                      <strong className="text-slate-900">Install App</strong> or{' '}
                      <strong className="text-slate-900">Add to Home screen</strong>.
                    </span>
                  </li>
                </ol>
              )}

              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="mt-6 w-full min-h-[44px] rounded-xl bg-[#0B2C6F] text-white text-sm font-bold hover:bg-[#082052] transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return <>{fallback}</>;
};
