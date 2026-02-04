import React, { type Dispatch, type SetStateAction } from 'react'
import type { StepType } from '../../pages/GetStarted';

interface UploadProps {
  selectedOption: string | null;
  uploadedFile: File | null;
  setCurrentStep: Dispatch<SetStateAction<StepType>>
  setSelectedOption: Dispatch<SetStateAction<"interview" | "resume" | null>>
  setUploadedFile: (file: File | null) => void;
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
    <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-2xl p-10">
                <div className="max-w-xl mx-auto">
                  {/* Upload Area */}
                  <div className="border-2 border-dashed border-gray-700 rounded-xl p-12 text-center hover:border-emerald-500 transition-all cursor-pointer">
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
                          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          </div>
                          <p className="text-white font-semibold mb-2">
                            Click to upload or drag and drop
                          </p>
                          <p className="text-gray-400 text-sm">
                            {selectedOption === 'interview' 
                              ? 'MP3, MP4, WAV, or MOV (max. 100MB)' 
                              : 'PDF, DOC, or DOCX (max. 10MB)'}
                          </p>
                        </>
                      ) : (
                        <div className="flex items-center justify-center space-x-3">
                          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="text-left">
                            <p className="text-white font-semibold">{uploadedFile.name}</p>
                            <p className="text-gray-400 text-sm">
                              {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                      )}
                    </label>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between mt-8">
                    <button
                      onClick={() => {
                        setCurrentStep('choose');
                        setSelectedOption(null);
                        setUploadedFile(null);
                      }}
                      className="text-gray-400 hover:text-white transition flex items-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      <span>Back</span>
                    </button>
                    <button
                      onClick={handleAnalyze}
                      disabled={!uploadedFile}
                      className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                        uploadedFile
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white transform hover:scale-105'
                          : 'bg-gray-800 text-gray-600 cursor-not-allowed'
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