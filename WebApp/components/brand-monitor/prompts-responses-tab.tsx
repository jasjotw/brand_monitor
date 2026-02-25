import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronsDown, ChevronsUp, Loader2, Sparkles } from 'lucide-react';
import { BrandPrompt, AIResponse } from '@/lib/types';
import { HighlightedResponse } from './highlighted-response';

interface PromptsResponsesTabProps {
  prompts: BrandPrompt[];
  responses: AIResponse[];
  expandedPromptIndex: number | null;
  onToggleExpand: (index: number | null) => void;
  brandName: string;
  competitors: string[];
  userId?: string;
  emailId?: string;
  companyUrl?: string;
}

// Provider icon mapping
const getProviderIcon = (provider: string) => {
  switch (provider) {
    case 'OpenAI':
      return (
        <img 
          src="https://cdn.brandfetch.io/idR3duQxYl/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B" 
          alt="OpenAI" 
          className="w-6 h-6"
        />
      );
    case 'Anthropic':
      return (
        <img 
          src="https://cdn.brandfetch.io/idmJWF3N06/theme/dark/symbol.svg" 
          alt="Anthropic" 
          className="w-6 h-6"
        />
      );
    case 'Google':
      return (
        <div className="w-6 h-6 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-6 h-6">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        </div>
      );
    case 'Perplexity':
      return (
        <img 
          src="https://cdn.brandfetch.io/idNdawywEZ/w/800/h/800/theme/dark/icon.png?c=1dxbfHSJFAPEGdCLU4o5B" 
          alt="Perplexity" 
          className="w-6 h-6"
        />
      );
    case 'DeepSeek':
      return (
        <img 
          src="/logos/deepseek.jpeg" 
          alt="DeepSeek" 
          className="w-6 h-6"
        />
      );
    case 'Grok':
    case 'xAI':
    case 'Grok (xAI)':
      return (
        <img 
          src="/logos/grok.jpeg" 
          alt="Grok" 
          className="w-6 h-6"
        />
      );
    default:
      return <div className="w-6 h-6 bg-gray-400 rounded" />;
  }
};

