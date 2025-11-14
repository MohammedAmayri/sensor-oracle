import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, FileText, Copy, Check, ArrowRight, Code2, RefreshCw, ArrowLeft, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { uploadPdfFile, getJob, loadEvidenceWithRefresh, type JobResponse } from "@/lib/azureDocumentIntelligence";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { ContentDisplay } from "@/components/ContentDisplay";

type Manufacturer = "milesight" | "decentlab" | "dragino" | "watteco" | "generic" | "enginko";

type WorkflowStep = 
  | "select_manufacturer"
  | "upload_doc"
  | "extracting"
  | "view_doc"
  | "step1_composite"
  | "step2_rules"
  | "step3_examples"
  | "step4_reconcile"
  | "step5_decoder"
  | "step6_repair"
  | "step7_feedback"
  | "complete";

// Ordered workflow steps for navigation
const WORKFLOW_STEPS: readonly WorkflowStep[] = [
  "select_manufacturer",
  "upload_doc",
  "extracting",
  "view_doc",
  "step1_composite",
  "step2_rules",
  "step3_examples",
  "step4_reconcile",
  "step5_decoder",
  "step6_repair",
  "step7_feedback",
];

const STEP_TITLES: Record<WorkflowStep, string> = {
  select_manufacturer: "Select Manufacturer",
  upload_doc: "Upload PDF",
  extracting: "Extracting...",
  view_doc: "Review Documentation",
  step1_composite: "1. Composite Spec",
  step2_rules: "2. Rules Block",
  step3_examples: "3. Examples",
  step4_reconcile: "4. Reconcile",
  step5_decoder: "5. Decoder",
  step6_repair: "6. Auto-Repair",
  step7_feedback: "7. Feedback",
  complete: "Complete",
};

