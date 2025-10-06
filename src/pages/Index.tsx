import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeviceModelFinder } from "@/components/DeviceModelFinder";
import { ModelDBInsertion } from "@/components/ModelDBInsertion";
import { Brain, Database, Menu } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(180,50%,48%)] to-[hsl(180,40%,58%)]">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/20">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Eliot Admin Dashboard</h1>
                <p className="text-white/80 text-sm">IoT Device Management System</p>
              </div>
            </div>
            <button className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
              <Menu className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="finder" className="max-w-6xl mx-auto">
          <TabsList className="glass-card grid w-full grid-cols-2 mb-8 p-1 h-auto rounded-lg">
            <TabsTrigger 
              value="finder" 
              className="gap-2 py-3 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200"
            >
              <Brain className="w-4 h-4" />
              <span className="font-medium">DeviceProfile Finnare</span>
            </TabsTrigger>
            <TabsTrigger 
              value="insertion" 
              className="gap-2 py-3 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-200"
            >
              <Database className="w-4 h-4" />
              <span className="font-medium">Device Model DB Insertion</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="finder" className="space-y-6 animate-in fade-in-50 duration-300">
            <DeviceModelFinder />
          </TabsContent>

          <TabsContent value="insertion" className="space-y-6 animate-in fade-in-50 duration-300">
            <ModelDBInsertion />
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <footer className="mt-16 pb-8">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 glass-card rounded-full">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <p className="text-white text-sm font-medium">Powered by Eliot • Secure • Real-time</p>
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
