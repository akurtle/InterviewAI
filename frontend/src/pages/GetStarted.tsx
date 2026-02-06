import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ResumeButton from '../components/parsers/ResumeButton';
import InterviewButton from '../components/parsers/InterviewButton';
import Upload from '../components/parsers/Upload';
import Analysis from '../components/parsers/Analysis';
import FeaturesMiniSection from '../components/parsers/FeaturesMiniSection';
import { Link } from 'react-router-dom';

export type StepType = 'choose' | 'upload' | 'analyze';

export interface ParseResponse {
  success: boolean;
  filename: string;
  data: Record<string, any>;
}

const GetStarted: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<StepType>('choose');
  const [selectedOption, setSelectedOption] = useState<'interview' | 'resume' | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | Blob>("");
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
        formData.append('file', uploadedFile);

        formData.append('filePath', uploadedFilePath);

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
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${currentStep === 'choose'
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
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${currentStep === 'upload'
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
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${currentStep === 'analyze'
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
                <InterviewButton handleOptionSelect={handleOptionSelect} />

                
                {/* Resume Option */}
                <ResumeButton handleOptionSelect={handleOptionSelect} />
              </div>
            )}

            {/* Step 2: Upload */}
            {currentStep === 'upload' && (
              <Upload selectedOption={selectedOption} uploadedFile={uploadedFile}
                setCurrentStep={setCurrentStep} setSelectedOption={setSelectedOption}
                setUploadedFile={setUploadedFile} uploadedFilePath={uploadedFilePath} handleFileUpload={handleFileUpload}
                handleAnalyze={handleAnalyze} />
            )}

            {/* Step 3: Analysis */}
            {currentStep === 'analyze' && (
              <Analysis
                isAnalyzing={isAnalyzing}
                analysisError={analysisError}
                analysisResult={analysisResult}
                setCurrentStep={setCurrentStep}
                setAnalysisError={setAnalysisError}
                setAnalysisResult={setAnalysisResult}
                setSelectedOption={setSelectedOption}
                setUploadedFile={setUploadedFile}
              />
            )}
          </div>

          {/* Features Section */}
          {currentStep === 'choose' && (
           <FeaturesMiniSection/>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default GetStarted;
