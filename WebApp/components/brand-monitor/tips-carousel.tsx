"use client";

import React, { useState, useEffect } from 'react';

export const BRAND_MONITOR_TIPS = [
  {
    title: "Brand Monitor",
    description: "Track how your brand appears inside AI-generated answers before users ever visit a website."
  },
  {
    title: "AI Visibility Score",
    description: "A metric that shows how often and how accurately AI platforms mention and recommend your brand."
  },
  {
    title: "Competitor Analysis",
    description: "See which competitors AI systems surfaces and why, so you can outperform them in AI-driven discovery."
  },
  {
    title: "Prompt Analysis",
    description: "Understand the exact questions users ask AI platforms and test how your brand shows up in those conversations."
  },
  {
    title: "Sentiment Analysis",
    description: "Measure whether AI portrays your brand positively, neutrally, or negatively because trust drives decisions."
  }
];

export const AEO_TIPS = [
  {
    title: "AEO Audit",
    description: "Evaluates your website’s readiness for Answer Engine Optimization and identifies areas that need improvement."
  },
  {
    title: "AEO Audit",
    description: "Audits content, schema, and authority signals for AI answer eligibility."
  },
  {
    title: "AEO Audit",
    description: "Analyzes site structure, content, and signals to improve visibility in AI-generated answers."
  }
];

export const GEO_FILES_TIPS = [
  {
    title: "GEO Files",
    description: "Generates essential website files that help AI crawlers understand your brand and content."
  },
  {
    title: "GEO Files",
    description: "Creates AI-readiness files like LLM schemas, crawler directives, and structured signals for AI platforms."
  },
  {
    title: "GEO Files",
    description: "Generates LLM schemas, robots directives, and structured files to enable AI crawling and brand understanding."
  }
];

export const INTELLIWRITE_TIPS = [
  {
    title: "IntelliWrite",
    description: "Generates AI-optimized content for blogs, Reddit, LinkedIn, and X to improve visibility across AI and search platforms."
  },
  {
    title: "IntelliWrite",
    description: "Creates platform-specific, AI-optimized content designed to perform in both AI answers and traditional search."
  },
  {
    title: "IntelliWrite",
    description: "Generates AI-ready content tailored for blogs, Reddit, LinkedIn, and X based on platform intent."
  }
];

interface Tip {
  title: string;
  description: string;
}

interface TipsCarouselProps {
  tips?: Tip[];
}

export function TipsCarousel({ tips = BRAND_MONITOR_TIPS }: TipsCarouselProps) {
  const [index, setIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!tips || tips.length === 0) return;
    
    const timer = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % tips.length);
        setIsAnimating(false);
      }, 300); // Wait for fade out
    }, 4000); // Change every 4 seconds

    return () => clearInterval(timer);
  }, [tips]);

  if (!tips || tips.length === 0) return null;

  return (
    <div className="w-full max-w-3xl mx-auto h-40 relative flex flex-col items-center justify-center">
      <div 
        className={`flex flex-col items-center justify-center text-center px-4 transition-all duration-300 transform ${
          isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}
      >
        <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
          {tips[index].title}
        </h3>
        <p className="text-gray-600 text-base md:text-lg max-w-2xl leading-relaxed">
          {tips[index].description}
        </p>
      </div>
      
      {/* Dots indicator */}
      <div className="flex justify-center gap-2 mt-6">
        {tips.map((_, i) => (
          <div 
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              i === index ? 'bg-blue-600 w-3' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}