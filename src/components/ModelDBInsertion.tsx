import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Database } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ModelDBResponse {
  sql: string;
  unknownKeys: string[];
  mapped: Array<{
    attributeName: string;
    dataAttributeId: number;
    valueKind: string;
    friendlyName: string;
    description: string;
    includeInResponse: boolean;
    notificationType: string;
  }>;
  templateSource: {
    builtinCount: number;
    csvCount: number;
    csvPath: string;
    loadedFromCsv: boolean;
  };
}

export const ModelDBInsertion = () => {
  const [jsonInput, setJsonInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ModelDBResponse | null>(null);

  const normalizeNumbers = (str: string): string => {
    // Replace commas with periods in numbers
    return str.replace(/(\d),(\d)/g, "$1.$2");
  };

  const formatSQL = (sql: string): string => {
    // Basic SQL formatting
    return sql
      .replace(/\r\n/g, "\n")
      .replace(/;/g, ";\n")
      .replace(/BEGIN/gi, "\nBEGIN")
      .replace(/END/gi, "\nEND")
      .replace(/SELECT/gi, "\nSELECT")
      .replace(/FROM/gi, "\nFROM")
      .replace(/WHERE/gi, "\nWHERE")
      .replace(/INSERT INTO/gi, "\nINSERT INTO")
      .replace(/VALUES/gi, "\nVALUES")
      .replace(/UPDATE/gi, "\nUPDATE")
      .replace(/SET/gi, "\nSET")
      .replace(/DECLARE/gi, "\nDECLARE")
      .trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!jsonInput.trim()) {
      toast({
        title: "Information saknas",
        description: "Vänligen ange JSON-data",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Normalize numbers first
      const normalizedInput = normalizeNumbers(jsonInput);
      
      // Parse to validate JSON
      const parsedInput = JSON.parse(normalizedInput);

      // TODO: Replace with actual Azure function URL
      const apiUrl = "https://your-azure-function.azurewebsites.net/api/model-db-insertion";

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsedInput),
      });

      if (!res.ok) {
        throw new Error("Failed to process model insertion");
      }

      const data = await res.json();
      setResponse(data);

      toast({
        title: "Lyckades",
        description: "Modell DB-infogning behandlades",
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast({
          title: "Ogiltig JSON",
          description: "Vänligen ange giltig JSON-data",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Fel",
          description: error instanceof Error ? error.message : "Kunde inte behandla infogning",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="glow-border">
        <CardHeader>
          <CardTitle className="glow-text">Modell DB-infogning</CardTitle>
          <CardDescription>Generera SQL för infogning av enhetsmodell i databas</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="jsonInput">JSON-data</Label>
              <Textarea
                id="jsonInput"
                placeholder='{"decoderName": "DecoderName", "deviceProfile": "...", ...}'
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="min-h-[200px] code-font text-sm bg-input border-primary/30 focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">
                Obs: Tal med kommatecken kommer automatiskt normaliseras till punkter
              </p>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Bearbetar...
                </>
              ) : (
                <>
                  <Database />
                  Generera SQL
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {response && (
        <div className="space-y-4">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                Genererad SQL
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(formatSQL(response.sql));
                    toast({
                      title: "Kopierad!",
                      description: "SQL kopierad till urklipp",
                    });
                  }}
                >
                  Kopiera SQL
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-background/50 p-4 rounded-lg overflow-x-auto border border-border">
                <pre className="code-font text-xs text-foreground whitespace-pre-wrap">
                  {formatSQL(response.sql)}
                </pre>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {response.unknownKeys && response.unknownKeys.length > 0 && (
              <Card className="border-destructive/30">
                <CardHeader>
                  <CardTitle className="text-lg text-destructive">Okända nycklar</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {response.unknownKeys.map((key, idx) => (
                      <li key={idx} className="text-sm font-mono text-destructive">
                        • {key}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Mallkälla</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Inbyggt antal:</span>
                  <span className="font-medium">{response.templateSource.builtinCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CSV-antal:</span>
                  <span className="font-medium">{response.templateSource.csvCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Laddad från CSV:</span>
                  <span className="font-medium">
                    {response.templateSource.loadedFromCsv ? "Ja" : "Nej"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Mappade attribut</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {response.mapped.map((attr, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg bg-muted/50 border border-border space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-primary">{attr.attributeName}</p>
                        <p className="text-sm text-muted-foreground">{attr.friendlyName}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-secondary/20 text-secondary border border-secondary/30">
                        {attr.valueKind}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{attr.description}</p>
                    <div className="flex gap-4 text-xs">
                      <span className="text-muted-foreground">
                        ID: <span className="text-foreground font-mono">{attr.dataAttributeId}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Typ: <span className="text-foreground">{attr.notificationType}</span>
                      </span>
                      <span className="text-muted-foreground">
                        I svar: <span className="text-foreground">{attr.includeInResponse ? "Ja" : "Nej"}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
