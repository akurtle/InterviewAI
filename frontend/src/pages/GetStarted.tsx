import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ResumeButton from '../components/parsers/ResumeButton';
import InterviewButton from '../components/parsers/InterviewButton';
import Upload from '../components/parsers/Upload';

export type StepType = 'choose' | 'upload' | 'analyze';

interface ParseResponse {
  success: boolean;
  filename: string;
  data: Record<string, any>;
}

const GetStarted: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<StepType>('choose');
  const [selectedOption, setSelectedOption] = useState<'interview' | 'resume' | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | undefined>("");
  const [analysisResult, setAnalysisResult] = useState<ParseResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);
      // Store the file path or create a temporary path
      const tempPath = URL.createObjectURL(file);
      setUploadedFilePath(tempPath);
    }
  };

  const handleOptionSelect = (option: 'interview' | 'resume') => {
    setSelectedOption(option);
    setCurrentStep('upload');
  };

  const handleAnalyze = async () => {
    if (uploadedFile && selectedOption === 'resume') {
      setCurrentStep('analyze');
      setIsAnalyzing(true);
      setAnalysisError(null);
      
      try {
        const formData = new FormData();
        formData.append('file', uploadedFile,uploadedFilePath);
        
        const response = await fetch('http://localhost:8000/parse-resume/', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to parse resume');
        }
        
        const result: ParseResponse = await response.json();
        setAnalysisResult(result);
        setIsAnalyzing(false);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        setAnalysisError(errorMessage);
        setIsAnalyzing(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500 rounded-full blur-3xl animate-pulse delay-700"></div>
        </div>

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

        <div className="relative z-10 max-w-6xl mx-auto px-6">
          {/* Progress Indicator */}
          <div className="flex items-center justify-center mb-12">
            <div className="flex items-center space-x-4">
              {/* Step 1 */}
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                  currentStep === 'choose' 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  1
                </div>
                <span className="ml-2 text-sm text-gray-400">Choose</span>
              </div>

              <div className="w-16 h-px bg-gray-800"></div>

              {/* Step 2 */}
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                  currentStep === 'upload' 
                    ? 'bg-emerald-500 text-white' 
                    : currentStep === 'analyze'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-gray-800 text-gray-600'
                }`}>
                  2
                </div>
                <span className="ml-2 text-sm text-gray-400">Upload</span>
              </div>

              <div className="w-16 h-px bg-gray-800"></div>

              {/* Step 3 */}
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                  currentStep === 'analyze' 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-gray-800 text-gray-600'
                }`}>
                  3
                </div>
                <span className="ml-2 text-sm text-gray-400">Analyze</span>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
              {currentStep === 'choose' && 'Choose Your Path'}
              {currentStep === 'upload' && 'Upload Your Content'}
              {currentStep === 'analyze' && 'AI Analysis in Progress'}
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              {currentStep === 'choose' && 'Select what you\'d like to improve today'}
              {currentStep === 'upload' && `Upload your ${selectedOption === 'interview' ? 'interview recording' : 'resume'} for AI analysis`}
              {currentStep === 'analyze' && 'Our AI is analyzing your content and generating personalized feedback'}
            </p>
          </div>

          {/* Content Area */}
          <div className="max-w-4xl mx-auto">
            {/* Step 1: Choose Option */}
            {currentStep === 'choose' && (
              <div className="grid md:grid-cols-2 gap-8">
                {/* Interview Option */}
                <InterviewButton handleOptionSelect={handleOptionSelect}/>

                {/* Resume Option */}
                <ResumeButton handleOptionSelect={handleOptionSelect}/>
              </div>
            )}

            {/* Step 2: Upload */}
            {currentStep === 'upload' && (
              <Upload selectedOption={selectedOption} uploadedFile={uploadedFile} 
              setCurrentStep={setCurrentStep} setSelectedOption={setSelectedOption} 
              setUploadedFile={setUploadedFile} uploadedFilePath={uploadedFilePath} handleFileUpload={handleFileUpload} 
              handleAnalyze={handleAnalyze}/>
            )}

            {/* Step 3: Analysis */}
            {currentStep === 'analyze' && (
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
                              <p className="text-emerald-400 font-semibold capitalize">{key.replace(/_/g, ' ')}</p>
                              <p className="text-gray-300 text-sm">
                                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                              </p>
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
            )}
          </div>

          {/* Features Section */}
          {currentStep === 'choose' && (
            <div className="mt-20 grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h4 className="text-white font-semibold mb-2">Lightning Fast</h4>
                <p className="text-gray-400 text-sm">Get results in under 60 seconds</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h4 className="text-white font-semibold mb-2">100% Secure</h4>
                <p className="text-gray-400 text-sm">Your data is encrypted and private</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h4 className="text-white font-semibold mb-2">Detailed Reports</h4>
                <p className="text-gray-400 text-sm">Actionable insights and recommendations</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default GetStarted;
