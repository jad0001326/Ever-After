"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveBudgetPlan } from "@/app/actions/budget";
import { loadPlanningHubPhotographerDetailAction } from "@/app/actions/planning-hub";
import { planningHubBudgetStorageKey, restoreBudgetPlan, serializeBudgetPlan } from "@/lib/budget/persistence";
import type { AvailabilityStatus, BudgetPlan, PaymentInstallment } from "@/lib/budget/types";
import {
  addManualPlanningHubPhotographer,
  findPlanningHubPhotographyItem,
  updatePlanningHubItemInstallments,
  updatePlanningHubItemAvailability,
  upsertPlanningHubPhotographer,
  type PlanningHubItemStatus
} from "@/lib/planning-hub/plan";
import type {
  PlanningHubPhotographer,
  PlanningHubPhotographerDetail,
  PlanningHubPhotographerResults as ResultData,
  PlanningHubPhotographySearchParams
} from "@/lib/planning-hub/types";
import { PlanningHubPhotographerCompare } from "./planning-hub-photographer-compare";
import { PlanningHubPhotographerDetailPanel } from "./planning-hub-photographer-detail";
import { PlanningHubPhotographerResults } from "./planning-hub-photographer-results";
import { PlanningHubPhotographyPlanPanel } from "./planning-hub-photography-plan-panel";
import type { PlanningHubSaveState } from "./planning-hub-plan-panel";