export const DecoderGenerator = () => {
  const [manufacturer, setManufacturer] = useState<Manufacturer | "">("");
  const [step, setStep] = useState<WorkflowStep>("select_manufacturer");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentation, setDocumentation] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  
  // Navigation state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [furthestCompletedIndex, setFurthestCompletedIndex] = useState(0);
  
  // Workflow state variables
  const [compositeSpec, setCompositeSpec] = useState("");
  const [rulesBlock, setRulesBlock] = useState("");
  const [examplesTablesMd, setExamplesTablesMd] = useState("");
  const [decoderCode, setDecoderCode] = useState("");
  const [feedbackMarkdown, setFeedbackMarkdown] = useState("");
  const [sensorSpecificPrompt, setSensorSpecificPrompt] = useState("");
  const [refinementFeedback, setRefinementFeedback] = useState("");
  const [refinementNotes, setRefinementNotes] = useState("");
  
  // Watteco-specific state
  const [deviceProfile, setDeviceProfile] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [safeClassName, setSafeClassName] = useState("");
  
  // Generic-specific state
  const [deviceFormat, setDeviceFormat] = useState("");
  const [manualExamples, setManualExamples] = useState("");
  const [inputMode, setInputMode] = useState<"pdf" | "text">("pdf");
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const pollStartTimeRef = useRef<number | null>(null);
  
  const [jobId, setJobId] = useState<string>("");

  // Unified Azure Function credentials for all manufacturers and feedback loop
  const DECODER_BASE = import.meta.env.VITE_DECODER_BASE;
  const DECODER_KEY = import.meta.env.VITE_DECODER_KEY;

  // Get API credentials (now unified for all manufacturers)
  const getApiCredentials = () => {
    // All manufacturers now use the same unified Azure Function resource
    return { base: DECODER_BASE, key: DECODER_KEY };
  };

  // Sync step with currentIndex
  useEffect(() => {
    setStep(WORKFLOW_STEPS[currentIndex]);
  }, [currentIndex]);

  // Navigation helpers
  const goToStep = (index: number, options?: { markComplete?: boolean }) => {
    const clampedIndex = Math.max(0, Math.min(index, WORKFLOW_STEPS.length - 1));
    setCurrentIndex(clampedIndex);
    if (options?.markComplete && clampedIndex > furthestCompletedIndex) {
      setFurthestCompletedIndex(clampedIndex);
    }
  };

  const findIndexByStep = (targetStep: WorkflowStep): number => {
    return WORKFLOW_STEPS.indexOf(targetStep);
  };

  const goToPreviousStep = () => {
    if (currentIndex > 0 && !isProcessing) {
      goToStep(currentIndex - 1);
    }
  };

  const goToNextStep = () => {
    if (currentIndex < WORKFLOW_STEPS.length - 1 && !isProcessing) {
      // Only allow moving forward if next step already has data (user can review)
      // or if we're within already completed range
      const nextIndex = currentIndex + 1;
      if (nextIndex <= furthestCompletedIndex) {
        goToStep(nextIndex);
      }
    }
  };

  // Check if step data already exists
  const hasStepData = (targetStep: WorkflowStep): boolean => {
    switch (targetStep) {
      case "step1_composite": return !!compositeSpec;
      case "step2_rules": return !!rulesBlock;
      case "step3_examples": return !!examplesTablesMd;
      case "step4_reconcile": return !!rulesBlock;
      case "step5_decoder": return !!decoderCode;
      case "step6_repair": return !!decoderCode;
      case "step7_feedback": return !!feedbackMarkdown;
      default: return false;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === "application/pdf") {
        setSelectedFile(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select a PDF file",
          variant: "destructive",
        });
      }
    }
  };

  const uploadAndExtract = async () => {
    if (!selectedFile) return;

    setIsExtracting(true);
    setPollCount(0);
    goToStep(findIndexByStep("extracting"));

    try {
      const job = await uploadPdfFile(selectedFile);
      setJobId(job.id);
      
      toast({
        title: "Upload successful",
        description: "PDF uploaded, starting extraction...",
      });

      startPollingForExtraction(job.id);
    } catch (error) {
      console.error("Upload error:", error);
      setIsExtracting(false);
      goToStep(findIndexByStep("upload_doc"));
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload PDF",
        variant: "destructive",
      });
    }
  };

  const startPollingForExtraction = (extractJobId: string) => {
    pollStartTimeRef.current = Date.now();
    const TIMEOUT_MS = 300000; // 5 minutes

    const poll = async () => {
      if (pollStartTimeRef.current && Date.now() - pollStartTimeRef.current > TIMEOUT_MS) {
        stopPolling();
        setIsExtracting(false);
        goToStep(findIndexByStep("upload_doc"));
        toast({
          title: "Extraction timeout",
          description: "The extraction took longer than expected",
          variant: "destructive",
        });
        return;
      }

      setPollCount(prev => prev + 1);
      
      try {
        const job = await getJob(extractJobId);

        const hasEvidence = job.evidenceReadUrl || job.evidenceMdUrl || job.evidenceTxtUrl;

        if (hasEvidence) {
          // Extraction complete - fetch the evidence
          const evidenceText = await loadEvidenceWithRefresh(job);
          
          stopPolling();
          setDocumentation(evidenceText);
          setIsExtracting(false);
          goToStep(findIndexByStep("view_doc"), { markComplete: true });
          
          toast({
            title: "Extraction complete",
            description: "Documentation has been extracted successfully",
          });
        } else if (job.status === "Failed" || job.error) {
          stopPolling();
          setIsExtracting(false);
          goToStep(findIndexByStep("upload_doc"));
          toast({
            title: "Extraction failed",
            description: job.error || "Failed to extract document",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    };

    poll();
    pollingIntervalRef.current = window.setInterval(poll, 2000);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    pollStartTimeRef.current = null;
  };

  const callDecoderGenAPI = async (endpoint: string, body: object) => {
    const { base, key } = getApiCredentials();
    
    if (!base || !key) {
      throw new Error(`API credentials not configured for ${manufacturer}`);
    }

    // Remove trailing slash from base URL to prevent double slashes
    const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;

    const response = await fetch(`${cleanBase}/api/${endpoint}?code=${key}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API call failed: ${response.statusText}`);
    }

    return response.json();
  };

  const runStep1GenerateCompositeSpec = async () => {
    setIsProcessing(true);
    try {
      const result = await callDecoderGenAPI("GenerateCompositeSpec", { documentation });
      setCompositeSpec(result.compositeSpec);
      goToStep(findIndexByStep("step1_composite"), { markComplete: true });
      toast({
        title: "Step 1 complete",
        description: "Composite spec generated successfully",
      });
    } catch (error) {
      toast({
        title: "Step 1 failed",
        description: error instanceof Error ? error.message : "Could not generate composite spec",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const runStep2GenerateRulesBlock = async () => {
    setIsProcessing(true);
    try {
      const result = await callDecoderGenAPI("GenerateRulesBlock", {
        documentation,
        sensorSpecificPrompt,
        compositeSpec,
      });
      setRulesBlock(result.rulesBlock);
      goToStep(findIndexByStep("step2_rules"), { markComplete: true });
      toast({
        title: "Step 2 complete",
        description: "Rules block generated successfully",
      });
    } catch (error) {
      toast({
        title: "Step 2 failed",
        description: error instanceof Error ? error.message : "Could not generate rules block",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const runStep3ExtractExamplesTables = async () => {
    setIsProcessing(true);
    try {
      const result = await callDecoderGenAPI("ExtractExamplesTables", { documentation });
      setExamplesTablesMd(result.examplesTablesMd);
      goToStep(findIndexByStep("step3_examples"), { markComplete: true });
      toast({
        title: "Step 3 complete",
        description: "Examples tables extracted successfully",
      });
    } catch (error) {
      toast({
        title: "Step 3 failed",
        description: error instanceof Error ? error.message : "Could not extract examples",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const runStep4ReconcileRulesBlock = async () => {
    setIsProcessing(true);
    try {
      const result = await callDecoderGenAPI("ReconcileRulesBlock", {
        rulesBlock,
        examplesTablesMd,
        compositeSpec,
      });
      setRulesBlock(result.rulesBlock);
      goToStep(findIndexByStep("step4_reconcile"), { markComplete: true });
      toast({
        title: "Step 4 complete",
        description: "Rules block reconciled successfully",
      });
    } catch (error) {
      toast({
        title: "Step 4 failed",
        description: error instanceof Error ? error.message : "Could not reconcile rules",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const runStep5GenerateDecoder = async () => {
    setIsProcessing(true);
    try {
      const result = await callDecoderGenAPI("GenerateDecoder", {
        rulesBlock,
        examplesTablesMd,
      });
      setDecoderCode(result.decoderCode);
      goToStep(findIndexByStep("step5_decoder"), { markComplete: true });
      toast({
        title: "Step 5 complete",
        description: "Decoder code generated successfully",
      });
    } catch (error) {
      toast({
        title: "Step 5 failed",
        description: error instanceof Error ? error.message : "Could not generate decoder",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const runStep6AutoRepairDecoder = async () => {
    setIsProcessing(true);
    try {
      const result = await callDecoderGenAPI("AutoRepairDecoder", {
        rulesBlock,
        examplesTablesMd,
        decoderCode,
      });
      setDecoderCode(result.repairedCode);
      goToStep(findIndexByStep("step6_repair"), { markComplete: true });
      toast({
        title: "Step 6 complete",
        description: "Decoder repaired successfully",
      });
    } catch (error) {
      toast({
        title: "Step 6 failed",
        description: error instanceof Error ? error.message : "Could not repair decoder",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const runStep7DecoderFeedback = async () => {
    setIsProcessing(true);
    try {
      const result = await callDecoderGenAPI("DecoderFeedback", {
        rulesBlock,
        examplesTablesMd,
        decoderCode,
      });
      setFeedbackMarkdown(result.feedbackMarkdown);
      goToStep(findIndexByStep("step7_feedback"), { markComplete: true });
      toast({
        title: "Step 7 complete",
        description: "Feedback generated successfully",
      });
    } catch (error) {
      toast({
        title: "Step 7 failed",
        description: error instanceof Error ? error.message : "Could not generate feedback",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Decentlab API functions
  const runDecentlabStep1GenerateRules = async () => {
    setIsProcessing(true);
    try {
      const result = await callDecoderGenAPI("decentlab/rules/generate", {
        documentation,
        sensorPrompt: sensorSpecificPrompt || undefined,
      });
      setRulesBlock(result.rulesBlock);
      goToStep(findIndexByStep("step2_rules"), { markComplete: true });
      toast({
        title: "Step 1 complete",
        description: "Decentlab rules generated successfully",
      });
    } catch (error) {
      toast({
        title: "Step 1 failed",
        description: error instanceof Error ? error.message : "Could not generate rules",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const runDecentlabStep2RefineRules = async () => {
    setIsProcessing(true);
    try {
      const result = await callDecoderGenAPI("decentlab/rules/refine", {
        documentation,
        sensorPrompt: sensorSpecificPrompt || undefined,
        currentRulesBlock: rulesBlock,
        userFeedback: sensorSpecificPrompt || undefined,
      });
      setRulesBlock(result.rulesBlock);
      toast({
        title: "Rules refined",
        description: "Decentlab rules updated successfully",
      });
    } catch (error) {
      toast({
        title: "Refine failed",
        description: error instanceof Error ? error.message : "Could not refine rules",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const runDecentlabStep3ExtractExamples = async () => {
    setIsProcessing(true);
    try {
      const result = await callDecoderGenAPI("decentlab/examples/extract", {
        documentation,
      });
      setExamplesTablesMd(result.examplesMarkdown);
      goToStep(findIndexByStep("step3_examples"), { markComplete: true });
      toast({
        title: "Step 2 complete",
        description: "Examples extracted successfully",
      });
    } catch (error) {
      toast({
        title: "Step 2 failed",
        description: error instanceof Error ? error.message : "Could not extract examples",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const runDecentlabStep4GenerateDecoder = async () => {
    setIsProcessing(true);
    try {
      const result = await callDecoderGenAPI("decentlab/decoder/generate", {
        documentation,
        rulesBlock,
        examplesMarkdown: examplesTablesMd,
      });
      setDecoderCode(result.decoderCode);
      goToStep(findIndexByStep("step5_decoder"), { markComplete: true });
      toast({
        title: "Step 3 complete",
        description: "Decoder generated successfully",
      });
    } catch (error) {
      toast({
        title: "Step 3 failed",
        description: error instanceof Error ? error.message : "Could not generate decoder",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const runDecentlabStep5StaticFeedback = async () => {
    setIsProcessing(true);
    try {
      const result = await callDecoderGenAPI("decentlab/decoder/feedback", {
        decoderCode,
        rulesBlock,
      });
      setFeedbackMarkdown(result.feedback);
      goToStep(findIndexByStep("step7_feedback"), { markComplete: true });
      toast({
        title: "Step 4 complete",
        description: result.hasIssues ? "Feedback generated - issues found" : "Feedback generated - no issues",
      });
    } catch (error) {
      toast({
        title: "Step 4 failed",
        description: error instanceof Error ? error.message : "Could not generate feedback",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const runDecentlabStep6RefineDecoder = async () => {
    setIsProcessing(true);
    try {
      const result = await callDecoderGenAPI("decentlab/decoder/refine", {
        currentCode: decoderCode,
        userFeedback: sensorSpecificPrompt || undefined,
        documentation,
        rulesBlock,
        examplesMarkdown: examplesTablesMd,
        decoderFeedback: feedbackMarkdown || undefined,
      });
      setDecoderCode(result.decoderCode);
      toast({
        title: "Decoder refined",
        description: "Decoder updated successfully",
      });
    } catch (error) {
      toast({
        title: "Refine failed",
        description: error instanceof Error ? error.message : "Could not refine decoder",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Dragino workflow functions
  const runDraginoStep1GenerateRules = async () => {
    setIsProcessing(true);
    try {
      const result = await callDecoderGenAPI("GenerateDraginoRules", {
        documentation,
        sensorSpecificPrompt: sensorSpecificPrompt || undefined,
      });
      // Note: API returns RulesBlock (capital R, B) not rulesBlock
      setRulesBlock(result.RulesBlock || result.rulesBlock);
      goToStep(findIndexByStep("step2_rules"), { markComplete: true });
      toast({
        title: "Step 1 complete",
        description: "Dragino rules generated successfully",
      });
    } catch (error) {
      toast({
        title: "Step 1 failed",
        description: error instanceof Error ? error.message : "Could not generate Dragino rules",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const runDraginoStep2GenerateDecoder = async () => {
    setIsProcessing(true);
    try {
      const result = await callDecoderGenAPI("GenerateDraginoDecoder", {
        rulesBlock,
      });
      // Note: API may return DecoderCode (capital D, C) or decoderCode
      setDecoderCode(result.DecoderCode || result.decoderCode);
      goToStep(findIndexByStep("step5_decoder"), { markComplete: true });
      toast({
        title: "Step 2 complete",
        description: "Dragino decoder generated successfully",
      });
    } catch (error) {
      toast({
        title: "Step 2 failed",
        description: error instanceof Error ? error.message : "Could not generate Dragino decoder",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Watteco workflow functions
  const runWattecoStep1GenerateProfile = async () => {
    setIsProcessing(true);
    try {
      const result = await callDecoderGenAPI("GenerateDeviceProfile", {
        deviceDocumentation: documentation,
        extraHints: sensorSpecificPrompt || undefined,
      });
      setDeviceProfile(result.profile);
      setDeviceName(result.deviceName);
      setSafeClassName(result.safeClassName);
      goToStep(findIndexByStep("step2_rules"), { markComplete: true });
      toast({
        title: "Step 1 complete",
        description: "Watteco device profile generated successfully",
      });
    } catch (error) {
      toast({
        title: "Step 1 failed",
        description: error instanceof Error ? error.message : "Could not generate Watteco device profile",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const runWattecoStep2GenerateDecoder = async () => {
    setIsProcessing(true);
    try {
      const result = await callDecoderGenAPI("GenerateDecoderCode", {
        deviceProfile,
        deviceNameOverride: deviceName || undefined,
        safeClassNameOverride: safeClassName || undefined,
      });
      setDecoderCode(result.decoderCode);
      setDeviceName(result.deviceName);
      setSafeClassName(result.safeClassName);
      goToStep(findIndexByStep("step5_decoder"), { markComplete: true });
      toast({
        title: "Step 2 complete",
        description: "Watteco decoder generated successfully",
      });
    } catch (error) {
      toast({
        title: "Step 2 failed",
        description: error instanceof Error ? error.message : "Could not generate Watteco decoder",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Generic workflow function
  const callGenericWorkflow = async () => {
    if (!documentation) {
      toast({
        title: "Documentation required",
        description: "Please provide device documentation via PDF or text input",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const { base, key } = getApiCredentials();
      if (!base || !key) {
        throw new Error("Generic API credentials not configured");
      }

      // Remove trailing slash from base URL
      const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base;

      // Always send JSON with documentation as required field
      // Optional fields: deviceName, sensorSpecificPrompt, manualExamples
      const requestBody: any = {
        documentation,
      };

      // Only include optional fields if they have values
      if (deviceName) requestBody.deviceName = deviceName;
      if (sensorSpecificPrompt) requestBody.sensorSpecificPrompt = sensorSpecificPrompt;
      if (manualExamples) requestBody.manualExamples = manualExamples;

      const response = await fetch(`${cleanBase}/api/DecoderGenerator?code=${key}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API returned ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Populate all state from the single API response
      // API returns PascalCase field names, but also check camelCase as fallback
      setDeviceFormat(result.DeviceFormat || result.deviceFormat || "");
      setCompositeSpec(result.CompositeSpec || result.compositeSpec || "");
      setRulesBlock(result.RulesBlock || result.rulesBlock || "");
      setExamplesTablesMd(result.ExamplesTablesMarkdown || result.examplesTablesMarkdown || "");
      setDecoderCode(result.DecoderCode || result.decoderCode || "");
      setFeedbackMarkdown(result.DecoderFeedback || result.decoderFeedback || "");

      // For Generic, we receive all outputs at once, so mark all relevant steps as complete
      // This allows navigation through steps 1, 2, 3, and 5
      const step5Index = findIndexByStep("step5_decoder");
      setFurthestCompletedIndex(step5Index);
      
      // Navigate to first content step
      goToStep(findIndexByStep("step1_composite"));

      toast({
        title: "Generic decoder generated",
        description: "All workflow outputs generated successfully",
      });
    } catch (error) {
      toast({
        title: "Generic workflow failed",
        description: error instanceof Error ? error.message : "Could not generate decoder",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const refineDecoderWithFeedback = async () => {
    if (!decoderCode) {
      toast({
        title: "No decoder code",
        description: "Generate a decoder first before refining",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const refineBase = import.meta.env.VITE_REFINE_BASE;
      const refineKey = import.meta.env.VITE_REFINE_KEY;

      if (!refineBase || !refineKey) {
        throw new Error("Refine API credentials not configured");
      }

      // Remove trailing slash from base URL to prevent double slashes
      const cleanRefineBase = refineBase.endsWith('/') ? refineBase.slice(0, -1) : refineBase;

      const requestBody: any = {
        manufacturer,
        documentation: documentation || undefined,
        currentDecoderCode: decoderCode,
        userFeedback: refinementFeedback || undefined,
      };

      if (manufacturer === "milesight") {
        requestBody.rulesBlock = rulesBlock || undefined;
        requestBody.examplesMarkdown = examplesTablesMd || undefined;
        requestBody.compositeSummary = compositeSpec || undefined;
      } else if (manufacturer === "decentlab") {
        requestBody.rulesBlock = rulesBlock || undefined;
        requestBody.examplesMarkdown = examplesTablesMd || undefined;
      } else if (manufacturer === "dragino") {
        requestBody.rulesBlock = rulesBlock || undefined;
      } else if (manufacturer === "watteco") {
        requestBody.deviceProfile = deviceProfile || undefined;
        requestBody.deviceName = deviceName || undefined;
        requestBody.safeClassName = safeClassName || undefined;
      } else if (manufacturer === "generic") {
        requestBody.deviceFormat = deviceFormat || undefined;
        requestBody.compositeSpec = compositeSpec || undefined;
        requestBody.rulesBlock = rulesBlock || undefined;
        requestBody.examplesMarkdown = examplesTablesMd || undefined;
        requestBody.manualExamples = manualExamples || undefined;
        requestBody.deviceName = deviceName || undefined;
      }

      const response = await fetch(`${cleanRefineBase}/api/RefineDecoder?code=${refineKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Refine API returned ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      // Note: API returns RefinedDecoderCode (capital R, D, C) and RefinementNotes (capital R, N)
      const refinedCode = result.RefinedDecoderCode || result.refinedDecoderCode;
      const notes = result.RefinementNotes || result.refinementNotes || "";
      
      setDecoderCode(refinedCode);
      setRefinementNotes(notes);

      toast({
        title: "Decoder refined successfully",
        description: "View the refined decoder code and notes below",
      });
    } catch (error) {
      toast({
        title: "Refinement failed",
        description: error instanceof Error ? error.message : "Could not refine decoder",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const resetWorkflow = () => {
    setManufacturer("");
    goToStep(0);
    setCurrentIndex(0);
    setFurthestCompletedIndex(0);
    setSelectedFile(null);
    setDocumentation("");
    setCompositeSpec("");
    setRulesBlock("");
    setExamplesTablesMd("");
    setDecoderCode("");
    setFeedbackMarkdown("");
    setSensorSpecificPrompt("");
    setRefinementFeedback("");
    setRefinementNotes("");
    setDeviceProfile("");
    setDeviceName("");
    setSafeClassName("");
    setDeviceFormat("");
    setManualExamples("");
    setInputMode("pdf");
    stopPolling();
  };

  return (
    <div className="space-y-6">
      {/* Step: Select Manufacturer */}
      {step === "select_manufacturer" && (
        <Card className="glass-card" data-testid="card-select-manufacturer">
          <CardHeader>
            <CardTitle>Select Manufacturer</CardTitle>
            <CardDescription>
              Choose the IoT device manufacturer to generate a decoder for
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Select
                value={manufacturer}
                onValueChange={(value) => setManufacturer(value as Manufacturer)}
              >
                <SelectTrigger id="manufacturer" data-testid="select-manufacturer">
                  <SelectValue placeholder="Select manufacturer..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="milesight">Milesight</SelectItem>
                  <SelectItem value="decentlab">DecentLab</SelectItem>
                  <SelectItem value="dragino">Dragino</SelectItem>
                  <SelectItem value="watteco">Watteco</SelectItem>
                  <SelectItem value="generic">Generic</SelectItem>
                  <SelectItem value="enginko" disabled>Enginko (Coming Soon)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => goToStep(findIndexByStep("upload_doc"))}
              disabled={!manufacturer}
              className="w-full"
              data-testid="button-continue-manufacturer"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step: Upload Documentation */}
      {step === "upload_doc" && (
        <Card className="glass-card" data-testid="card-upload-doc">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {manufacturer === "generic" ? <Code2 className="w-5 h-5" /> : manufacturer === "watteco" ? <FileText className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
              {manufacturer === "generic" ? "Configure Decoder Generation" : manufacturer === "watteco" ? "Paste Documentation" : "Upload Documentation"} ({manufacturer})
            </CardTitle>
            <CardDescription>
              {manufacturer === "generic"
                ? "Provide device documentation and optional metadata for comprehensive decoder generation"
                : manufacturer === "watteco" 
                  ? "Paste the device documentation text directly (Applicative Layer section, frame examples, etc.)"
                  : "Upload the device datasheet PDF for extraction"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {manufacturer === "generic" ? (
              <>
                <Tabs defaultValue={inputMode} onValueChange={(v) => setInputMode(v as "pdf" | "text")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pdf" data-testid="tab-pdf">PDF Upload</TabsTrigger>
                    <TabsTrigger value="text" data-testid="tab-text">Paste Text</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="pdf" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="pdf-file-generic">Select PDF File</Label>
                      <input
                        id="pdf-file-generic"
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={handleFileSelect}
                        className="w-full"
                        data-testid="input-pdf-file-generic"
                      />
                    </div>
                    {selectedFile && (
                      <div className="p-3 bg-muted rounded-md">
                        <p className="text-sm font-medium">Selected: {selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Size: {(selectedFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="text" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="doc-text-generic">Device Documentation</Label>
                      <Textarea
                        id="doc-text-generic"
                        value={documentation}
                        onChange={(e) => setDocumentation(e.target.value)}
                        placeholder="Paste the full PDF text / markdown / HTML for the device here..."
                        className="min-h-[300px] font-mono text-sm"
                        data-testid="textarea-generic-doc"
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="device-name" className="text-sm font-medium">Optional Metadata</Label>
                  <p className="text-xs text-muted-foreground mb-2">Provide additional context to improve decoder generation</p>
                  
                  <div className="space-y-2">
                    <Label htmlFor="device-name">Device Name (Optional)</Label>
                    <Input
                      id="device-name"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      placeholder="e.g., MCF-LW12CO2"
                      data-testid="input-device-name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="sensor-prompt">Sensor-Specific Prompt (Optional)</Label>
                    <Textarea
                      id="sensor-prompt"
                      value={sensorSpecificPrompt}
                      onChange={(e) => setSensorSpecificPrompt(e.target.value)}
                      placeholder="e.g., LoRaWAN sensor with CO2 (ppm), temperature (°C), humidity (%RH). Battery in volts."
                      className="min-h-[60px]"
                      data-testid="textarea-sensor-prompt"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="manual-examples">Manual Examples (Optional)</Label>
                    <Textarea
                      id="manual-examples"
                      value={manualExamples}
                      onChange={(e) => setManualExamples(e.target.value)}
                      placeholder="Example payloads with human interpretation, if you have them..."
                      className="min-h-[60px]"
                      data-testid="textarea-manual-examples"
                    />
                  </div>
                </div>
              </>
            ) : manufacturer === "watteco" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="doc-text">Device Documentation</Label>
                  <Textarea
                    id="doc-text"
                    value={documentation}
                    onChange={(e) => setDocumentation(e.target.value)}
                    placeholder="Paste the Watteco device documentation here (Applicative Layer, frame examples, configuration, etc.)..."
                    className="min-h-[400px] font-mono text-sm"
                    data-testid="textarea-watteco-doc"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="extra-hints">Extra Hints (Optional)</Label>
                  <Textarea
                    id="extra-hints"
                    value={sensorSpecificPrompt}
                    onChange={(e) => setSensorSpecificPrompt(e.target.value)}
                    placeholder="E.g., 'This device only uses inputs 1 and 2', 'We only care about Binary Input cluster'..."
                    className="min-h-[100px]"
                    data-testid="textarea-extra-hints"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="pdf-file">Select PDF File</Label>
                  <input
                    id="pdf-file"
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="w-full"
                    data-testid="input-pdf-file"
                  />
                </div>

                {selectedFile && (
                  <div className="p-3 bg-muted rounded-md">
                    <p className="text-sm font-medium">Selected: {selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Size: {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (manufacturer === "generic") {
                    if (inputMode === "pdf") {
                      uploadAndExtract();
                    } else {
                      callGenericWorkflow();
                    }
                  } else if (manufacturer === "watteco") {
                    runWattecoStep1GenerateProfile();
                  } else {
                    uploadAndExtract();
                  }
                }}
                disabled={manufacturer === "generic" ? (inputMode === "pdf" ? !selectedFile : !documentation) : manufacturer === "watteco" ? !documentation : !selectedFile}
                className="flex-1"
                data-testid="button-upload-extract"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : manufacturer === "generic" ? (
                  <Code2 className="w-4 h-4 mr-2" />
                ) : manufacturer === "watteco" ? (
                  <Code2 className="w-4 h-4 mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                {manufacturer === "generic" ? (inputMode === "pdf" ? "Upload and Extract" : "Generate Decoder") : manufacturer === "watteco" ? "Generate Device Profile" : "Upload and Extract"}
              </Button>
              <Button
                onClick={() => goToStep(findIndexByStep("select_manufacturer"))}
                variant="outline"
                data-testid="button-back"
              >
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Extracting */}
      {step === "extracting" && (
        <Card className="glass-card" data-testid="card-extracting">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">Extracting with Azure Document Intelligence...</h3>
                <p className="text-sm text-muted-foreground">This may take 10-20 seconds</p>
                {pollCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Checked {pollCount} time{pollCount !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: View Documentation (Side-by-side Markdown/HTML) */}
      {step === "view_doc" && (
        <Card className="glass-card" data-testid="card-view-doc">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Review Extracted Documentation
            </CardTitle>
            <CardDescription>
              Review and edit the extracted content before generating the decoder
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="markdown" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="markdown">Markdown (Editable)</TabsTrigger>
                <TabsTrigger value="preview">HTML Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="markdown" className="space-y-2">
                <Textarea
                  value={documentation}
                  onChange={(e) => setDocumentation(e.target.value)}
                  className="min-h-[500px] font-mono text-sm"
                  data-testid="textarea-documentation"
                />
              </TabsContent>
              <TabsContent value="preview" className="space-y-2">
                <div 
                  className="min-h-[500px] p-4 border rounded-md bg-background prose prose-sm dark:prose-invert max-w-none overflow-auto"
                  data-testid="preview-documentation"
                >
                  <ReactMarkdown rehypePlugins={[rehypeRaw, rehypeSanitize]}>
                    {documentation}
                  </ReactMarkdown>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2">
              <Button
                onClick={
                  manufacturer === "generic"
                    ? callGenericWorkflow
                    : manufacturer === "decentlab" 
                      ? runDecentlabStep1GenerateRules 
                      : manufacturer === "dragino"
                        ? runDraginoStep1GenerateRules
                        : runStep1GenerateCompositeSpec
                }
                disabled={isProcessing}
                className="flex-1"
                data-testid="button-start-generation"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Code2 className="w-4 h-4 mr-2" />
                )}
                {manufacturer === "generic"
                  ? "Generate Decoder"
                  : manufacturer === "decentlab" 
                    ? "Start Decentlab Generation" 
                    : manufacturer === "dragino"
                      ? "Start Dragino Generation"
                      : "Start Generation Process"}
              </Button>
              <Button
                onClick={() => goToStep(findIndexByStep("upload_doc"))}
                variant="outline"
                data-testid="button-back-upload"
              >
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Steps 1-7: Generation Process */}
      {(step === "step1_composite" || step === "step2_rules" || step === "step3_examples" || 
        step === "step4_reconcile" || step === "step5_decoder" || step === "step6_repair" || 
        step === "step7_feedback") && (
        <div className="space-y-6">
          {/* Progress Stepper */}
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {WORKFLOW_STEPS.slice(4, 11).map((stepName, idx) => {
                    const stepIndex = idx + 4;
                    const isActive = stepIndex === currentIndex;
                    const isCompleted = stepIndex <= furthestCompletedIndex;
                    const isClickable = stepIndex <= furthestCompletedIndex;
                    
                    return (
                      <div key={stepName} className="flex items-center">
                        <button
                          onClick={() => isClickable && goToStep(stepIndex)}
                          disabled={!isClickable || isProcessing}
                          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : isCompleted
                              ? "bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-100 hover:bg-green-200 dark:hover:bg-green-800"
                              : "bg-muted text-muted-foreground cursor-not-allowed"
                          }`}
                          data-testid={`stepper-${stepName}`}
                        >
                          {idx === 6 ? <Check className="w-4 h-4" /> : idx + 1}
                        </button>
                        {idx < 6 && <ChevronRight className="w-4 h-4 mx-1 text-muted-foreground" />}
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Navigation Buttons */}
              <div className="flex gap-2 justify-between">
                <Button
                  onClick={goToPreviousStep}
                  disabled={currentIndex <= 4 || isProcessing}
                  variant="outline"
                  size="sm"
                  data-testid="button-nav-previous"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous Step
                </Button>
                <div className="text-sm text-muted-foreground flex items-center">
                  {STEP_TITLES[step]}
                </div>
                <Button
                  onClick={goToNextStep}
                  disabled={
                    currentIndex >= 10 || 
                    isProcessing || 
                    currentIndex >= furthestCompletedIndex
                  }
                  variant="outline"
                  size="sm"
                  data-testid="button-nav-next"
                >
                  Next Step
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Step 1: Composite Spec / Device Format (Milesight & Generic) */}
          {(manufacturer === "milesight" || manufacturer === "generic") && (step === "step1_composite" || step === "step2_rules" || step === "step3_examples" || 
            step === "step4_reconcile" || step === "step5_decoder" || step === "step6_repair" || step === "step7_feedback") && (
            <Card className="glass-card" data-testid="card-step1">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{manufacturer === "generic" ? "Step 1: Device Format & Composite Spec" : "Step 1: Composite Spec"}</span>
                  {step !== "step1_composite" && <Check className="w-5 h-5 text-green-500" />}
                </CardTitle>
              </CardHeader>
              {step === "step1_composite" && (
                <CardContent className="space-y-4">
                  {manufacturer === "generic" && deviceFormat && (
                    <div className="space-y-2 border-b pb-4 mb-4">
                      <Label className="text-sm font-semibold">Device Format</Label>
                      <div className="p-3 bg-muted rounded-md">
                        <p className="text-sm font-mono">{deviceFormat}</p>
                      </div>
                    </div>
                  )}
                  <ContentDisplay
                    content={compositeSpec}
                    onChange={setCompositeSpec}
                    contentType="rules"
                    placeholder="Composite spec will appear here after generation..."
                    dataTestId="content-composite-spec"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => copyToClipboard(compositeSpec, "Composite Spec")}
                      variant="outline"
                      size="sm"
                    >
                      <Copy className="w-3 h-3 mr-2" />
                      Copy
                    </Button>
                    {manufacturer === "milesight" && (
                      <Button
                        onClick={runStep2GenerateRulesBlock}
                        disabled={isProcessing}
                        data-testid="button-next-step2"
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                        Next: Generate Rules Block
                      </Button>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Step 2: Rules Block / Device Profile */}
          {(step === "step2_rules" || step === "step3_examples" || step === "step4_reconcile" || 
            step === "step5_decoder" || step === "step6_repair" || step === "step7_feedback") && (
            <Card className="glass-card" data-testid="card-step2">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{manufacturer === "watteco" ? "Step 1: Device Profile" : "Step 2: Rules Block"}</span>
                  {step !== "step2_rules" && <Check className="w-5 h-5 text-green-500" />}
                </CardTitle>
              </CardHeader>
              {step === "step2_rules" && (
                <CardContent className="space-y-4">
                  {manufacturer === "watteco" ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="device-name">Device Name</Label>
                        <input
                          id="device-name"
                          type="text"
                          value={deviceName}
                          onChange={(e) => setDeviceName(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                          placeholder="Device name..."
                          data-testid="input-device-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="safe-class-name">Safe Class Name</Label>
                        <input
                          id="safe-class-name"
                          type="text"
                          value={safeClassName}
                          onChange={(e) => setSafeClassName(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md"
                          placeholder="Safe class name..."
                          data-testid="input-safe-class-name"
                        />
                      </div>
                      <ContentDisplay
                        content={deviceProfile}
                        onChange={setDeviceProfile}
                        contentType="markdown"
                        placeholder="Device profile will appear here after generation..."
                        dataTestId="content-device-profile"
                      />
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="sensor-prompt">Sensor-Specific Prompt (Optional)</Label>
                        <Textarea
                          id="sensor-prompt"
                          value={sensorSpecificPrompt}
                          onChange={(e) => setSensorSpecificPrompt(e.target.value)}
                          placeholder="Add any specific requirements or hints..."
                          className="min-h-[100px]"
                          data-testid="textarea-sensor-prompt"
                        />
                      </div>
                      <ContentDisplay
                        content={rulesBlock}
                        onChange={setRulesBlock}
                        contentType="rules"
                        placeholder="Rules block will appear here after generation..."
                        dataTestId="content-rules-block"
                      />
                    </>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => copyToClipboard(manufacturer === "watteco" ? deviceProfile : rulesBlock, manufacturer === "watteco" ? "Device Profile" : "Rules Block")}
                      variant="outline"
                      size="sm"
                    >
                      <Copy className="w-3 h-3 mr-2" />
                      Copy
                    </Button>
                    {manufacturer === "decentlab" && rulesBlock && (
                      <Button
                        onClick={runDecentlabStep2RefineRules}
                        disabled={isProcessing}
                        variant="outline"
                        data-testid="button-refine-rules"
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Refine Rules
                      </Button>
                    )}
                    <Button
                      onClick={
                        manufacturer === "decentlab" 
                          ? runDecentlabStep3ExtractExamples 
                          : manufacturer === "dragino"
                            ? runDraginoStep2GenerateDecoder
                            : manufacturer === "watteco"
                              ? runWattecoStep2GenerateDecoder
                              : runStep3ExtractExamplesTables
                      }
                      disabled={isProcessing}
                      data-testid="button-next-step3"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                      {manufacturer === "dragino" || manufacturer === "watteco" ? "Next: Generate Decoder" : "Next: Extract Examples"}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Step 3: Examples Tables (not for Dragino or Watteco) */}
          {(manufacturer === "milesight" || manufacturer === "decentlab" || manufacturer === "generic") && (step === "step3_examples" || step === "step4_reconcile" || step === "step5_decoder" || 
            step === "step6_repair" || step === "step7_feedback") && (
            <Card className="glass-card" data-testid="card-step3">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Step 3: Examples Tables</span>
                  {step !== "step3_examples" && <Check className="w-5 h-5 text-green-500" />}
                </CardTitle>
              </CardHeader>
              {step === "step3_examples" && (
                <CardContent className="space-y-4">
                  <ContentDisplay
                    content={examplesTablesMd}
                    onChange={setExamplesTablesMd}
                    contentType="markdown"
                    placeholder="Example tables will appear here after extraction..."
                    dataTestId="content-examples"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => copyToClipboard(examplesTablesMd, "Examples Tables")}
                      variant="outline"
                      size="sm"
                    >
                      <Copy className="w-3 h-3 mr-2" />
                      Copy
                    </Button>
                    <Button
                      onClick={manufacturer === "decentlab" ? runDecentlabStep4GenerateDecoder : runStep4ReconcileRulesBlock}
                      disabled={isProcessing}
                      data-testid="button-next-step4"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                      {manufacturer === "decentlab" ? "Next: Generate Decoder" : "Next: Reconcile Rules"}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Step 4: Reconcile (Milesight only) */}
          {manufacturer === "milesight" && (step === "step4_reconcile" || step === "step5_decoder" || step === "step6_repair" || 
            step === "step7_feedback") && (
            <Card className="glass-card" data-testid="card-step4">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Step 4: Reconciled Rules</span>
                  {step !== "step4_reconcile" && <Check className="w-5 h-5 text-green-500" />}
                </CardTitle>
              </CardHeader>
              {step === "step4_reconcile" && (
                <CardContent className="space-y-4">
                  <ContentDisplay
                    content={rulesBlock}
                    onChange={setRulesBlock}
                    contentType="rules"
                    placeholder="Reconciled rules will appear here..."
                    dataTestId="content-reconciled-rules"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => copyToClipboard(rulesBlock, "Reconciled Rules")}
                      variant="outline"
                      size="sm"
                    >
                      <Copy className="w-3 h-3 mr-2" />
                      Copy
                    </Button>
                    <Button
                      onClick={runStep5GenerateDecoder}
                      disabled={isProcessing}
                      data-testid="button-next-step5"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                      Next: Generate Decoder
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Step 5: Decoder Code */}
          {(step === "step5_decoder" || step === "step6_repair" || step === "step7_feedback") && (
            <Card className="glass-card" data-testid="card-step5">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Step 5: Decoder Code</span>
                  {step !== "step5_decoder" && <Check className="w-5 h-5 text-green-500" />}
                </CardTitle>
              </CardHeader>
              {step === "step5_decoder" && (
                <CardContent className="space-y-4">
                  <ContentDisplay
                    content={decoderCode}
                    onChange={setDecoderCode}
                    contentType="code"
                    language="csharp"
                    placeholder="C# decoder code will appear here after generation..."
                    dataTestId="content-decoder-code"
                  />

                  {/* Refinement Notes Section */}
                  {refinementNotes && (
                    <div className="border-t pt-4 space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        Refinement Notes:
                      </Label>
                      <ContentDisplay
                        content={refinementNotes}
                        contentType="markdown"
                        readonly
                        previewOnly
                        placeholder="Refinement notes will appear here..."
                        dataTestId="content-refinement-notes"
                      />
                    </div>
                  )}

                  {/* AI-generated feedback for Generic */}
                  {manufacturer === "generic" && feedbackMarkdown && (
                    <div className="border-t pt-4 space-y-2">
                      <Label className="text-sm font-semibold">AI-Generated Decoder Feedback</Label>
                      <ContentDisplay
                        content={feedbackMarkdown}
                        contentType="markdown"
                        readonly
                        previewOnly
                        placeholder="Decoder feedback will appear here..."
                        dataTestId="content-decoder-feedback-generic"
                      />
                    </div>
                  )}

                  {/* Feedback input for Dragino, Watteco, and Generic (they don't have Step 7) */}
                  {(manufacturer === "dragino" || manufacturer === "watteco" || manufacturer === "generic") && (
                    <div className="border-t pt-4 space-y-2">
                      <Label htmlFor="refinement-notes" className="text-sm font-semibold">
                        Refinement Notes (Optional):
                      </Label>
                      <Textarea
                        id="refinement-notes"
                        value={refinementFeedback}
                        onChange={(e) => setRefinementFeedback(e.target.value)}
                        placeholder="Add any specific requirements or corrections to refine the decoder..."
                        className="min-h-[80px]"
                        data-testid="textarea-refinement-notes"
                      />
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => copyToClipboard(decoderCode, "Decoder Code")}
                      variant="outline"
                      size="sm"
                    >
                      <Copy className="w-3 h-3 mr-2" />
                      Copy
                    </Button>

                    {manufacturer === "milesight" && (
                      <Button
                        onClick={runStep6AutoRepairDecoder}
                        disabled={isProcessing}
                        variant="outline"
                        data-testid="button-repair"
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Auto-Repair
                      </Button>
                    )}

                    {(manufacturer === "dragino" || manufacturer === "watteco" || manufacturer === "generic") ? (
                      <Button
                        onClick={refineDecoderWithFeedback}
                        disabled={isProcessing || !decoderCode}
                        variant="default"
                        data-testid="button-refine-decoder"
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Refine Decoder with Feedback
                      </Button>
                    ) : (
                      <Button
                        onClick={manufacturer === "decentlab" ? runDecentlabStep5StaticFeedback : runStep7DecoderFeedback}
                        disabled={isProcessing}
                        data-testid="button-next-step7"
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                        Get Feedback
                      </Button>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Step 6: Auto-Repaired Code (Milesight only) */}
          {manufacturer === "milesight" && (step === "step6_repair" || step === "step7_feedback") && (
            <Card className="glass-card bg-green-50 dark:bg-green-950" data-testid="card-step6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Step 6: Auto-Repaired Code</span>
                  {step !== "step6_repair" && <Check className="w-5 h-5 text-green-500" />}
                </CardTitle>
              </CardHeader>
              {step === "step6_repair" && (
                <CardContent className="space-y-4">
                  <ContentDisplay
                    content={decoderCode}
                    onChange={setDecoderCode}
                    contentType="code"
                    language="csharp"
                    placeholder="Auto-repaired decoder code will appear here..."
                    dataTestId="content-repaired-code"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => copyToClipboard(decoderCode, "Repaired Code")}
                      variant="outline"
                      size="sm"
                    >
                      <Copy className="w-3 h-3 mr-2" />
                      Copy
                    </Button>
                    <Button
                      onClick={runStep7DecoderFeedback}
                      disabled={isProcessing}
                      data-testid="button-feedback"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                      Get Feedback
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Step 7: Feedback */}
          {step === "step7_feedback" && (
            <Card className="glass-card" data-testid="card-step7">
              <CardHeader>
                <CardTitle>Step 7: Decoder Feedback & Iteration</CardTitle>
                <CardDescription>
                  Review the AI feedback below. You can iterate by adding your own notes and regenerating the decoder.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold mb-2 block">AI-Generated Feedback:</Label>
                  <ContentDisplay
                    content={feedbackMarkdown}
                    contentType="markdown"
                    placeholder="Feedback will appear here after generation..."
                    dataTestId="content-feedback"
                    previewOnly
                  />
                </div>

                <div className="border-t pt-4">
                  <Label htmlFor="user-feedback-notes" className="text-sm font-semibold mb-2 block">
                    Your Feedback Notes (Optional):
                  </Label>
                  <Textarea
                    id="user-feedback-notes"
                    value={refinementFeedback}
                    onChange={(e) => setRefinementFeedback(e.target.value)}
                    placeholder="Add any specific requirements, corrections, or observations you'd like to incorporate..."
                    className="min-h-[100px]"
                    data-testid="textarea-user-feedback"
                  />
                </div>

                {/* Refinement Notes Section - Shows after refinement */}
                {refinementNotes && (
                  <div className="border-t pt-4 space-y-2 bg-green-50 dark:bg-green-950 p-4 rounded-md">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500" />
                      Refinement Notes:
                    </Label>
                    <ContentDisplay
                      content={refinementNotes}
                      contentType="markdown"
                      readonly
                      previewOnly
                      placeholder="Refinement notes will appear here..."
                      dataTestId="content-refinement-notes-step7"
                    />
                  </div>
                )}

                <div className="bg-muted/50 p-4 rounded-md">
                  <p className="text-sm text-muted-foreground mb-3">
                    <strong>Iterate on the decoder:</strong> Use the universal refinement to improve your decoder based on feedback.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={refineDecoderWithFeedback}
                      disabled={isProcessing || !decoderCode}
                      variant="default"
                      size="lg"
                      data-testid="button-refine-decoder"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                      Refine Decoder with Feedback
                    </Button>
                    <Button
                      onClick={() => {
                        goToStep(findIndexByStep("step5_decoder"));
                        toast({
                          title: "View Decoder",
                          description: "Check the decoder code in Step 5",
                        });
                      }}
                      variant="outline"
                      data-testid="button-view-decoder"
                    >
                      <Code2 className="w-4 h-4 mr-2" />
                      View Decoder Code
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-4 flex gap-2 flex-wrap">
                  <Button
                    onClick={() => copyToClipboard(feedbackMarkdown, "Feedback")}
                    variant="outline"
                    size="sm"
                  >
                    <Copy className="w-3 h-3 mr-2" />
                    Copy Feedback
                  </Button>
                  <Button
                    onClick={() => copyToClipboard(decoderCode, "Final Decoder Code")}
                    variant="outline"
                    size="sm"
                  >
                    <Copy className="w-3 h-3 mr-2" />
                    Copy Final Code
                  </Button>
                  <Button
                    onClick={resetWorkflow}
                    variant="outline"
                    data-testid="button-start-new"
                  >
                    Start New Generation
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
