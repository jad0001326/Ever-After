import type { Venue } from "@/types/venue";

// Development/demo reference data only. Runtime venue pages and admin flows read from Supabase.
export const venueTypes = ["Castle", "Barn", "Luxury Hotel", "Country Estate"] as const;

export const amenities = [
  { id: "exclusive-use", name: "Exclusive use" },
  { id: "accommodation", name: "Guest accommodation" },
  { id: "licensed", name: "Licensed ceremony spaces" },
  { id: "catering", name: "In-house catering" },
  { id: "gardens", name: "Landscaped gardens" },
  { id: "pets", name: "Pet friendly" },
  { id: "parking", name: "Private parking" },
  { id: "late-license", name: "Late licence" }
];

const image = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=82`;

export const venues: Venue[] = [
  {
    id: "v-001",
    slug: "ardencairn-castle",
    name: "Ardencairn Castle",
    type: "Castle",
    region: "Argyll and Bute",
    town: "Inveraray",
    country: "Scotland",
    summary: "A private lochside castle with candlelit halls, terraced gardens, and full weekend hire.",
    description:
      "Ardencairn Castle is made for couples who want old-world drama without losing modern comfort. The vaulted dining hall seats up to 140 guests, while the loch lawn offers a cinematic ceremony backdrop in calmer weather. Weekend hire includes the principal suites, breakfast room, drawing rooms, and access to preferred local suppliers.",
    priceFrom: 9200,
    priceTo: 18500,
    capacityMin: 40,
    capacityMax: 160,
    heroImage: image("photo-1519225421980-715cb0215aed"),
    listingStatus: "published",
    claimStatus: "unclaimed",
    imagePermissionStatus: "representative",
    imageIsRepresentative: true,
    isClaimed: false,
    inviteStatus: "not_sent",
    images: [
      { id: "i-001", venueId: "v-001", url: image("photo-1519225421980-715cb0215aed"), alt: "Castle wedding tablescape", sortOrder: 1 },
      { id: "i-002", venueId: "v-001", url: image("photo-1523438885200-e635ba2c371e"), alt: "Historic stone venue exterior", sortOrder: 2 },
      { id: "i-003", venueId: "v-001", url: image("photo-1464366400600-7168b8af9bc3"), alt: "Elegant ceremony room", sortOrder: 3 }
    ],
    amenities: amenities.filter((item) => ["exclusive-use", "accommodation", "licensed", "gardens", "parking"].includes(item.id)),
    latitude: 56.2306,
    longitude: -5.0737,
    isFeatured: true
  },
  {
    id: "v-002",
    slug: "brae-and-thistle-barn",
    name: "Brae & Thistle Barn",
    type: "Barn",
    region: "Perthshire",
    town: "Crieff",
    country: "Scotland",
    summary: "A restored stone barn with meadow ceremonies, fire pits, and a relaxed countryside feel.",
    description:
      "Set between rolling farmland and birch woods, Brae & Thistle Barn is a flexible blank canvas for design-led celebrations. Couples can host outdoor ceremonies in the meadow, move into the barn for dinner, and finish the night in the whisky snug or around the courtyard fire pits.",
    priceFrom: 5200,
    priceTo: 9800,
    capacityMin: 30,
    capacityMax: 120,
    heroImage: image("photo-1519167758481-83f550bb49b3"),
    listingStatus: "published",
    claimStatus: "unclaimed",
    imagePermissionStatus: "representative",
    imageIsRepresentative: true,
    isClaimed: false,
    inviteStatus: "not_sent",
    images: [
      { id: "i-004", venueId: "v-002", url: image("photo-1519167758481-83f550bb49b3"), alt: "Rustic barn wedding reception", sortOrder: 1 },
      { id: "i-005", venueId: "v-002", url: image("photo-1527529482837-4698179dc6ce"), alt: "Outdoor wedding celebration", sortOrder: 2 },
      { id: "i-006", venueId: "v-002", url: image("photo-1469371670807-013ccf25f16a"), alt: "Wedding table flowers", sortOrder: 3 }
    ],
    amenities: amenities.filter((item) => ["exclusive-use", "licensed", "catering", "pets", "parking", "late-license"].includes(item.id)),
    latitude: 56.372,
    longitude: -3.84,
    isFeatured: true
  },
  {
    id: "v-003",
    slug: "the-calder-hotel",
    name: "The Calder Hotel",
    type: "Luxury Hotel",
    region: "Edinburgh",
    town: "Edinburgh",
    country: "Scotland",
    summary: "A five-star Georgian hotel with rooftop views, polished service, and city-centre convenience.",
    description:
      "The Calder Hotel brings a luxury travel sensibility to wedding hosting: refined suites, an intimate rooftop terrace, and a grand ballroom designed for black-tie dinners. It is a strong fit for couples with international guests who want everything walkable and beautifully handled.",
    priceFrom: 11000,
    priceTo: 26000,
    capacityMin: 50,
    capacityMax: 220,
    heroImage: image("photo-1519741497674-611481863552"),
    listingStatus: "published",
    claimStatus: "unclaimed",
    imagePermissionStatus: "representative",
    imageIsRepresentative: true,
    isClaimed: false,
    inviteStatus: "not_sent",
    images: [
      { id: "i-007", venueId: "v-003", url: image("photo-1519741497674-611481863552"), alt: "Luxury hotel wedding", sortOrder: 1 },
      { id: "i-008", venueId: "v-003", url: image("photo-1511795409834-ef04bbd61622"), alt: "Ballroom wedding dinner", sortOrder: 2 },
      { id: "i-009", venueId: "v-003", url: image("photo-1520854221256-17451cc331bf"), alt: "Elegant wedding couple", sortOrder: 3 }
    ],
    amenities: amenities.filter((item) => ["accommodation", "licensed", "catering", "parking", "late-license"].includes(item.id)),
    latitude: 55.9533,
    longitude: -3.1883,
    isFeatured: true
  },
  {
    id: "v-004",
    slug: "kinloch-mhor-estate",
    name: "Kinloch Mhor Estate",
    type: "Country Estate",
    region: "Highlands",
    town: "Fort William",
    country: "Scotland",
    summary: "A wild Highland estate with mountain views, private lodges, and multi-day celebration options.",
    description:
      "Kinloch Mhor Estate is built for destination weddings with a sense of place. Ceremony settings range from a glasshouse to a loch jetty, and the estate team can coordinate welcome dinners, outdoor feasts, and guided guest experiences across the weekend.",
    priceFrom: 13500,
    priceTo: 32000,
    capacityMin: 20,
    capacityMax: 180,
    heroImage: image("photo-1500530855697-b586d89ba3ee"),
    listingStatus: "published",
    claimStatus: "unclaimed",
    imagePermissionStatus: "representative",
    imageIsRepresentative: true,
    isClaimed: false,
    inviteStatus: "not_sent",
    images: [
      { id: "i-010", venueId: "v-004", url: image("photo-1500530855697-b586d89ba3ee"), alt: "Country estate landscape", sortOrder: 1 },
      { id: "i-011", venueId: "v-004", url: image("photo-1506744038136-46273834b3fb"), alt: "Highland loch view", sortOrder: 2 },
      { id: "i-012", venueId: "v-004", url: image("photo-1511285560929-80b456fea0bc"), alt: "Wedding reception detail", sortOrder: 3 }
    ],
    amenities: amenities.filter((item) => ["exclusive-use", "accommodation", "licensed", "gardens", "pets", "parking"].includes(item.id)),
    latitude: 56.8198,
    longitude: -5.1052,
    isFeatured: false
  },
  {
    id: "v-005",
    slug: "lochmere-house",
    name: "Lochmere House",
    type: "Country Estate",
    region: "Stirling",
    town: "Callander",
    country: "Scotland",
    summary: "An intimate country house with waterside gardens and a food-led approach to celebrations.",
    description:
      "Lochmere House focuses on warm, beautifully paced weddings for smaller guest lists. The orangery opens directly onto the gardens, the dining room is known for seasonal Scottish menus, and the house sleeps close family for the full weekend.",
    priceFrom: 6800,
    priceTo: 14500,
    capacityMin: 20,
    capacityMax: 95,
    heroImage: image("photo-1464146072230-91cabc968266"),
    listingStatus: "published",
    claimStatus: "unclaimed",
    imagePermissionStatus: "representative",
    imageIsRepresentative: true,
    isClaimed: false,
    inviteStatus: "not_sent",
    images: [
      { id: "i-013", venueId: "v-005", url: image("photo-1464146072230-91cabc968266"), alt: "Country house exterior", sortOrder: 1 },
      { id: "i-014", venueId: "v-005", url: image("photo-1529634806980-85c3dd6d34ac"), alt: "Wedding dining room", sortOrder: 2 },
      { id: "i-015", venueId: "v-005", url: image("photo-1482575832494-771f74bf6857"), alt: "Garden wedding detail", sortOrder: 3 }
    ],
    amenities: amenities.filter((item) => ["exclusive-use", "accommodation", "licensed", "catering", "gardens"].includes(item.id)),
    latitude: 56.244,
    longitude: -4.216,
    isFeatured: false
  },
  {
    id: "v-006",
    slug: "northwick-hall",
    name: "Northwick Hall",
    type: "Castle",
    region: "Aberdeenshire",
    town: "Banchory",
    country: "Scotland",
    summary: "A baronial hall with woodland drives, a private chapel, and dramatic winter wedding potential.",
    description:
      "Northwick Hall combines heritage architecture with a sharp hospitality team. Its private chapel suits ceremonies of up to 90, while the oak hall and marquee lawn allow larger receptions. The estate is particularly strong for atmospheric autumn and winter weddings.",
    priceFrom: 7800,
    priceTo: 16800,
    capacityMin: 35,
    capacityMax: 150,
    heroImage: image("photo-1542314831-068cd1dbfeeb"),
    listingStatus: "published",
    claimStatus: "unclaimed",
    imagePermissionStatus: "representative",
    imageIsRepresentative: true,
    isClaimed: false,
    inviteStatus: "not_sent",
    images: [
      { id: "i-016", venueId: "v-006", url: image("photo-1542314831-068cd1dbfeeb"), alt: "Historic venue driveway", sortOrder: 1 },
      { id: "i-017", venueId: "v-006", url: image("photo-1519225421980-715cb0215aed"), alt: "Reception candlelight", sortOrder: 2 },
      { id: "i-018", venueId: "v-006", url: image("photo-1492684223066-81342ee5ff30"), alt: "Wedding evening party", sortOrder: 3 }
    ],
    amenities: amenities.filter((item) => ["exclusive-use", "licensed", "gardens", "parking", "late-license"].includes(item.id)),
    latitude: 57.0517,
    longitude: -2.4882,
    isFeatured: false
  }
];
