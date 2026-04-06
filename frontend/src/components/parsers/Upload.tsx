import React, { type Dispatch, type SetStateAction } from 'react'
import type { StepType } from '../../pages/GetStarted';

interface UploadProps {
  selectedOption: string | null;
  uploadedFile: File | null;
  setCurrentStep: Dispatch<SetStateAction<StepType>>
  setSelectedOption: Dispatch<SetStateAction<"interview" | "resume" | null>>
  setUploadedFile: (file: File | null) => void;
  uploadedFilePath: string | Blob;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAnalyze: () => void;
}

function Upload({
  selectedOption,
  uploadedFile,
  setCurrentStep,
  setSelectedOption,
  setUploadedFile,
  handleFileUpload,
  handleAnalyze
}: UploadProps) {
  return (
    <div className="theme-panel rounded-2xl p-10 backdrop-blur">
      <div className="mx-auto max-w-xl">
        <div className="theme-panel-soft cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-all hover:[border-color:var(--accent-border-strong)]">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept={selectedOption === 'interview' ? 'audio/*,video/*' : '.pdf,.doc,.docx'}
            onChange={handleFileUpload}
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            {!uploadedFile ? (
              <>
                <div className="theme-icon-badge mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                  <svg className="theme-accent-text h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="theme-text-primary mb-2 font-semibold">
                  Click to upload or drag and drop
                </p>
                <p className="theme-text-muted text-sm">
                  {selectedOption === 'interview'
                    ? 'MP3, MP4, WAV, or MOV (max. 100MB)'
                    : 'PDF, DOC, or DOCX (max. 10MB)'}
                </p>
              </>
            ) : (
              <div className="flex items-center justify-center space-x-3">
                <svg className="theme-accent-text h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-left">
                  <p className="theme-text-primary font-semibold">{uploadedFile.name}</p>
                  <p className="theme-text-muted text-sm">
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            )}
          </label>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => {
              setCurrentStep('choose');
              setSelectedOption(null);
              setUploadedFile(null);
            }}
            className="theme-ghost-link flex items-center space-x-2 transition"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back</span>
          </button>
          <button
            onClick={handleAnalyze}
            disabled={!uploadedFile}
            className={`rounded-lg px-8 py-3 font-semibold transition-all ${
              uploadedFile
                ? 'theme-button-primary hover:scale-105'
                : 'theme-button-secondary theme-text-dim cursor-not-allowed'
            }`}
          >
            Analyze Now
          </button>
        </div>
      </div>
    </div>
  )
}

export default Upload
