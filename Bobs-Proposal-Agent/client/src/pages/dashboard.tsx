import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { FileText, CheckCircle, Clock, XCircle, Plus, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { Proposal } from "@shared/schema";

export default function Dashboard() {
  const { data: proposals, isLoading } = useQuery<Proposal[]>({
    queryKey: ["/api/proposals"],
  });

  const stats = {
    total: proposals?.length || 0,
    pending: proposals?.filter((p) => p.status === "pending").length || 0,
    approved: proposals?.filter((p) => p.status === "approved").length || 0,
    rejected: proposals?.filter((p) => p.status === "rejected").length || 0,
    totalValue: proposals?.reduce((sum, p) => sum + p.total, 0) || 0,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-chart-2 text-white" data-testid={`badge-status-approved`}>Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" data-testid={`badge-status-rejected`}>Rejected</Badge>;
      default:
        return <Badge className="bg-chart-3 text-white" data-testid={`badge-status-pending`}>Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">HubSpot Conversation to Proposal Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Transform client conversations into professional proposals. View all proposals and sync approved ones to HubSpot.
          </p>
        </div>
        <Link href="/new-proposal">
          <Button data-testid="button-create-proposal">
            <Plus className="h-4 w-4 mr-2" />
            Import HubSpot Conversation
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Proposals</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-proposals">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              All time proposals created
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-chart-3" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-proposals">{stats.pending}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-approved-proposals">{stats.approved}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Successfully approved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-value">
              {formatCurrency(stats.totalValue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Combined proposal value
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Proposals</CardTitle>
          <CardDescription>
            Your most recently created proposals
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-md">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : proposals && proposals.length > 0 ? (
            <div className="space-y-4">
              {proposals.slice(0, 5).map((proposal) => (
                <Link 
                  key={proposal.id} 
                  href={`/proposals/${proposal.id}`}
                  className="block"
                >
                  <div
                    className="flex items-center justify-between p-4 border rounded-md hover-elevate cursor-pointer transition-all"
                    data-testid={`card-proposal-${proposal.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-mono text-sm font-medium" data-testid={`text-proposal-number-${proposal.id}`}>
                          {proposal.proposalNumber}
                        </p>
                        {getStatusBadge(proposal.status)}
                      </div>
                      <p className="text-sm text-muted-foreground" data-testid={`text-customer-name-${proposal.id}`}>
                        {proposal.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDateTime(proposal.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold" data-testid={`text-proposal-total-${proposal.id}`}>
                        {formatCurrency(proposal.total)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Click to view details →
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No proposals yet</h3>
              <p className="text-muted-foreground mb-4">
                Get started by creating your first proposal
              </p>
              <Link href="/new-proposal">
                <Button data-testid="button-create-first-proposal">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Proposal
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
