import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit3, Eye } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

interface ContentDisplayProps {
  content: string;
  onChange: (value: string) => void;
  contentType?: "code" | "markdown" | "rules" | "auto";
  language?: string;
  readonly?: boolean;
  dataTestId?: string;
}

export const ContentDisplay = ({
  content,
  onChange,
  contentType = "auto",
  language = "csharp",
  readonly = false,
  dataTestId,
}: ContentDisplayProps) => {
  const [mode, setMode] = useState<"preview" | "edit">("preview");

  // Auto-detect content type if not specified
  const detectedType = contentType === "auto" ? detectContentType(content) : contentType;

  return (
    <div className="space-y-2">
      {!readonly && (
        <div className="flex gap-2 mb-2">
          <Button
            variant={mode === "preview" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("preview")}
            data-testid={`${dataTestId}-preview-button`}
          >
            <Eye className="w-3 h-3 mr-2" />
            Preview
          </Button>
          <Button
            variant={mode === "edit" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("edit")}
            data-testid={`${dataTestId}-edit-button`}
          >
            <Edit3 className="w-3 h-3 mr-2" />
            Edit
          </Button>
        </div>
      )}

      {mode === "preview" || readonly ? (
        <div className="border rounded-md bg-background">
          {detectedType === "code" && (
            <SyntaxHighlighter
              language={language}
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                maxHeight: "none",
              }}
              wrapLongLines={true}
              data-testid={dataTestId}
            >
              {content}
            </SyntaxHighlighter>
          )}

          {detectedType === "markdown" && (
            <div className="p-4 prose prose-sm dark:prose-invert max-w-none" data-testid={dataTestId}>
              <ReactMarkdown rehypePlugins={[rehypeRaw, rehypeSanitize]}>
                {content}
              </ReactMarkdown>
            </div>
          )}

          {(detectedType === "rules" || detectedType === "auto") && (
            <pre className="p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap" data-testid={dataTestId}>
              <code>{content}</code>
            </pre>
          )}
        </div>
      ) : (
        <Textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-sm resize-none"
          style={{
            minHeight: "200px",
            height: "auto",
            maxHeight: "none",
          }}
          rows={Math.min(Math.max(content.split('\n').length + 2, 10), 50)}
          data-testid={`${dataTestId}-textarea`}
        />
      )}
    </div>
  );
};

// Helper function to detect content type
function detectContentType(content: string): "code" | "markdown" | "rules" | "auto" {
  if (!content) return "auto";

  // Check for C# code patterns
  if (
    content.includes("using ") ||
    content.includes("namespace ") ||
    content.includes("public class ") ||
    content.includes("public static ") ||
    content.includes("private ") ||
    content.includes("return ")
  ) {
    return "code";
  }

  // Check for markdown tables
  if (content.includes("|") && content.includes("---")) {
    return "markdown";
  }

  // Check for rules format (MAP, LOOKUP, RENDER, BITFIELDS)
  if (
    content.includes("MAP:") ||
    content.includes("LOOKUP:") ||
    content.includes("RENDER:") ||
    content.includes("BITFIELDS")
  ) {
    return "rules";
  }

  // Check for other markdown patterns
  if (
    content.includes("# ") ||
    content.includes("## ") ||
    content.includes("### ") ||
    content.includes("**") ||
    content.includes("```")
  ) {
    return "markdown";
  }

  return "auto";
}
