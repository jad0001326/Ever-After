export type CurrencyCode = "GBP" | "EUR" | "USD";
export type ContingencyType = "none" | "fixed" | "percentage";
export type ItemSource = "manual" | "website";
export type ImportedPriceType = "fixed" | "starting_from" | "per_person" | "package" | "range" | "quote_required" | "unavailable";
export type CostStatus = "estimated" | "quoted" | "booked" | "deposit_paid" | "partially_paid" | "paid" | "cancelled";
export type BookingStatus = "researching" | "shortlisted" | "quoted" | "booked" | "cancelled";
export type PaymentStatus = "not_started" | "deposit_paid" | "partially_paid" | "paid" | "overpaid";

export type BudgetCategory = {
  id: string;
  name: string;
  isCustom: boolean;
  suggestedPercentage?: number;
  targetPence: number | null;
  collapsed: boolean;
};

export type BudgetItem = {
  id: string;
  categoryId: string;
  listingId: string | null;
  listingType: string | null;
  listingUrl: string | null;
  imageUrl: string | null;
  source: ItemSource;
  itemName: string;
  supplierName: string | null;
  supplierType: string | null;
  description: string | null;
  estimatedCostPence: number | null;
  confirmedCostPence: number | null;
  importedPricePence: number | null;
  importedPriceToPence: number | null;
  importedPriceType: ImportedPriceType | null;
  costPerPersonPence: number | null;
  guestCount: number | null;
  depositPaidPence: number;
  totalPaidPence: number;
  costStatus: CostStatus;
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;
  dueDate: string | null;
  websiteUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  sortOrder: number;
};

export type BudgetPlan = {
  schemaVersion: 1;
  id: string;
  userId: string | null;
  name: string;
  totalBudgetPence: number;
  currency: CurrencyCode;
  weddingDate: string | null;
  guestCount: number | null;
  location: string | null;
  contingencyType: ContingencyType;
  contingencyValue: number;
  createdAt: string;
  updatedAt: string;
  selectedVenueId: string | null;
  scenarioName: string;
  categories: BudgetCategory[];
  items: BudgetItem[];
};

export type PlannerListing = {
  id: string;
  slug: string;
  name: string;
  type: string;
  location: string;
  imageUrl: string;
  listingUrl: string;
  priceFromPence: number | null;
  priceToPence: number | null;
  pricingStatus: ImportedPriceType;
  pricingKind?: string | null;
  pricingLabel?: string | null;
  pricingUnit?: string | null;
  priceQualifier?: string | null;
  includedGuests?: number | null;
  pricingDescription?: string | null;
  taxLabel?: string | null;
  minimumNights?: number | null;
  validFrom?: string | null;
  validTo?: string | null;
  verifiedAt?: string | null;
};

