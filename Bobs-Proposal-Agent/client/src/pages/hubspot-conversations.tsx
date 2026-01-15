import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  User, 
  Calendar, 
  AlertCircle, 
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Search,
  FileText,
  Sparkles,
  Eye,
  Play,
  Info,
  Mail,
  Phone,
  Building
} from "lucide-react";

interface HubSpotThread {
  id: string;
  status: "OPEN" | "CLOSED";
  associatedContactId?: string;
  latestMessageTimestamp?: string;
  inboxId?: string;
}

interface HubSpotMessage {
  id: string;
  text: string;
  direction: "INCOMING" | "OUTGOING";
  createdAt: string;
  senders?: Array<{
    name?: string;
    deliveryIdentifier?: {
      value: string;
    };
  }>;
}

interface HubSpotContact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    company?: string;
  };
}

interface ConversationWithContext {
  thread: HubSpotThread;
  messages: HubSpotMessage[];
  contact?: HubSpotContact;
  deals?: Array<{
    id: string;
    properties: {
      dealname?: string;
      dealstage?: string;
      amount?: string;
    };
  }>;
}

export default function HubSpotConversations() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithContext | null>(null);
  const [showSimulation, setShowSimulation] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  // Check HubSpot configuration
  const { data: config } = useQuery<{
    configured: boolean;
    mode?: "read-only" | "test" | "production";
    hasApiKey?: boolean;
  }>({
    queryKey: ["/api/hubspot/config"],
  });

  // Fetch conversations
  const { data: threads, isLoading: threadsLoading, refetch: refetchThreads } = useQuery<{
    results: HubSpotThread[];
    paging?: any;
  }>({
    queryKey: ["/api/hubspot/conversations"],
    enabled: !!config?.configured,
  });

  // Fetch conversation details
  const { data: conversationDetails, isLoading: detailsLoading } = useQuery<ConversationWithContext>({
    queryKey: [`/api/hubspot/conversations/${selectedThread}`],
    enabled: !!selectedThread,
  });

  // Generate proposal from conversation
  const generateProposalMutation = useMutation({
    mutationFn: async (conversation: ConversationWithContext) => {
      // Build conversation text from messages
      const conversationText = conversation.messages
        .map(msg => `${msg.direction === "INCOMING" ? "Customer" : "Sales"}: ${msg.text}`)
        .join("\n\n");

      // Extract customer info
      const customerName = conversation.contact?.properties.firstname && conversation.contact?.properties.lastname
        ? `${conversation.contact.properties.firstname} ${conversation.contact.properties.lastname}`
        : conversation.contact?.properties.email || "Valued Customer";
      
      const customerEmail = conversation.contact?.properties.email || "";

      // First, analyze the conversation with AI
      const analysisResponse: any = await apiRequest("/api/proposals/analyze", "POST", {
        conversationNotes: conversationText,
        customerName: customerName
      });

      // Then create the proposal
      const proposalData = {
        customerName,
        customerEmail,
        conversationNotes: conversationText,
        aiAnalysis: analysisResponse,
        lineItems: analysisResponse.recommendations || [],
        subtotal: analysisResponse.recommendations?.reduce((sum: number, item: any) => 
          sum + (item.unitPrice * item.quantity), 0) || 0,
        tax: 0,
        total: 0,
        status: "pending" as const,
        hubspotThreadId: conversation.thread.id,
        hubspotContactId: conversation.contact?.id
      };

      // Calculate tax and total
      proposalData.tax = Math.round(proposalData.subtotal * 0.0825);
      proposalData.total = proposalData.subtotal + proposalData.tax;

      const proposal: any = await apiRequest("/api/proposals", "POST", proposalData);

      return proposal;
    },
    onSuccess: (proposal: any) => {
      toast({
        title: "Proposal Generated",
        description: `Proposal #${proposal.proposalNumber} created successfully`,
      });
      setLocation(`/proposals/${proposal.id}`);
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: "Failed to generate proposal from conversation",
        variant: "destructive",
      });
    }
  });

  // Simulate HubSpot creation
  const simulateMutation = useMutation({
    mutationFn: async (proposalData: any) => {
      return apiRequest("/api/hubspot/simulate-proposal", "POST", proposalData);
    },
    onSuccess: (result) => {
      setSimulationResult(result);
      setShowSimulation(true);
    }
  });

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Handle conversation selection
  const handleSelectConversation = (threadId: string) => {
    setSelectedThread(threadId);
  };

  // Handle generate proposal
  const handleGenerateProposal = () => {
    if (conversationDetails) {
      generateProposalMutation.mutate(conversationDetails);
    }
  };

  // If not configured, show configuration prompt
  if (!config?.configured) {
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-amber-500" />
              HubSpot Not Configured
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You need to configure your HubSpot API key before you can import conversations.
            </p>
            <Button onClick={() => setLocation("/hubspot")} data-testid="button-configure-hubspot">
              <Settings className="h-4 w-4 mr-2" />
              Configure HubSpot Integration
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MessageSquare className="h-8 w-8" />
          HubSpot Conversations
        </h1>
        <p className="text-muted-foreground mt-2">
          Select a conversation from HubSpot to generate a proposal
        </p>
      </div>

      {/* Configuration Status */}
      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>Mode: {config.mode?.toUpperCase()}</AlertTitle>
        <AlertDescription>
          {config.mode === "read-only" && "You can browse conversations and generate proposals locally. No data will be sent to HubSpot."}
          {config.mode === "test" && "You can generate proposals and simulate what would be created in HubSpot without actually creating records."}
          {config.mode === "production" && "Full integration enabled. Proposals will be created as deals in HubSpot."}
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversations List */}
        <Card className="h-[600px]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Conversations</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetchThreads()}
                disabled={threadsLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${threadsLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {threadsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : threads?.results && threads.results.length > 0 ? (
              <ScrollArea className="h-[480px]">
                <div className="space-y-2">
                  {threads.results.map((thread: HubSpotThread) => (
                    <div
                      key={thread.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedThread === thread.id 
                          ? "border-primary bg-primary/5" 
                          : "hover:bg-accent/50"
                      }`}
                      onClick={() => handleSelectConversation(thread.id)}
                      data-testid={`thread-${thread.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          <span className="font-medium text-sm">Thread #{thread.id.slice(-6)}</span>
                        </div>
                        <Badge variant={thread.status === "OPEN" ? "default" : "secondary"}>
                          {thread.status}
                        </Badge>
                      </div>
                      
                      {thread.latestMessageTimestamp && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(thread.latestMessageTimestamp)}</span>
                        </div>
                      )}
                      
                      {thread.associatedContactId && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <User className="h-3 w-3" />
                          <span>Contact: {thread.associatedContactId.slice(-6)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No conversations found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Check your HubSpot inbox or API configuration
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversation Details */}
        <Card className="h-[600px]">
          <CardHeader>
            <CardTitle>Conversation Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedThread && detailsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : conversationDetails ? (
              <div className="space-y-4">
                {/* Contact Info */}
                {conversationDetails.contact && (
                  <div className="p-3 border rounded-lg bg-card/50">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4" />
                      <span className="font-medium">Contact Information</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {conversationDetails.contact.properties.firstname && (
                        <div>
                          <span className="text-muted-foreground">Name: </span>
                          <span>
                            {conversationDetails.contact.properties.firstname} {conversationDetails.contact.properties.lastname}
                          </span>
                        </div>
                      )}
                      {conversationDetails.contact.properties.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate">{conversationDetails.contact.properties.email}</span>
                        </div>
                      )}
                      {conversationDetails.contact.properties.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span>{conversationDetails.contact.properties.phone}</span>
                        </div>
                      )}
                      {conversationDetails.contact.properties.company && (
                        <div className="flex items-center gap-1">
                          <Building className="h-3 w-3 text-muted-foreground" />
                          <span>{conversationDetails.contact.properties.company}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="font-medium">Messages ({conversationDetails.messages.length})</span>
                  </div>
                  <ScrollArea className="h-[250px] border rounded-lg p-3">
                    <div className="space-y-3">
                      {conversationDetails.messages.map((message, idx) => (
                        <div
                          key={message.id}
                          className={`p-2 rounded-lg text-sm ${
                            message.direction === "INCOMING"
                              ? "bg-blue-500/10 ml-0 mr-8"
                              : "bg-gray-500/10 ml-8 mr-0"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-xs">
                              {message.direction === "INCOMING" ? "Customer" : "Sales"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(message.createdAt)}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap">{message.text}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleGenerateProposal}
                    disabled={generateProposalMutation.isPending}
                    className="flex-1"
                    data-testid="button-generate-from-hubspot"
                  >
                    {generateProposalMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Proposal
                      </>
                    )}
                  </Button>
                  
                  {config.mode !== "read-only" && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Simulate what would be created
                        const proposalData = {
                          customerName: conversationDetails.contact?.properties.firstname || "Customer",
                          proposalNumber: `BC-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-SIM`,
                          total: 50000,
                          contactId: conversationDetails.contact?.id
                        };
                        simulateMutation.mutate(proposalData);
                      }}
                      disabled={simulateMutation.isPending}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Simulate
                    </Button>
                  )}
                </div>
              </div>
            ) : selectedThread ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 text-red-500 opacity-50" />
                <p className="text-muted-foreground">Failed to load conversation</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Select a conversation to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Simulation Dialog */}
      <Dialog open={showSimulation} onOpenChange={setShowSimulation}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>HubSpot Simulation Results</DialogTitle>
            <DialogDescription>
              This shows what would be created in HubSpot if you were in production mode
            </DialogDescription>
          </DialogHeader>
          
          {simulationResult && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertTitle>Mode: {simulationResult.mode?.toUpperCase()}</AlertTitle>
                <AlertDescription>
                  Simulation successful - no actual records were created
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="p-3 border rounded-lg">
                  <h4 className="font-medium mb-2">Deal that would be created:</h4>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                    {JSON.stringify(simulationResult.wouldCreate?.deal, null, 2)}
                  </pre>
                </div>

                <div className="p-3 border rounded-lg">
                  <h4 className="font-medium mb-2">Note that would be attached:</h4>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                    {JSON.stringify(simulationResult.wouldCreate?.note, null, 2)}
                  </pre>
                </div>

                <div className="p-3 border rounded-lg">
                  <h4 className="font-medium mb-2">Attachments:</h4>
                  <ul className="list-disc list-inside text-sm">
                    {simulationResult.wouldCreate?.attachments?.map((att: string, idx: number) => (
                      <li key={idx}>{att}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSimulation(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Add missing import
import { Settings } from "lucide-react";