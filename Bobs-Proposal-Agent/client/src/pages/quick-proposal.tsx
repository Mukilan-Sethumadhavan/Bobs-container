import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FileText, Sparkles, CheckCircle, AlertCircle, Edit, Download, Eye, Save, X } from "lucide-react";
import type { Proposal } from "@shared/schema";

const conversationSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Must be a valid email").optional().or(z.literal("")),
  conversationNotes: z.string().min(20, "Please paste the conversation from HubSpot"),
});

type ConversationData = z.infer<typeof conversationSchema>;

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default function QuickProposal() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [generatedProposal, setGeneratedProposal] = useState<Proposal | null>(null);
  const [step, setStep] = useState<"import" | "review">("import");
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuantities, setEditedQuantities] = useState<{ [key: number]: number }>({});

  const form = useForm<ConversationData>({
    resolver: zodResolver(conversationSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      conversationNotes: "",
    },
  });

  const generateProposalMutation = useMutation({
    mutationFn: async (data: ConversationData) => {
      const res = await apiRequest("POST", "/api/proposals/generate", {
        ...data,
        customerEmail: data.customerEmail || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.proposal) {
        setGeneratedProposal(data.proposal);
        setStep("review");
        queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
        toast({
          title: "Proposal Generated!",
          description: `${data.analysis?.matchedProducts?.length || 0} products automatically selected from conversation`,
        });
      }
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to generate proposal";
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: message,
      });
    },
  });

  const downloadPdfMutation = useMutation({
    mutationFn: async () => {
      if (!generatedProposal?.id) throw new Error("No proposal ID");
      
      // Fetch the PDF as a blob
      const res = await fetch(`/api/proposals/${generatedProposal.id}/pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to generate PDF');
      }
      
      // Get the blob and create download link
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
        description: "Your proposal PDF has been downloaded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "PDF Generation Failed",
        description: error.message || "Failed to generate PDF.",
        variant: "destructive"
      });
    },
  });

  const handleGenerate = async () => {
    const isValid = await form.trigger();
    if (!isValid) return;
    
    const values = form.getValues();
    generateProposalMutation.mutate(values);
  };

  const handleEdit = () => {
    if (generatedProposal) {
      setIsEditing(true);
      // Initialize edited quantities with current values
      const initialQuantities: { [key: number]: number } = {};
      generatedProposal.lineItems?.forEach((item: any, index: number) => {
        initialQuantities[index] = item.quantity;
      });
      setEditedQuantities(initialQuantities);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedQuantities({});
  };

  const handleSaveEdit = async () => {
    if (!generatedProposal) return;
    
    try {
      // Update line items with new quantities
      const updatedLineItems = generatedProposal.lineItems?.map((item: any, index: number) => ({
        ...item,
        quantity: editedQuantities[index] || item.quantity,
        total: (editedQuantities[index] || item.quantity) * item.unitPrice
      }));

      // Recalculate totals
      const subtotal = updatedLineItems?.reduce((sum, item) => sum + item.total, 0) || 0;
      const tax = Math.round(subtotal * 0.0825);
      const total = subtotal + tax;

      // Update the proposal in state
      setGeneratedProposal({
        ...generatedProposal,
        lineItems: updatedLineItems,
        subtotal,
        tax,
        total
      });
      
      setIsEditing(false);
      setEditedQuantities({});
      
      toast({
        title: "Quantities Updated",
        description: "Proposal has been updated with new quantities.",
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update quantities. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleQuantityChange = (index: number, value: string) => {
    const qty = parseInt(value) || 0;
    if (qty >= 0) {
      setEditedQuantities(prev => ({ ...prev, [index]: qty }));
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Quick Proposal Generator</h1>
          <p className="text-muted-foreground mt-2">
            Import HubSpot conversation → Get complete proposal instantly
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            step === "import" ? "bg-primary text-primary-foreground" : "bg-muted"
          }`}>
            <span className="font-medium">1</span>
            <span>Import</span>
          </div>
          <div className="w-8 h-0.5 bg-border" />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            step === "review" ? "bg-primary text-primary-foreground" : "bg-muted"
          }`}>
            <span className="font-medium">2</span>
            <span>Review</span>
          </div>
        </div>
      </div>

      {step === "import" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Import HubSpot Conversation
            </CardTitle>
            <CardDescription>
              Paste the conversation and our AI will generate a complete proposal with exact products and pricing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Acme Corp"
                            data-testid="input-customer-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customerEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="contact@acmecorp.com"
                            data-testid="input-customer-email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="conversationNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>HubSpot Conversation *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Paste the full conversation from HubSpot. Include all details about products, quantities, timeline, budget, and special requirements..."
                          className="min-h-[300px] font-mono text-sm"
                          data-testid="input-conversation"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The AI will analyze this conversation to identify products, quantities, and requirements
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>For best results:</strong> Include specific product mentions, dimensions (20ft, 40ft), 
                    quantities, features (office, kitchen, bathroom), and any special requirements in the conversation.
                  </AlertDescription>
                </Alert>
              </div>
            </Form>
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleGenerate}
              disabled={generateProposalMutation.isPending}
              size="lg"
              className="w-full"
              data-testid="button-generate"
            >
              {generateProposalMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing Conversation & Generating Proposal...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Complete Proposal
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === "review" && generatedProposal && (
        <div className="space-y-6">
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <strong>Success!</strong> Proposal {generatedProposal.proposalNumber} has been generated 
              with {generatedProposal.lineItems?.length || 0} products totaling {formatCurrency(generatedProposal.total)}.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Generated Proposal #{generatedProposal.proposalNumber}</CardTitle>
                  <CardDescription>{generatedProposal.customerName}</CardDescription>
                </div>
                <Badge className="bg-green-500 text-white">Ready for Review</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Customer Conversation - Show First */}
              <div>
                <h3 className="font-medium mb-3">Customer's Original Message</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap font-mono">
                    {generatedProposal.conversationNotes}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Customer Info */}
              <div>
                <h3 className="font-medium mb-3">Customer Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <p className="font-medium">{generatedProposal.customerName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-medium">{generatedProposal.customerEmail || "Not provided"}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* AI Analysis - Show After Conversation */}
              {generatedProposal.aiAnalysis && (
                <>
                  <div>
                    <h3 className="font-medium mb-3">AI Analysis - Extracted Requirements</h3>
                    <ul className="space-y-1">
                      {generatedProposal.aiAnalysis.requirements?.map((req: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-primary mt-1">•</span>
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {/* Reasoning Steps */}
                  {generatedProposal.aiAnalysis.reasoningSteps && generatedProposal.aiAnalysis.reasoningSteps.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">AI Reasoning Process</h4>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {generatedProposal.aiAnalysis.reasoningSteps.map((step: string, i: number) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="mt-0.5">→</span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Unmatched Needs */}
                  {generatedProposal.aiAnalysis.unmatchedNeeds && generatedProposal.aiAnalysis.unmatchedNeeds.length > 0 && (
                    <Alert className="mt-4 border-amber-500 bg-amber-50 dark:bg-amber-950">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800 dark:text-amber-200">
                        <strong>Manual Review Needed:</strong>
                        <ul className="mt-2 space-y-1">
                          {generatedProposal.aiAnalysis.unmatchedNeeds.map((need: string, i: number) => (
                            <li key={i} className="text-sm">• {need}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <Separator />
                </>
              )}

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Selected Products</h3>
                  {isEditing && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        variant="default"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save Changes
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleCancelEdit}
                        variant="outline"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {generatedProposal.lineItems?.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-md">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.productName}</p>
                        {isEditing ? (
                          <div className="flex items-center gap-2 mt-1">
                            <label className="text-xs text-muted-foreground">Qty:</label>
                            <Input
                              type="number"
                              min="0"
                              value={editedQuantities[i] ?? item.quantity}
                              onChange={(e) => handleQuantityChange(i, e.target.value)}
                              className="w-20 h-7 text-xs"
                            />
                            <span className="text-xs text-muted-foreground">
                              × {formatCurrency(item.unitPrice)}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} × {formatCurrency(item.unitPrice)}
                          </p>
                        )}
                      </div>
                      <p className="font-mono font-medium">
                        {isEditing 
                          ? formatCurrency((editedQuantities[i] ?? item.quantity) * item.unitPrice)
                          : formatCurrency(item.total || (item.quantity * item.unitPrice))
                        }
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Pricing Summary */}
              <div>
                <h3 className="font-medium mb-3">Pricing Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono">
                      {isEditing
                        ? formatCurrency(
                            generatedProposal.lineItems?.reduce((sum, item: any, i: number) => 
                              sum + ((editedQuantities[i] ?? item.quantity) * item.unitPrice), 0) || 0
                          )
                        : formatCurrency(generatedProposal.subtotal || 0)
                      }
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax (8.25%)</span>
                    <span className="font-mono">
                      {isEditing
                        ? formatCurrency(
                            Math.round(
                              (generatedProposal.lineItems?.reduce((sum, item: any, i: number) => 
                                sum + ((editedQuantities[i] ?? item.quantity) * item.unitPrice), 0) || 0) * 0.0825
                            )
                          )
                        : formatCurrency(generatedProposal.tax || 0)
                      }
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>Total</span>
                    <span className="font-mono text-lg">
                      {isEditing
                        ? (() => {
                            const subtotal = generatedProposal.lineItems?.reduce((sum, item: any, i: number) => 
                              sum + ((editedQuantities[i] ?? item.quantity) * item.unitPrice), 0) || 0;
                            const tax = Math.round(subtotal * 0.0825);
                            return formatCurrency(subtotal + tax);
                          })()
                        : formatCurrency(generatedProposal.total || 0)
                      }
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button
                onClick={() => downloadPdfMutation.mutate()}
                disabled={downloadPdfMutation.isPending}
                variant="default"
                data-testid="button-download-pdf"
              >
                {downloadPdfMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </>
                )}
              </Button>
              <Button
                onClick={() => setLocation(`/proposals/${generatedProposal.id}`)}
                variant="outline"
                data-testid="button-view-full"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Button>
              <Button
                variant="outline"
                onClick={handleEdit}
                disabled={isEditing}
                data-testid="button-edit"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Quantities
              </Button>
            </CardFooter>
          </Card>

          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={() => {
                setStep("import");
                setGeneratedProposal(null);
                form.reset();
              }}
              data-testid="button-new-proposal"
            >
              Generate Another Proposal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}