"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveBudgetPlan } from "@/app/actions/budget";
import { toggleFavourite } from "@/app/actions/favourites";
import { loadPlanningHubVenueDetailAction } from "@/app/actions/planning-hub";
import { planningHubBudgetStorageKey, restoreBudgetPlan, serializeBudgetPlan } from "@/lib/budget/persistence";
import type { BudgetPlan } from "@/lib/budget/types";
import {
  addManualPlanningHubVenue,
  choosePlanningHubVenue,
  findPlanningHubVenueItem,
  getVenuePlanningCost,
  updatePlanningHubVenuePayment,
  upsertPlanningHubVenue,
  type PlanningHubVenueStatus
} from "@/lib/planning-hub/plan";
import type { PlanningHubSearchParams, PlanningHubVenue, PlanningHubVenueDetail, PlanningHubVenueResults as PlanningHubVenueResultData } from "@/lib/planning-hub/types";
import { PlanningHubComparePanel } from "./planning-hub-compare-panel";
import { PlanningHubPlanPanel, type PlanningHubSaveState } from "./planning-hub-plan-panel";
import { PlanningHubVenueDetailPanel } from "./planning-hub-venue-detail";
import { PlanningHubVenueResults } from "./planning-hub-venue-results";

export function PlanningHubWorkspace({
  initialPlan,
  initialSavedVenueIds,
  connectedWorkspaceId = null,
  results,
  searchParams,
  userId
}: {
  initialPlan: BudgetPlan;
  connectedWorkspaceId?: string | null;
  initialSavedVenueIds: string[];
  results: PlanningHubVenueResultData;
  searchParams: PlanningHubSearchParams;
  userId: string | null;
}) {
  const storageKey = planningHubBudgetStorageKey(connectedWorkspaceId);
  const firstVenue = results.venues.find((venue) => venue.id === initialPlan.selectedVenueId) ?? results.venues[0] ?? null;
  const firstItem = findPlanningHubVenueItem(initialPlan, firstVenue?.id);
  const [plan, setPlan] = useState(initialPlan);
  const [ready, setReady] = useState(false);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(firstVenue?.id ?? null);
  const [status, setStatus] = useState<PlanningHubVenueStatus>(normaliseStatus(firstItem?.bookingStatus));
  const [planningCostPence, setPlanningCostPence] = useState(
    getSavedItemCost(firstItem) ?? getVenuePlanningCost(firstVenue, initialPlan.guestCount) ?? 0
  );
  const [savedVenueIds, setSavedVenueIds] = useState(() => new Set(initialSavedVenueIds));
  const [comparedVenues, setComparedVenues] = useState<PlanningHubVenue[]>([]);
  const [detail, setDetail] = useState<PlanningHubVenueDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saveState, setSaveState] = useState<PlanningHubSaveState>("idle");
  const [saveMessage, setSaveMessage] = useState(userId ? "Changes are also kept on this device." : "Changes are saved on this device.");
  const [pending, startTransition] = useTransition();
  const detailRequestId = useRef(0);
  const detailTriggerRef = useRef<HTMLElement | null>(null);

  const selectedVenue = results.venues.find((venue) => venue.id === selectedVenueId) ?? null;
  const selectedItem = findPlanningHubVenueItem(plan, selectedVenueId);
  const comparedIds = new Set(comparedVenues.map((venue) => venue.id));

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const localPlan = restoreBudgetPlan(window.localStorage.getItem(storageKey));
        if (localPlan && new Date(localPlan.updatedAt).getTime() > new Date(initialPlan.updatedAt).getTime()) {
          setPlan({ ...localPlan, userId });
          setSaveMessage("Restored newer changes from this device.");
          const restoredVenue = results.venues.find((venue) => venue.id === localPlan.selectedVenueId);
          if (restoredVenue) {
            const restoredItem = findPlanningHubVenueItem(localPlan, restoredVenue.id);
            setSelectedVenueId(restoredVenue.id);
            setStatus(normaliseStatus(restoredItem?.bookingStatus));
            setPlanningCostPence(getSavedItemCost(restoredItem) ?? getVenuePlanningCost(restoredVenue, localPlan.guestCount) ?? 0);
          }
        }
      } catch {
        setSaveMessage("This browser could not restore local changes.");
      } finally {
        setReady(true);
      }
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [initialPlan.updatedAt, results.venues, storageKey, userId]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(storageKey, serializeBudgetPlan(plan));
    } catch {
      queueMicrotask(() => {
        setSaveState("error");
        setSaveMessage("This browser could not save the latest local changes.");
      });
    }
  }, [plan, ready, storageKey]);

  function openVenue(venueId: string) {
    const venue = results.venues.find((candidate) => candidate.id === venueId);
    if (!venue) return;
    detailTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const item = findPlanningHubVenueItem(plan, venue.id);
    setSelectedVenueId(venue.id);
    setStatus(normaliseStatus(item?.bookingStatus));
    setPlanningCostPence(getSavedItemCost(item) ?? getVenuePlanningCost(venue, plan.guestCount) ?? 0);
    setDetailLoading(true);
    const requestId = detailRequestId.current + 1;
    detailRequestId.current = requestId;
    startTransition(async () => {
      const loaded = await loadPlanningHubVenueDetailAction(venue.id);
      if (requestId !== detailRequestId.current) return;
      setDetail(loaded);
      setDetailLoading(false);
      if (!loaded) {
        setSaveState("error");
        setSaveMessage("Venue details could not be opened. The result remains available in your plan.");
        return;
      }
      requestAnimationFrame(() => {
        const panel = document.getElementById("venue-detail");
        panel?.focus({ preventScroll: true });
        panel?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function closeVenueDetail() {
    setDetail(null);
    requestAnimationFrame(() => detailTriggerRef.current?.focus());
  }

  function toggleCompare(venueId: string) {
    const existing = comparedVenues.some((venue) => venue.id === venueId);
    if (existing) {
      setComparedVenues((current) => current.filter((venue) => venue.id !== venueId));
      return;
    }
    const venue = results.venues.find((candidate) => candidate.id === venueId);
    if (!venue) return;
    if (comparedVenues.length >= 3) {
      setSaveMessage("Compare up to three venues at a time.");
      return;
    }
    setComparedVenues((current) => [...current, venue]);
  }

  function toggleSavedVenue(venueId: string) {
    if (!userId) {
      setSaveState("error");
      setSaveMessage("Sign in to save venue favourites. Your wedding plan still stays on this device.");
      return;
    }
    const wasSaved = savedVenueIds.has(venueId);
    setSavedVenueIds((current) => {
      const next = new Set(current);
      if (wasSaved) next.delete(venueId); else next.add(venueId);
      return next;
    });
    startTransition(async () => {
      const result = await toggleFavourite(venueId, wasSaved, "/planning-hub");
      if (!result.ok) {
        setSavedVenueIds((current) => {
          const next = new Set(current);
          if (wasSaved) next.add(venueId); else next.delete(venueId);
          return next;
        });
        setSaveState("error");
      }
      setSaveMessage(result.message);
    });
  }

  function saveCurrentVenue() {
    if (!selectedVenue) return;
    const next = upsertPlanningHubVenue(plan, selectedVenue, planningCostPence, status);
    persistPlan(next, `${selectedVenue.name} is ${status === "quoted" ? "recorded with a quote" : status} in your plan.`);
  }

  function chooseCurrentVenue() {
    if (!selectedVenue) return;
    const withItem = selectedItem ? plan : upsertPlanningHubVenue(plan, selectedVenue, planningCostPence, status);
    persistPlan(choosePlanningHubVenue(withItem, selectedVenue.id), `${selectedVenue.name} is now your chosen venue.`);
  }

  function addManualVenue(name: string, costPence: number, venueStatus: PlanningHubVenueStatus) {
    persistPlan(addManualPlanningHubVenue(plan, name, costPence, venueStatus), `${name} was added manually.`);
  }

  function savePayments(depositPence: number, paidPence: number, dueDate: string | null) {
    if (!selectedVenue) return;
    persistPlan(updatePlanningHubVenuePayment(plan, selectedVenue.id, depositPence, paidPence, dueDate), "Venue payments updated.");
  }

  function updatePlan(updates: Partial<BudgetPlan>) {
    setPlan((current) => ({ ...current, ...updates, updatedAt: new Date().toISOString() }));
    setSaveState("idle");
    setSaveMessage(userId ? "Save when your wedding basics are ready." : "Saved on this device.");
  }

  function persistPlan(nextPlan: BudgetPlan, successMessage: string) {
    setPlan(nextPlan);
    if (!userId) {
      setSaveState("saved");
      setSaveMessage(`${successMessage} Saved on this device.`);
      return;
    }
    setSaveState("saving");
    setSaveMessage("Saving to your account…");
    startTransition(async () => {
      const result = connectedWorkspaceId
        ? await (await import("@/app/actions/planning-workspace")).saveConnectedBudgetPlanAction(connectedWorkspaceId, nextPlan)
        : await saveBudgetPlan(nextPlan);
      setSaveState(result.ok ? "saved" : "error");
      setSaveMessage(result.ok ? successMessage : result.message ?? "Cloud save failed. Your changes remain on this device.");
    });
  }

  return (
    <div className="grid min-w-0 gap-6 lg:col-span-2 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <PlanningHubComparePanel onRemove={(venueId) => setComparedVenues((current) => current.filter((venue) => venue.id !== venueId))} venues={comparedVenues} />
        <PlanningHubVenueDetailPanel detail={detail} loading={detailLoading || pending && detailLoading} onClose={closeVenueDetail} />
        <PlanningHubVenueResults
          comparedVenueIds={comparedIds}
          onCompare={toggleCompare}
          onOpen={openVenue}
          onSave={toggleSavedVenue}
          plan={plan}
          results={results}
          savedVenueIds={savedVenueIds}
          searchParams={searchParams}
        />
      </div>
      <PlanningHubPlanPanel
        onChooseVenue={chooseCurrentVenue}
        onManualVenue={addManualVenue}
        onPaymentSave={savePayments}
        onPlanChange={updatePlan}
        onPlanSave={() => persistPlan(plan, userId ? "Your plan is saved to your account." : "Your plan is up to date.")}
        onPlanningCostChange={setPlanningCostPence}
        onStatusChange={setStatus}
        onVenueSave={saveCurrentVenue}
        plan={plan}
        planningCostPence={planningCostPence}
        saveMessage={saveMessage}
        saveState={saveState}
        selectedItem={selectedItem}
        selectedVenue={selectedVenue}
        status={status}
      />
    </div>
  );
}

function normaliseStatus(status: string | undefined): PlanningHubVenueStatus {
  return status === "researching" || status === "quoted" || status === "booked" ? status : "shortlisted";
}

function getSavedItemCost(item: ReturnType<typeof findPlanningHubVenueItem>) {
  if (!item) return null;
  return item.confirmedCostPence ?? item.estimatedCostPence ?? (
    item.costPerPersonPence != null && item.guestCount != null ? item.costPerPersonPence * item.guestCount : null
  );
}
