import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Database, Wand2, Copy, Plus, Trash2 } from "lucide-react";
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

interface AttributeUnit {
  id: number;
  unit: string;
}

interface AdditionalAttribute {
  attributeName: string;
  dataAttributeId: number;
  attributeDescription: string;
  attributeFriendlyName: string;
  includeInResponse: boolean;
  notificationType: string;
  valueKind: string;
}

const ATTRIBUTE_UNITS: AttributeUnit[] = [
  { id: 1, unit: "Unknown" },
  { id: 2, unit: "Amp" },
  { id: 3, unit: "grader" },
  { id: 4, unit: "status" },
  { id: 5, unit: "%" },
  { id: 6, unit: "tal" },
  { id: 7, unit: "Lux" },
  { id: 8, unit: "kPa" },
  { id: 9, unit: "st" },
  { id: 10, unit: "C" },
  { id: 11, unit: "mV" },
  { id: 12, unit: "ppb" },
  { id: 13, unit: "m/s" },
  { id: 14, unit: "text" },
  { id: 15, unit: "V" },
  { id: 16, unit: "Ohm" },
  { id: 17, unit: "ppm" },
  { id: 18, unit: "hPa" },
  { id: 19, unit: "µg/m3" },
  { id: 20, unit: "dBA" },
  { id: 21, unit: "µm" },
  { id: 22, unit: "#/cm3" },
  { id: 23, unit: "mm" },
  { id: 24, unit: "s" },
  { id: 25, unit: "W/m2" },
  { id: 26, unit: "mm/h" },
  { id: 27, unit: "km" },
  { id: 28, unit: "m" },
  { id: 29, unit: "kWh" },
  { id: 30, unit: "kVarh" },
  { id: 31, unit: "m3" },
  { id: 32, unit: "l" },
  { id: 33, unit: "Wh" },
  { id: 34, unit: "VArh" },
  { id: 35, unit: "W" },
  { id: 36, unit: "mA" },
  { id: 37, unit: "V" },
  { id: 38, unit: "Hz" },
  { id: 39, unit: "nm" },
  { id: 40, unit: "Pa" },
  { id: 41, unit: "dB" },
  { id: 42, unit: "Bq/m3" },
  { id: 43, unit: "Ah" },
  { id: 44, unit: "ds/m" },
  { id: 45, unit: "g" },
  { id: 46, unit: "min" },
];

interface IotPlatform {
  id: number;
  name: string;
}

const IOT_PLATFORMS: IotPlatform[] = [
  { id: 1, name: "Thingpark" },
  { id: 6, name: "Radonova" },
  { id: 7, name: "Chirpstack" },
  { id: 8, name: "Kameror MKB Net" },
  { id: 9, name: "Netmore" },
];

