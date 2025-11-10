import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, FileText, Copy, Check, ArrowRight, Code2, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { uploadPdfFile, getJob, loadEvidenceWithRefresh, type JobResponse } from "@/lib/azureDocumentIntelligence";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

type Manufacturer = "milesight" | "decentlab" | "dragino" | "watteco" | "enginko";

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

export const DecoderGenerator = () => {
  const [manufacturer, setManufacturer] = useState<Manufacturer | "">("");
  const [step, setStep] = useState<WorkflowStep>("select_manufacturer");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentation, setDocumentation] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  
  // Workflow state variables
  const [compositeSpec, setCompositeSpec] = useState("");
  const [rulesBlock, setRulesBlock] = useState("");
  const [examplesTablesMd, setExamplesTablesMd] = useState("");
  const [decoderCode, setDecoderCode] = useState("");
  const [feedbackMarkdown, setFeedbackMarkdown] = useState("");
  const [sensorSpecificPrompt, setSensorSpecificPrompt] = useState("");
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const pollStartTimeRef = useRef<number | null>(null);
  
  const [jobId, setJobId] = useState<string>("");

  const DECODERGEN_BASE = import.meta.env.VITE_DECODERGEN_BASE;
  const DECODERGEN_KEY = import.meta.env.VITE_DECODERGEN_KEY;

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
    setStep("extracting");

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
      setStep("upload_doc");
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
        setStep("upload_doc");
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
          setStep("view_doc");
          
          toast({
            title: "Extraction complete",
            description: "Documentation has been extracted successfully",
          });
        } else if (job.status === "Failed" || job.error) {
          stopPolling();
          setIsExtracting(false);
          setStep("upload_doc");
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
    const response = await fetch(`${DECODERGEN_BASE}/api/${endpoint}?code=${DECODERGEN_KEY}`, {
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
      setStep("step1_composite");
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
      setStep("step2_rules");
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
      setStep("step3_examples");
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
      setStep("step4_reconcile");
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
      setStep("step5_decoder");
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
      setStep("step6_repair");
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
      setStep("step7_feedback");
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
    setStep("select_manufacturer");
    setSelectedFile(null);
    setDocumentation("");
    setCompositeSpec("");
    setRulesBlock("");
    setExamplesTablesMd("");
    setDecoderCode("");
    setFeedbackMarkdown("");
    setSensorSpecificPrompt("");
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
                  <SelectItem value="decentlab" disabled>DecentLab (Coming Soon)</SelectItem>
                  <SelectItem value="dragino" disabled>Dragino (Coming Soon)</SelectItem>
                  <SelectItem value="watteco" disabled>Watteco (Coming Soon)</SelectItem>
                  <SelectItem value="enginko" disabled>Enginko (Coming Soon)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => setStep("upload_doc")}
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
              <Upload className="w-5 h-5" />
              Upload Documentation ({manufacturer})
            </CardTitle>
            <CardDescription>
              Upload the device datasheet PDF for extraction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

            <div className="flex gap-2">
              <Button
                onClick={uploadAndExtract}
                disabled={!selectedFile}
                className="flex-1"
                data-testid="button-upload-extract"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload and Extract
              </Button>
              <Button
                onClick={() => setStep("select_manufacturer")}
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
                onClick={runStep1GenerateCompositeSpec}
                disabled={isProcessing}
                className="flex-1"
                data-testid="button-start-generation"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Code2 className="w-4 h-4 mr-2" />
                )}
                Start Generation Process
              </Button>
              <Button
                onClick={() => setStep("upload_doc")}
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
        <div className="space-y-4">
          {/* Step 1: Composite Spec */}
          <Card className="glass-card" data-testid="card-step1">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Step 1: Composite Spec</span>
                {step !== "step1_composite" && <Check className="w-5 h-5 text-green-500" />}
              </CardTitle>
            </CardHeader>
            {step === "step1_composite" && (
              <CardContent className="space-y-4">
                <Textarea
                  value={compositeSpec}
                  onChange={(e) => setCompositeSpec(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                  data-testid="textarea-composite-spec"
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
                  <Button
                    onClick={runStep2GenerateRulesBlock}
                    disabled={isProcessing}
                    data-testid="button-next-step2"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                    Next: Generate Rules Block
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Step 2: Rules Block */}
          {(step === "step2_rules" || step === "step3_examples" || step === "step4_reconcile" || 
            step === "step5_decoder" || step === "step6_repair" || step === "step7_feedback") && (
            <Card className="glass-card" data-testid="card-step2">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Step 2: Rules Block</span>
                  {step !== "step2_rules" && <Check className="w-5 h-5 text-green-500" />}
                </CardTitle>
              </CardHeader>
              {step === "step2_rules" && (
                <CardContent className="space-y-4">
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
                  <Textarea
                    value={rulesBlock}
                    onChange={(e) => setRulesBlock(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                    data-testid="textarea-rules-block"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => copyToClipboard(rulesBlock, "Rules Block")}
                      variant="outline"
                      size="sm"
                    >
                      <Copy className="w-3 h-3 mr-2" />
                      Copy
                    </Button>
                    <Button
                      onClick={runStep3ExtractExamplesTables}
                      disabled={isProcessing}
                      data-testid="button-next-step3"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                      Next: Extract Examples
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Step 3: Examples Tables */}
          {(step === "step3_examples" || step === "step4_reconcile" || step === "step5_decoder" || 
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
                  <Textarea
                    value={examplesTablesMd}
                    onChange={(e) => setExamplesTablesMd(e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                    data-testid="textarea-examples"
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
                      onClick={runStep4ReconcileRulesBlock}
                      disabled={isProcessing}
                      data-testid="button-next-step4"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                      Next: Reconcile Rules
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Step 4: Reconcile */}
          {(step === "step4_reconcile" || step === "step5_decoder" || step === "step6_repair" || 
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
                  <Textarea
                    value={rulesBlock}
                    onChange={(e) => setRulesBlock(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                    data-testid="textarea-reconciled-rules"
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
                  <Textarea
                    value={decoderCode}
                    onChange={(e) => setDecoderCode(e.target.value)}
                    className="min-h-[400px] font-mono text-sm"
                    data-testid="textarea-decoder-code"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => copyToClipboard(decoderCode, "Decoder Code")}
                      variant="outline"
                      size="sm"
                    >
                      <Copy className="w-3 h-3 mr-2" />
                      Copy
                    </Button>
                    <Button
                      onClick={runStep6AutoRepairDecoder}
                      disabled={isProcessing}
                      variant="outline"
                      data-testid="button-repair"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                      Auto-Repair
                    </Button>
                    <Button
                      onClick={runStep7DecoderFeedback}
                      disabled={isProcessing}
                      data-testid="button-next-step7"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                      Get Feedback
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Step 6: Auto-Repaired Code */}
          {(step === "step6_repair" || step === "step7_feedback") && (
            <Card className="glass-card bg-green-50 dark:bg-green-950" data-testid="card-step6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Step 6: Auto-Repaired Code</span>
                  {step !== "step6_repair" && <Check className="w-5 h-5 text-green-500" />}
                </CardTitle>
              </CardHeader>
              {step === "step6_repair" && (
                <CardContent className="space-y-4">
                  <Textarea
                    value={decoderCode}
                    onChange={(e) => setDecoderCode(e.target.value)}
                    className="min-h-[400px] font-mono text-sm"
                    data-testid="textarea-repaired-code"
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
                <CardTitle>Step 7: Decoder Feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div 
                  className="prose prose-sm dark:prose-invert max-w-none p-4 bg-muted rounded-md"
                  dangerouslySetInnerHTML={{ __html: feedbackMarkdown.replace(/\n/g, '<br>') }}
                  data-testid="feedback-content"
                />
                <div className="flex gap-2">
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
