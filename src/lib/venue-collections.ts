import type { VenueSearchParams } from "@/types/venue";

export type VenueCollection = {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  intro: readonly [string, string];
  searchParams: VenueSearchParams;
  browseLabel: string;
  highlights: readonly { title: string; copy: string }[];
  faqs: readonly { question: string; answer: string }[];
  relatedSlugs: readonly string[];
};

export const venueCollections: readonly VenueCollection[] = [
  {
    slug: "edinburgh",
    eyebrow: "Edinburgh venue guide",
    title: "Wedding venues in Edinburgh",
    description: "Compare wedding venues in Edinburgh, from city hotels to castles and country estates within easy reach of the capital.",
    intro: [
      "Edinburgh gives couples an unusually broad choice: landmark city settings, elegant hotels and historic venues close to the centre, plus country estates and castles a short journey away.",
      "Use this guide to compare published prices, guest capacities and venue styles. Open any profile for more detail, or add a venue to the free EverAft budget planner to see how it fits alongside the rest of your day."
    ],
    searchParams: { location: "Edinburgh" },
    browseLabel: "Browse all Edinburgh matches",
    highlights: [
      { title: "Think about travel", copy: "A central venue can simplify transport and accommodation for guests arriving by train or plane." },
      { title: "Compare the full package", copy: "Check whether catering, ceremony space, accommodation and exclusive use are included before comparing headline prices." },
      { title: "Plan beyond the city", copy: "If you want more space, include nearby estates and castles in the Lothians in your shortlist." }
    ],
    faqs: [
      { question: "How much does an Edinburgh wedding venue cost?", answer: "Costs vary widely by venue style, date, guest count and what the package includes. EverAft shows published starting prices where they are available, but you should request a tailored quote before booking." },
      { question: "Should we choose a city-centre or countryside venue?", answer: "City venues can make travel and accommodation easier. Countryside venues may offer more outdoor space, accommodation and exclusive use. Compare the complete guest experience as well as the hire price." },
      { question: "Can I add an Edinburgh venue to my wedding budget?", answer: "Yes. Open a venue profile and choose the budget-planner option, or search for it directly inside the free EverAft wedding budget planner." }
    ],
    relatedSlugs: ["glasgow", "castles", "country-estates"]
  },
  {
    slug: "glasgow",
    eyebrow: "Glasgow venue guide",
    title: "Wedding venues in Glasgow",
    description: "Find and compare wedding venues in Glasgow, including city hotels, characterful buildings and country venues nearby.",
    intro: [
      "Glasgow works well for couples who want a lively city celebration with strong transport links, plenty of accommodation and a wide range of venue styles.",
      "Compare the Glasgow venues currently published on EverAft, then check capacity, pricing details and the practical questions that matter to your plans. You can carry any shortlisted venue straight into the budget planner."
    ],
    searchParams: { location: "Glasgow" },
    browseLabel: "Browse all Glasgow matches",
    highlights: [
      { title: "Map the guest journey", copy: "Consider how guests will move between the ceremony, reception, hotels and late-night transport." },
      { title: "Check minimum spends", copy: "City venues may price around packages or food-and-drink minimums rather than a simple room-hire fee." },
      { title: "Widen the radius", copy: "Country houses and estates outside Glasgow can add accommodation and outdoor space without taking guests too far from the city." }
    ],
    faqs: [
      { question: "What kinds of wedding venues are available around Glasgow?", answer: "The area includes hotels and urban spaces as well as castles, estates and country venues within travelling distance of the city." },
      { question: "What should we compare in Glasgow venue packages?", answer: "Compare the ceremony and reception spaces, catering, drink packages, minimum spend, guest accommodation, access times and any late-finish restrictions." },
      { question: "Can EverAft help us keep the venue within budget?", answer: "Yes. Add a published venue price or your own quote to the EverAft planner and track it alongside every other wedding expense." }
    ],
    relatedSlugs: ["edinburgh", "luxury-hotels", "country-estates"]
  },
  {
    slug: "castles",
    eyebrow: "Scottish venue collection",
    title: "Castle wedding venues in Scotland",
    description: "Explore Scottish castle wedding venues and compare location, guest capacity and published starting prices in one place.",
    intro: [
      "A Scottish castle wedding can mean anything from an intimate historic house to a large exclusive-use estate. The atmosphere may be similar, but the accommodation, access, catering and package structure can be very different.",
      "This collection brings EverAft's published castle venues together so you can compare the practical details as well as the setting. Save the strongest options and test their likely cost in your wedding budget."
    ],
    searchParams: { type: "Castle" },
    browseLabel: "Browse all castle venues",
    highlights: [
      { title: "Ask about exclusive use", copy: "Confirm which rooms and grounds are private to your wedding, and for how long." },
      { title: "Check accommodation", copy: "Bedroom numbers, minimum stays and check-in times can materially change the total cost for you and your guests." },
      { title: "Plan for the building", copy: "Historic layouts can affect accessibility, wet-weather plans, supplier access and the flow between ceremony and reception." }
    ],
    faqs: [
      { question: "How much does a castle wedding in Scotland cost?", answer: "The total depends on the date, exclusivity, accommodation, catering and guest count. Compare what each published starting price includes and request a quote for your exact plans." },
      { question: "Do Scottish castle wedding venues include accommodation?", answer: "Some offer bedrooms or estate cottages, while others are primarily event venues. Check each profile and ask whether accommodation is included, optional or subject to a minimum stay." },
      { question: "What should we ask at a castle venue viewing?", answer: "Ask about accessibility, heating, wet-weather space, supplier access, ceremony options, noise restrictions, accommodation and exactly which areas are included in exclusive use." }
    ],
    relatedSlugs: ["country-estates", "luxury-hotels", "edinburgh"]
  },
  {
    slug: "country-estates",
    eyebrow: "Scottish venue collection",
    title: "Country estate wedding venues in Scotland",
    description: "Compare country estate wedding venues across Scotland, with useful details on capacity, location and published pricing.",
    intro: [
      "Country estates can offer the space for a full wedding weekend: ceremony settings, reception rooms, grounds and sometimes guest accommodation in one place.",
      "Use this collection to compare Scottish estates without losing sight of the practical details. Look beyond the hire fee to understand catering, accommodation, minimum stays and what exclusive use actually covers."
    ],
    searchParams: { type: "Country Estate" },
    browseLabel: "Browse all country estates",
    highlights: [
      { title: "Define exclusive use", copy: "Ask when access starts, when it ends and whether any public or shared areas remain open." },
      { title: "Price the whole stay", copy: "Include required bedrooms, cottages, catering and minimum-night rules when comparing estates." },
      { title: "Have a weather plan", copy: "Make sure the indoor ceremony, drinks and photography options still work if the grounds cannot be used." }
    ],
    faqs: [
      { question: "What is an exclusive-use country estate wedding venue?", answer: "It usually means specified venue spaces are reserved for your celebration, but the exact rooms, grounds and timings vary. Ask each venue to define the included areas in writing." },
      { question: "Are country estates suitable for a wedding weekend?", answer: "Many are, particularly where on-site accommodation and multiple event spaces are available. Check arrival times, bedroom capacity, minimum stays and plans for meals outside the wedding itself." },
      { question: "How can we compare estate venue costs fairly?", answer: "Build a like-for-like total covering hire, food and drink, accommodation, ceremony fees, required suppliers and any minimum spend. EverAft's budget planner can hold both estimates and confirmed quotes." }
    ],
    relatedSlugs: ["castles", "edinburgh", "glasgow"]
  },
  {
    slug: "luxury-hotels",
    eyebrow: "Scottish venue collection",
    title: "Luxury hotel wedding venues in Scotland",
    description: "Discover luxury hotel wedding venues in Scotland and compare guest capacity, setting and available pricing information.",
    intro: [
      "Luxury hotels can make the logistics of a wedding much simpler by bringing celebration spaces, catering, guest bedrooms and an experienced events team under one roof.",
      "Compare EverAft's published Scottish hotel venues, then look closely at package inclusions, room commitments and food-and-drink minimums before deciding which offers the best fit."
    ],
    searchParams: { type: "Luxury Hotel" },
    browseLabel: "Browse all luxury hotels",
    highlights: [
      { title: "Read the package detail", copy: "Confirm menu choices, drinks, room hire, staffing, furniture and service charges rather than comparing package prices alone." },
      { title: "Check bedroom commitments", copy: "Ask whether you must guarantee a room block and what happens to rooms that guests do not book." },
      { title: "Understand shared spaces", copy: "Hotel weddings may share entrances, bars or grounds with other guests, so ask what privacy is included." }
    ],
    faqs: [
      { question: "What is normally included in a hotel wedding package?", answer: "Packages often combine room hire, catering, drinks and selected extras, but inclusions vary considerably. Always compare the written package for your date and guest count." },
      { question: "Do we have to book guest bedrooms at a hotel venue?", answer: "Some hotels offer an optional allocation while others require a minimum room commitment. Ask about rates, release dates, deposits and liability for unbooked rooms." },
      { question: "How do we add a hotel package to the budget planner?", answer: "Choose the venue inside the planner and use its published estimate where available, or replace it with the tailored quote supplied by the hotel." }
    ],
    relatedSlugs: ["glasgow", "edinburgh", "country-estates"]
  },
  {
    slug: "stirling",
    eyebrow: "Stirling venue guide",
    title: "Wedding venues in Stirling",
    description: "Compare wedding venues in Stirling, from historic city settings to castles, hotels and countryside venues across the region.",
    intro: [
      "Stirling sits at a useful meeting point for guests travelling from across central Scotland. Couples can combine the practical transport links of the city with historic buildings, lochside settings and countryside venues throughout the wider council area.",
      "This guide brings together the Stirling venues currently published on EverAft. Compare capacity, setting and available prices, then add a promising venue to the budget planner to understand the full cost alongside catering, photography and every other part of the day."
    ],
    searchParams: { location: "Stirling" },
    browseLabel: "Browse all Stirling matches",
    highlights: [
      { title: "Check the travel radius", copy: "The Stirling region is broad, so compare journey times from rail stations, airports and likely guest accommodation." },
      { title: "Plan around the setting", copy: "Historic, rural and lochside venues can have different access, supplier and wet-weather considerations." },
      { title: "Compare complete costs", copy: "Include required catering, accommodation, transport and exclusive-use conditions rather than comparing hire fees alone." }
    ],
    faqs: [
      { question: "What kinds of wedding venues are available in Stirling?", answer: "The area includes historic buildings, castles, hotels and countryside venues, with options in Stirling itself and across the wider region." },
      { question: "Is Stirling convenient for wedding guests?", answer: "Stirling has strong road and rail connections, but rural venues can still require arranged transport. Map the full guest journey before booking." },
      { question: "Can I compare Stirling venues in the EverAft budget planner?", answer: "Yes. Open a venue profile or search inside the free planner, then use its published estimate or replace it with your tailored quote." }
    ],
    relatedSlugs: ["edinburgh", "glasgow", "perthshire"]
  },
  {
    slug: "perthshire",
    eyebrow: "Perthshire venue guide",
    title: "Wedding venues in Perthshire",
    description: "Explore wedding venues across Perthshire and Perth and Kinross, including country estates, hotels, castles and rural celebrations.",
    intro: [
      "Perthshire offers a wide mix of wedding settings, from venues around Perth to estates, castles and hotels surrounded by some of Scotland's most recognisable countryside. It can work particularly well for couples looking for space, accommodation or a full wedding weekend.",
      "EverAft searches the current Perth and Kinross catalogue for this guide so that modern regional records and the familiar Perthshire search term lead to the same useful shortlist. Compare the details carefully and test the likely total in the budget planner."
    ],
    searchParams: { location: "Perth and Kinross" },
    browseLabel: "Browse all Perthshire matches",
    highlights: [
      { title: "Look beyond the venue name", copy: "Perthshire searches often span Perth and Kinross, so check the exact location and realistic guest journey for every option." },
      { title: "Price the full weekend", copy: "Rural venues may combine exclusive use, accommodation and several days of access. Compare the complete stay, not only the wedding day." },
      { title: "Check supplier logistics", copy: "Ask about access times, travel fees, local accommodation and any approved or required supplier lists." }
    ],
    faqs: [
      { question: "Does this guide include Perth and Kinross wedding venues?", answer: "Yes. Perthshire is widely used as a search term, while many current venue records use Perth and Kinross. This guide brings those relevant listings together." },
      { question: "Are Perthshire venues suitable for wedding weekends?", answer: "Many estates and rural venues offer accommodation or multi-day access, but inclusions and minimum stays vary. Ask for the complete written cost." },
      { question: "How should we compare rural Perthshire venue prices?", answer: "Include accommodation, catering, transport, minimum stays, ceremony fees and required suppliers alongside the headline venue price." }
    ],
    relatedSlugs: ["stirling", "country-estates", "castles"]
  },
  {
    slug: "ayrshire",
    eyebrow: "Ayrshire venue guide",
    title: "Wedding venues in Ayrshire",
    description: "Find wedding venues across Ayrshire, including coastal hotels, castles, country estates and celebrations near Ayr, Kilmarnock and the west coast.",
    intro: [
      "Ayrshire gives couples a substantial range of settings across North, South and East Ayrshire. The catalogue includes coastal venues, hotels, estates and historic properties, with Glasgow still within practical reach for many guests.",
      "Use this page to compare the Ayrshire venues currently published on EverAft. Check the exact council area, travel plan and package detail, then bring the strongest option into the budget planner alongside the rest of your wedding costs."
    ],
    searchParams: { location: "Ayrshire" },
    browseLabel: "Browse all Ayrshire matches",
    highlights: [
      { title: "Check the exact area", copy: "Ayrshire covers three council areas and a wide coastline, so venue-to-hotel and late-night travel times can vary considerably." },
      { title: "Plan for coastal weather", copy: "For coastal or outdoor settings, ask to see the ceremony, drinks and photography plan for poor weather." },
      { title: "Read package inclusions", copy: "Hotels and estates may combine room hire, food, drinks and bedrooms differently. Build a like-for-like total before deciding." }
    ],
    faqs: [
      { question: "Which areas are included in an Ayrshire wedding venue search?", answer: "Relevant listings may be in North Ayrshire, South Ayrshire or East Ayrshire, including places around Ayr, Kilmarnock and the coast." },
      { question: "Is Ayrshire accessible from Glasgow?", answer: "Many Ayrshire venues are within practical travelling distance of Glasgow, but the region is broad. Check the exact route, public transport and late-night options." },
      { question: "Can I add an Ayrshire venue to a starter wedding budget?", answer: "Yes. Open a venue in EverAft and add it to the planner, or begin with an editable £15,000, £20,000 or £30,000 example and replace the venue estimate." }
    ],
    relatedSlugs: ["glasgow", "country-estates", "luxury-hotels"]
  }
] as const;

export function getVenueCollection(slug: string) {
  return venueCollections.find((collection) => collection.slug === slug);
}

export function getVenueCollectionForSearchParams(params: VenueSearchParams) {
  if (params.guests || params.budget) return undefined;

  return venueCollections.find((collection) => {
    const location = collection.searchParams.location;
    const type = collection.searchParams.type;

    if (location) return !params.type && params.location === location;
    if (type) return !params.location && params.type === type;
    return false;
  });
}

export function getVenueLocationCollection({ region, town }: { region: string; town: string }) {
  const locations = [town, region].map(normaliseLocation);

  return venueCollections.find((collection) => {
    const location = collection.searchParams.location;
    if (!location) return false;

    const target = normaliseLocation(location);
    return locations.some((value) => value === target || value.includes(target) || target.includes(value));
  });
}

export function getVenueTypeCollection(type: string) {
  return venueCollections.find((collection) => collection.searchParams.type === type);
}

function normaliseLocation(value: string) {
  return value.trim().toLocaleLowerCase("en-GB");
}
