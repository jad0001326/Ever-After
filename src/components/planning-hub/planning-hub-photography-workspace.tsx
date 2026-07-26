"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveBudgetPlan } from "@/app/actions/budget";
import { loadPlanningHubPhotographerDetailAction } from "@/app/actions/planning-hub";
import { planningHubBudgetStorageKey, restoreBudgetPlan, serializeBudgetPlan } from "@/lib/budget/persistence";
import type { BudgetPlan } from "@/lib/budget/types";
import {
  addManualPlanningHubPhotographer,
  findPlanningHubPhotographyItem,
  updatePlanningHubPhotographerPayment,
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
  connectedWorkspaceId = null,
  results,
  searchParams,
  userId
}: {
  initialPlan: BudgetPlan;
  connectedWorkspaceId?: string | null;
  results: ResultData;
  searchParams: PlanningHubPhotographySearchParams;
  userId: string | null;
}) {
  const storageKey = planningHubBudgetStorageKey(connectedWorkspaceId);
  const firstPhotographer = findInitialPhotographer(initialPlan, results.photographers);
  const firstItem = findPlanningHubPhotographyItem(initialPlan, firstPhotographer?.id);
  const [plan, setPlan] = useState(initialPlan);
  const [ready, setReady] = useState(false);
  const [selectedPhotographerId, setSelectedPhotographerId] = useState<string | null>(firstPhotographer?.id ?? null);
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
        if (localPlan && new Date(localPlan.updatedAt).getTime() > new Date(initialPlan.updatedAt).getTime()) {
          const restored = { ...localPlan, userId };
          setPlan(restored);
          setSaveMessage("Restored newer changes from this device.");
          const restoredPhotographer = findInitialPhotographer(restored, results.photographers);
          if (restoredPhotographer) {
            const restoredItem = findPlanningHubPhotographyItem(restored, restoredPhotographer.id);
            setSelectedPhotographerId(restoredPhotographer.id);
            setStatus(normaliseStatus(restoredItem?.bookingStatus));
            setPlanningCostPence(getSavedItemCost(restoredItem) ?? restoredPhotographer.startingPricePence ?? 0);
          }
        }
      } catch {
        setSaveMessage("This browser could not restore local changes.");
      } finally {
        setReady(true);
      }
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [initialPlan.updatedAt, results.photographers, storageKey, userId]);

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
    persistPlan(addManualPlanningHubPhotographer(plan, name, costPence, itemStatus), `${name} was added manually.`);
  }

  function savePayments(depositPence: number, paidPence: number, dueDate: string | null) {
    if (!selectedPhotographer) return;
    persistPlan(
      updatePlanningHubPhotographerPayment(plan, selectedPhotographer.id, depositPence, paidPence, dueDate),
      "Photography payments updated."
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
        onManualPhotographer={addManualPhotographer}
        onPaymentSave={savePayments}
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
      />
    </div>
  );
}

function findInitialPhotographer(plan: BudgetPlan, photographers: PlanningHubPhotographer[]) {
  const plannedIds = new Set(plan.items.filter((item) => item.categoryId === "photography" && item.listingId).map((item) => item.listingId));
  return photographers.find((photographer) => plannedIds.has(photographer.id)) ?? photographers[0] ?? null;
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
