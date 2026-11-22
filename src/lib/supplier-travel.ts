export function supplierTravelSummary(supplier: {
  baseTown: string;
  region: string;
  serviceAreas: string[];
  travelRadiusMiles: number | null;
  travelsNationwide: boolean;
}) {
  if (supplier.travelsNationwide) return "Travels across Scotland";
  if (supplier.travelRadiusMiles && supplier.travelRadiusMiles > 0) {
    const radius = `Travels up to ${supplier.travelRadiusMiles} miles from ${supplier.baseTown}`;
    return supplier.serviceAreas.length ? `${radius}, including ${supplier.serviceAreas.join(", ")}` : radius;
  }
  if (supplier.serviceAreas.length) return supplier.serviceAreas.join(", ");
  return `Works from ${supplier.baseTown}, ${supplier.region}`;
}

export function supplierBaseLabel(supplier: {
  baseTown: string;
  region: string;
  travelRadiusMiles: number | null;
  travelsNationwide: boolean;
}) {
  const base = `Based in ${supplier.baseTown}, ${supplier.region}`;
  if (supplier.travelsNationwide) return `${base} · travels across Scotland`;
  if (supplier.travelRadiusMiles && supplier.travelRadiusMiles > 0) return `${base} · up to ${supplier.travelRadiusMiles} miles`;
  return base;
}
