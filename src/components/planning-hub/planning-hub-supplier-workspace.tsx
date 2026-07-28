"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveBudgetPlan } from "@/app/actions/budget";
import { loadPlanningHubSupplierDetailAction } from "@/app/actions/planning-hub";
import { planningHubBudgetStorageKey, restoreBudgetPlan, serializeBudgetPlan } from "@/lib/budget/persistence";
import type { BudgetItem, BudgetPlan, PaymentInstallment } from "@/lib/budget/types";
import {
  addManualPlanningHubSupplier,
  findPlanningHubSupplierItem,
  updatePlanningHubItemInstallments,
  upsertPlanningHubSupplier,
  type PlanningHubItemStatus,
} from "@/lib/planning-hub/plan";
import type {
  PlanningHubSupplier,
  PlanningHubSupplierCategory,
  PlanningHubSupplierDetail,
  PlanningHubSupplierResults as ResultData,
  PlanningHubSupplierSearchParams,
} from "@/lib/planning-hub/types";
import { PlanningHubSupplierCompare } from "./planning-hub-supplier-compare";
import { PlanningHubSupplierDetailPanel } from "./planning-hub-supplier-detail";
import { PlanningHubSupplierPlanPanel } from "./planning-hub-supplier-plan-panel";
import { PlanningHubSupplierResults } from "./planning-hub-supplier-results";
import type { PlanningHubSaveState } from "./planning-hub-plan-panel";

