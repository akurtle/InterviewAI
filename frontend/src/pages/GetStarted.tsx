import React, { useState } from 'react';
import Navbar from '../components/Layout/Navbar';
import Footer from '../components/Layout/Footer';
import ResumeButton from '../components/Resume/ResumeButton';
import InterviewButton from '../components/Resume/InterviewButton';
import Upload from '../components/Resume/Upload';
import Analysis from '../components/Resume/Analysis';
import FeaturesMiniSection from '../components/Resume/FeaturesMiniSection';
import { fetchWithLoopbackFallback, getApiBase } from '../network';

export type StepType = 'choose' | 'upload' | 'analyze';

export interface ParseResponse {
  success: boolean;
  filename: string;
  data: Record<string, any>;
}

const GetStarted: React.FC = () => {
  const API_BASE = getApiBase();
  const [currentStep, setCurrentStep] = useState<StepType>('choose');
  const [selectedOption, setSelectedOption] = useState<'interview' | 'resume' | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = useState<string | Blob>("");
  const [analysisResult, setAnalysisResult] = useState<ParseResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const isResumeFlow = selectedOption === 'resume';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);
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

        const response = await fetchWithLoopbackFallback(`${API_BASE}/parse-resume/`, {
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
    <div className="theme-page-shell">
      <Navbar />

      <section className="relative overflow-hidden pb-20 pt-32">
        <div className="absolute inset-0 opacity-20">
          <div className="theme-glow-primary absolute left-1/4 top-1/4 h-96 w-96 rounded-full blur-3xl animate-pulse"></div>
          <div className="theme-glow-secondary absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full blur-3xl animate-pulse delay-700"></div>
        </div>
        <div className="theme-grid-overlay absolute inset-0"></div>

        <div className="relative z-10 mx-auto max-w-6xl px-6">
          {isResumeFlow && (
            <div className="mb-12 flex items-center justify-center">
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold transition-all ${
                    currentStep === 'choose'
                      ? 'theme-button-primary text-white'
                      : 'theme-chip'
                  }`}>
                    1
                  </div>
                  <span className="theme-text-muted ml-2 text-sm">Choose</span>
                </div>

                <div className="theme-stat-divider h-px w-16"></div>

                <div className="flex items-center">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold transition-all ${
                    currentStep === 'upload'
                      ? 'theme-button-primary text-white'
                      : currentStep === 'analyze'
                        ? 'theme-chip'
                        : 'theme-panel-soft theme-text-dim'
                  }`}>
                    2
                  </div>
                  <span className="theme-text-muted ml-2 text-sm">Upload</span>
                </div>

                <div className="theme-stat-divider h-px w-16"></div>

                <div className="flex items-center">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold transition-all ${
                    currentStep === 'analyze'
                      ? 'theme-button-primary text-white'
                      : 'theme-panel-soft theme-text-dim'
                  }`}>
                    3
                  </div>
                  <span className="theme-text-muted ml-2 text-sm">Analyze</span>
                </div>
              </div>
            </div>
          )}

          <div className="mb-16 text-center">
            <h1 className="theme-text-primary mb-4 text-5xl font-bold md:text-6xl">
              {currentStep === 'choose' && 'Choose Your Path'}
              {currentStep === 'upload' && 'Upload Your Resume'}
              {currentStep === 'analyze' && 'AI Analysis in Progress'}
            </h1>
            <p className="theme-text-muted mx-auto max-w-2xl text-xl">
              {currentStep === 'choose' && 'Select what you\'d like to improve today'}
              {currentStep === 'upload' && 'Upload your resume for AI analysis'}
              {currentStep === 'analyze' && 'Our AI is analyzing your resume and generating personalized feedback'}
            </p>
          </div>

          <div className="mx-auto max-w-4xl">
            {currentStep === 'choose' && (
              <div className="grid gap-8 md:grid-cols-2">
                <InterviewButton />
                <ResumeButton handleOptionSelect={handleOptionSelect} />
              </div>
            )}

            {currentStep === 'upload' && (
              <Upload
                selectedOption={selectedOption}
                uploadedFile={uploadedFile}
                setCurrentStep={setCurrentStep}
                setSelectedOption={setSelectedOption}
                setUploadedFile={setUploadedFile}
                uploadedFilePath={uploadedFilePath}
                handleFileUpload={handleFileUpload}
                handleAnalyze={handleAnalyze}
              />
            )}

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

          {currentStep === 'choose' && (
            <FeaturesMiniSection />
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default GetStarted;
