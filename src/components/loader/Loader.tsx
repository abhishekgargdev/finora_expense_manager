// src/components/Loader.tsx
'use client';

import React from 'react';

interface LoaderProps {
  fullScreen?: boolean;
  message?: string;
}

const Loader: React.FC<LoaderProps> = ({ fullScreen = true, message }) => {
  if (!fullScreen) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-4">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover rounded-full"
            >
              <source src="/loader_video.mp4" type="video/mp4" />
            </video>
          </div>
          {message && <p className="text-slate-400 text-sm">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-purple-950">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />
      </div>

      {/* Loader content */}
      <div className="relative z-10 text-center">
        <div className="relative w-40 h-40 mx-auto mb-6">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover rounded-full shadow-2xl shadow-cyan-500/20"
          >
            <source src="/loader_video.mp4" type="video/mp4" />
          </video>
        </div>

        {message && (
          <div className="space-y-2">
            <p className="text-white text-lg font-medium">{message}</p>
            <div className="flex items-center justify-center gap-1">
              <div
                className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <div
                className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <div
                className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Loader;