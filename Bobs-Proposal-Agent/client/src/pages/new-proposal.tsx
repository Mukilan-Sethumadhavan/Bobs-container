import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, Sparkles, ShoppingCart, FileText } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency, generateProposalNumber } from "@/lib/utils";
import type { Product } from "@shared/schema";
import { analyzeConversationSchema } from "@shared/schema";

const proposalFormSchema = analyzeConversationSchema.extend({
  selectedProducts: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    quantity: z.number().min(1),
    unitPrice: z.number(),
  })).min(1, "At least one product must be selected"),
});

type ProposalFormData = z.infer<typeof proposalFormSchema>;

export default function NewProposal() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<"conversation" | "analysis" | "products">("conversation");
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [selectedProducts, setSelectedProducts] = useState<Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>>([]);

  const form = useForm<ProposalFormData>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      conversationNotes: "",
      selectedProducts: [],
    },
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const analyzeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof analyzeConversationSchema>) => {
      const res = await apiRequest("POST", "/api/proposals/analyze", data);
      return res.json();
    },
    onSuccess: (data) => {
      setAiAnalysis(data);
      
      // Auto-populate matched products
      if (data.matchedProducts && data.matchedProducts.length > 0) {
        const autoSelected = data.matchedProducts.map((match: any) => ({
          productId: match.productId,
          productName: match.productName,
          quantity: match.quantity,
          unitPrice: match.unitPrice || 0,
        }));
        setSelectedProducts(autoSelected);
        
        // Skip to products step if high confidence
        const avgConfidence = data.matchedProducts.reduce((sum: number, m: any) => sum + m.confidence, 0) / data.matchedProducts.length;
        if (avgConfidence > 0.8) {
          setStep("products");
          toast({
            title: "Products Auto-Selected",
            description: `AI has automatically selected ${data.matchedProducts.length} products based on the conversation. Review and adjust if needed.`,
          });
        } else {
          setStep("analysis");
          toast({
            title: "Analysis Complete",
            description: "AI has analyzed the conversation and suggested products. Please review the selections.",
          });
        }
      } else {
        setStep("analysis");
        toast({
          title: "Analysis Complete",
          description: "AI has analyzed the conversation. Please select products manually.",
        });
      }
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: "Failed to analyze conversation. Please try again.",
      });
    },
  });

  const createProposalMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/proposals", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({
        title: "Proposal Created",
        description: `Proposal ${data.proposalNumber} has been created successfully.`,
      });
      setLocation(`/proposals/${data.id}`);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: "Failed to create proposal. Please try again.",
      });
    },
  });

  const handleAnalyze = () => {
    const { customerName, customerEmail, conversationNotes } = form.getValues();
    analyzeMutation.mutate({ 
      customerName, 
      customerEmail: customerEmail || undefined, // Send undefined if empty to match optional schema
      conversationNotes 
    });
  };

  const handleProductToggle = (product: Product) => {
    const exists = selectedProducts.find((p) => p.productId === product.id);
    if (exists) {
      setSelectedProducts(selectedProducts.filter((p) => p.productId !== product.id));
    } else {
      setSelectedProducts([
        ...selectedProducts,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.unitPrice,
        },
      ]);
    }
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    setSelectedProducts(
      selectedProducts.map((p) =>
        p.productId === productId ? { ...p, quantity } : p
      )
    );
  };

  const handleCreateProposal = () => {
    const { customerName, customerEmail, conversationNotes } = form.getValues();
    const lineItems = selectedProducts.map((p) => ({
      ...p,
      total: p.quantity * p.unitPrice,
    }));
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const total = subtotal;

    createProposalMutation.mutate({
      proposalNumber: generateProposalNumber(),
      customerName,
      customerEmail,
      conversationNotes,
      aiAnalysis,
      lineItems,
      subtotal,
      total,
      status: "pending",
    });
  };

  const totalAmount = selectedProducts.reduce(
    (sum, p) => sum + p.quantity * p.unitPrice,
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Transform Client Conversation to Proposal</h1>
        <p className="text-muted-foreground mt-1">
          Paste HubSpot conversation notes → AI extracts requirements → Generate branded proposal → Push to HubSpot
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {step === "conversation" && (
            <Card>
              <CardHeader>
                <CardTitle>Step 1: Import Client Conversation from HubSpot</CardTitle>
                <CardDescription>
                  Paste the raw conversation notes from your HubSpot CRM. Our AI will analyze the conversation 
                  to extract requirements and intelligently match products from Bob's Containers catalog.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Form {...form}>
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="customerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="John Smith"
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
                          <FormLabel>Customer Email (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="john@example.com"
                              data-testid="input-customer-email"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="conversationNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>HubSpot Conversation Notes</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Example: 'Client called about container offices. Needs 2x 40ft containers with HVAC, electrical, windows, and modern interior. Budget is $150k. Timeline is 8 weeks. Located in Houston, TX. Prefers blue exterior...'"
                              className="min-h-[200px] font-mono text-sm"
                              data-testid="input-conversation-notes"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Paste the raw conversation notes from HubSpot. AI will automatically extract product requirements, 
                            timeline, budget, and other key details to generate a professional proposal.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      onClick={handleAnalyze}
                      disabled={
                        !form.getValues("customerName") ||
                        !form.getValues("conversationNotes") ||
                        analyzeMutation.isPending
                      }
                      className="w-full"
                      data-testid="button-analyze"
                    >
                      {analyzeMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing with AI...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Analyze with AI
                        </>
                      )}
                    </Button>
                  </div>
                </Form>
              </CardContent>
            </Card>
          )}

          {step === "analysis" && aiAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle>AI Analysis Results</CardTitle>
                <CardDescription>
                  Review the extracted requirements and recommendations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-3">Customer Requirements</h3>
                  <ul className="space-y-2">
                    {aiAnalysis.requirements?.map((req: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-1">•</span>
                        <span data-testid={`text-requirement-${i}`}>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-medium mb-3">Recommended Products</h3>
                  <div className="flex flex-wrap gap-2">
                    {aiAnalysis.recommendedProducts?.map((product: string, i: number) => (
                      <Badge key={i} variant="secondary" data-testid={`badge-recommended-${i}`}>
                        {product}
                      </Badge>
                    ))}
                  </div>
                </div>

                {aiAnalysis.matchedProducts && aiAnalysis.matchedProducts.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Auto-Matched Products
                      </h3>
                      <div className="space-y-2">
                        {aiAnalysis.matchedProducts.map((match: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-primary/5 rounded-md border border-primary/20">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{match.productName}</p>
                              <p className="text-xs text-muted-foreground">Qty: {match.quantity} • {formatCurrency(match.unitPrice || 0)}/ea</p>
                            </div>
                            <Badge className="bg-chart-2 text-white">
                              {Math.round(match.confidence * 100)}% match
                            </Badge>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Products automatically matched based on conversation analysis
                      </p>
                    </div>
                  </>
                )}

                {aiAnalysis.estimatedBudget && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-sm font-medium mb-2">Estimated Budget</h3>
                      <p className="text-sm text-muted-foreground" data-testid="text-estimated-budget">
                        {aiAnalysis.estimatedBudget}
                      </p>
                    </div>
                  </>
                )}

                <Button onClick={() => setStep("products")} className="w-full" data-testid="button-select-products">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Select Products
                </Button>
              </CardContent>
            </Card>
          )}

          {step === "products" && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedProducts.length > 0 && aiAnalysis?.matchedProducts?.length > 0
                    ? "AI-Selected Products"
                    : "Select Products"
                  }
                </CardTitle>
                <CardDescription>
                  {selectedProducts.length > 0 && aiAnalysis?.matchedProducts?.length > 0
                    ? `AI has automatically selected ${selectedProducts.length} products based on the conversation. Review and adjust quantities if needed.`
                    : "Choose products from the catalog to include in this proposal"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {productsLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {products?.map((product) => {
                      const selected = selectedProducts.find((p) => p.productId === product.id);
                      return (
                        <div
                          key={product.id}
                          className={`flex items-center justify-between p-4 border rounded-md hover-elevate ${
                            selected ? "border-primary bg-primary/5" : ""
                          }`}
                          data-testid={`card-product-${product.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm mb-1" data-testid={`text-product-name-${product.id}`}>
                              {product.name}
                            </p>
                            <p className="font-mono text-sm text-muted-foreground">
                              {formatCurrency(product.unitPrice)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {selected && (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleQuantityChange(product.id, Math.max(1, selected.quantity - 1))}
                                  data-testid={`button-decrease-${product.id}`}
                                >
                                  -
                                </Button>
                                <span className="w-8 text-center font-mono text-sm" data-testid={`text-quantity-${product.id}`}>
                                  {selected.quantity}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleQuantityChange(product.id, selected.quantity + 1)}
                                  data-testid={`button-increase-${product.id}`}
                                >
                                  +
                                </Button>
                              </div>
                            )}
                            <Button
                              variant={selected ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleProductToggle(product)}
                              data-testid={`button-toggle-${product.id}`}
                            >
                              {selected ? "Remove" : "Add"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Proposal Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium" data-testid="text-summary-customer">
                    {form.watch("customerName") || "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Products:</span>
                  <span className="font-medium" data-testid="text-summary-product-count">
                    {selectedProducts.length}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="font-medium">Total:</span>
                  <span className="text-lg font-bold" data-testid="text-summary-total">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </div>

              {selectedProducts.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      Selected Products
                      {aiAnalysis?.matchedProducts?.length > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <Sparkles className="h-3 w-3 mr-1" />
                          AI Selected
                        </Badge>
                      )}
                    </h4>
                    <div className="space-y-2">
                      {selectedProducts.map((p) => (
                        <div key={p.productId} className="flex justify-between text-xs">
                          <span className="text-muted-foreground truncate flex-1">
                            {p.productName}
                          </span>
                          <span className="font-mono ml-2">
                            {p.quantity} × {formatCurrency(p.unitPrice)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {aiAnalysis?.matchedProducts?.length > 0 && step === "products" && (
                <div className="p-3 bg-primary/5 rounded-md border border-primary/20">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-primary mt-0.5" />
                    <div className="text-xs">
                      <p className="font-medium text-primary">AI Auto-Selection Active</p>
                      <p className="text-muted-foreground mt-1">
                        Products were automatically matched based on the conversation. 
                        Review quantities or click "Create Proposal" to proceed.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleCreateProposal}
                disabled={selectedProducts.length === 0 || createProposalMutation.isPending}
                className="w-full"
                data-testid="button-create-proposal"
              >
                {createProposalMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    {aiAnalysis?.matchedProducts?.length > 0 ? "Quick Create Proposal" : "Create Proposal"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
