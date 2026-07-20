import type { Venue } from "@/types/venue";

type VenueSeoOverride = {
  title: string;
  description: string;
  keywords: string[];
};

const venueSeoOverrides: Record<string, VenueSeoOverride> = {
  "bridge-gardens": {
    title: "Bridge Gardens Glasgow Wedding Venue",
    description:
      "Explore Bridge Gardens, a Glasgow wedding venue. Check capacity, pricing information, location details, venue imagery and official links.",
    keywords: ["Bridge Gardens", "Bridge Gardens Glasgow", "Bridge Gardens wedding", "Bridge Gardens photos"]
  },
  "the-gathering-at-woodhead-farm": {
    title: "The Gathering at Woodhead Farm Wedding Venue",
    description:
      "Explore The Gathering at Woodhead Farm wedding venue, including guest capacity, pricing information, location details and official links.",
    keywords: ["The Gathering at Woodhead Farm", "Woodhead Farm wedding", "Woodhead Farm wedding venue"]
  },
  "the-function-rooms": {
    title: "The Function Rooms Hamilton | Weddings & Prices",
    description:
      "Explore The Function Rooms in Hamilton, including wedding capacity, current pricing information, venue details and official links.",
    keywords: ["The Function Rooms Hamilton", "The Function Rooms Hamilton prices", "Hamilton wedding venue"]
  },
  "dalmeny-park-house-hotel": {
    title: "Dalmeny Park House Hotel | Barrhead Weddings",
    description:
      "Explore Dalmeny Park House Hotel, a Barrhead wedding venue. Compare capacity, pricing information, venue details and official links.",
    keywords: ["Dalmeny Park wedding", "Barrhead wedding venue", "wedding venues Barrhead"]
  }
};

export function getVenueSeoCopy(venue: Venue) {
  const override = venueSeoOverrides[venue.slug];
  if (override) return override;

  return {
    title: `${venue.name} Wedding Venue in ${venue.town}`,
    description: truncateDescription(
      `Explore ${venue.name}, a ${venue.town} wedding venue. Check guest capacity, pricing information, location details and official links on EverAft.`
    ),
    keywords: [
      `${venue.name} wedding venue`,
      `${venue.town} wedding venue`,
      `${venue.type} wedding venue Scotland`
    ]
  };
}

export function buildVenueFaqs(venue: Venue) {
  const hasPublishedPricing = (venue.priceOptions?.length ?? 0) > 0 || venue.priceFrom != null || venue.priceTo != null;
  const imageryAnswer = venue.officialGalleryUrl
    ? `EverAft links to the official ${venue.name} gallery from this listing.`
    : venue.imageIsRepresentative
      ? "EverAft currently shows a visual venue profile while venue-approved photography is being confirmed."
      : `Reviewed imagery for ${venue.name} is displayed on this listing.`;

  return [
    {
      question: `Where is ${venue.name}?`,
      answer: `${venue.name} is in ${venue.town}, ${venue.region}, Scotland.`
    },
    {
      question: `How many guests can ${venue.name} accommodate?`,
      answer: `${venue.name} is currently listed for weddings of ${venue.capacityMin} to ${venue.capacityMax} guests. Confirm the appropriate room layout and current limits directly with the venue.`
    },
    {
      question: `How much does a wedding at ${venue.name} cost?`,
      answer: hasPublishedPricing
        ? "Current published pricing information is shown in the pricing section above. Request a tailored written quote for your date, guest count and chosen package before booking."
        : "EverAft does not currently hold a confirmed public price for this venue. Contact the venue for a tailored written quote for your date, guest count and chosen package."
    },
    {
      question: `Can I see photos of ${venue.name}?`,
      answer: imageryAnswer
    }
  ];
}

function truncateDescription(value: string, maxLength = 155) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}
