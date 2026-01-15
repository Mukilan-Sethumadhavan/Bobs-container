import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings, 
  Link, 
  AlertCircle, 
  CheckCircle2, 
  Shield, 
  Activity,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  Database,
  MessageSquare,
  Users,
  DollarSign
} from "lucide-react";

interface HubSpotConfig {
  configured: boolean;
  mode?: "read-only" | "test" | "production";
  hasApiKey?: boolean;
}

interface ActivityLog {
  timestamp: string;
  action: string;
  endpoint: string;
  method: string;
  mode: string;
  success: boolean;
  details?: any;
  error?: string;
}

export default function HubSpotSettings() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [mode, setMode] = useState<"read-only" | "test" | "production">("read-only");
  const [showApiKey, setShowApiKey] = useState(false);

  // Fetch current configuration
  const { data: config, isLoading: configLoading } = useQuery<HubSpotConfig>({
    queryKey: ["/api/hubspot/config"],
  });

  // Fetch activity logs
  const { data: activityLogs, isLoading: logsLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/hubspot/activity-log"],
    refetchInterval: 5000 // Auto-refresh every 5 seconds
  });

  // Configure HubSpot
  const configMutation = useMutation({
    mutationFn: async (data: { apiKey: string; mode: string }) => {
      return apiRequest("/api/hubspot/config", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "HubSpot Configured",
        description: `Successfully configured HubSpot in ${mode} mode`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hubspot/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hubspot/activity-log"] });
      setApiKey(""); // Clear API key from form after saving
    },
    onError: (error) => {
      toast({
        title: "Configuration Error",
        description: "Failed to configure HubSpot API",
        variant: "destructive",
      });
    }
  });

  // Clear activity logs
  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/hubspot/activity-log", "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Logs Cleared",
        description: "Activity logs have been cleared",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hubspot/activity-log"] });
    },
  });

  // Test connection
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/hubspot/conversations?limit=1");
      if (!response.ok) {
        throw new Error("Failed to connect");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Connection Successful",
        description: "Successfully connected to HubSpot API",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hubspot/activity-log"] });
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description: "Could not connect to HubSpot API. Please check your API key.",
        variant: "destructive",
      });
    }
  });

  useEffect(() => {
    if (config?.mode) {
      setMode(config.mode);
    }
  }, [config]);

  const getModeColor = (mode: string) => {
    switch (mode) {
      case "read-only":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "test":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "production":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "";
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8" />
          HubSpot Integration
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure HubSpot CRM integration to import conversations and sync proposals
        </p>
      </div>

      <Tabs defaultValue="configuration" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          <TabsTrigger value="guide">Setup Guide</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-4">
          {/* Current Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Connection Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {configLoading ? (
                <div>Loading configuration...</div>
              ) : config?.configured ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="font-medium">HubSpot Connected</span>
                    </div>
                    <Badge className={getModeColor(config.mode || "")}>
                      {config.mode?.toUpperCase()} MODE
                    </Badge>
                  </div>
                  
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Current Configuration</AlertTitle>
                    <AlertDescription>
                      {config.mode === "read-only" && "Can read data from HubSpot but cannot create or modify records."}
                      {config.mode === "test" && "Will simulate actions without actually creating records in HubSpot."}
                      {config.mode === "production" && "Full access to create and modify records in HubSpot."}
                    </AlertDescription>
                  </Alert>

                  <Button 
                    onClick={() => testConnectionMutation.mutate()}
                    disabled={testConnectionMutation.isPending}
                    className="w-full"
                  >
                    {testConnectionMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Testing Connection...
                      </>
                    ) : (
                      <>
                        <Activity className="h-4 w-4 mr-2" />
                        Test Connection
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <AlertCircle className="h-5 w-5" />
                  <span>HubSpot not configured</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configuration Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                API Configuration
              </CardTitle>
              <CardDescription>
                Enter your HubSpot Private App API key and select the operation mode
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* API Key Input */}
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="api-key"
                      type={showApiKey ? "text" : "password"}
                      placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      data-testid="input-hubspot-api-key"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your API key from HubSpot Settings → Integrations → Private Apps
                </p>
              </div>

              {/* Mode Selection */}
              <div className="space-y-3">
                <Label>Operation Mode</Label>
                <RadioGroup value={mode} onValueChange={(value) => setMode(value as any)}>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="read-only" id="read-only" className="mt-1" />
                      <Label htmlFor="read-only" className="flex-1 cursor-pointer">
                        <div className="font-medium">Read-Only Mode</div>
                        <div className="text-sm text-muted-foreground">
                          Safely read conversations, contacts, and deals without making any changes
                        </div>
                      </Label>
                    </div>
                    
                    <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="test" id="test" className="mt-1" />
                      <Label htmlFor="test" className="flex-1 cursor-pointer">
                        <div className="font-medium">Test Mode</div>
                        <div className="text-sm text-muted-foreground">
                          Simulate creating proposals and deals without actually posting to HubSpot
                        </div>
                      </Label>
                    </div>
                    
                    <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="production" id="production" className="mt-1" />
                      <Label htmlFor="production" className="flex-1 cursor-pointer">
                        <div className="font-medium">Production Mode</div>
                        <div className="text-sm text-muted-foreground">
                          Full access to create and update records in HubSpot
                        </div>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => configMutation.mutate({ apiKey, mode })}
                disabled={!apiKey || configMutation.isPending}
                className="w-full"
                data-testid="button-save-hubspot-config"
              >
                {configMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving Configuration...
                  </>
                ) : (
                  "Save Configuration"
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  API Activity Log
                </CardTitle>
                {activityLogs && activityLogs.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => clearLogsMutation.mutate()}
                    disabled={clearLogsMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Logs
                  </Button>
                )}
              </div>
              <CardDescription>
                Track all HubSpot API interactions and their results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div>Loading activity logs...</div>
              ) : activityLogs && activityLogs.length > 0 ? (
                <ScrollArea className="h-[400px] w-full">
                  <div className="space-y-2">
                    {activityLogs.slice().reverse().map((log, idx) => (
                      <div 
                        key={idx} 
                        className={`p-3 border rounded-lg text-sm ${
                          log.success ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {log.success ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span className="font-medium">{log.action}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {log.mode}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>
                            <span className="font-medium">Method:</span> {log.method}
                          </div>
                          <div>
                            <span className="font-medium">Time:</span> {new Date(log.timestamp).toLocaleTimeString()}
                          </div>
                          <div className="col-span-2">
                            <span className="font-medium">Endpoint:</span> {log.endpoint}
                          </div>
                          {log.details && (
                            <div className="col-span-2">
                              <span className="font-medium">Details:</span> {JSON.stringify(log.details)}
                            </div>
                          )}
                          {log.error && (
                            <div className="col-span-2 text-red-500">
                              <span className="font-medium">Error:</span> {log.error}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No API activity yet</p>
                  <p className="text-sm mt-1">API calls will appear here when you interact with HubSpot</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guide" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>HubSpot Setup Guide</CardTitle>
              <CardDescription>
                Follow these steps to connect Bob's Containers to your HubSpot account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge className="h-8 w-8 rounded-full p-0 flex items-center justify-center">1</Badge>
                  <h3 className="font-semibold">Create a Private App in HubSpot</h3>
                </div>
                <div className="ml-11 space-y-2 text-sm text-muted-foreground">
                  <p>1. Log in to your HubSpot account</p>
                  <p>2. Navigate to Settings → Integrations → Private Apps</p>
                  <p>3. Click "Create a private app"</p>
                  <p>4. Name it "Bob's Containers Proposal Generator"</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge className="h-8 w-8 rounded-full p-0 flex items-center justify-center">2</Badge>
                  <h3 className="font-semibold">Configure Scopes</h3>
                </div>
                <div className="ml-11 space-y-2">
                  <p className="text-sm text-muted-foreground">Enable these scopes in the Scopes tab:</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span>conversations.read</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>crm.objects.contacts.read</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>crm.objects.deals.read</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span>crm.objects.deals.write (for production)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge className="h-8 w-8 rounded-full p-0 flex items-center justify-center">3</Badge>
                  <h3 className="font-semibold">Copy Your API Key</h3>
                </div>
                <div className="ml-11 space-y-2 text-sm text-muted-foreground">
                  <p>1. Click "Create app" to generate your API key</p>
                  <p>2. Copy the access token (starts with "pat-na1-")</p>
                  <p>3. Paste it in the API Key field above</p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge className="h-8 w-8 rounded-full p-0 flex items-center justify-center">4</Badge>
                  <h3 className="font-semibold">Start with Read-Only Mode</h3>
                </div>
                <div className="ml-11 space-y-2 text-sm text-muted-foreground">
                  <p>We recommend starting in Read-Only mode to:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Safely test the connection</li>
                    <li>Browse your conversations</li>
                    <li>Generate proposals without creating HubSpot records</li>
                  </ul>
                  <p className="mt-2">You can switch to Test or Production mode anytime.</p>
                </div>
              </div>

              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Security Note</AlertTitle>
                <AlertDescription>
                  Your API key is stored securely on your server and never exposed to the browser. 
                  We recommend using the minimum required scopes for your use case.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}