export function PlanningHubSupplierWorkspace({
  category,
  connectedWorkspaceId = null,
  initialPlan,
  results,
  searchParams,
  today = "2026-07-28",
  userId,
}: {
  category: PlanningHubSupplierCategory;
  connectedWorkspaceId?: string | null;
  initialPlan: BudgetPlan;
  results: ResultData;
  searchParams: PlanningHubSupplierSearchParams;
  today?: string;
  userId: string | null;
}) {
  const storageKey = planningHubBudgetStorageKey(connectedWorkspaceId);
  const firstPlannedItem = findLatestSupplierItem(initialPlan, category);
  const firstSupplier = firstPlannedItem
    ? results.suppliers.find((supplier) => supplier.id === firstPlannedItem.listingId) ?? null
    : results.suppliers[0] ?? null;
  const firstItem = firstPlannedItem ?? findPlanningHubSupplierItem(initialPlan, category.slug, firstSupplier?.id);
  const [plan, setPlan] = useState(initialPlan);
  const [ready, setReady] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(firstSupplier?.id ?? firstItem?.id ?? null);
  const [status, setStatus] = useState<PlanningHubItemStatus>(normaliseStatus(firstItem?.bookingStatus));
  const [planningCostPence, setPlanningCostPence] = useState(getSavedItemCost(firstItem) ?? firstSupplier?.startingPricePence ?? 0);
  const [comparedSuppliers, setComparedSuppliers] = useState<PlanningHubSupplier[]>([]);
  const [detail, setDetail] = useState<PlanningHubSupplierDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saveState, setSaveState] = useState<PlanningHubSaveState>("idle");
  const [saveMessage, setSaveMessage] = useState(userId ? "Changes are also kept on this device." : "Changes are saved on this device.");
  const [pending, startTransition] = useTransition();
  const detailRequestId = useRef(0);
  const detailTriggerRef = useRef<HTMLElement | null>(null);

  const selectedSupplier = results.suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? null;
  const selectedItem = findPlanningHubSupplierItem(plan, category.slug, selectedSupplierId);
  const comparedIds = new Set(comparedSuppliers.map((supplier) => supplier.id));

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const localPlan = restoreBudgetPlan(window.localStorage.getItem(storageKey));
        if (localPlan && new Date(localPlan.updatedAt).getTime() > new Date(initialPlan.updatedAt).getTime()) {
          const restored = { ...localPlan, userId };
          setPlan(restored);
          setSaveMessage("Restored newer changes from this device.");
          const restoredItem = findLatestSupplierItem(restored, category);
          const restoredSupplier = restoredItem?.listingId
            ? results.suppliers.find((supplier) => supplier.id === restoredItem.listingId) ?? null
            : null;
          if (restoredItem) {
            setSelectedSupplierId(restoredSupplier?.id ?? restoredItem.id);
            setStatus(normaliseStatus(restoredItem.bookingStatus));
            setPlanningCostPence(getSavedItemCost(restoredItem) ?? restoredSupplier?.startingPricePence ?? 0);
          }
        }
      } catch {
        setSaveMessage("This browser could not restore local changes.");
      } finally {
        setReady(true);
      }
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [category, initialPlan.updatedAt, results.suppliers, storageKey, userId]);

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

  function openSupplier(supplierId: string) {
    const supplier = results.suppliers.find((candidate) => candidate.id === supplierId);
    if (!supplier) return;
    detailTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const item = findPlanningHubSupplierItem(plan, category.slug, supplier.id);
    setSelectedSupplierId(supplier.id);
    setStatus(normaliseStatus(item?.bookingStatus));
    setPlanningCostPence(getSavedItemCost(item) ?? supplier.startingPricePence ?? 0);
    setDetailLoading(true);
    const requestId = detailRequestId.current + 1;
    detailRequestId.current = requestId;
    startTransition(async () => {
      const loaded = await loadPlanningHubSupplierDetailAction(category.slug, supplier.id);
      if (requestId !== detailRequestId.current) return;
      setDetail(loaded);
      setDetailLoading(false);
      if (!loaded) {
        setSaveState("error");
        setSaveMessage(`${category.label} details could not be opened. The result remains available in your plan.`);
        return;
      }
      requestAnimationFrame(() => {
        const panel = document.getElementById("supplier-detail");
        panel?.focus({ preventScroll: true });
        panel?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function closeSupplierDetail() {
    setDetail(null);
    requestAnimationFrame(() => detailTriggerRef.current?.focus());
  }

  function toggleCompare(supplierId: string) {
    const existing = comparedSuppliers.some((supplier) => supplier.id === supplierId);
    if (existing) {
      setComparedSuppliers((current) => current.filter((supplier) => supplier.id !== supplierId));
      return;
    }
    const supplier = results.suppliers.find((candidate) => candidate.id === supplierId);
    if (!supplier) return;
    if (comparedSuppliers.length >= 3) {
      setSaveMessage(`Compare up to three ${category.plural.toLowerCase()} at a time.`);
      return;
    }
    setComparedSuppliers((current) => [...current, supplier]);
  }

  function saveCurrentSupplier() {
    if (!selectedSupplier) return;
    persistPlan(
      upsertPlanningHubSupplier(plan, selectedSupplier, planningCostPence, status),
      `${selectedSupplier.name} is ${status === "quoted" ? "recorded with a quote" : status} in your plan.`,
    );
  }

  function addManualSupplier(name: string, costPence: number, itemStatus: PlanningHubItemStatus) {
    const nextPlan = addManualPlanningHubSupplier(plan, category.slug, name, costPence, itemStatus);
    const addedItem = nextPlan.items.at(-1);
    if (addedItem) {
      setSelectedSupplierId(addedItem.id);
      setStatus(itemStatus);
      setPlanningCostPence(costPence);
    }
    persistPlan(nextPlan, `${name} was added manually.`);
  }

  function saveInstallments(installments: PaymentInstallment[]) {
    if (!selectedItem) return;
    persistPlan(
      updatePlanningHubItemInstallments(plan, selectedItem.id, installments),
      `${category.label} payment schedule updated.`,
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
        <PlanningHubSupplierCompare category={category} onRemove={(supplierId) => setComparedSuppliers((current) => current.filter((supplier) => supplier.id !== supplierId))} suppliers={comparedSuppliers} />
        <PlanningHubSupplierDetailPanel category={category} detail={detail} loading={detailLoading || pending && detailLoading} onClose={closeSupplierDetail} />
        <PlanningHubSupplierResults
          category={category}
          comparedSupplierIds={comparedIds}
          onCompare={toggleCompare}
          onOpen={openSupplier}
          plan={plan}
          results={results}
          searchParams={searchParams}
        />
      </div>
      <PlanningHubSupplierPlanPanel
        category={category}
        connectedWorkspaceId={connectedWorkspaceId}
        onInstallmentsSave={saveInstallments}
        onManualSupplier={addManualSupplier}
        onPlanSave={() => persistPlan(plan, userId ? "Your plan is saved to your account." : "Your plan is up to date.")}
        onPlanningCostChange={setPlanningCostPence}
        onStatusChange={setStatus}
        onSupplierSave={saveCurrentSupplier}
        plan={plan}
        planningCostPence={planningCostPence}
        saveMessage={saveMessage}
        saveState={saveState}
        selectedItem={selectedItem}
        selectedSupplier={selectedSupplier}
        status={status}
        today={today}
      />
    </div>
  );
}

function findLatestSupplierItem(plan: BudgetPlan, category: PlanningHubSupplierCategory) {
  return [...plan.items].reverse().find((item) => (
    item.categoryId === category.budgetCategoryId
    && item.supplierType === category.label
    && item.bookingStatus !== "cancelled"
  )) ?? null;
}

function normaliseStatus(status: string | undefined): PlanningHubItemStatus {
  return status === "researching" || status === "quoted" || status === "booked" ? status : "shortlisted";
}

function getSavedItemCost(item: BudgetItem | null) {
  if (!item) return null;
  return item.confirmedCostPence ?? item.estimatedCostPence ?? (
    item.costPerPersonPence != null && item.guestCount != null ? item.costPerPersonPence * item.guestCount : null
  );
}
