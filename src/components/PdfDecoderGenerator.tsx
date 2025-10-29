import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, FileText, Download, Save, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type JobStatus = "Uploaded" | "Extracting" | "Extracted" | "Generating" | "Done" | "Failed";

type WorkflowState = 
  | { step: "idle" }
  | { step: "uploaded"; jobId: string }
  | { step: "extracting"; jobId: string }
  | { step: "extracted"; jobId: string }
  | { step: "editing"; jobId: string; evidenceContent: string }
  | { step: "generating"; jobId: string }
  | { step: "done"; jobId: string }
  | { step: "failed"; jobId: string; error: string };

interface JobResponse {
  ok: boolean;
  id: string;
  status: JobStatus;
  error: string | null;
  evidenceReadUrl: string | null;
  evidenceWriteUrl: string | null;
  evidenceMdUrl: string | null;
  evidenceTxtUrl: string | null;
  resultJsonUrl: string | null;
  fullDecoderUrl: string | null;
  consoleDecoderUrl: string | null;
}

const FUNC_BASE = import.meta.env.VITE_FUNC_BASE || "";
const FUNC_KEY = import.meta.env.VITE_FUNC_KEY || "";

// Map numeric status codes from backend to string values
const mapStatusCode = (statusCode: number | string): JobStatus => {
  if (typeof statusCode === "string") return statusCode as JobStatus;
  
  const statusMap: Record<number, JobStatus> = {
    0: "Uploaded",
    1: "Uploaded",
    2: "Extracting",
    3: "Extracted",
    4: "Generating",
    5: "Done",
    6: "Failed",
  };
  
  return statusMap[statusCode] || "Failed";
};

// Normalize backend response to match frontend interface
const normalizeJobResponse = (data: any): JobResponse => {
  return {
    ok: data.ok ?? true,
    id: data.Id || data.id || "",
    status: mapStatusCode(data.Status ?? data.status),
    error: data.Error ?? data.error ?? null,
    evidenceReadUrl: data.evidenceReadUrl ?? null,
    evidenceWriteUrl: data.evidenceWriteUrl ?? null,
    evidenceMdUrl: data.evidenceMdUrl ?? null,
    evidenceTxtUrl: data.evidenceTxtUrl ?? null,
    resultJsonUrl: data.resultJsonUrl ?? null,
    fullDecoderUrl: data.fullDecoderUrl ?? null,
    consoleDecoderUrl: data.consoleDecoderUrl ?? null,
  };
};

