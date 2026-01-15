import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/app-sidebar";
import Dashboard from "@/pages/dashboard";
import NewProposal from "@/pages/new-proposal";
import QuickProposal from "@/pages/quick-proposal";
import InstantProposal from "@/pages/instant-proposal";
import Catalog from "@/pages/catalog";
import ProposalDetail from "@/pages/proposal-detail";
import Settings from "@/pages/settings";
import HubSpotSettings from "@/pages/hubspot-settings";
import HubSpotConversations from "@/pages/hubspot-conversations";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={InstantProposal} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/new-proposal" component={NewProposal} />
      <Route path="/quick-proposal" component={QuickProposal} />
      <Route path="/catalog" component={Catalog} />
      <Route path="/proposals/:id" component={ProposalDetail} />
      <Route path="/hubspot" component={HubSpotSettings} />
      <Route path="/hubspot/conversations" component={HubSpotConversations} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="bobs-containers-theme">
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 overflow-hidden">
                <header className="flex items-center justify-between p-4 border-b bg-background shrink-0">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <ThemeToggle />
                </header>
                <main className="flex-1 overflow-auto">
                  <div className="container max-w-7xl mx-auto p-6">
                    <Router />
                  </div>
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
