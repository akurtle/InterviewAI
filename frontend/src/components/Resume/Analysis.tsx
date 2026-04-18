import React, { type SetStateAction } from 'react'
import type { ParseResponse, StepType } from '../../pages/GetStarted';



interface AnalysisProps {
  isAnalyzing: boolean;
  analysisError: string | null;
  analysisResult: ParseResponse | null;
  setCurrentStep: React.Dispatch<SetStateAction<StepType>>
  setAnalysisError: (value: string | null) => void;
  setAnalysisResult: (value: ParseResponse | null) => void;
  setSelectedOption: React.Dispatch<SetStateAction<"interview" | "resume" | null>>;
  setUploadedFile: (value: File | null) => void;
}

function Analysis({
  isAnalyzing,
  analysisError,
  analysisResult,
  setCurrentStep,
  setAnalysisError,
  setAnalysisResult,
  setSelectedOption,
  setUploadedFile,
}: AnalysisProps) {
  return (
    <div className="bg-gray-900/50 backdrop-blur border border-gray-800 rounded-2xl p-10">
                <div className="max-w-2xl mx-auto">
                  {isAnalyzing ? (
                    <div className="text-center">
                      {/* Loading Animation */}
                      <div className="relative w-24 h-24 mx-auto mb-8">
                        <div className="absolute inset-0 border-4 border-emerald-500/30 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-transparent border-t-emerald-500 rounded-full animate-spin"></div>
                        <div className="absolute inset-4 bg-emerald-500/20 rounded-full flex items-center justify-center">
                          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                      </div>

                      <h3 className="text-2xl font-semibold text-white mb-4">Analyzing Your Resume</h3>
                      <p className="text-gray-400 mb-8">Our AI is processing your content. This usually takes 30-60 seconds.</p>

                      {/* Progress Steps */}
                      <div className="space-y-4 text-left">
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-gray-300">Uploading file...</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <span className="text-gray-300">Processing content...</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 border-2 border-emerald-500 rounded-full animate-pulse"></div>
                          <span className="text-gray-300">Generating insights...</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-6 h-6 border-2 border-gray-700 rounded-full"></div>
                          <span className="text-gray-500">Creating report...</span>
                        </div>
                      </div>
                    </div>
                  ) : analysisError ? (
                    <div className="text-center">
                      <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-semibold text-white mb-4">Analysis Failed</h3>
                      <p className="text-red-400 mb-8">{analysisError}</p>
                      <button
                        onClick={() => {
                          setCurrentStep('upload');
                          setAnalysisError(null);
                          setAnalysisResult(null);
                        }}
                        className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold transition"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : analysisResult ? (
                    <div>
                      <div className="flex items-center justify-center mb-8">
                        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>

                      <h3 className="text-2xl font-semibold text-white mb-2 text-center">Analysis Complete!</h3>
                      <p className="text-gray-400 mb-8 text-center">File: {analysisResult.filename}</p>

                      {/* Results Display */}
                      <div className="bg-gray-800/50 rounded-lg p-6 mb-8">
                        <h4 className="text-lg font-semibold text-white mb-4">Extracted Information:</h4>
                        <div className="space-y-4">
                          {Object.entries(analysisResult.data).map(([key, value]) => (
                            <div key={key} className="border-l-2 border-emerald-500 pl-4">
                              <p className="text-emerald-400 font-semibold capitalize">{key.replace(/_/g, ' ')}</p> <textarea
                                className="
                                      mt-2 w-full h-32
                                      bg-black/40
                                      border border-emerald-500/40
                                      rounded-md
                                      px-3 py-2
                                      text-gray-200 text-sm
                                      
                                      focus:outline-none focus:ring-2 focus:ring-emerald-500/70
                                      scrollbar-thin scrollbar-thumb-emerald-500 scrollbar-track-gray-800
                                    "
                                // value={
                                //   typeof value === 'object'
                                //     ? JSON.stringify(value, null, 2)
                                //     : String(value)
                                // }
                              >
                                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                              </textarea>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-4 justify-center">
                        <button
                          onClick={() => {
                            setCurrentStep('choose');
                            setSelectedOption(null);
                            setUploadedFile(null);
                            setAnalysisResult(null);
                          }}
                          className="px-6 py-2 border border-emerald-500 text-emerald-400 hover:bg-emerald-500/10 rounded-lg font-semibold transition"
                        >
                          Start Over
                        </button>
                        <button
                          onClick={() => {
                            setCurrentStep('upload');
                          }}
                          className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold transition"
                        >
                          Upload Another
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
  )
}

export default Analysis