export const PdfDecoderGenerator = () => {
  const [state, setState] = useState<WorkflowState>({ step: "idle" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [evidenceContent, setEvidenceContent] = useState("");
  const [originalEvidence, setOriginalEvidence] = useState("");
  const [outputType, setOutputType] = useState("csharp");
  const [generalPrompt, setGeneralPrompt] = useState(`You are given EVIDENCE extracted from a sensor payload PDF. Produce a SINGLE JSON object with keys:
payloadExample, consoleDecoder, fullDecoder, metadata, decodedExample, validation.
No prose, no code fences.

Rules:
- LANGUAGE: C# ONLY.
- fullDecoder signature: public static async Task<JObject> Decode(JObject deviceData, ILogger log)
  and include: using Newtonsoft.Json.Linq; using Microsoft.Extensions.Logging;
- Parse bytes with a TLV loop: read [channel][type] then Data; obey the PDF's endianness
  (default little-endian for multi-byte if unspecified). If the PDF clearly shows port-based
  (FPort) or non-TLV formats, adapt accordingly and state this in metadata.notes.
- Map ONLY what's documented. Prefer standard names when evident: BatteryLevel (%),
  Temperature (°C), Humidity (%), CO2 (ppm). Do not invent fields.
- metadata.spec.frames must mirror the spec: "channel"/"type" as hex strings (e.g. "0x03","0x67"),
  "len" in bytes, "endian", "scale" (e.g. "x0.1" or "/2"), "name", "unit"; include "ports" if stated.
- Provide a robust HexToBytes helper (tolerate whitespace/odd lengths), bounds-check reads,
  skip unknown frames safely, never throw.
- payloadExample must be a short, valid hex that your decoder can parse; decodedExample must be
  exactly what your decoder computes on payloadExample.
- Ban: string token switching on textual tokens; any JavaScript keywords (let/const/function).
- If evidence is ambiguous/insufficient, set validation.hasDecode=false and list reasons; still
  return the full JSON object.`);
  const [specialPrompt, setSpecialPrompt] = useState("");
  const [jobData, setJobData] = useState<JobResponse | null>(null);
  const [isGeneralPromptOpen, setIsGeneralPromptOpen] = useState(false);
  const [isSpecialPromptOpen, setIsSpecialPromptOpen] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const pollingIntervalRef = useRef<number | null>(null);
  const pollStartTimeRef = useRef<number | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please select a PDF file",
        variant: "destructive",
      });
    }
  };

  const uploadPdf = async () => {
    if (!selectedFile) return;

    setState({ step: "uploaded", jobId: "" });

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      
      const response = await fetch(`${FUNC_BASE}/api/CreateJobAndUpload`, {
        method: "POST",
        headers: {
          "x-functions-key": FUNC_KEY,
          "Content-Type": "application/pdf",
        },
        body: arrayBuffer,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const rawData = await response.json();
      const data = normalizeJobResponse(rawData);
      
      if (!data.ok || !data.id) {
        throw new Error("Invalid response from server");
      }

      toast({
        title: "Upload successful",
        description: "PDF uploaded, starting extraction...",
      });

      setState({ step: "extracting", jobId: data.id });
      startPollingForExtraction(data.id);
    } catch (error) {
      setState({ step: "failed", jobId: "", error: error instanceof Error ? error.message : "Upload failed" });
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload PDF",
        variant: "destructive",
      });
    }
  };

  const getJob = async (jobId: string): Promise<JobResponse | null> => {
    try {
      const response = await fetch(`${FUNC_BASE}/api/job/${jobId}`, {
        headers: {
          "x-functions-key": FUNC_KEY,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get job: ${response.statusText}`);
      }

      const rawData = await response.json();
      const normalizedData = normalizeJobResponse(rawData);
      setJobData(normalizedData);
      return normalizedData;
    } catch (error) {
      console.error("Error fetching job:", error);
      return null;
    }
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    pollStartTimeRef.current = null;
    setPollCount(0);
  };

  const startPollingForExtraction = (jobId: string) => {
    stopPolling();
    setPollCount(0);
    pollStartTimeRef.current = Date.now();

    const TIMEOUT_MS = 300000; // 5 minutes max (increased for large PDFs)

    const poll = async () => {
      // Check timeout
      if (pollStartTimeRef.current && Date.now() - pollStartTimeRef.current > TIMEOUT_MS) {
        stopPolling();
        setState({ step: "failed", jobId, error: "Extraction timed out after 5 minutes" });
        toast({
          title: "Extraction timeout",
          description: "The extraction is taking longer than expected. Please check your Azure Document Intelligence service or try a simpler PDF.",
          variant: "destructive",
        });
        return;
      }

      setPollCount(prev => prev + 1);
      const job = await getJob(jobId);
      
      if (!job) return;

      // Check if evidence URLs are available (extraction complete)
      const hasEvidence = job.evidenceReadUrl || job.evidenceMdUrl || job.evidenceTxtUrl;
      
      if (hasEvidence) {
        stopPolling();
        setState({ step: "extracted", jobId });
        loadEvidence(job);
      } else if (job.status === "Failed" || job.error) {
        stopPolling();
        setState({ step: "failed", jobId, error: job.error || "Extraction failed" });
        toast({
          title: "Extraction failed",
          description: job.error || "Failed to extract content from PDF",
          variant: "destructive",
        });
      }
    };

    poll();
    pollingIntervalRef.current = window.setInterval(poll, 2000);
  };

  const loadEvidence = async (job: JobResponse, retryCount = 0) => {
    const readUrl = job.evidenceReadUrl || job.evidenceMdUrl || job.evidenceTxtUrl;
    
    if (!readUrl) {
      toast({
        title: "No evidence found",
        description: "Could not find evidence URL",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(readUrl);
      
      if (!response.ok) {
        // Handle SAS expiry with automatic refresh and retry
        if (response.status === 403 && retryCount === 0) {
          toast({
            title: "SAS expired",
            description: "Refreshing link and retrying...",
          });
          
          const refreshedJob = await getJob(job.id);
          if (refreshedJob) {
            return loadEvidence(refreshedJob, retryCount + 1);
          }
        }
        throw new Error("Failed to load evidence");
      }

      const content = await response.text();
      setEvidenceContent(content);
      setOriginalEvidence(content);
      setState({ step: "editing", jobId: job.id, evidenceContent: content });
      
      toast({
        title: "Evidence loaded",
        description: "You can now review and edit the extracted content",
      });
    } catch (error) {
      toast({
        title: "Failed to load evidence",
        description: error instanceof Error ? error.message : "Could not load evidence content",
        variant: "destructive",
      });
    }
  };

  const saveEvidence = async () => {
    if (state.step !== "editing") return;

    const job = jobData;
    if (!job?.evidenceWriteUrl) {
      toast({
        title: "Cannot save",
        description: "No write URL available",
        variant: "destructive",
      });
      return;
    }

    try {
      const isMd = job.evidenceWriteUrl.includes(".md");
      const contentType = isMd ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8";

      const response = await fetch(job.evidenceWriteUrl, {
        method: "PUT",
        headers: {
          "x-ms-blob-type": "BlockBlob",
          "x-ms-blob-content-type": contentType,
          "Content-Type": contentType,
        },
        body: evidenceContent,
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast({
            title: "SAS expired",
            description: "Refreshing link and retrying...",
          });
          
          const refreshedJob = await getJob(state.jobId);
          if (refreshedJob?.evidenceWriteUrl) {
            const retryResponse = await fetch(refreshedJob.evidenceWriteUrl, {
              method: "PUT",
              headers: {
                "x-ms-blob-type": "BlockBlob",
                "x-ms-blob-content-type": contentType,
                "Content-Type": contentType,
              },
              body: evidenceContent,
            });

            if (!retryResponse.ok) {
              throw new Error("Failed to save after refresh");
            }
          } else {
            throw new Error("Could not refresh write URL");
          }
        } else {
          throw new Error(`Save failed: ${response.statusText}`);
        }
      }

      toast({
        title: "Saved",
        description: "Evidence has been saved successfully",
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save evidence",
        variant: "destructive",
      });
    }
  };

  const startGeneration = async () => {
    if (state.step !== "editing") return;

    try {
      const response = await fetch(`${FUNC_BASE}/api/StartGeneration`, {
        method: "POST",
        headers: {
          "x-functions-key": FUNC_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId: state.jobId,
          outputType,
          generalPrompt,
          specialPrompt,
        }),
      });

      if (!response.ok) {
        throw new Error(`Generation failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.ok) {
        throw new Error("Generation request failed");
      }

      toast({
        title: "Generation started",
        description: "Generating decoder artifacts...",
      });

      setState({ step: "generating", jobId: state.jobId });
      startPollingForGeneration(state.jobId);
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Could not start generation",
        variant: "destructive",
      });
    }
  };

  const startPollingForGeneration = (jobId: string) => {
    stopPolling();
    setPollCount(0);
    pollStartTimeRef.current = Date.now();

    const TIMEOUT_MS = 300000; // 5 minutes max for generation

    const poll = async () => {
      // Check timeout
      if (pollStartTimeRef.current && Date.now() - pollStartTimeRef.current > TIMEOUT_MS) {
        stopPolling();
        setState({ step: "failed", jobId, error: "Generation timed out after 5 minutes" });
        toast({
          title: "Generation timeout",
          description: "The generation is taking longer than expected. Please check Azure Portal.",
          variant: "destructive",
        });
        return;
      }

      setPollCount(prev => prev + 1);
      const job = await getJob(jobId);
      
      if (!job) return;

      // Check if artifact URLs are available (generation complete)
      const hasArtifacts = job.resultJsonUrl || job.fullDecoderUrl || job.consoleDecoderUrl;
      
      if (hasArtifacts) {
        stopPolling();
        setState({ step: "done", jobId });
        toast({
          title: "Generation complete",
          description: "Your decoder artifacts are ready for download",
        });
      } else if (job.status === "Failed" || job.error) {
        stopPolling();
        setState({ step: "failed", jobId, error: job.error || "Generation failed" });
        toast({
          title: "Generation failed",
          description: job.error || "Failed to generate artifacts",
          variant: "destructive",
        });
      }
    };

    poll();
    pollingIntervalRef.current = window.setInterval(poll, 2000);
  };

  const downloadFile = async (url: string | null, filename: string, retryCount = 0) => {
    if (!url) {
      toast({
        title: "Download failed",
        description: "File URL not available",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        // Handle SAS expiry with automatic refresh and retry
        if (response.status === 403 && retryCount === 0 && state.step === "done") {
          toast({
            title: "Link expired",
            description: "Refreshing links and retrying...",
          });
          
          const refreshedJob = await getJob(state.jobId);
          if (refreshedJob) {
            // Retry with refreshed URL
            const urlType = url === jobData?.resultJsonUrl ? refreshedJob.resultJsonUrl :
                           url === jobData?.fullDecoderUrl ? refreshedJob.fullDecoderUrl :
                           refreshedJob.consoleDecoderUrl;
            
            if (urlType) {
              return downloadFile(urlType, filename, retryCount + 1);
            }
          }
        }
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      
      toast({
        title: "Download complete",
        description: `${filename} has been downloaded`,
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Could not download file",
        variant: "destructive",
      });
    }
  };

  const resetWorkflow = () => {
    setState({ step: "idle" });
    setSelectedFile(null);
    setEvidenceContent("");
    setOriginalEvidence("");
    setOutputType("csharp");
    setGeneralPrompt("Keep code idiomatic .NET 8. Minimal allocations.");
    setSpecialPrompt("");
    setJobData(null);
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Upload */}
      {state.step === "idle" && (
        <Card className="glass-card" data-testid="card-upload">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Step 1: Upload PDF
            </CardTitle>
            <CardDescription>
              Upload a PDF document to extract decoder evidence using Azure Document Intelligence
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pdf-file">Select PDF File</Label>
              <input
                id="pdf-file"
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  file:cursor-pointer cursor-pointer"
                data-testid="input-pdf-file"
              />
            </div>
            
            {selectedFile && (
              <div className="p-3 bg-secondary rounded-md" data-testid="text-selected-file">
                <p className="text-sm font-medium">Selected: {selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  Size: {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
              </div>
            )}

            <Button
              onClick={uploadPdf}
              disabled={!selectedFile}
              className="w-full"
              data-testid="button-upload"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload and Extract
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Extracting State */}
      {state.step === "extracting" && (
        <Card className="glass-card" data-testid="card-extracting">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">Extracting with Azure Document Intelligence...</h3>
                <p className="text-sm text-muted-foreground">This may take 10-20 seconds (complex PDFs can take longer)</p>
                {pollCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Checked {pollCount} time{pollCount !== 1 ? 's' : ''} • Will timeout after 5 minutes
                  </p>
                )}
              </div>
              <Button
                onClick={() => {
                  stopPolling();
                  setState({ step: "idle" });
                  toast({
                    title: "Cancelled",
                    description: "Extraction cancelled",
                  });
                }}
                variant="outline"
                data-testid="button-cancel-extraction"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Edit Evidence */}
      {(state.step === "editing" || state.step === "extracted") && (
        <>
          <Card className="glass-card" data-testid="card-editing">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Step 2: Review & Edit Evidence
              </CardTitle>
              <CardDescription>
                Review and edit the extracted evidence before generating decoder code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="evidence-editor">Evidence Content</Label>
                <Textarea
                  id="evidence-editor"
                  value={evidenceContent}
                  onChange={(e) => setEvidenceContent(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                  placeholder="Extracted evidence will appear here..."
                  data-testid="textarea-evidence"
                />
              </div>

              <Button
                onClick={saveEvidence}
                variant="outline"
                className="w-full"
                data-testid="button-save"
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>

              <p className="text-xs text-muted-foreground">
                💡 If save fails with 403, we'll automatically refresh the link and retry
              </p>
            </CardContent>
          </Card>

          <Card className="glass-card" data-testid="card-generation-config">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Step 3: Configure & Generate
              </CardTitle>
              <CardDescription>
                Configure generation options and start decoder generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="output-type">Output Type</Label>
                <Select value={outputType} onValueChange={setOutputType}>
                  <SelectTrigger id="output-type" data-testid="select-output-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csharp">C# (.NET)</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Collapsible open={isGeneralPromptOpen} onOpenChange={setIsGeneralPromptOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between" data-testid="button-toggle-general">
                    General Prompt
                    {isGeneralPromptOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <Textarea
                    value={generalPrompt}
                    onChange={(e) => setGeneralPrompt(e.target.value)}
                    className="min-h-[100px]"
                    placeholder="General instructions for code generation..."
                    data-testid="textarea-general-prompt"
                  />
                </CollapsibleContent>
              </Collapsible>

              <Collapsible open={isSpecialPromptOpen} onOpenChange={setIsSpecialPromptOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between" data-testid="button-toggle-special">
                    Special Prompt (Optional)
                    {isSpecialPromptOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <Textarea
                    value={specialPrompt}
                    onChange={(e) => setSpecialPrompt(e.target.value)}
                    className="min-h-[100px]"
                    placeholder="Special requirements (e.g., 'Normalize GPS fields to WGS84 if present')..."
                    data-testid="textarea-special-prompt"
                  />
                </CollapsibleContent>
              </Collapsible>

              <Button
                onClick={startGeneration}
                className="w-full"
                data-testid="button-start-generation"
              >
                Start Generation
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Generating State */}
      {state.step === "generating" && (
        <Card className="glass-card" data-testid="card-generating">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <div className="text-center space-y-2">
                <h3 className="text-lg font-semibold">Generating decoder artifacts...</h3>
                <p className="text-sm text-muted-foreground">This may take 1-2 minutes</p>
                {pollCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Checked {pollCount} time{pollCount !== 1 ? 's' : ''} • Will timeout after 5 minutes
                  </p>
                )}
              </div>
              <Button
                onClick={() => {
                  stopPolling();
                  setState({ step: "editing", jobId: state.jobId, evidenceContent });
                  toast({
                    title: "Cancelled",
                    description: "Generation cancelled",
                  });
                }}
                variant="outline"
                data-testid="button-cancel-generation"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Downloads */}
      {state.step === "done" && jobData && (
        <Card className="glass-card" data-testid="card-downloads">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Download Artifacts
            </CardTitle>
            <CardDescription>
              Your decoder artifacts are ready for download
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                ✅ Generation complete! Download your artifacts below:
              </p>
            </div>

            <div className="grid gap-2">
              <Button
                onClick={() => downloadFile(jobData.resultJsonUrl, "result.json")}
                variant="outline"
                className="justify-start"
                data-testid="button-download-json"
              >
                <Download className="w-4 h-4 mr-2" />
                Download result.json
              </Button>
              <Button
                onClick={() => downloadFile(jobData.fullDecoderUrl, "fullDecoder.cs")}
                variant="outline"
                className="justify-start"
                data-testid="button-download-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Download fullDecoder.{outputType === "csharp" ? "cs" : outputType === "python" ? "py" : "js"}
              </Button>
              <Button
                onClick={() => downloadFile(jobData.consoleDecoderUrl, "consoleDecoder.cs")}
                variant="outline"
                className="justify-start"
                data-testid="button-download-console"
              >
                <Download className="w-4 h-4 mr-2" />
                Download consoleDecoder.{outputType === "csharp" ? "cs" : outputType === "python" ? "py" : "js"}
              </Button>
            </div>

            <Button
              onClick={() => getJob(state.jobId)}
              variant="ghost"
              size="sm"
              className="w-full"
              data-testid="button-refresh-links"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh download links
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              💡 If downloads fail, click 'Refresh download links' and retry
            </p>
          </CardContent>
        </Card>
      )}


      {/* Failed State */}
      {state.step === "failed" && (
        <Card className="glass-card border-destructive" data-testid="card-failed">
          <CardContent className="py-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 bg-destructive/10 rounded-full">
                <FileText className="w-8 h-8 text-destructive" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-destructive">Operation Failed</h3>
                <p className="text-sm text-muted-foreground mt-2">{state.error}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={resetWorkflow} variant="outline" data-testid="button-start-over">
                  Start Over
                </Button>
                {state.jobId && (
                  <Button
                    onClick={() => {
                      setState({ step: "editing", jobId: state.jobId, evidenceContent });
                    }}
                    data-testid="button-back-to-edit"
                  >
                    Back to Edit
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reset button for completed workflow */}
      {state.step === "done" && (
        <Button
          onClick={resetWorkflow}
          variant="outline"
          className="w-full"
          data-testid="button-new-job"
        >
          Start New Job
        </Button>
      )}
    </div>
  );
};
