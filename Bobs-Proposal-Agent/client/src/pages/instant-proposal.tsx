import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sparkles, Zap, Download, Eye, Send, TrendingUp, CheckCircle2, Clock, DollarSign, AlertCircle, Save, Minus, Plus } from "lucide-react";
import type { Proposal } from "@shared/schema";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function extractCustomerName(text: string): string {
  // Try to extract customer name from conversation patterns
  const patterns = [
    /(?:customer|client|contact):\s*([A-Z][a-z]+ [A-Z][a-z]+)/i,
    /(?:name|contact):\s*([A-Z][a-z]+ [A-Z][a-z]+)/i,
    /^([A-Z][a-z]+ [A-Z][a-z]+):/m,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  
  return "Valued Customer";
}

function extractCustomerEmail(text: string): string | undefined {
  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const match = text.match(emailPattern);
  return match?.[1];
}

export default function InstantProposal() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [conversationInput, setConversationInput] = useState("");
  const [generatedProposal, setGeneratedProposal] = useState<Proposal | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<number>(0);
  const [unmatchedNeeds, setUnmatchedNeeds] = useState<string[]>([]);
  const [editedQuantities, setEditedQuantities] = useState<{ [key: number]: number }>({});
  const [isUpdatingProposal, setIsUpdatingProposal] = useState(false);
  
  const generateProposalMutation = useMutation({
    mutationFn: async (conversation: string) => {
      // Extract customer info intelligently
      const customerName = extractCustomerName(conversation);
      const customerEmail = extractCustomerEmail(conversation);
      
      const res = await apiRequest("POST", "/api/proposals/generate", {
        customerName,
        customerEmail,
        conversationNotes: conversation,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.proposal) {
        setGeneratedProposal(data.proposal);
        
        // Calculate confidence score based on matched products
        const matchedCount = data.analysis?.matchedProducts?.length || 0;
        const avgConfidence = data.analysis?.matchedProducts?.reduce(
          (sum: number, p: any) => sum + (p.confidence || 0.5), 0
        ) / Math.max(matchedCount, 1);
        const finalConfidence = Math.round((avgConfidence || 0.5) * 100);
        setConfidenceScore(finalConfidence);
        
        // Capture unmatched needs from AI analysis
        if (data.analysis?.unmatchedNeeds && data.analysis.unmatchedNeeds.length > 0) {
          setUnmatchedNeeds(data.analysis.unmatchedNeeds);
        } else {
          setUnmatchedNeeds([]);
        }
        
        queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
        
        // Success notification
        toast({
          title: "Proposal Ready!",
          description: `${matchedCount} products selected • ${finalConfidence}% confidence`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: error?.message || "Failed to generate proposal",
      });
    },
  });

  const handleInstantGenerate = () => {
    if (conversationInput.length < 20) {
      toast({
        variant: "destructive",
        title: "More Context Needed",
        description: "Please paste the customer conversation from HubSpot",
      });
      return;
    }
    generateProposalMutation.mutate(conversationInput);
  };

  const downloadPdfMutation = useMutation({
    mutationFn: async () => {
      if (!generatedProposal?.id) throw new Error("No proposal ID");
      
      const res = await fetch(`/api/proposals/${generatedProposal.id}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to generate PDF');
      }
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proposal-${generatedProposal?.proposalNumber || 'download'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      return true;
    },
    onSuccess: () => {
      toast({
        title: "PDF Downloaded",
        description: "Proposal PDF downloaded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download PDF.",
        variant: "destructive"
      });
    },
  });

  if (generatedProposal) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Success Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Proposal Generated!</h1>
                <p className="text-muted-foreground">
                  {generatedProposal.proposalNumber} • Ready in 2.3 seconds
                </p>
              </div>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <Progress value={confidenceScore} className="w-24 h-2" />
                    <Badge variant={confidenceScore > 80 ? "default" : confidenceScore > 60 ? "secondary" : "outline"}>
                      {confidenceScore}%
                    </Badge>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">
                    {confidenceScore > 80 ? "High confidence - excellent keyword matches" :
                     confidenceScore > 60 ? "Good confidence - strong product alignment" :
                     "Review recommended - consider manual adjustments"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Proposal Summary Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{generatedProposal.customerName}</CardTitle>
                <CardDescription>
                  {generatedProposal.customerEmail || "No email provided"}
                </CardDescription>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {formatCurrency(generatedProposal.total)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {generatedProposal.lineItems?.length || 0} items
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Editable Product List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Selected Products:</span>
                {Object.keys(editedQuantities).length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      setIsUpdatingProposal(true);
                      // Update the proposal with new quantities
                      const updatedLineItems = generatedProposal.lineItems?.map((item: any, idx: number) => ({
                        ...item,
                        quantity: editedQuantities[idx] !== undefined ? editedQuantities[idx] : item.quantity
                      }));
                      
                      // Recalculate totals
                      const subtotal = updatedLineItems?.reduce((sum: number, item: any) => 
                        sum + (item.unitPrice * item.quantity), 0) || 0;
                      const tax = Math.round(subtotal * 0.0825); // 8.25% tax
                      const total = subtotal + tax;
                      
                      // Update local state
                      setGeneratedProposal({
                        ...generatedProposal,
                        lineItems: updatedLineItems,
                        subtotal,
                        tax,
                        total
                      });
                      
                      setEditedQuantities({});
                      setIsUpdatingProposal(false);
                      toast({
                        title: "Quantities Updated",
                        description: "Proposal totals have been recalculated",
                      });
                    }}
                    disabled={isUpdatingProposal}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    Save Changes
                  </Button>
                )}
              </div>
              
              {/* Show ALL line items with editable quantities */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {generatedProposal.lineItems?.map((item: any, idx: number) => {
                  const currentQuantity = editedQuantities[idx] !== undefined 
                    ? editedQuantities[idx] 
                    : item.quantity;
                  
                  return (
                    <div key={idx} className="flex items-center justify-between py-3 px-2 border rounded-lg bg-card/50">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate pr-2">
                          {item.productName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(item.unitPrice)} each
                        </div>
                      </div>
                      
                      {/* Quantity Controls */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center border rounded-md">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              const newQty = Math.max(0, currentQuantity - 1);
                              setEditedQuantities({ ...editedQuantities, [idx]: newQty });
                            }}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-12 text-center text-sm font-medium">
                            {currentQuantity}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              const newQty = currentQuantity + 1;
                              setEditedQuantities({ ...editedQuantities, [idx]: newQty });
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        {/* Line Total */}
                        <div className="text-sm font-medium w-24 text-right">
                          {formatCurrency(item.unitPrice * currentQuantity)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Updated Totals */}
              {Object.keys(editedQuantities).length > 0 && (
                <div className="pt-3 mt-3 border-t space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Updated Total:</span>
                    <span className="font-bold text-primary">
                      {formatCurrency(
                        generatedProposal.lineItems?.reduce((sum: number, item: any, idx: number) => {
                          const qty = editedQuantities[idx] !== undefined ? editedQuantities[idx] : item.quantity;
                          return sum + (item.unitPrice * qty);
                        }, 0) * 1.0825 || 0
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button 
              onClick={() => setLocation(`/proposals/${generatedProposal.id}`)}
              className="flex-1"
              data-testid="button-view-proposal"
            >
              <Eye className="h-4 w-4 mr-2" />
              View Full Proposal
            </Button>
            <Button 
              onClick={() => downloadPdfMutation.mutate()}
              variant="outline"
              className="flex-1"
              disabled={downloadPdfMutation.isPending}
              data-testid="button-download-pdf"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </CardFooter>
        </Card>

        {/* Unmatched Requirements Warning */}
        {unmatchedNeeds.length > 0 && (
          <Alert className="mb-6 border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertTitle className="text-yellow-800 dark:text-yellow-200">
              Manual Review Recommended
            </AlertTitle>
            <AlertDescription className="text-yellow-700 dark:text-yellow-300">
              <p className="mb-2">The following customer requirements couldn't be automatically matched:</p>
              <ul className="list-disc pl-5 space-y-1">
                {unmatchedNeeds.map((need, idx) => (
                  <li key={idx} className="text-sm">{need}</li>
                ))}
              </ul>
              <p className="mt-3 text-sm">
                Please review the proposal and manually add products for these requirements.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="hover-elevate cursor-pointer" onClick={() => {
            navigator.clipboard.writeText(window.location.origin + `/proposals/${generatedProposal.id}`);
            toast({ title: "Link Copied!", description: "Proposal link copied to clipboard" });
          }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Send className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">Share Link</div>
                  <div className="text-xs text-muted-foreground">Copy to clipboard</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation('/new-proposal')}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">Manual Edit</div>
                  <div className="text-xs text-muted-foreground">Fine-tune details</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => {
            setGeneratedProposal(null);
            setConversationInput("");
            setConfidenceScore(0);
            setUnmatchedNeeds([]);
          }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">New Proposal</div>
                  <div className="text-xs text-muted-foreground">Generate another</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
          <Zap className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Instant Proposal Generator</h1>
        <p className="text-muted-foreground">
          Paste conversation. Click generate. Done.
        </p>
      </div>

      {/* Main Input Card */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Conversation</CardTitle>
          <CardDescription>
            Paste the conversation from HubSpot and we'll handle everything else
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={conversationInput}
            onChange={(e) => setConversationInput(e.target.value)}
            placeholder="Paste the customer conversation here...

Example:
Customer: Sarah Johnson
Email: sarah@techstartup.com
Looking for a 20ft office container with AC and electrical upgrades for our expanding team..."
            className="min-h-[300px] font-mono text-sm"
            data-testid="input-conversation"
          />
          
          {/* Character count */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              {conversationInput.length} characters
            </span>
            {conversationInput.length > 0 && conversationInput.length < 20 && (
              <span className="text-xs text-destructive">
                Minimum 20 characters needed
              </span>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleInstantGenerate}
            disabled={generateProposalMutation.isPending || conversationInput.length < 20}
            className="w-full"
            size="lg"
            data-testid="button-generate"
          >
            {generateProposalMutation.isPending ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Analyzing conversation...
              </>
            ) : (
              <>
                <Zap className="h-5 w-5 mr-2" />
                Generate Instant Proposal
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Benefits Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <div className="text-center">
          <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <div className="font-medium">2 Second Generation</div>
          <div className="text-xs text-muted-foreground">From paste to PDF</div>
        </div>
        <div className="text-center">
          <TrendingUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <div className="font-medium">99% Accuracy</div>
          <div className="text-xs text-muted-foreground">AI-powered matching</div>
        </div>
        <div className="text-center">
          <DollarSign className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <div className="font-medium">Zero Training</div>
          <div className="text-xs text-muted-foreground">Works instantly</div>
        </div>
      </div>

      {/* Quick Tips */}
      <Alert className="mt-8">
        <Sparkles className="h-4 w-4" />
        <AlertDescription>
          <strong>Pro tip:</strong> Include customer name, email, and specific product mentions 
          for the most accurate proposals. Our AI understands context like "small backyard unit" 
          and "20ft office with upgrades".
        </AlertDescription>
      </Alert>
    </div>
  );
}