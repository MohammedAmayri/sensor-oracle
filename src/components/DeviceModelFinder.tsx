import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DeviceModelResponse {
  status: string;
  query: {
    supplier: string;
    model: string;
    region: string;
  };
  bestMatch: {
    manufacturer: string;
    modelName: string;
    modelId: string;
    connectivity: string;
    ismBands: string[];
  };
  confidence: number;
  why: string[];
  alternatives: Array<{
    manufacturer: string;
    modelName: string;
    modelId: string;
    connectivity: string;
    ismBands: string[];
  }>;
  evidence: {
    lorawan_version: string;
    device_class: string;
    manufacturer: string;
    model_name: string;
    regions: string[];
    sources: string[];
    notes: string;
  };
}

export const DeviceModelFinder = () => {
  const [supplier, setSupplier] = useState("");
  const [model, setModel] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [inputMode, setInputMode] = useState<"fields" | "json">("fields");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<DeviceModelResponse | null>(null);

  const extractFromJson = (jsonStr: string): { supplier: string; model: string } | null => {
    try {
      const data = JSON.parse(jsonStr);
      
      // Try to find supplier and model from common field names
      const supplier = data.supplier || data.Supplier || data.manufacturer || data.Manufacturer || "";
      const model = data.model || data.Model || data.modelName || data.ModelName || 
                   data.deviceProfile || data.DeviceProfile || "";
      
      if (supplier || model) {
        return { supplier, model };
      }
      
      return null;
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalSupplier = supplier;
    let finalModel = model;
    
    if (inputMode === "json") {
      if (!jsonInput.trim()) {
        toast({
          title: "Information saknas",
          description: "Vänligen ange JSON-data",
          variant: "destructive",
        });
        return;
      }
      
      const extracted = extractFromJson(jsonInput);
      if (!extracted || (!extracted.supplier && !extracted.model)) {
        toast({
          title: "Kunde inte extrahera data",
          description: "JSON måste innehålla 'supplier' och 'model' fält",
          variant: "destructive",
        });
        return;
      }
      
      finalSupplier = extracted.supplier;
      finalModel = extracted.model;
    } else {
      if (!supplier.trim() || !model.trim()) {
        toast({
          title: "Information saknas",
          description: "Vänligen ange både leverantör och modell",
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_DEVICE_MODEL_FINDER_URL;
      
      if (!apiUrl) {
        throw new Error("API URL saknas. Kontrollera konfigurationen.");
      }
      
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          supplier: finalSupplier.trim(),
          model: finalModel.trim(),
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("API Error:", res.status, errorText);
        throw new Error(`API-fel (${res.status}): ${errorText || res.statusText}`);
      }

      const data = await res.json();
      setResponse(data);
      
      toast({
        title: "Lyckades",
        description: "Enhetsmodell hittades",
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: error instanceof Error ? error.message : "Kunde inte hämta enhetsmodell",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="glow-border">
        <CardHeader>
          <CardTitle className="glow-text">Enhetsmodellfinnare</CardTitle>
          <CardDescription>Sök efter IoT-enhetsmodeller via leverantör och modellnamn</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Tabs defaultValue="fields" onValueChange={(v) => setInputMode(v as "fields" | "json")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="fields" data-testid="tab-fields">Fält</TabsTrigger>
                <TabsTrigger value="json" data-testid="tab-json">JSON</TabsTrigger>
              </TabsList>
              
              <TabsContent value="fields" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="supplier">Leverantör</Label>
                  <Input
                    id="supplier"
                    data-testid="input-supplier"
                    placeholder="t.ex. Small Data Garden"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="bg-input border-primary/30 focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Modell</Label>
                  <Input
                    id="model"
                    data-testid="input-model"
                    placeholder="t.ex. IOTSU AQ01"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="bg-input border-primary/30 focus:border-primary"
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="json" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="jsonInput">JSON-data</Label>
                  <Textarea
                    id="jsonInput"
                    data-testid="input-json"
                    placeholder='{"supplier": "Small Data Garden", "model": "IOTSU AQ01"}'
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    className="min-h-[200px] code-font text-sm bg-input border-primary/30 focus:border-primary"
                  />
                  <p className="text-xs text-muted-foreground">
                    JSON måste innehålla fält som 'supplier' och 'model' (eller liknande varianter)
                  </p>
                </div>
              </TabsContent>
            </Tabs>
            
            <Button type="submit" disabled={loading} className="w-full" data-testid="button-search">
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Söker...
                </>
              ) : (
                <>
                  <Search />
                  Hitta enhetsmodell
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
              <CardTitle className="text-lg flex items-center gap-2">
                Bästa matchning
                <span className="text-sm font-normal text-muted-foreground">
                  ({(response.confidence * 100).toFixed(0)}% säkerhet)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Tillverkare</p>
                  <p className="font-medium text-primary">{response.bestMatch.manufacturer}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Anslutning</p>
                  <p className="font-medium">{response.bestMatch.connectivity}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Modellnamn</p>
                  <p className="font-medium">{response.bestMatch.modelName}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Modell-ID</p>
                  <p className="font-mono text-sm text-primary">{response.bestMatch.modelId}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">ISM-band</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {response.bestMatch.ismBands.map((band) => (
                      <span
                        key={band}
                        className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/30"
                      >
                        {band}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-accent/30">
            <CardHeader>
              <CardTitle className="text-lg">Varför denna matchning?</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {response.why.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-accent mt-1">•</span>
                    <span className="text-sm">{reason}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {response.alternatives && response.alternatives.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Alternativa matchningar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {response.alternatives.map((alt, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-muted/50 border border-border space-y-1"
                  >
                    <p className="font-medium">{alt.modelName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{alt.modelId}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {alt.ismBands.map((band) => (
                        <span
                          key={band}
                          className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20"
                        >
                          {band}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bevis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 code-font text-sm">
                <pre className="bg-background/50 p-4 rounded-lg overflow-x-auto border border-border">
                  {JSON.stringify(response.evidence, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