export function PlanningHubPhotographyWorkspace({
  initialPlan,
  initialPlanIsFallback = false,
  connectedWorkspaceId = null,
  results,
  searchParams,
  today = "2026-07-26",
  userId
}: {
  initialPlan: BudgetPlan;
  initialPlanIsFallback?: boolean;
  connectedWorkspaceId?: string | null;
  results: ResultData;
  searchParams: PlanningHubPhotographySearchParams;
  today?: string;
  userId: string | null;
}) {
  const storageKey = planningHubBudgetStorageKey(connectedWorkspaceId);
  const firstPlannedItem = findPlanningHubPhotographyItem(initialPlan, searchParams.planItem)
    ?? findLatestPhotographyItem(initialPlan);
  const firstPhotographer = firstPlannedItem
    ? results.photographers.find((photographer) => photographer.id === firstPlannedItem.listingId) ?? null
    : results.photographers[0] ?? null;
  const firstItem = firstPlannedItem ?? findPlanningHubPhotographyItem(initialPlan, firstPhotographer?.id);
  const [plan, setPlan] = useState(initialPlan);
  const [ready, setReady] = useState(false);
  const [selectedPhotographerId, setSelectedPhotographerId] = useState<string | null>(firstPhotographer?.id ?? firstItem?.id ?? null);
  const [status, setStatus] = useState<PlanningHubItemStatus>(normaliseStatus(firstItem?.bookingStatus));
  const [planningCostPence, setPlanningCostPence] = useState(getSavedItemCost(firstItem) ?? firstPhotographer?.startingPricePence ?? 0);
  const [comparedPhotographers, setComparedPhotographers] = useState<PlanningHubPhotographer[]>([]);
  const [detail, setDetail] = useState<PlanningHubPhotographerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saveState, setSaveState] = useState<PlanningHubSaveState>("idle");
  const [saveMessage, setSaveMessage] = useState(userId ? "Changes are also kept on this device." : "Changes are saved on this device.");
  const [pending, startTransition] = useTransition();
  const detailRequestId = useRef(0);
  const detailTriggerRef = useRef<HTMLElement | null>(null);

  const selectedPhotographer = results.photographers.find((photographer) => photographer.id === selectedPhotographerId) ?? null;
  const selectedItem = findPlanningHubPhotographyItem(plan, selectedPhotographerId);
  const comparedIds = new Set(comparedPhotographers.map((photographer) => photographer.id));

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const localPlan = restoreBudgetPlan(window.localStorage.getItem(storageKey));
        if (localPlan && (initialPlanIsFallback || new Date(localPlan.updatedAt).getTime() > new Date(initialPlan.updatedAt).getTime())) {
          const restored = { ...localPlan, userId };
          setPlan(restored);
          setSaveMessage("Restored newer changes from this device.");
          const restoredItem = findPlanningHubPhotographyItem(restored, searchParams.planItem)
            ?? findLatestPhotographyItem(restored);
          const restoredPhotographer = restoredItem?.listingId
            ? results.photographers.find((photographer) => photographer.id === restoredItem.listingId) ?? null
            : null;
          if (restoredItem) {
            setSelectedPhotographerId(restoredPhotographer?.id ?? restoredItem.id);
            setStatus(normaliseStatus(restoredItem?.bookingStatus));
            setPlanningCostPence(getSavedItemCost(restoredItem) ?? restoredPhotographer?.startingPricePence ?? 0);
          }
        }
      } catch {
        setSaveMessage("This browser could not restore local changes.");
      } finally {
        setReady(true);
      }
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [initialPlan.updatedAt, initialPlanIsFallback, results.photographers, searchParams.planItem, storageKey, userId]);

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

  function openPhotographer(photographerId: string) {
    const photographer = results.photographers.find((candidate) => candidate.id === photographerId);
    if (!photographer) return;
    detailTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const item = findPlanningHubPhotographyItem(plan, photographer.id);
    setSelectedPhotographerId(photographer.id);
    setStatus(normaliseStatus(item?.bookingStatus));
    setPlanningCostPence(getSavedItemCost(item) ?? photographer.startingPricePence ?? 0);
    setDetailLoading(true);
    const requestId = detailRequestId.current + 1;
    detailRequestId.current = requestId;
    startTransition(async () => {
      const loaded = await loadPlanningHubPhotographerDetailAction(photographer.id);
      if (requestId !== detailRequestId.current) return;
      setDetail(loaded);
      setDetailLoading(false);
      if (!loaded) {
        setSaveState("error");
        setSaveMessage("Photographer details could not be opened. The result remains available in your plan.");
        return;
      }
      requestAnimationFrame(() => {
        const panel = document.getElementById("photographer-detail");
        panel?.focus({ preventScroll: true });
        panel?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function closePhotographerDetail() {
    setDetail(null);
    requestAnimationFrame(() => detailTriggerRef.current?.focus());
  }

  function toggleCompare(photographerId: string) {
    const existing = comparedPhotographers.some((photographer) => photographer.id === photographerId);
    if (existing) {
      setComparedPhotographers((current) => current.filter((photographer) => photographer.id !== photographerId));
      return;
    }
    const photographer = results.photographers.find((candidate) => candidate.id === photographerId);
    if (!photographer) return;
    if (comparedPhotographers.length >= 3) {
      setSaveMessage("Compare up to three photographers at a time.");
      return;
    }
    setComparedPhotographers((current) => [...current, photographer]);
  }

  function saveCurrentPhotographer() {
    if (!selectedPhotographer) return;
    persistPlan(
      upsertPlanningHubPhotographer(plan, selectedPhotographer, planningCostPence, status),
      `${selectedPhotographer.name} is ${status === "quoted" ? "recorded with a quote" : status} in your plan.`
    );
  }

  function addManualPhotographer(name: string, costPence: number, itemStatus: PlanningHubItemStatus) {
    const nextPlan = addManualPlanningHubPhotographer(plan, name, costPence, itemStatus);
    const addedItem = nextPlan.items.at(-1);
    if (addedItem) {
      setSelectedPhotographerId(addedItem.id);
      setStatus(itemStatus);
      setPlanningCostPence(costPence);
    }
    persistPlan(nextPlan, `${name} was added manually.`);
  }

  function saveInstallments(installments: PaymentInstallment[]) {
    if (!selectedItem) return;
    persistPlan(
      updatePlanningHubItemInstallments(plan, selectedItem.id, installments),
      "Photography payment schedule updated."
    );
  }

  function saveAvailability(availabilityStatus: AvailabilityStatus) {
    if (!selectedItem) return;
    persistPlan(
      updatePlanningHubItemAvailability(plan, selectedItem.id, availabilityStatus),
      "Photography availability updated.",
    );
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
        <PlanningHubPhotographerCompare onRemove={(photographerId) => setComparedPhotographers((current) => current.filter((photographer) => photographer.id !== photographerId))} photographers={comparedPhotographers} />
        <PlanningHubPhotographerDetailPanel detail={detail} loading={detailLoading || pending && detailLoading} onClose={closePhotographerDetail} />
        <PlanningHubPhotographerResults
          comparedPhotographerIds={comparedIds}
          onCompare={toggleCompare}
          onOpen={openPhotographer}
          plan={plan}
          results={results}
          searchParams={searchParams}
        />
      </div>
      <PlanningHubPhotographyPlanPanel
        connectedWorkspaceId={connectedWorkspaceId}
        onAvailabilityChange={saveAvailability}
        onManualPhotographer={addManualPhotographer}
        onInstallmentsSave={saveInstallments}
        onPhotographerSave={saveCurrentPhotographer}
        onPlanSave={() => persistPlan(plan, userId ? "Your plan is saved to your account." : "Your plan is up to date.")}
        onPlanningCostChange={setPlanningCostPence}
        onStatusChange={setStatus}
        plan={plan}
        planningCostPence={planningCostPence}
        saveMessage={saveMessage}
        saveState={saveState}
        selectedItem={selectedItem}
        selectedPhotographer={selectedPhotographer}
        status={status}
        today={today}
      />
    </div>
  );
}

function findLatestPhotographyItem(plan: BudgetPlan) {
  return [...plan.items].reverse().find((item) => (
    item.categoryId === "photography" && item.bookingStatus !== "cancelled"
  )) ?? null;
}

function normaliseStatus(status: string | undefined): PlanningHubItemStatus {
  return status === "researching" || status === "quoted" || status === "booked" ? status : "shortlisted";
}

function getSavedItemCost(item: ReturnType<typeof findPlanningHubPhotographyItem>) {
  if (!item) return null;
  return item.confirmedCostPence ?? item.estimatedCostPence ?? (
    item.costPerPersonPence != null && item.guestCount != null ? item.costPerPersonPence * item.guestCount : null
  );
}
