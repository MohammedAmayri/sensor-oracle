import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeviceModelFinder } from "@/components/DeviceModelFinder";
import { ModelDBInsertion } from "@/components/ModelDBInsertion";
import { Brain, Cpu } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(210,50%,16%)] via-background to-[hsl(258,68%,18%)]" />
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-[hsl(258,68%,56%)] rounded-full blur-[150px] opacity-20 animate-pulse" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[hsl(200,60%,45%)] rounded-full blur-[140px] opacity-15" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[hsl(167,65%,48%)] rounded-full blur-[120px] opacity-10" />
      
      <div className="relative container mx-auto px-4 py-12">
        <header className="text-center mb-16">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 backdrop-blur-sm border border-primary/30">
              <Brain className="w-10 h-10 text-primary drop-shadow-[0_0_12px_hsl(var(--glow-primary)/0.5)]" />
            </div>
            <h1 className="text-6xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent [text-shadow:0_0_40px_hsl(var(--glow-primary)/0.3)]">
              The Sensor Whisperer
            </h1>
            <div className="p-3 rounded-2xl bg-gradient-to-br from-secondary/20 to-accent/20 backdrop-blur-sm border border-secondary/30">
              <Cpu className="w-10 h-10 text-secondary drop-shadow-[0_0_12px_hsl(var(--glow-secondary)/0.5)]" />
            </div>
          </div>
          <p className="text-foreground/80 text-xl max-w-2xl mx-auto font-light tracking-wide">
            Avkoda mysterierna med IoT-enheter med AI-driven intelligens
          </p>
        </header>

        <Tabs defaultValue="finder" className="max-w-5xl mx-auto">
          <TabsList className="glass-card grid w-full grid-cols-2 mb-10 p-2 h-auto rounded-2xl">
            <TabsTrigger 
              value="finder" 
              className="gap-2 py-4 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/90 data-[state=active]:text-primary-foreground data-[state=active]:glow-border transition-all duration-300"
            >
              <Brain className="w-5 h-5" />
              <span className="font-medium">Enhetsmodellfinnare</span>
            </TabsTrigger>
            <TabsTrigger 
              value="insertion" 
              className="gap-2 py-4 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-accent data-[state=active]:to-accent/90 data-[state=active]:text-accent-foreground data-[state=active]:glow-accent transition-all duration-300"
            >
              <Database className="w-5 h-5" />
              <span className="font-medium">Modell DB-infogning</span>
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

      <footer className="relative mt-24 text-center pb-10">
        <div className="inline-flex items-center gap-3 px-6 py-3 glass-card rounded-full">
          <span className="w-2 h-2 bg-accent rounded-full animate-pulse shadow-[0_0_8px_hsl(var(--glow-accent))]" />
          <p className="text-foreground/70 text-sm font-medium">Drivs av AI • Säker • Realtidsanalys</p>
          <span className="w-2 h-2 bg-secondary rounded-full animate-pulse shadow-[0_0_8px_hsl(var(--glow-secondary))]" />
        </div>
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
