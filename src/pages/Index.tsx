import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeviceModelFinder } from "@/components/DeviceModelFinder";
import { ModelDBInsertion } from "@/components/ModelDBInsertion";
import { Brain, Cpu } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--gradient-ai),transparent_50%)] opacity-30" />
      
      <div className="relative container mx-auto px-4 py-12">
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Brain className="w-10 h-10 text-primary glow-text animate-pulse" />
            <h1 className="text-5xl font-bold glow-text bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              The Sensor Whisperer
            </h1>
            <Cpu className="w-10 h-10 text-primary glow-text animate-pulse" />
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Avkoda mysterierna med IoT-enheter med AI-driven intelligens
          </p>
        </header>

        <Tabs defaultValue="finder" className="max-w-5xl mx-auto">
          <TabsList className="grid w-full grid-cols-2 mb-8 bg-muted/50 p-1 h-auto">
            <TabsTrigger value="finder" className="gap-2 py-3">
              <Brain className="w-4 h-4" />
              Enhetsmodellfinnare
            </TabsTrigger>
            <TabsTrigger value="insertion" className="gap-2 py-3">
              <Database className="w-4 h-4" />
              Modell DB-infogning
            </TabsTrigger>
          </TabsList>

          <TabsContent value="finder" className="space-y-6 animate-in fade-in-50 duration-500">
            <DeviceModelFinder />
          </TabsContent>

          <TabsContent value="insertion" className="space-y-6 animate-in fade-in-50 duration-500">
            <ModelDBInsertion />
          </TabsContent>
        </Tabs>
      </div>

      <footer className="relative mt-20 text-center text-muted-foreground text-sm pb-8">
        <p>Drivs av AI • Säker • Realtidsanalys</p>
      </footer>
    </div>
  );
};

const Database = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
  </svg>
);

export default Index;
