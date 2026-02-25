import React, { useEffect, useState } from 'react';
import { Globe, Loader2, ArrowRight } from 'lucide-react';
import { TipsCarousel, BRAND_MONITOR_TIPS } from './tips-carousel';

interface UrlInputSectionProps {
  url: string;
  urlValid: boolean | null;
  loading: boolean;
  analyzing: boolean;
  locked?: boolean;
  error?: string;
  onDismissError?: () => void;
  onUrlChange: (url: string) => void;
  onSubmit: () => void;
}

export function UrlInputSection({
  url,
  urlValid,
  loading,
  analyzing,
  locked,
  error,
  onDismissError,
  onUrlChange,
  onSubmit
}: UrlInputSectionProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="relative w-full flex flex-col items-center justify-center py-20 lg:py-32 overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
         {/* Blobs */}
         <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-100/50 rounded-full blur-3xl mix-blend-multiply animate-blob" />
         <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-100/50 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-2000" />
         <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-pink-100/50 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-4000" />
      </div>

      <div className={`relative z-10 w-full max-w-4xl px-6 flex flex-col items-center text-center transition-all duration-1000 transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
        
        {/* Badge */}
        <div className="mb-8 inline-flex items-center px-3 py-1 rounded-full border border-gray-200 bg-white/50 backdrop-blur-sm shadow-sm transition-all hover:bg-white/80">
          <span className="flex h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">AI-Powered Brand Analysis</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 mb-6 drop-shadow-sm">
          <span className="block mb-2">Analyze your brand's</span>
          <span className="block bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent pb-2">
            Share of Voice
          </span>
        </h1>

        {/* Subtitle */}
        <p className="max-w-2xl text-lg md:text-xl text-gray-600 mb-12 leading-relaxed">
          Monitor your visibility across AI platforms. Enter your website to instantly discover how AI search engines perceive and rank your brand.
        </p>

        {error && (
          <div className="w-full max-w-2xl mb-4">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 shadow-sm">
              <div className="text-sm font-medium text-left">{error}</div>
              {onDismissError && (
                <button
                  type="button"
                  onClick={onDismissError}
                  className="text-xs font-semibold text-red-600 hover:text-red-800"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        )}

        {/* Input Card */}
        <div className={`w-full max-w-2xl transition-all duration-700 delay-300 transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className={`relative group p-1.5 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 shadow-xl transition-all duration-300 ${urlValid === false ? 'from-red-100 to-red-200' : 'hover:shadow-2xl hover:scale-[1.005]'}`}>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-xl"></div>
            
            <div className="relative bg-white rounded-xl flex items-center p-2 shadow-inner">
              <div className="pl-4 pr-3 text-gray-400">
                <Globe className={`h-6 w-6 ${urlValid ? 'text-blue-500' : ''} transition-colors duration-300`} />
              </div>
              
              <input
                type="text"
                className="flex-1 h-14 bg-transparent text-lg text-gray-900 placeholder-gray-400 focus:outline-none font-medium"
                placeholder="example.com"
                value={url}
                onChange={(e) => !locked && onUrlChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading && !analyzing && url) {
                    onSubmit();
                  }
                }}
                disabled={loading || analyzing || locked}
                readOnly={locked}
                autoFocus
              />

              <div className="pr-1">
                <button
                  onClick={onSubmit}
                  disabled={loading || analyzing || !url || urlValid === false}
                  className={`h-12 px-6 rounded-lg flex items-center justify-center font-medium transition-all duration-300 
                    ${!url ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 
                      loading ? 'bg-gray-800 text-white cursor-wait' :
                      'bg-gray-900 text-white hover:bg-black shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0'
                    }`}
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Analyzing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>Analyze</span>
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  )}
                </button>
              </div>
            </div>
            
            {/* Error Message Tooltip */}
            {urlValid === false && (
              <div className="absolute -bottom-10 left-0 text-red-500 text-sm font-medium flex items-center animate-fade-in-up">
                <span className="block w-2 h-2 rounded-full bg-red-500 mr-2" />
                Please enter a valid URL (e.g., example.com)
              </div>
            )}
          </div>
        </div>

        {/* Tips Carousel */}
        <div className={`mt-16 w-full transition-all duration-700 delay-500 transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
           <TipsCarousel tips={BRAND_MONITOR_TIPS} />
        </div>

      </div>
    </div>
  );
}