export const ModelDBInsertion = () => {
  const [decoderName, setDecoderName] = useState("");
  const [decodedData, setDecodedData] = useState("");
  const [deviceProfile, setDeviceProfile] = useState("");
  const [reformattedJson, setReformattedJson] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ModelDBResponse | null>(null);
  const [additionalAttributes, setAdditionalAttributes] = useState<AdditionalAttribute[]>([]);
  const [updatedSql, setUpdatedSql] = useState("");
  const [editableMappedAttributes, setEditableMappedAttributes] = useState<AdditionalAttribute[]>([]);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<number[]>([1]);

  const extractSupplierAndModel = (decoderName: string): { supplier: string; modelName: string } => {
    // Remove "Decoder" prefix if present
    let cleanName = decoderName.replace(/^Decoder/i, "");
    
    // Extract supplier (first word starting with capital letter)
    const supplierMatch = cleanName.match(/^([A-Z][a-z]+)/);
    const supplier = supplierMatch ? supplierMatch[1] : "";
    
    // Extract model code (everything after supplier)
    const modelCode = cleanName.substring(supplier.length);
    const modelName = supplier + (modelCode ? " " + modelCode : "");
    
    return { supplier, modelName };
  };

  const cleanDoubleQuotes = (text: string): string => {
    // Replace escaped double quotes ("") with single quotes (")
    return text.replace(/""/g, '"');
  };

  const convertToNumber = (value: string): number | string => {
    // Replace comma with period for European number format
    const normalized = value.replace(",", ".");
    const num = parseFloat(normalized);
    return !isNaN(num) ? num : value;
  };

  const handleReformat = () => {
    if (!decoderName.trim() || !decodedData.trim() || !deviceProfile.trim()) {
      toast({
        title: "Saknade fält",
        description: "Vänligen fyll i alla tre fält",
        variant: "destructive",
      });
      return;
    }

    try {
      // Parse the decoded data JSON
      const parsedData = JSON.parse(decodedData);
      
      // Extract supplier and model name
      const { supplier, modelName } = extractSupplierAndModel(decoderName);
      
      // Convert numeric strings to actual numbers
      const processedData: Record<string, any> = {};
      for (const [key, value] of Object.entries(parsedData)) {
        if (typeof value === "string") {
          // Try to convert numeric strings
          const numValue = convertToNumber(value);
          processedData[key] = numValue;
        } else {
          processedData[key] = value;
        }
      }
      
      // Create the reformatted object
      const reformatted = {
        decoderName: decoderName,
        deviceProfile: deviceProfile,
        modelName: modelName,
        supplier: supplier,
        useOpenAI: false,
        decodedData: processedData
      };
      
      const formattedJson = JSON.stringify(reformatted, null, 2);
      setReformattedJson(formattedJson);
      
      toast({
        title: "Omformaterad!",
        description: "Data har omformaterats till rätt format",
      });
    } catch (error) {
      toast({
        title: "Ogiltigt format",
        description: "Kunde inte tolka decoded data som JSON",
        variant: "destructive",
      });
    }
  };

  const normalizeNumbers = (str: string): string => {
    // Replace commas with periods in numbers
    return str.replace(/(\d),(\d)/g, "$1.$2");
  };

  const cleanSqlText = (sql: string): string => {
    let cleaned = sql;
    
    // Fix all attributeFriendlyName corruptions
    cleaned = cleaned.replace(/attributeFri\s*\n\s*ENDlyName/g, 'attributeFriendlyName');
    cleaned = cleaned.replace(/attributeFriENDlyName/g, 'attributeFriendlyName');
    
    // Fix mangled JSON keys (with or without line breaks)
    cleaned = cleaned.replace(/"\s*\n\s*SELECTable"/g, '"selectable"');
    cleaned = cleaned.replace(/SELECTable/g, 'selectable');
    
    return cleaned;
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

      const res = await fetch('/api/model-db-insertion', {
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
      
      // Clean the SQL before setting response
      data.sql = cleanSqlText(data.sql);
      
      setResponse(data);
      
      // Initialize editable mapped attributes from response
      setEditableMappedAttributes(data.mapped.map((attr: any) => ({
        attributeName: attr.attributeName,
        dataAttributeId: attr.dataAttributeId,
        attributeDescription: attr.description,
        attributeFriendlyName: attr.friendlyName,
        includeInResponse: attr.includeInResponse,
        notificationType: attr.notificationType,
        valueKind: attr.valueKind
      })));

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

  const addNewAttribute = () => {
    setAdditionalAttributes([...additionalAttributes, {
      attributeName: "",
      dataAttributeId: 1,
      attributeDescription: "",
      attributeFriendlyName: "",
      includeInResponse: true,
      notificationType: "M",
      valueKind: "string"
    }]);
  };

  const removeAttribute = (index: number) => {
    setAdditionalAttributes(additionalAttributes.filter((_, i) => i !== index));
  };

  const updateAttribute = (index: number, field: keyof AdditionalAttribute, value: any) => {
    const updated = [...additionalAttributes];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalAttributes(updated);
  };

  const updateMappedAttribute = (index: number, field: keyof AdditionalAttribute, value: any) => {
    const updated = [...editableMappedAttributes];
    updated[index] = { ...updated[index], [field]: value };
    setEditableMappedAttributes(updated);
  };

  const getMissingAttributes = (): string[] => {
    if (!jsonInput) return [];
    
    try {
      const normalizedInput = normalizeNumbers(jsonInput);
      const parsedInput = JSON.parse(normalizedInput);
      const decodedData = parsedInput.decodedData;
      
      if (!decodedData || typeof decodedData !== 'object') return [];
      
      const decodedKeys = Object.keys(decodedData);
      const existingAttributeNames = [
        ...editableMappedAttributes.map(attr => attr.attributeName),
        ...additionalAttributes.map(attr => attr.attributeName)
      ];
      
      return decodedKeys.filter(key => !existingAttributeNames.includes(key));
    } catch {
      return [];
    }
  };

  const addMissingAttributes = () => {
    const missingKeys = getMissingAttributes();
    
    if (missingKeys.length === 0) {
      toast({
        title: "Inga saknade attribut",
        description: "Alla attribut från decoded data är redan tillagda",
      });
      return;
    }

    const newAttributes = missingKeys.map(key => ({
      attributeName: key,
      dataAttributeId: 1,
      attributeDescription: "",
      attributeFriendlyName: key,
      includeInResponse: true,
      notificationType: "M",
      valueKind: "string"
    }));

    setAdditionalAttributes([...additionalAttributes, ...newAttributes]);

    toast({
      title: "Attribut tillagda",
      description: `${missingKeys.length} saknade attribut har lagts till`,
    });
  };

  const togglePlatform = (platformId: number) => {
    setSelectedPlatformIds(prev => {
      if (prev.includes(platformId)) {
        // Don't allow deselecting if it's the only one selected
        if (prev.length === 1) {
          toast({
            title: "Minst en plattform krävs",
            description: "Du måste ha minst en IoT-plattform vald",
            variant: "destructive"
          });
          return prev;
        }
        return prev.filter(id => id !== platformId);
      }
      return [...prev, platformId].sort();
    });
  };

  const updateSqlWithAttributes = () => {
    if (!response) return;

    const allAttributes = [
      ...editableMappedAttributes.map(attr => ({
        attributeName: attr.attributeName,
        dataAttributeId: attr.dataAttributeId,
        valueKind: attr.valueKind,
        friendlyName: attr.attributeFriendlyName,
        description: attr.attributeDescription,
        includeInResponse: attr.includeInResponse,
        notificationType: attr.notificationType
      })),
      ...additionalAttributes.map(attr => ({
        attributeName: attr.attributeName,
        dataAttributeId: attr.dataAttributeId,
        valueKind: attr.valueKind,
        friendlyName: attr.attributeFriendlyName,
        description: attr.attributeDescription,
        includeInResponse: attr.includeInResponse,
        notificationType: attr.notificationType
      }))
    ];

    // Generate the INSERT INTO @attrs VALUES section
    const attrValues = allAttributes.map(attr => {
      const valueListJson = `[\\n  { "value": "${attr.valueKind}", "description": "${attr.valueKind === 'number' ? 'Mätvärde' : 'Text'}", "selectable": false }\\n]`;
      return `        (${attr.dataAttributeId}, N'${attr.attributeName}', N'${attr.description}', N'${valueListJson}', ${attr.includeInResponse ? 1 : 0}, '${attr.notificationType}', N'${attr.friendlyName}')`;
    }).join(',\n');

    // Update the SQL by replacing the VALUES section
    let updatedSqlText = response.sql;
    
    // Find and replace the INSERT INTO @attrs VALUES section
    const insertPattern = /INSERT INTO @attrs[\s\S]*?VALUES[\s\S]*?;/i;
    const newInsert = `INSERT INTO @attrs
    ( dataAttributeId, attributeName, attributeDescription, attributeValueList, includeInResponse, notificationType, attributeFriendlyName )
    VALUES
${attrValues};`;
    
    updatedSqlText = updatedSqlText.replace(insertPattern, newInsert);
    
    // Apply SQL cleanup to fix corruptions
    updatedSqlText = cleanSqlText(updatedSqlText);
    
    // Ensure @csModel declaration exists (after @tpModel declaration)
    if (!updatedSqlText.includes('DECLARE @csModel')) {
      updatedSqlText = updatedSqlText.replace(
        /(DECLARE @tpModel\s+nvarchar\(200\)\s*=\s*N'[^']*';)/,
        `$1\n    DECLARE @csModel   nvarchar(200) = @tpModel; -- change if ChirpStack differs`
      );
    }
    
    // Ensure @iotPlatformDeviceModelId is declared in the platform linking section
    // We'll add it at the start of the platform linking sections
    
    // Generate platform linking sections for all selected platforms
    const platformLinkingDeclaration = `    /* ---- Link to IoT Platforms -------------------------------------------- */
    DECLARE @iotPlatformDeviceModelId int;
`;
    
    const platformLinkingSections = selectedPlatformIds.map(platformId => {
      const platform = IOT_PLATFORMS.find(p => p.id === platformId);
      const platformName = platform ? platform.name : `Platform ${platformId}`;
      
      // ThingPark (ID 1) uses JSON format, others use plain string
      const isThingPark = platformId === 1;
      const valueFormat = isThingPark
        ? `CONCAT('{"OTAA":"', @tpModel, '","ABP":"', @tpModel, '"}')`
        : `@csModel`;
      
      return `    /* ---- Link to ${platformName} (iotPlatformId = ${platformId}) ---------------------------- */
    IF NOT EXISTS
    (
        SELECT 1
        FROM dbo.iotPlatformDeviceModel
        WHERE iotPlatformId = ${platformId}
          AND deviceModelId = @deviceModelId
    )
    BEGIN
        INSERT INTO dbo.iotPlatformDeviceModel (iotPlatformId, deviceModelId)
        VALUES (${platformId}, @deviceModelId);
    END

    SELECT @iotPlatformDeviceModelId = iotPlatformDeviceModelId
    FROM dbo.iotPlatformDeviceModel
    WHERE iotPlatformId = ${platformId}
      AND deviceModelId = @deviceModelId;

    IF EXISTS
    (
        SELECT 1
        FROM dbo.iotDeviceModelTag
        WHERE iotPlatformDeviceModelId = @iotPlatformDeviceModelId
          AND tag = 'DeviceModelID'
    )
    BEGIN
        UPDATE dbo.iotDeviceModelTag
        SET [value] = ${valueFormat}
        WHERE iotPlatformDeviceModelId = @iotPlatformDeviceModelId
          AND tag = 'DeviceModelID';
    END
    ELSE
    BEGIN
        INSERT INTO dbo.iotDeviceModelTag (iotPlatformDeviceModelId, tag, [value])
        VALUES (@iotPlatformDeviceModelId, 'DeviceModelID', ${valueFormat});
    END`;
    }).join('\n\n');
    
    const completePlatformSection = platformLinkingDeclaration + '\n' + platformLinkingSections;
    
    // Replace all platform linking sections with new ones
    // Find the pattern starting from first "Link to" comment to COMMIT TRAN
    const platformSectionPattern = /\/\* ---- Link to.*?(?=COMMIT TRAN;)/s;
    updatedSqlText = updatedSqlText.replace(platformSectionPattern, completePlatformSection + '\n\n    ');
    
    // Update the primary platform ID in the initial INSERT statement (use first selected platform)
    const primaryPlatformId = selectedPlatformIds[0];
    updatedSqlText = updatedSqlText.replace(
      /\(.*deviceModelName.*deviceModelVersion.*deviceModelSupplier.*iotPlatformId.*decoderFunctionName.*display.*\)[\s\S]*?VALUES[\s\S]*?\(.*@name.*NULL.*@supplier.*\d+.*@decoder.*1.*\)/i,
      (match) => match.replace(/(@supplier,\s*)(\d+)/, `$1${primaryPlatformId}`)
    );
    
    setUpdatedSql(updatedSqlText);

    
    const totalChanges = additionalAttributes.length;
    toast({
      title: "SQL uppdaterad!",
      description: totalChanges > 0 
        ? `${editableMappedAttributes.length} befintliga attribut och ${totalChanges} nya attribut`
        : `${editableMappedAttributes.length} attribut uppdaterade`,
    });
  };

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-accent" />
            Infoga modelldata
          </CardTitle>
          <CardDescription>Fyll i fälten nedan och omformatera till rätt JSON-struktur</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="decoderName">Decoder Name</Label>
            <Input
              id="decoderName"
              data-testid="input-decoder-name"
              placeholder="t.ex. DecoderAdeunisARF8180BA"
              value={decoderName}
              onChange={(e) => setDecoderName(e.target.value)}
              className="bg-input/50 border-border/50 focus:border-primary"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="decodedData">Decoded Data (JSON)</Label>
            <Textarea
              id="decodedData"
              data-testid="input-decoded-data"
              placeholder='{"UplinkType": "Unknown condition code", "FrameCounter": 5, ...}'
              value={decodedData}
              onChange={(e) => setDecodedData(cleanDoubleQuotes(e.target.value))}
              className="min-h-[200px] code-font text-sm bg-input/50 border-border/50 focus:border-primary"
            />
            <p className="text-xs text-muted-foreground">
              Obs: Dubbla citattecken ("") ersätts automatiskt med enkla ("). Numeriska värden med kommatecken (t.ex. "35,0") konverteras automatiskt till tal
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="deviceProfile">Device Profile</Label>
            <Input
              id="deviceProfile"
              data-testid="input-device-profile"
              placeholder="t.ex. ADRF/TempA.1.0.2_EU"
              value={deviceProfile}
              onChange={(e) => setDeviceProfile(e.target.value)}
              className="bg-input/50 border-border/50 focus:border-primary"
            />
          </div>
          
          <Button 
            type="button" 
            onClick={handleReformat}
            data-testid="button-reformat"
            className="w-full bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent/80 glow-accent"
          >
            <Wand2 className="w-4 h-4" />
            Omformatera data
          </Button>
        </CardContent>
      </Card>

      {reformattedJson && (
        <Card className="glass-card border-accent/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Database className="w-5 h-5 text-accent" />
                Omformaterad JSON
              </span>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-copy-json"
                onClick={() => {
                  navigator.clipboard.writeText(reformattedJson);
                  toast({
                    title: "Kopierad!",
                    description: "JSON kopierad till urklipp",
                  });
                }}
              >
                <Copy className="w-4 h-4" />
                Kopiera
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-background/50 p-4 rounded-lg overflow-x-auto border border-accent/20">
              <pre className="code-font text-xs text-foreground whitespace-pre-wrap" data-testid="text-reformatted-json">
                {reformattedJson}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}

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
                data-testid="input-json-data"
                placeholder='{"decoderName": "DecoderName", "deviceProfile": "...", ...}'
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="min-h-[200px] code-font text-sm bg-input border-primary/30 focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">
                Obs: Tal med kommatecken kommer automatiskt normaliseras till punkter
              </p>
            </div>
            <Button type="submit" disabled={loading} className="w-full" data-testid="button-generate-sql">
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
              <Textarea
                readOnly
                value={formatSQL(response.sql)}
                className="min-h-[400px] code-font text-xs bg-background/50 border-border resize-y"
                data-testid="textarea-generated-sql"
              />
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
              <div className="space-y-4">
                <div>
                  <CardTitle className="text-lg">Mappade attribut (Redigerbara)</CardTitle>
                  <CardDescription>
                    Redigera befintliga attribut genom att ändra värdena nedan
                  </CardDescription>
                </div>
                
                <div className="p-4 bg-muted/30 rounded-lg border border-primary/20 space-y-3">
                  <div>
                    <Label className="font-medium">IoT Plattformar:</Label>
                    <p className="text-sm text-muted-foreground">
                      Välj vilka plattformar som ska inkluderas i SQL-skriptet
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {IOT_PLATFORMS.map((platform) => (
                      <div key={platform.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`platform-${platform.id}`}
                          checked={selectedPlatformIds.includes(platform.id)}
                          onChange={() => togglePlatform(platform.id)}
                          className="rounded border-border"
                          data-testid={`checkbox-platform-${platform.id}`}
                        />
                        <Label htmlFor={`platform-${platform.id}`} className="cursor-pointer">
                          {platform.id} - {platform.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Valda: {selectedPlatformIds.length} plattform{selectedPlatformIds.length !== 1 ? 'ar' : ''}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {editableMappedAttributes.map((attr, index) => (
                  <div key={index} className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-primary font-medium">Attribut: {attr.attributeName}</Label>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor={`mapped-name-${index}`}>Attributnamn</Label>
                        <Input
                          id={`mapped-name-${index}`}
                          value={attr.attributeName}
                          onChange={(e) => updateMappedAttribute(index, 'attributeName', e.target.value)}
                          data-testid={`input-mapped-name-${index}`}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`mapped-unit-${index}`}>Datatyp (Unit ID)</Label>
                        <Select
                          value={attr.dataAttributeId.toString()}
                          onValueChange={(value) => updateMappedAttribute(index, 'dataAttributeId', parseInt(value))}
                        >
                          <SelectTrigger data-testid={`select-mapped-unit-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ATTRIBUTE_UNITS.map((unit) => (
                              <SelectItem key={unit.id} value={unit.id.toString()}>
                                {unit.id} - {unit.unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`mapped-friendly-${index}`}>Vänligt namn</Label>
                        <Input
                          id={`mapped-friendly-${index}`}
                          value={attr.attributeFriendlyName}
                          onChange={(e) => updateMappedAttribute(index, 'attributeFriendlyName', e.target.value)}
                          data-testid={`input-mapped-friendly-${index}`}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`mapped-kind-${index}`}>Värdetyp</Label>
                        <Select
                          value={attr.valueKind}
                          onValueChange={(value) => updateMappedAttribute(index, 'valueKind', value)}
                        >
                          <SelectTrigger data-testid={`select-mapped-kind-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="string">string</SelectItem>
                            <SelectItem value="number">number</SelectItem>
                            <SelectItem value="boolean">boolean</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={`mapped-desc-${index}`}>Beskrivning</Label>
                        <Input
                          id={`mapped-desc-${index}`}
                          value={attr.attributeDescription}
                          onChange={(e) => updateMappedAttribute(index, 'attributeDescription', e.target.value)}
                          data-testid={`input-mapped-description-${index}`}
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`mapped-response-${index}`}
                          checked={attr.includeInResponse}
                          onChange={(e) => updateMappedAttribute(index, 'includeInResponse', e.target.checked)}
                          className="rounded border-border"
                          data-testid={`checkbox-mapped-response-${index}`}
                        />
                        <Label htmlFor={`mapped-response-${index}`}>Inkludera i svar</Label>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`mapped-notif-${index}`}>Notifieringstyp</Label>
                        <Select
                          value={attr.notificationType}
                          onValueChange={(value) => updateMappedAttribute(index, 'notificationType', value)}
                        >
                          <SelectTrigger data-testid={`select-mapped-notif-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="M">M - Measurement</SelectItem>
                            <SelectItem value="A">A - Alert</SelectItem>
                            <SelectItem value="S">S - Status</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-accent/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                Lägg till ytterligare attribut
                <div className="flex gap-2">
                  {getMissingAttributes().length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addMissingAttributes}
                      className="border-amber-500 text-amber-500 hover:bg-amber-500/10"
                      data-testid="button-add-missing"
                    >
                      <Wand2 className="w-4 h-4" />
                      Lägg till saknade ({getMissingAttributes().length})
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addNewAttribute}
                    data-testid="button-add-attribute"
                  >
                    <Plus className="w-4 h-4" />
                    Lägg till attribut
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                Lägg till saknade eller korrigera felaktiga attribut
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {additionalAttributes.map((attr, index) => (
                <div key={index} className="p-4 rounded-lg bg-muted/30 border border-accent/20 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-accent">Attribut {index + 1}</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttribute(index)}
                      data-testid={`button-remove-attribute-${index}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`attr-name-${index}`}>Attributnamn</Label>
                      <Input
                        id={`attr-name-${index}`}
                        value={attr.attributeName}
                        onChange={(e) => updateAttribute(index, 'attributeName', e.target.value)}
                        placeholder="t.ex. InternalSensor"
                        data-testid={`input-attribute-name-${index}`}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`attr-unit-${index}`}>Datatyp (Unit ID)</Label>
                      <Select
                        value={attr.dataAttributeId.toString()}
                        onValueChange={(value) => updateAttribute(index, 'dataAttributeId', parseInt(value))}
                      >
                        <SelectTrigger data-testid={`select-attribute-unit-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ATTRIBUTE_UNITS.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id.toString()}>
                              {unit.id} - {unit.unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`attr-friendly-${index}`}>Vänligt namn</Label>
                      <Input
                        id={`attr-friendly-${index}`}
                        value={attr.attributeFriendlyName}
                        onChange={(e) => updateAttribute(index, 'attributeFriendlyName', e.target.value)}
                        placeholder="t.ex. Intern sensor"
                        data-testid={`input-attribute-friendly-${index}`}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`attr-kind-${index}`}>Värdetyp</Label>
                      <Select
                        value={attr.valueKind}
                        onValueChange={(value) => updateAttribute(index, 'valueKind', value)}
                      >
                        <SelectTrigger data-testid={`select-value-kind-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">string</SelectItem>
                          <SelectItem value="number">number</SelectItem>
                          <SelectItem value="boolean">boolean</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor={`attr-desc-${index}`}>Beskrivning</Label>
                      <Input
                        id={`attr-desc-${index}`}
                        value={attr.attributeDescription}
                        onChange={(e) => updateAttribute(index, 'attributeDescription', e.target.value)}
                        placeholder="t.ex. Intern sensor identifierare"
                        data-testid={`input-attribute-description-${index}`}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`attr-response-${index}`}
                        checked={attr.includeInResponse}
                        onChange={(e) => updateAttribute(index, 'includeInResponse', e.target.checked)}
                        className="rounded border-border"
                        data-testid={`checkbox-include-response-${index}`}
                      />
                      <Label htmlFor={`attr-response-${index}`}>Inkludera i svar</Label>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`attr-notif-${index}`}>Notifieringstyp</Label>
                      <Select
                        value={attr.notificationType}
                        onValueChange={(value) => updateAttribute(index, 'notificationType', value)}
                      >
                        <SelectTrigger data-testid={`select-notification-type-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">M - Measurement</SelectItem>
                          <SelectItem value="A">A - Alert</SelectItem>
                          <SelectItem value="S">S - Status</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}

              {additionalAttributes.length > 0 && (
                <Button
                  onClick={updateSqlWithAttributes}
                  className="w-full bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent/80"
                  data-testid="button-update-sql"
                >
                  <Database className="w-4 h-4" />
                  Uppdatera SQL med nya attribut
                </Button>
              )}
              
              {additionalAttributes.length === 0 && editableMappedAttributes.length > 0 && (
                <Button
                  onClick={updateSqlWithAttributes}
                  className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
                  data-testid="button-update-sql-existing"
                >
                  <Database className="w-4 h-4" />
                  Uppdatera SQL med redigerade attribut
                </Button>
              )}
            </CardContent>
          </Card>

          {updatedSql && (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Uppdaterad SQL
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(formatSQL(updatedSql));
                      toast({
                        title: "Kopierad!",
                        description: "Uppdaterad SQL kopierad till urklipp",
                      });
                    }}
                    data-testid="button-copy-updated-sql"
                  >
                    <Copy className="w-4 h-4" />
                    Kopiera SQL
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-background/50 p-4 rounded-lg overflow-x-auto border border-border">
                  <pre className="code-font text-xs text-foreground whitespace-pre-wrap" data-testid="text-updated-sql">
                    {formatSQL(updatedSql)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
