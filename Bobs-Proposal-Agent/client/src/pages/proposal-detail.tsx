import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { FileText, CheckCircle, XCircle, ArrowLeft, Download, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { Proposal } from "@shared/schema";
import { useState } from "react";

export default function ProposalDetail() {
  const [, params] = useRoute("/proposals/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [notes, setNotes] = useState("");

  const { data: proposal, isLoading } = useQuery<Proposal>({
    queryKey: ["/api/proposals", params?.id],
    enabled: !!params?.id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/proposals/${params?.id}/status`, { status, notes });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals", params?.id] });
      toast({
        title: "Status Updated",
        description: `Proposal has been ${data.status}.`,
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Failed to update proposal status.",
      });
    },
  });

  const downloadPdfMutation = useMutation({
    mutationFn: async () => {
      // Fetch the PDF as a blob
      const res = await fetch(`/api/proposals/${params?.id}/pdf`, {
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
      a.download = `proposal-${proposal?.proposalNumber || 'download'}.pdf`;
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

  const handleApprove = () => {
    updateStatusMutation.mutate({ status: "approved", notes });
  };

  const handleReject = () => {
    updateStatusMutation.mutate({ status: "rejected", notes });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-chart-2 text-white">Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge className="bg-chart-3 text-white">Pending</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Proposal not found</h3>
        <Button onClick={() => setLocation("/")} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-semibold tracking-tight font-mono" data-testid="text-proposal-number">
              {proposal.proposalNumber}
            </h1>
            {getStatusBadge(proposal.status)}
          </div>
          <p className="text-muted-foreground">
            Created {formatDateTime(proposal.createdAt)}
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => downloadPdfMutation.mutate()}
          disabled={downloadPdfMutation.isPending}
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
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Customer Conversation - Displayed First */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Conversation</CardTitle>
              <CardDescription>Original message from the customer</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-6 rounded-lg">
                <p className="text-sm whitespace-pre-wrap font-mono" data-testid="text-conversation-notes">
                  {proposal.conversationNotes}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* AI Analysis - Displayed After Conversation */}
          {proposal.aiAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle>AI Analysis & Reasoning</CardTitle>
                <CardDescription>How we interpreted the customer's needs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground text-sm">Extracted Requirements</Label>
                  <ul className="space-y-2 mt-2">
                    {proposal.aiAnalysis.requirements?.map((req: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-1">•</span>
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {proposal.aiAnalysis.recommendedProducts && proposal.aiAnalysis.recommendedProducts.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-muted-foreground text-sm">Recommended Products</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {proposal.aiAnalysis.recommendedProducts.map((product: string, i: number) => (
                          <Badge key={i} variant="secondary">
                            {product}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-sm">Customer Name</Label>
                <p className="font-medium mt-1" data-testid="text-customer-name">{proposal.customerName}</p>
              </div>
              {proposal.customerEmail && (
                <div>
                  <Label className="text-muted-foreground text-sm">Email</Label>
                  <p className="font-medium mt-1" data-testid="text-customer-email">{proposal.customerEmail}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {proposal.lineItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 border rounded-md"
                    data-testid={`card-line-item-${index}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm mb-1" data-testid={`text-line-item-name-${index}`}>
                        {item.productName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Quantity: {item.quantity} × {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <p className="text-lg font-semibold ml-4" data-testid={`text-line-item-total-${index}`}>
                      {formatCurrency(item.total)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pricing Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-mono" data-testid="text-subtotal">{formatCurrency(proposal.subtotal)}</span>
              </div>
              {proposal.tax !== null && proposal.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax:</span>
                  <span className="font-mono">{formatCurrency(proposal.tax || 0)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="font-semibold">Total:</span>
                <span className="text-2xl font-bold" data-testid="text-total">
                  {formatCurrency(proposal.total || 0)}
                </span>
              </div>
            </CardContent>
          </Card>

          {proposal.status === "pending" && (
            <Card>
              <CardHeader>
                <CardTitle>Approve or Reject</CardTitle>
                <CardDescription>Review and update proposal status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any notes or comments..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-2"
                    data-testid="input-status-notes"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleApprove}
                    disabled={updateStatusMutation.isPending}
                    className="flex-1 bg-chart-2 hover:bg-chart-2/90"
                    data-testid="button-approve"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={updateStatusMutation.isPending}
                    variant="destructive"
                    className="flex-1"
                    data-testid="button-reject"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {proposal.status !== "pending" && (
            <Card>
              <CardHeader>
                <CardTitle>Status Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-muted-foreground text-sm">Status</Label>
                  <div className="mt-2">{getStatusBadge(proposal.status)}</div>
                </div>
                {proposal.status === "approved" && proposal.approvedAt && (
                  <div>
                    <Label className="text-muted-foreground text-sm">Approved At</Label>
                    <p className="text-sm mt-1">{formatDateTime(proposal.approvedAt)}</p>
                  </div>
                )}
                {proposal.status === "rejected" && proposal.rejectedAt && (
                  <div>
                    <Label className="text-muted-foreground text-sm">Rejected At</Label>
                    <p className="text-sm mt-1">{formatDateTime(proposal.rejectedAt)}</p>
                  </div>
                )}
                {proposal.notes && (
                  <div>
                    <Label className="text-muted-foreground text-sm">Notes</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{proposal.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
