import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Sidebar } from "@/components/Sidebar";
import { DetailDrawer } from "@/components/DetailDrawer";
import {
  OverviewTab,
  MatchedTab,
  UnmatchedTab,
  BankDepositsTab,
  FilesTab,
  SafetyNetTab,
  WarningsTab,
} from "@/components/Tabs";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAppStore } from "@/store/appStore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hugh's PBS Claim Reconciliation App" },
      {
        name: "description",
        content:
          "Reconcile Z Dispense Summary Reconciliation Reports against Medicare PBS Claim Payment Advice PDFs for Australian community pharmacy.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const loadDemo = useAppStore((s) => s.loadDemo);
  const filesCount = useAppStore((s) => s.files.length);
  const [tab, setTab] = useState("overview");

  // Auto-load demo data on first visit so the app is immediately useful
  useEffect(() => {
    if (filesCount === 0) loadDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="matched">Matched</TabsTrigger>
              <TabsTrigger value="unmatched">Unmatched</TabsTrigger>
              <TabsTrigger value="bank">Bank Deposits</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="safety">Safety Net</TabsTrigger>
              <TabsTrigger value="warnings">Parse Warnings</TabsTrigger>
            </TabsList>
            <TabsContent value="overview"><OverviewTab /></TabsContent>
            <TabsContent value="matched"><MatchedTab /></TabsContent>
            <TabsContent value="unmatched"><UnmatchedTab /></TabsContent>
            <TabsContent value="bank"><BankDepositsTab /></TabsContent>
            <TabsContent value="files"><FilesTab /></TabsContent>
            <TabsContent value="safety"><SafetyNetTab /></TabsContent>
            <TabsContent value="warnings"><WarningsTab /></TabsContent>
          </Tabs>
        </main>
      </div>
      <DetailDrawer />
    </div>
  );
}
