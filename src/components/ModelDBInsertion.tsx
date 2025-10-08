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
  const [modelName, setModelName] = useState("");
  const [supplier, setSupplier] = useState("");
  const [decodedData, setDecodedData] = useState("");
  const [deviceProfile, setDeviceProfile] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ModelDBResponse | null>(null);
  const [additionalAttributes, setAdditionalAttributes] = useState<AdditionalAttribute[]>([]);
  const [updatedSql, setUpdatedSql] = useState("");
  const [editableMappedAttributes, setEditableMappedAttributes] = useState<AdditionalAttribute[]>([]);
  const [selectedPlatformIds, setSelectedPlatformIds] = useState<number[]>([1]);

  const cleanDoubleQuotes = (text: string): string => {
    // Replace escaped double quotes ("") with single quotes (")
    return text.replace(/""/g, '"');
  };

  const isJsonMalformed = (text: string): boolean => {
    if (!text.trim()) return false;
    
    try {
      JSON.parse(text);
      return false; // Valid JSON
    } catch {
      // Check for common malformed patterns
      const hasMissingQuotes = /:\s*string|:\s*double|:\s*integer|:\s*boolean|:\s*float/i.test(text);
      const hasUnquotedKeys = /[{,]\s*[a-zA-Z_][a-zA-Z0-9_]*\s*:/g.test(text);
      return hasMissingQuotes || hasUnquotedKeys;
    }
  };

  const fixMalformedJson = (text: string): string => {
    let fixed = text.trim();
    
    // Step 1: Add missing quotes to property names
    // Match unquoted property names (word characters followed by colon)
    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');
    
    // Step 2: Fix missing closing quotes on property names
    fixed = fixed.replace(/"\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '"$1":');
    
    // Step 3: Add missing commas between properties (BEFORE type replacement)
    // Match: any word (like string/double/integer) or value, followed by newline and quote
    // This handles both data types and actual values
    fixed = fixed.replace(/([a-zA-Z0-9_]+|"[^"]*"|true|false|null|\d+\.?\d*)\s*\n\s*(")/g, '$1,\n$2');
    
    // Step 4: Replace data type placeholders with example values
    const typeReplacements: Record<string, string> = {
      'string': '"example"',
      'double': '0.0',
      'float': '0.0',
      'integer': '0',
      'int': '0',
      'boolean': 'false',
      'bool': 'false',
      'number': '0'
    };
    
    // Replace data types with example values
    for (const [type, value] of Object.entries(typeReplacements)) {
      const regex = new RegExp(`:\\s*${type}\\b`, 'gi');
      fixed = fixed.replace(regex, `: ${value}`);
    }
    
    // Step 5: Ensure proper JSON structure
    // Remove any trailing commas before closing braces/brackets
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
    
    return fixed;
  };

  const handleFixJson = () => {
    const fixed = fixMalformedJson(decodedData);
    
    try {
      // Validate the fixed JSON
      JSON.parse(fixed);
      setDecodedData(fixed);
      toast({
        title: "JSON fixad!",
        description: "JSON-formatet har korrigerats",
      });
    } catch (error) {
      toast({
        title: "Kunde inte fixa JSON",
        description: "JSON-strukturen är för trasig för automatisk reparation",
        variant: "destructive",
      });
    }
  };

  const convertToNumber = (value: string): number | string => {
    // Replace comma with period for European number format
    const normalized = value.replace(",", ".");
    const num = parseFloat(normalized);
    return !isNaN(num) ? num : value;
  };

  const buildJsonFromForm = () => {
    // Parse the decoded data JSON
    const parsedData = JSON.parse(decodedData);
    
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
    
    // Create the JSON object
    return {
      decoderName: decoderName,
      deviceProfile: deviceProfile,
      modelName: modelName,
      supplier: supplier,
      useOpenAI: false,
      decodedData: processedData
    };
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
    // Basic SQL formatting with word boundaries to avoid breaking words
    return sql
      .replace(/\r\n/g, "\n")
      .replace(/;/g, ";\n")
      .replace(/\bBEGIN\b/gi, "\nBEGIN")
      .replace(/\bEND\b/gi, "\nEND")
      .replace(/\bSELECT\b/gi, "\nSELECT")
      .replace(/\bFROM\b/gi, "\nFROM")
      .replace(/\bWHERE\b/gi, "\nWHERE")
      .replace(/\bINSERT INTO\b/gi, "\nINSERT INTO")
      .replace(/\bVALUES\b/gi, "\nVALUES")
      .replace(/\bUPDATE\b/gi, "\nUPDATE")
      .replace(/\bSET\b/gi, "\nSET")
      .replace(/\bDECLARE\b/gi, "\nDECLARE")
      .trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!decoderName.trim() || !modelName.trim() || !supplier.trim() || !decodedData.trim() || !deviceProfile.trim()) {
      toast({
        title: "Saknade fält",
        description: "Vänligen fyll i alla fält",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Build JSON from form fields
      const parsedInput = buildJsonFromForm();

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
        description: "Device Model DB Insertion behandlades",
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

  const handleReset = () => {
    setDecoderName("");
    setModelName("");
    setSupplier("");
    setDecodedData("");
    setDeviceProfile("");
    setResponse(null);
    setAdditionalAttributes([]);
    setUpdatedSql("");
    setEditableMappedAttributes([]);
    setSelectedPlatformIds([1]);
    
    toast({
      title: "Formulär återställt",
      description: "Alla fält har rensats",
    });
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
    if (!decodedData) return [];
    
    try {
      const parsedData = JSON.parse(decodedData);
      
      if (!parsedData || typeof parsedData !== 'object') return [];
      
      const decodedKeys = Object.keys(parsedData);
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

    // Filter out any duplicates that might already exist in additionalAttributes
    const currentAttributeNames = additionalAttributes.map(attr => attr.attributeName);
    const uniqueNewAttributes = newAttributes.filter(
      newAttr => !currentAttributeNames.includes(newAttr.attributeName)
    );

    if (uniqueNewAttributes.length === 0) {
      toast({
        title: "Inga nya attribut",
        description: "Attributen finns redan i listan",
      });
      return;
    }

    setAdditionalAttributes([...additionalAttributes, ...uniqueNewAttributes]);

    toast({
      title: "Attribut tillagda",
      description: `${uniqueNewAttributes.length} saknade attribut har lagts till`,
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

    // Work on the current SQL (either already updated, or the original from response)
    const originalSqlText = updatedSql || response.sql;
    let updatedSqlText = originalSqlText;

    // --- Capture originals BEFORE we remove anything ---
    // 1) ThingPark DeviceModelID literal in the existing SQL (preferred if present)
    const thingparkLiteralMatch = originalSqlText.match(
      /INSERT\s+INTO\s+dbo\.iotDeviceModelTag[\s\S]*?VALUES\s*\([\s\S]*?@iotPlatformDeviceModelId[\s\S]*?'DeviceModelID'[\s,]*\r?\n\s*('(?:[^']|'')*')\s*\)/i
    );
    const thingparkLiteralFromSql = thingparkLiteralMatch?.[1] ?? null; // includes surrounding single quotes

    // 2) "ThingPark ID: ..." from the header comment as a fallback
    const headerTpIdMatch = originalSqlText.match(/ThingPark ID:\s*([^\r\n]+)/i);
    const headerThingparkId = headerTpIdMatch?.[1]?.trim() ?? null;

    // 3) Any declared @tpModel value (another fallback)
    const declaredTpModelMatch = originalSqlText.match(/DECLARE\s+@tpModel\s+nvarchar\(200\)\s*=\s*N'([^']*)'/i);
    const declaredTpModelValue = declaredTpModelMatch?.[1] ?? null;

    // 4) Check if @tpModel exists at all
    const hasTpModelVar = /DECLARE\s+@tpModel\b/i.test(originalSqlText);

    // ---- Remove all existing deviceModelAttribute INSERT statements (we'll recreate) ----
    // More robust pattern that handles various whitespace scenarios
    const attributeInsertPattern = /--[^\n]*\s*\n+\s*INSERT INTO dbo\.deviceModelAttribute[\s\S]*?VALUES[\s\S]*?\([^)]*\);/gi;
    updatedSqlText = updatedSqlText.replace(attributeInsertPattern, '');

    // ---- Generate new INSERTs for attributes ----
    const newAttributeInserts = allAttributes.map(attr => {
      const unit = ATTRIBUTE_UNITS.find(u => u.id === attr.dataAttributeId);
      const unitDescription = unit ? unit.unit : 'Unknown';
      const valueListJson = `[ { "value": "${attr.valueKind}", "description": "${unitDescription}", "selectable": false } ]`;

      return `--${attr.attributeName}

  INSERT INTO dbo.deviceModelAttribute
                             (  deviceModelId
                             ,   dataAttributeId
                             ,   attributeName
                             ,   attributeDescription
                             ,   attributeValueList
                             ,   includeInResponse
                             ,                          notificationType
                             ,                          triggerLogic
                             ,                          triggerValue
                             ,   attributeFriendlyName
                             )

  VALUES
  (
  @deviceModelId,
  ${attr.dataAttributeId},
  N'${attr.attributeName}',
  N'${attr.description}',
  N'${valueListJson}',
  '${attr.includeInResponse ? 1 : 0}',
  '${attr.notificationType}',
  NULL,
  NULL,
  N'${attr.friendlyName}'
  );`;
    }).join('\n\n\n');

    // Insert the new attribute statements after SET @deviceModelId = SCOPE_IDENTITY();
    const afterDeviceModelIdPattern = /(SET @deviceModelId = SCOPE_IDENTITY\(\);)/;
    updatedSqlText = updatedSqlText.replace(afterDeviceModelIdPattern, `$1\n\n\n${newAttributeInserts}`);

    // Apply SQL cleanup to fix known corruptions
    updatedSqlText = cleanSqlText(updatedSqlText);

    // Ensure @chirpstackDeviceModel declaration exists (after @tpModel declaration if present)
    if (!updatedSqlText.includes('DECLARE @chirpstackDeviceModel')) {
      updatedSqlText = updatedSqlText.replace(
        /(DECLARE @tpModel\s+nvarchar\(200\)\s*=\s*N'[^']*';)/,
        `$1\n    DECLARE @chirpstackDeviceModel nvarchar(200) = @tpModel; -- change if ChirpStack differs`
      );
    }

    // ---- Build platform linking sections ----
    // Remove ALL existing platform linking sections
    const simplePlatformPattern = /(?:\/\*[^*]*\*\/\s*)?INSERT INTO dbo\.iotPlatformDeviceModel\s*\([^)]*\)\s*VALUES\s*\([^)]*@deviceModelId[^)]*\);?\s*(?:SET @iotPlatformDeviceModelId = SCOPE_IDENTITY\(\);)?\s*INSERT INTO dbo\.iotDeviceModelTag\s*\([^)]*\)\s*VALUES\s*\([^)]*'DeviceModelID'[^)]*\);?/gi;
    updatedSqlText = updatedSqlText.replace(simplePlatformPattern, '');
    // Also remove stray headers / DECLARE left over
    updatedSqlText = updatedSqlText.replace(/\/\*\s*----\s*Link to IoT Platforms[^*]*\*\/\s*/g, '');
    updatedSqlText = updatedSqlText.replace(/\s*DECLARE @iotPlatformDeviceModelId int;\s*(?=\n|$)/g, '');

    // Platform block preamble (declare only once if not present)
    const needsDeclaration = !updatedSqlText.includes('DECLARE @iotPlatformDeviceModelId');
    const platformLinkingDeclaration = needsDeclaration
      ? `    /* ---- Link to IoT Platforms -------------------------------------------- */
      DECLARE @iotPlatformDeviceModelId int;
  `
      : `    /* ---- Link to IoT Platforms -------------------------------------------- */
  `;

    const platformLinkingSections = selectedPlatformIds.map(platformId => {
      const platform = IOT_PLATFORMS.find(p => p.id === platformId);
      const platformName = platform ? platform.name : `Platform ${platformId}`;
      const isThingPark = platformId === 1;

      // === IMPORTANT: preserve original literal for ThingPark if it existed ===
      let valueExpression: string;
      if (isThingPark) {
        if (thingparkLiteralFromSql) {
          // Keep EXACT original line, e.g.:
          // '{\"OTAA\": \"msight_em500-lgt_RFGroup1_1.0.3a_A\", \"ABP\": \"msight_em500-lgt_RFGroup1_1.0.3a_A\"}'
          valueExpression = thingparkLiteralFromSql; // already wrapped in single quotes
        } else if (hasTpModelVar) {
          // Fall back to @tpModel-based interpolation only if @tpModel exists
          valueExpression = `'{"OTAA": "' + @tpModel + '", "ABP": "' + @tpModel + '"}'`;
        } else {
          // No @tpModel var: synthesize a literal from header or declared value if available
          const literalId =
            headerThingparkId ??
            declaredTpModelValue ??
            '';
          const safeId = literalId.replace(/'/g, "''");
          valueExpression = `'{"OTAA": "${safeId}", "ABP": "${safeId}"}'`;
        }
      } else {
        valueExpression = `@chirpstackDeviceModel`;
      }

      return `    /* ---- Link to ${platformName} (iotPlatformId = ${platformId}) ---------------------------- */
      INSERT INTO dbo.iotPlatformDeviceModel
                             (  iotPlatformId
                             ,   deviceModelId
                             )
      VALUES
      (
      ${platformId},
      @deviceModelId
      );

      SET @iotPlatformDeviceModelId = SCOPE_IDENTITY();

      INSERT INTO dbo.iotDeviceModelTag
                             (  iotPlatformDeviceModelId
                             ,   tag
                             ,   [value]
                             )
      VALUES
      (
      @iotPlatformDeviceModelId,
      'DeviceModelID',
      ${valueExpression}
      );`;
    }).join('\n\n');

    const completePlatformSection = platformLinkingDeclaration + '\n' + platformLinkingSections;

    // Clean up excessive blank lines
    updatedSqlText = updatedSqlText.replace(/\n{3,}/g, '\n\n');

    // Insert the new platform sections before SELECT or COMMIT, else append
    const beforeSelectPattern = /(\n\n+SELECT\s+DISTINCT)/i;
    const beforeCommitPattern = /(\n\s*COMMIT TRAN;)/i;

    if (beforeSelectPattern.test(updatedSqlText)) {
      updatedSqlText = updatedSqlText.replace(beforeSelectPattern, `\n\n${completePlatformSection}\n$1`);
    } else if (beforeCommitPattern.test(updatedSqlText)) {
      updatedSqlText = updatedSqlText.replace(beforeCommitPattern, `\n${completePlatformSection}\n\n$1`);
    } else {
      updatedSqlText = updatedSqlText.trim() + '\n\n' + completePlatformSection;
    }

    // Update the primary platform ID in the initial INSERT (use first selected platform)
    const primaryPlatformId = selectedPlatformIds[0];
    updatedSqlText = updatedSqlText.replace(
      /\(.*deviceModelName.*deviceModelVersion.*deviceModelSupplier.*iotPlatformId.*decoderFunctionName.*display.*\)[\s\S]*?VALUES[\s\S]*?\(.*@name.*NULL.*@supplier.*\d+.*@decoder.*1.*\)/i,
      (match) => match.replace(/(@supplier,\s*)(\d+)/, `$1${primaryPlatformId}`)
    );

    setUpdatedSql(updatedSqlText);

    const totalChanges = additionalAttributes.length;
    const platformNames = selectedPlatformIds
      .map(id => IOT_PLATFORMS.find(p => p.id === id)?.name)
      .filter(Boolean)
      .join(', ');

    toast({
      title: "SQL uppdaterad!",
      description: totalChanges > 0
        ? `${editableMappedAttributes.length} befintliga + ${totalChanges} nya attribut · Plattformar: ${platformNames}`
        : `${editableMappedAttributes.length} attribut · Plattformar: ${platformNames}`,
    });
  };


  return (
    <div className="space-y-6">
      <Card className="glow-border">
        <CardHeader>
          <CardTitle className="glow-text flex items-center gap-2">
            <Database className="w-5 h-5" />
            Generera SQL för Device Model
          </CardTitle>
          <CardDescription>Fyll i fälten nedan och generera SQL för infogning av enhetsmodell i databas</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modelName">Model Name</Label>
                <Input
                  id="modelName"
                  data-testid="input-model-name"
                  placeholder="t.ex. Adeunis ARF8180BA"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="bg-input/50 border-border/50 focus:border-primary"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier</Label>
                <Input
                  id="supplier"
                  data-testid="input-supplier"
                  placeholder="t.ex. Adeunis"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="bg-input/50 border-border/50 focus:border-primary"
                />
              </div>
            </div>
            
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
              <Label htmlFor="deviceProfile">Device Profile (ThingPark Model ID)</Label>
              <Input
                id="deviceProfile"
                data-testid="input-device-profile"
                placeholder="t.ex. ADRF/TempA.1.0.2_EU"
                value={deviceProfile}
                onChange={(e) => setDeviceProfile(e.target.value)}
                className="bg-input/50 border-border/50 focus:border-primary"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="decodedData">Decoded Data (JSON)</Label>
              <div className="relative">
                <Textarea
                  id="decodedData"
                  data-testid="input-decoded-data"
                  placeholder='{"UplinkType": "Unknown condition code", "FrameCounter": 5, ...}'
                  value={decodedData}
                  onChange={(e) => setDecodedData(cleanDoubleQuotes(e.target.value))}
                  className="min-h-[200px] code-font text-sm bg-input/50 border-border/50 focus:border-primary"
                />
                {isJsonMalformed(decodedData) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleFixJson}
                    className="absolute top-2 right-2 bg-background/95 hover:bg-accent/20 border-accent/50"
                    data-testid="button-fix-json"
                  >
                    <Wand2 className="w-3 h-3 mr-1" />
                    Fix JSON
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Obs: Dubbla citattecken ("") ersätts automatiskt med enkla ("). Numeriska värden med kommatecken (t.ex. "35,0") konverteras automatiskt till tal
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button 
                type="button" 
                variant="outline"
                onClick={handleReset}
                disabled={loading}
                className="w-full"
                data-testid="button-reset-form"
              >
                <Trash2 className="w-4 h-4" />
                Återställ
              </Button>
              
              <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent/80 glow-accent" data-testid="button-generate-sql">
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Bearbetar...
                  </>
                ) : (
                  <>
                    <Database />
                    Genera SQL
                  </>
                )}
              </Button>
            </div>
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
