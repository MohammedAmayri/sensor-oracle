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
  onChange?: (value: string) => void;
  contentType?: "code" | "markdown" | "rules" | "plain";
  language?: string;
  readonly?: boolean;
  previewOnly?: boolean;
  defaultMode?: "preview" | "edit";
  placeholder?: string;
  dataTestId?: string;
}

export const ContentDisplay = ({
  content,
  onChange,
  contentType = "plain",
  language = "csharp",
  readonly = false,
  previewOnly = false,
  defaultMode = "preview",
  placeholder = "No content available",
  dataTestId = "content-display",
}: ContentDisplayProps) => {
  const [mode, setMode] = useState<"preview" | "edit">(defaultMode);

  const showToggle = !readonly && !previewOnly && onChange;

  return (
    <div className="space-y-2">
      {showToggle && (
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

      {!content && (
        <div className="border rounded-md bg-muted p-8 text-center text-muted-foreground">
          {placeholder}
        </div>
      )}

      {content && (mode === "preview" || readonly || previewOnly) && (
        <div className="border rounded-md bg-background">
          {contentType === "code" && (
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

          {contentType === "markdown" && (
            <div className="p-4 prose prose-sm dark:prose-invert max-w-none" data-testid={dataTestId}>
              <ReactMarkdown rehypePlugins={[rehypeRaw, rehypeSanitize]}>
                {content}
              </ReactMarkdown>
            </div>
          )}

          {(contentType === "rules" || contentType === "plain") && (
            <pre className="p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap" data-testid={dataTestId}>
              <code>{content}</code>
            </pre>
          )}
        </div>
      )}

      {content && mode === "edit" && !readonly && !previewOnly && onChange && (
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