export function PromptsResponsesTab({
  prompts,
  responses,
  expandedPromptIndex,
  onToggleExpand,
  brandName,
  competitors,
  userId,
  emailId,
  companyUrl
}: PromptsResponsesTabProps) {
  const [allExpanded, setAllExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  
  const handleExpandAll = () => {
    if (allExpanded) {
      // Collapse all
      setAllExpanded(false);
      onToggleExpand(null);
    } else {
      // Expand all - we'll use -1 as a special value to indicate all expanded
      setAllExpanded(true);
      onToggleExpand(-1);
    }
  };

  // Identify prompts where at least one provider missed the brand
  const missedPrompts = prompts.filter(p => 
    responses?.some(r => r.prompt === p.prompt && !r.brandMentioned)
  ).map(p => p.prompt);

  const handleGenerateRecovery = async () => {
    if (missedPrompts.length === 0 || !userId || !companyUrl) return;
    
    setRecoveryLoading(true);
    setRecoverySuccess(false);
    
    try {
      const payload = {
        user_id: userId,
        company_url: companyUrl,
        prompt: missedPrompts,
        isprompt: true,
        email_id: emailId,
        brand_name: brandName
      };

      const blogAgentUrl = process.env.NEXT_PUBLIC_BLOG_AGENT_URL || "https://intelliwrite.vercel.app";
      const url = `${blogAgentUrl}/blogs`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setRecoverySuccess(true);
        // Reset success message after 5 seconds
        setTimeout(() => setRecoverySuccess(false), 5000);
      } else {
        const error = await res.json();
        alert(`Failed to generate recovery content: ${error.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.error('Recovery generation error:', e);
      alert('An error occurred while generating recovery content.');
    } finally {
      setRecoveryLoading(false);
    }
  };
  
  // Filter prompts based on search query
  const filteredPromptIndices = prompts
    .map((prompt, idx) => {
      if (!searchQuery) return idx;
      
      const promptMatches = prompt.prompt.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Check if any response contains the search query
      const promptResponses = responses?.filter(response => 
        response.prompt === prompt.prompt
      ) || [];
      
      const responseMatches = promptResponses.some(response => 
        response.response.toLowerCase().includes(searchQuery.toLowerCase()) ||
        response.provider.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      return (promptMatches || responseMatches) ? idx : null;
    })
    .filter(idx => idx !== null);
  
  return (
    <div className="space-y-2">
      {/* Search and Controls */}
      {prompts.length > 0 && (
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex items-center gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search prompts and responses..."
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#155DFC] focus:border-transparent text-sm"
              />
              <svg 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {missedPrompts.length > 0 && (
                <Button
                  onClick={handleGenerateRecovery}
                  disabled={recoveryLoading}
                  className={`h-9 px-4 py-2 rounded-[10px] text-sm font-medium flex items-center gap-2 transition-all duration-200 ${
                    recoverySuccess 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-100'
                  }`}
                >
                  {recoveryLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {recoverySuccess ? 'Recovery Sent!' : `Generate Recovery Topics (${missedPrompts.length})`}
                </Button>
              )}

              <button
                onClick={handleExpandAll}
                className="h-9 px-4 py-2 rounded-[10px] text-sm font-medium flex items-center gap-2 transition-all duration-200 bg-[#155DFC] text-white hover:bg-[#665DFF] [box-shadow:inset_0px_-2.108433723449707px_0px_0px_#110A8B,_0px_1.2048193216323853px_6.325301647186279px_0px_rgba(23, 13, 242, 58%)]"
              >
                {allExpanded ? (
                  <>
                    <ChevronsUp className="h-4 w-4" />
                    Collapse All
                  </>
                ) : (
                  <>
                    <ChevronsDown className="h-4 w-4" />
                    Expand All
                  </>
                )}
              </button>
            </div>
          </div>
          
          {recoverySuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
              <Sparkles className="h-3 w-3" />
              Topics have been generated for missed mentions. You can find them in the <strong>IntelliWrite</strong> tab.
            </div>
          )}
        </div>
      )}
      
      {prompts.map((promptData, idx) => {
        // Skip if filtered out
        if (!filteredPromptIndices.includes(idx)) return null;
        
        // Find responses for this prompt
        const promptResponses = responses?.filter(response => 
          response.prompt === promptData.prompt
        ) || [];
        
        // Check if any provider mentioned the brand
        const hasBrandMention = promptResponses.some(r => r.brandMentioned);
        
        // Check if this tile is expanded - auto-expand when searching
        const isExpanded = searchQuery 
          ? true 
          : (expandedPromptIndex === -1 || expandedPromptIndex === idx);
        
        return (
          <div
            key={idx}
            className={`
              relative border rounded-lg transition-all duration-300
              ${isExpanded 
                ? 'border-[#665DFF] bg-white shadow-md' 
                : 'border-gray-200 bg-white hover:border-[#B3ADFF] hover:shadow-sm'
              }
            `}
          >
            {/* Tile Header - Compact single line */}
            <div 
              className="px-3 py-4 cursor-pointer select-none"
              onClick={() => {
                if (expandedPromptIndex === -1) {
                  // If all are expanded, clicking one should collapse all and keep this one expanded
                  setAllExpanded(false);
                  onToggleExpand(idx);
                } else {
                  // Normal toggle behavior
                  onToggleExpand(isExpanded ? null : idx);
                }
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{promptData.prompt}</p>
                  {hasBrandMention && (
                    <Badge variant="default" className="text-xs bg-green-100 text-green-800 shrink-0">
                      Brand Mentioned
                    </Badge>
                  )}
                <div className="flex items-center gap-2 shrink-0">
{['OpenAI', 'Anthropic', 'Google', 'Perplexity', 'DeepSeek', 'Grok'].map((providerName) => {
                    const providerResponse = promptResponses.find(r => r.provider === providerName);
                    if (!providerResponse) return null;
                    
                    // Check if response failed (empty response text)
                    const isFailed = !providerResponse.response || providerResponse.response.trim().length === 0;
                    
                    return (
                      <div key={providerName} className="relative flex items-center">
                        <div className="w-6 h-6 flex items-center justify-center">
                          {getProviderIcon(providerName)}
                        </div>
                        {isFailed ? (
                          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 flex items-center justify-center bg-red-500 rounded-full border border-white">
                            <span className="text-white text-xs font-bold leading-none">×</span>
                          </div>
                        ) : providerResponse.brandMentioned ? (
                          <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full border border-white" />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                
                </div>

                {/* Expand/Collapse indicator */}
                <div className={`transition-transform duration-300 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>
            
            {/* Expandable content */}
            <div
              className={`
                overflow-hidden transition-all duration-300
                ${isExpanded ? 'max-h-[4000px] opacity-100' : 'max-h-0 opacity-0'}
              `}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-t border-gray-100 px-3 py-3">
                {promptResponses.length > 0 ? (
                  <div className="space-y-4">
                    {['OpenAI', 'Anthropic', 'Google', 'Perplexity', 'DeepSeek', 'Grok'].map((providerName) => {
                      const response = promptResponses.find(r => r.provider === providerName);
                      if (!response) return null;
                      
                      // Check if response failed (empty response text)
                      const isFailed = !response.response || response.response.trim().length === 0;
                      
                      return (
                      <div key={providerName} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {getProviderIcon(response.provider)}
                            <span className="font-medium text-sm text-gray-900">{response.provider}</span>
                          </div>
                          {isFailed ? (
                            <Badge variant="destructive" className="text-xs bg-red-100 text-red-800">
                              Failed ×
                            </Badge>
                          ) : response.brandMentioned ? (
                            <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                              Brand Mentioned
                            </Badge>
                          ) : null}
                          {response.brandPosition && response.brandPosition > 0 && (
                            <Badge variant="outline" className="text-xs">
                              Position #{response.brandPosition}
                            </Badge>
                          )}
                        </div>
                        <div className="bg-gray-50 rounded-md p-3 text-sm text-gray-700 select-text cursor-text">
                          {isFailed ? (
                            <div className="text-red-600 italic">
                              Response failed or returned empty content
                            </div>
                          ) : (
                            <HighlightedResponse
                              response={response}
                              brandName={brandName}
                              competitors={competitors}
                              showHighlighting={true}
                              highlightClassName="bg-green-100 text-green-900 px-0.5 rounded font-medium"
                              renderMarkdown={true}
                            />
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm text-center py-4">No responses available for this prompt</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      
      {/* No results message */}
      {searchQuery && filteredPromptIndices.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-2">No results found for "{searchQuery}"</p>
          <p className="text-gray-500 text-sm">Try searching for different keywords</p>
        </div>
      )}
    </div>
  );
}
