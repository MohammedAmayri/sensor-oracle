import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<DeviceModelResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supplier.trim() || !model.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both supplier and model",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // TODO: Replace with actual Azure function URL
      const apiUrl = "https://your-azure-function.azurewebsites.net/api/device-model-finder";
      
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          supplier: supplier.trim(),
          model: model.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch device model");
      }

      const data = await res.json();
      setResponse(data);
      
      toast({
        title: "Success",
        description: "Device model found successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch device model",
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
          <CardTitle className="glow-text">Device Model Finder</CardTitle>
          <CardDescription>Search for IoT device models by supplier and model name</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input
                id="supplier"
                placeholder="e.g., Small Data Garden"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="bg-input border-primary/30 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                placeholder="e.g., IOTSU AQ01"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bg-input border-primary/30 focus:border-primary"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search />
                  Find Device Model
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
                Best Match
                <span className="text-sm font-normal text-muted-foreground">
                  ({(response.confidence * 100).toFixed(0)}% confidence)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Manufacturer</p>
                  <p className="font-medium text-primary">{response.bestMatch.manufacturer}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Connectivity</p>
                  <p className="font-medium">{response.bestMatch.connectivity}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Model Name</p>
                  <p className="font-medium">{response.bestMatch.modelName}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Model ID</p>
                  <p className="font-mono text-sm text-primary">{response.bestMatch.modelId}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">ISM Bands</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {response.bestMatch.ismBands.map((band) => (
                      <span
                        key={band}
                        className="px-2 py-0.5 rounded-full text-xs bg-secondary/20 text-secondary border border-secondary/30"
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
              <CardTitle className="text-lg">Why This Match?</CardTitle>
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
                <CardTitle className="text-lg">Alternative Matches</CardTitle>
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
              <CardTitle className="text-lg">Evidence</CardTitle>
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
