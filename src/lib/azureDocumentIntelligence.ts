/**
 * Azure Document Intelligence shared utilities
 * Used by both PdfDecoderGenerator and DecoderGenerator components
 */

export type JobStatus = "Uploaded" | "Extracting" | "Extracted" | "Generating" | "Done" | "Failed";

export interface JobResponse {
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

/**
 * Map numeric status codes from backend to string values
 */
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

/**
 * Normalize backend response to match frontend interface
 */
export const normalizeJobResponse = (data: any): JobResponse => {
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

/**
 * Upload PDF file and create a job for extraction
 */
export const uploadPdfFile = async (file: File): Promise<JobResponse> => {
  const arrayBuffer = await file.arrayBuffer();
  
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

  return data;
};

/**
 * Get job status and details
 */
export const getJob = async (jobId: string): Promise<JobResponse> => {
  const response = await fetch(`${FUNC_BASE}/api/job/${jobId}`, {
    headers: {
      "x-functions-key": FUNC_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get job: ${response.statusText}`);
  }

  const rawData = await response.json();
  return normalizeJobResponse(rawData);
};

/**
 * Load evidence content from job with automatic SAS refresh on expiry
 */
export const loadEvidenceWithRefresh = async (
  job: JobResponse,
  retryCount = 0
): Promise<string> => {
  const readUrl = job.evidenceReadUrl || job.evidenceMdUrl || job.evidenceTxtUrl;
  
  if (!readUrl) {
    throw new Error("No evidence URL available");
  }

  const response = await fetch(readUrl);
  
  if (!response.ok) {
    // Handle SAS expiry with automatic refresh and retry
    if (response.status === 403 && retryCount === 0) {
      const refreshedJob = await getJob(job.id);
      return loadEvidenceWithRefresh(refreshedJob, retryCount + 1);
    }
    throw new Error("Failed to load evidence");
  }

  return response.text();
};

/**
 * Save evidence content to Azure Blob Storage with SAS refresh
 */
export const saveEvidence = async (
  jobId: string,
  evidenceWriteUrl: string,
  content: string
): Promise<void> => {
  const isMd = evidenceWriteUrl.includes(".md");
  const contentType = isMd ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8";

  const response = await fetch(evidenceWriteUrl, {
    method: "PUT",
    headers: {
      "x-ms-blob-type": "BlockBlob",
      "x-ms-blob-content-type": contentType,
      "Content-Type": contentType,
    },
    body: content,
  });

  if (!response.ok) {
    if (response.status === 403) {
      // SAS expired, refresh and retry
      const refreshedJob = await getJob(jobId);
      if (!refreshedJob.evidenceWriteUrl) {
        throw new Error("Could not refresh write URL");
      }
      
      const retryResponse = await fetch(refreshedJob.evidenceWriteUrl, {
        method: "PUT",
        headers: {
          "x-ms-blob-type": "BlockBlob",
          "x-ms-blob-content-type": contentType,
          "Content-Type": contentType,
        },
        body: content,
      });

      if (!retryResponse.ok) {
        throw new Error("Failed to save after refresh");
      }
    } else {
      throw new Error(`Save failed: ${response.statusText}`);
    }
  }
};

/**
 * Poll job until condition is met or timeout occurs
 */
export const pollJobUntil = async (
  jobId: string,
  condition: (job: JobResponse) => boolean,
  onUpdate: (job: JobResponse) => void,
  timeoutMs = 300000, // 5 minutes
  intervalMs = 2000 // 2 seconds
): Promise<JobResponse> => {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error("Polling timeout"));
        return;
      }

      try {
        const job = await getJob(jobId);
        onUpdate(job);

        if (condition(job)) {
          resolve(job);
        } else if (job.status === "Failed" || job.error) {
          reject(new Error(job.error || "Job failed"));
        } else {
          setTimeout(poll, intervalMs);
        }
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
};
