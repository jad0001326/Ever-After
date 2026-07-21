export type GuideTable = {
  headers: readonly string[];
  rows: readonly (readonly string[])[];
};

export type GuideSection = {
  heading: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
  table?: GuideTable;
};

export type GuideLink = {
  label: string;
  href: string;
};

export type GuideSource = {
  label: string;
  href: string;
};

export type PlanningGuide = {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  category: "Costs" | "Choosing a venue" | "Venue practicalities" | "Photography" | "Legal & ceremonies" | "Seasons & outdoors" | "Planning" | "Accessibility";
  publishedAt: string;
  updatedAt: string;
  readMinutes: number;
  featured?: boolean;
  intro: readonly string[];
  answer?: string;
  takeaways: readonly string[];
  sections: readonly GuideSection[];
  venueLinks: readonly GuideLink[];
  faqs: readonly { question: string; answer: string }[];
  sources?: readonly GuideSource[];
};

const publishedAt = "2026-07-15";

export const planningGuides: readonly PlanningGuide[] = [
  {
    slug: "how-much-does-a-wedding-venue-cost-in-scotland",
    title: "How much does a wedding venue cost in Scotland?",
    shortTitle: "Scottish wedding venue costs",
    description:
      "A practical guide to Scottish wedding venue prices, what the headline figure includes and how to compare quotes fairly.",
    category: "Costs",
    publishedAt,
    updatedAt: publishedAt,
    readMinutes: 8,
    featured: true,
    answer:
      "There is no single useful venue average because a room-hire fee and a full food-and-drink package describe very different purchases. For planning, separate venue hire, catering, drinks, accommodation and required extras before comparing totals.",
    intro: [
      "A Scottish wedding venue might advertise a four-figure hire fee, a price per guest, a minimum spend or a two-night exclusive-use package. Those figures cannot be compared until you know what each one actually buys.",
      "The best starting point is not to ask whether a venue is cheap or expensive. Ask what your date, guest count and non-negotiables will cost in full, including every compulsory part of the booking."
    ],
    takeaways: [
      "Compare complete like-for-like totals, not headline hire fees.",
      "Guest count, season, day of the week and accommodation can change the total materially.",
      "Keep the venue and catering impact visible inside your whole wedding budget."
    ],
    sections: [
      {
        heading: "Start with the type of price you are looking at",
        paragraphs: [
          "Venue hire usually pays for access to specified rooms or grounds. A package may add catering, drinks, furniture, staffing and coordination. Dry hire gives you the space but can leave you arranging most of the infrastructure yourself. Exclusive-use estates and castles may add bedrooms, cottages or a minimum stay.",
          "This is why two venues showing £6,000 can lead to completely different final bills. One may include a meal and drinks for a set number of guests; the other may be the building alone."
        ],
        bullets: [
          "Room or estate hire: confirm the spaces, access hours and exclusivity included.",
          "Per-person package: check the minimum guest number and what food and drink are covered.",
          "Minimum spend: ask whether room hire is additional and what counts towards the spend.",
          "Accommodation commitment: find out whether unbooked bedrooms become your responsibility.",
          "VAT and service: confirm whether every quoted figure includes VAT and any service charge."
        ]
      },
      {
        heading: "Useful 2026 context - without treating an average as a target",
        paragraphs: [
          "Bridebook's 2026 report puts the average total Scottish wedding at £22,987, based on its survey of 7,000 UK couples. Its UK-wide average is £20,604. Hitched reports a separate UK average of £21,990 from more than 2,000 couples. The difference is a useful warning: averages depend on the couples surveyed and which costs are counted.",
          "Use those figures as context, not as a required spend. A smaller weekday celebration and a large exclusive-use weekend are both weddings, but their cost structures are not comparable. Your own guest count and written quotes matter more than a national headline."
        ]
      },
      {
        heading: "The four variables that move the price fastest",
        bullets: [
          "Guest count: meals, drinks, furniture and staffing often rise with every additional person.",
          "Date: Saturdays in peak season usually carry less flexibility than winter or midweek dates.",
          "Format: a single-day hotel package and a private estate weekend solve different problems.",
          "Inclusions: catering, drinks, bedrooms, ceremony fees and required suppliers can outweigh the hire fee."
        ],
        paragraphs: [
          "Ask each venue to quote the same scenario: the same date or season, the same day of the week, the same day and evening guest counts, and the same broad food-and-drink requirements. That turns a collection of brochures into a comparison you can actually use."
        ]
      },
      {
        heading: "Build a true venue total",
        table: {
          headers: ["Cost line", "What to confirm"],
          rows: [
            ["Hire or package", "Exact rooms, grounds, timings and guest numbers"],
            ["Food and drink", "Price per person, minimum numbers, evening food and bar terms"],
            ["Ceremony", "Room fee, registrar or celebrant costs and turnaround charges"],
            ["Accommodation", "Required rooms, minimum nights, breakfast and liability for unused rooms"],
            ["Required extras", "Security, cleaning, corkage, furniture, staffing and approved suppliers"],
            ["Contingency", "A buffer for quote changes, final numbers and forgotten items"]
          ]
        },
        paragraphs: [
          "Enter that total in the EverAft budget planner as an estimate. Replace it with the written quote when you have one, record the deposit separately and keep the balance due date visible."
        ]
      }
    ],
    venueLinks: [
      { label: "Compare all Scottish wedding venues", href: "/venues" },
      { label: "Explore castle wedding venues", href: "/wedding-venues/castles" },
      { label: "Compare country estate venues", href: "/wedding-venues/country-estates" },
      { label: "Browse luxury hotel venues", href: "/wedding-venues/luxury-hotels" }
    ],
    faqs: [
      {
        question: "What percentage of our wedding budget should go on the venue?",
        answer:
          "There is no fixed rule, especially when a venue package also contains catering and drinks. Ring-fence the complete venue-related total first, then check that the remaining budget can still cover your other priorities and a contingency."
      },
      {
        question: "Are Scottish wedding venue prices usually per person?",
        answer:
          "Some are. Hotels commonly offer per-person packages, while estates, barns and castles may use hire fees, exclusive-use packages, minimum spends or a mixture. Always ask for a total for your guest count."
      },
      {
        question: "Is an off-peak wedding always cheaper?",
        answer:
          "Often, but not automatically. Check whether the saving changes minimum guest numbers, package inclusions, heating, accommodation or supplier availability before deciding."
      }
    ],
    sources: [
      { label: "Bridebook: Average wedding cost in Scotland (2026)", href: "https://bridebook.com/uk/article/average-wedding-cost-scotland" },
      { label: "Bridebook: UK Wedding Report 2026", href: "https://partners.bridebook.com/uk/wedding-report-2026" },
      { label: "Hitched: 2026 Wedding Industry Report", href: "https://www.hitched.co.uk/wedding-planning/organising-and-planning/the-average-wedding-cost-in-the-uk-revealed/" }
    ]
  },
  {
    slug: "real-cost-of-a-scottish-wedding-2026",
    title: "The real cost of a Scottish wedding in 2026",
    shortTitle: "The real cost in 2026",
    description:
      "What current wedding averages do and do not tell you, plus a realistic way to build your own Scottish wedding cost.",
    category: "Costs",
    publishedAt,
    updatedAt: publishedAt,
    readMinutes: 9,
    featured: true,
    answer:
      "Bridebook reports a £22,987 average for weddings in Scotland in 2026. That is a benchmark, not a price list: the real number for you will be driven by guest count, venue format, date and the costs included in each quote.",
    intro: [
      "An average wedding figure is appealing because it feels like an answer. In practice, it can hide more than it reveals. It blends small celebrations with large weddings, city hotels with private estates and couples who count different items in their total.",
      "A better question is: what will the version of the day we are planning cost, and which choices are responsible for most of that number?"
    ],
    takeaways: [
      "The reported 2026 Scottish average is £22,987, but it is not a recommended budget.",
      "Guest count and venue-plus-catering choices create the largest early commitments.",
      "Build a range first, then replace assumptions with quotes as you plan."
    ],
    sections: [
      {
        heading: "What the 2026 figures say",
        paragraphs: [
          "Bridebook's 2026 Scottish figure is £22,987, compared with its UK average of £20,604. Hitched's separate UK report gives an average of £21,990 and an average spend per guest of £272. Different samples and methods produce different answers, which is exactly why a single average should not become your target.",
          "Bridebook also reports that a quarter of couples in its UK sample spent under £10,000 and a quarter spent over £26,000. The middle is broad. Your wedding does not become more or less valid depending on which side of an average it lands."
        ]
      },
      {
        heading: "The costs that shape the total",
        bullets: [
          "Venue, food and drink: often the largest combined commitment and closely linked to guest numbers.",
          "Photography and film: usually booked early and priced by coverage, team and deliverables.",
          "Clothing and beauty: alterations, accessories and the wider wedding party can change the headline price.",
          "Styling and flowers: strongly affected by scale, season, installation work and reuse between spaces.",
          "Entertainment and production: bands, DJs, sound, lighting and power requirements can overlap.",
          "Ceremony and administration: include the registrar or celebrant, notices, certificates and ceremony-room costs.",
          "Travel and accommodation: especially important for rural, island and multi-day Scottish weddings."
        ]
      },
      {
        heading: "Build three numbers, not one",
        table: {
          headers: ["Version", "Purpose"],
          rows: [
            ["Minimum workable", "The least expensive version you would both still be happy to hold"],
            ["Expected", "Your most likely plan using current research and realistic allowances"],
            ["Upper limit", "The firm amount you will not exceed, including contingency"]
          ]
        },
        paragraphs: [
          "This range prevents an early venue quote from quietly becoming permission to spend everything else at the same level. When a cost rises, decide together whether the expected total rises, another category falls or the scope changes."
        ]
      },
      {
        heading: "Turn research into a live plan",
        paragraphs: [
          "Start with estimates, mark them clearly and give every major category an owner. When a supplier quote arrives, keep the estimate and confirmed cost distinct. Record the deposit as a payment rather than subtracting it from the price, then add every balance date to one schedule.",
          "EverAft's planner is designed around that transition. You can start from £15,000, £20,000 or £30,000, add a venue from the directory and change every estimate to fit the wedding you are actually planning."
        ]
      }
    ],
    venueLinks: [
      { label: "See Scottish venues with published details", href: "/venues" },
      { label: "Browse Edinburgh wedding venues", href: "/wedding-venues/edinburgh" },
      { label: "Browse Glasgow wedding venues", href: "/wedding-venues/glasgow" },
      { label: "Explore Perthshire wedding venues", href: "/wedding-venues/perthshire" }
    ],
    faqs: [
      {
        question: "What is the average cost of a wedding in Scotland in 2026?",
        answer:
          "Bridebook reports an average of £22,987 from its 2026 UK Wedding Report. Use it as market context rather than a target because guest count, date, format and included costs vary substantially."
      },
      {
        question: "Does that average include the honeymoon?",
        answer:
          "Survey definitions can differ, which is one reason published averages do not always match. When comparing any figure with your own budget, check exactly what the source counts and decide whether your planner includes rings, honeymoon and pre-wedding events."
      },
      {
        question: "How much contingency should we keep?",
        answer:
          "Five to ten percent is a useful planning range for many couples, but the right buffer depends on how many prices are still estimates and how close you are to your firm spending limit."
      }
    ],
    sources: [
      { label: "Bridebook: Average wedding cost in Scotland (2026)", href: "https://bridebook.com/uk/article/average-wedding-cost-scotland" },
      { label: "Bridebook: UK Wedding Report 2026", href: "https://partners.bridebook.com/uk/wedding-report-2026" },
      { label: "The Knot Worldwide: Hitched 2026 report summary", href: "https://www.theknotww.com/press-releases/the-average-cost-of-a-wedding-in-2026-around-21990-according-to-hitched" }
    ]
  },
  {
    slug: "questions-to-ask-before-booking-a-wedding-venue",
    title: "Questions to ask before booking a wedding venue",
    shortTitle: "Questions before booking",
    description:
      "The questions that uncover the real price, practical limits and contract commitments before you reserve a wedding venue.",
    category: "Choosing a venue",
    publishedAt,
    updatedAt: publishedAt,
    readMinutes: 8,
    featured: true,
    answer:
      "Before booking, confirm the complete price for your date and guest count, every compulsory supplier or charge, the spaces and access times included, the wet-weather plan, accessibility, payment schedule and cancellation terms in writing.",
    intro: [
      "A venue can feel right within minutes. The booking still needs to work on paper. The questions below are designed to expose costs, restrictions and assumptions while there is still time to compare them.",
      "Ask the same core questions at every venue. You will get more useful answers and a much fairer shortlist."
    ],
    takeaways: [
      "Ask for a written total built around your actual date and guest count.",
      "Clarify every space, timing, supplier restriction and weather alternative.",
      "Read the payment and cancellation terms before paying anything."
    ],
    sections: [
      {
        heading: "Availability and exclusivity",
        bullets: [
          "Is our preferred date available, and how long can you hold it without payment?",
          "What time can we and our suppliers enter, and when must everyone leave?",
          "Which rooms and outdoor areas are included at each stage of the day?",
          "Will another wedding, event or public visitor use any part of the venue?",
          "What does 'exclusive use' mean in this contract?"
        ]
      },
      {
        heading: "Capacity and how the day will flow",
        bullets: [
          "What are the comfortable seated and evening capacities for the layout we want?",
          "Where do guests go while a room is being turned around?",
          "Is there a separate ceremony option and what happens if the weather changes?",
          "Are there enough toilets, cloakroom space and accessible routes for our numbers?",
          "Where will the band, DJ, bar, cake and evening food actually go?"
        ],
        paragraphs: [
          "A legal maximum is not the same as a comfortable capacity. Ask to see a floor plan or photographs of a real wedding with a similar guest count and layout."
        ]
      },
      {
        heading: "Price, food and required extras",
        bullets: [
          "What is the total for our date, day guests and evening guests?",
          "Does the quote include VAT, service charges, staffing, furniture, linen and cleaning?",
          "Are there minimum guest numbers, food-and-drink spends or bedroom commitments?",
          "Can prices change after booking, and if so how is any increase calculated?",
          "What are the corkage, cake-cutting, supplier meal and overtime charges?",
          "Which suppliers are compulsory, approved or prohibited?"
        ]
      },
      {
        heading: "Contract, payments and what happens if plans change",
        bullets: [
          "How much is the booking deposit and when do later payments fall due?",
          "Which payments are refundable and in what circumstances?",
          "What happens if we reduce guest numbers, postpone or change the date?",
          "What happens if the venue cancels or can no longer provide an important part of the booking?",
          "Is wedding insurance required or recommended, and what does the venue's own insurance cover?"
        ],
        paragraphs: [
          "Do not rely on a conversation alone. Ask for the contract, package specification, final quote and any promised exception in writing before paying the deposit."
        ]
      },
      {
        heading: "Guest experience and access",
        bullets: [
          "Is every main part of the day step-free, and is there an accessible toilet?",
          "How many parking spaces are available and what are the taxi or coach options?",
          "Is there on-site accommodation, a room block or a required minimum stay?",
          "Are children welcome and is there a safe, quiet space for families?",
          "What sound limits, finish times, candle rules or decoration restrictions apply?"
        ]
      }
    ],
    venueLinks: [
      { label: "Build a Scottish venue shortlist", href: "/venues" },
      { label: "Compare castle venues", href: "/wedding-venues/castles" },
      { label: "Compare country estates", href: "/wedding-venues/country-estates" },
      { label: "Compare luxury hotels", href: "/wedding-venues/luxury-hotels" }
    ],
    faqs: [
      {
        question: "Should we ask for the contract before paying a deposit?",
        answer:
          "Yes. Read the contract, quote, package inclusions, payment schedule and cancellation terms before making a non-trivial payment. Ask for unclear wording or verbal promises to be confirmed in writing."
      },
      {
        question: "How many venues should we view?",
        answer:
          "There is no ideal number. A focused shortlist of venues that already meet your budget, capacity and location requirements is usually more useful than viewing many unsuitable options."
      },
      {
        question: "What should we take to a venue viewing?",
        answer:
          "Bring your estimated guest numbers, preferred date range, priorities, phone camera, notes and the EverAft venue-viewing checklist so you collect the same evidence at every visit."
      }
    ]
  },
  {
    slug: "wedding-venue-viewing-checklist",
    title: "Wedding venue viewing checklist",
    shortTitle: "Venue viewing checklist",
    description:
      "A room-by-room wedding venue viewing checklist, with the questions and evidence you need to compare venues after the excitement settles.",
    category: "Choosing a venue",
    publishedAt,
    updatedAt: publishedAt,
    readMinutes: 7,
    answer:
      "Take the same checklist to every viewing, record exact inclusions and restrictions, photograph the practical spaces as well as the beautiful ones, and score the venue only after you have its written quote and contract.",
    intro: [
      "Venue viewings are deliberately emotional. You are being shown the best rooms, the best angles and the version of the day everyone hopes for. A checklist lets you enjoy that while still collecting the information you will need later.",
      "Download the EverAft checklist before you go. It includes space for two venue viewings, a cost snapshot and the questions most often forgotten in the moment."
    ],
    takeaways: [
      "Photograph practical details and layouts, not only the grounds and ceremony backdrop.",
      "Record what is included, compulsory and unavailable in writing.",
      "Compare venues against the same non-negotiables after each visit."
    ],
    sections: [
      {
        heading: "Before the viewing",
        bullets: [
          "Write down your day and evening guest estimates.",
          "Set a complete venue-related budget, including food, drink and required accommodation.",
          "Choose three non-negotiables and three preferences.",
          "Ask the venue to send its current brochure, sample quote and terms in advance.",
          "Check the route at the time and on the day of the week your guests would travel."
        ]
      },
      {
        heading: "What to look at while you are there",
        bullets: [
          "Arrival, parking, signage and the route from bedrooms or transport drop-off.",
          "Ceremony sightlines, acoustics, aisle width and accessible seating.",
          "The wet-weather ceremony and photography plan.",
          "Reception layout at your guest count, including dance floor and entertainment.",
          "Toilets, changing space, quiet rooms, heating, ventilation and lighting.",
          "Supplier access, storage, power, kitchen arrangements and pack-down route."
        ]
      },
      {
        heading: "Evidence to take away",
        bullets: [
          "A written quote for the same date, guest count and package assumptions used elsewhere.",
          "The current package specification and full terms and conditions.",
          "A floor plan or example layout for your numbers.",
          "The payment schedule, cancellation scale and price-review wording.",
          "A list of compulsory or approved suppliers and every additional charge discussed."
        ]
      },
      {
        heading: "The five-minute review",
        paragraphs: [
          "Before travelling home, each of you should independently write what felt strongest, what worried you and whether the venue still fits the budget. This captures your real reaction before one person's enthusiasm becomes the shared memory.",
          "Wait for the written quote before scoring value. Then enter the complete estimated total in your planner and compare the remaining budget with your other priorities."
        ]
      }
    ],
    venueLinks: [
      { label: "Find venues to view", href: "/venues" },
      { label: "View Edinburgh options", href: "/wedding-venues/edinburgh" },
      { label: "View Glasgow options", href: "/wedding-venues/glasgow" },
      { label: "Explore Stirling venues", href: "/wedding-venues/stirling" }
    ],
    faqs: [
      {
        question: "Can I download the wedding venue checklist?",
        answer:
          "Yes. The EverAft PDF is designed for printing or saving to your phone and includes tick boxes, cost prompts and comparison notes for two venue visits."
      },
      {
        question: "Can we take photographs at a venue viewing?",
        answer:
          "Usually, but ask first if another event or guests are present. Photograph layouts, access points and wet-weather spaces so your images remain useful when comparing venues later."
      },
      {
        question: "Should we decide on the day?",
        answer:
          "You do not need to. Ask how long the date can be held, then review the written quote and contract away from the sales setting before paying a deposit."
      }
    ]
  },
  {
    slug: "how-to-compare-wedding-venue-packages",
    title: "How to compare wedding venue packages",
    shortTitle: "Compare venue packages",
    description:
      "Turn different venue brochures into one like-for-like comparison covering price, inclusions, guest numbers and risk.",
    category: "Choosing a venue",
    publishedAt,
    updatedAt: publishedAt,
    readMinutes: 8,
    answer:
      "Create one common wedding scenario and ask every venue to price it. Separate included, optional and compulsory costs, then compare the total alongside space, service, flexibility and contract terms.",
    intro: [
      "Wedding packages are meant to make planning simpler, but each venue bundles different things. A gold package at one venue may cover less than a standard package somewhere else, and the cheaper price per guest may sit beside a higher room hire or minimum spend.",
      "The solution is to stop comparing package names and start comparing the same wedding."
    ],
    takeaways: [
      "Give every venue the same date, timings and guest numbers.",
      "Separate included, optional and compulsory lines.",
      "Compare the total cost and contract flexibility, not only price per person."
    ],
    sections: [
      {
        heading: "Create your comparison scenario",
        bullets: [
          "Preferred date or month, day of the week and year.",
          "Day and evening guest counts, including children and supplier meals.",
          "Ceremony at the venue or elsewhere.",
          "Meal style, drinks expectation and evening food.",
          "Required bedrooms or guest accommodation.",
          "Entertainment, finish time and any important cultural or accessibility needs."
        ],
        paragraphs: [
          "Send that same short brief to every venue. If a venue cannot quote one part yet, mark it as unknown rather than treating it as zero."
        ]
      },
      {
        heading: "Compare the lines that packages often hide",
        table: {
          headers: ["Area", "Questions"],
          rows: [
            ["Rooms and ceremony", "Are ceremony hire, turnaround and all reception rooms included?"],
            ["Food", "How many courses, choices, dietary alternatives and supplier meals?"],
            ["Drink", "Which drinks, quantities, brands, corkage and bar rules?"],
            ["People", "Minimum numbers, child pricing and separate evening-guest fees?"],
            ["Furniture and styling", "Tables, chairs, linen, crockery, candles, setup and removal?"],
            ["Service", "Coordinator, waiting staff, bar staff, security, cleaning and service charge?"],
            ["Bedrooms", "Allocation, required rooms, rates, release date and unbooked-room liability?"],
            ["Price changes", "Can food, drink or package prices rise after booking?"]
          ]
        }
      },
      {
        heading: "Give flexibility a value",
        paragraphs: [
          "A package is not better simply because it contains more. Value depends on whether you want those inclusions and how easy they are to change. A fixed supplier list can save time but reduce choice. A drinks package can create certainty but may not suit a light-drinking group.",
          "Record the cost of replacing anything you do not want and the risk around anything still labelled 'from', 'subject to review' or 'based on minimum numbers'."
        ]
      },
      {
        heading: "Make the decision in the whole budget",
        paragraphs: [
          "Add the complete package total to your wedding budget, not just the deposit or hire fee. Then test what happens if your guest count rises by ten, falls below a minimum or the venue applies a stated price increase.",
          "The strongest package is the one that gives you the day you want, leaves enough for your other priorities and places acceptable risk in writing."
        ]
      }
    ],
    venueLinks: [
      { label: "Compare luxury hotel venues", href: "/wedding-venues/luxury-hotels" },
      { label: "Compare country estate venues", href: "/wedding-venues/country-estates" },
      { label: "Search all Scottish venues", href: "/venues" }
    ],
    faqs: [
      {
        question: "Are all-inclusive wedding packages cheaper?",
        answer:
          "They can offer good value and certainty, but not automatically. Compare the full cost against what you would otherwise buy and check whether included items match your plans."
      },
      {
        question: "What is a wedding venue minimum spend?",
        answer:
          "It is a minimum amount you agree to spend on qualifying items, commonly food and drink. Ask what counts towards it, whether room hire is separate and what happens if your final order is below it."
      },
      {
        question: "How do we compare packages with different guest minimums?",
        answer:
          "Price each package at your realistic guest count and include any charge created by a higher minimum. Do not divide a minimum-spend total by guests you do not expect to invite."
      }
    ]
  },
  {
    slug: "dry-hire-vs-all-inclusive-wedding-venues",
    title: "Dry-hire versus all-inclusive wedding venues",
    shortTitle: "Dry hire vs all-inclusive",
    description:
      "The real trade-offs between dry-hire flexibility and an all-inclusive venue package, including costs couples often miss.",
    category: "Choosing a venue",
    publishedAt,
    updatedAt: publishedAt,
    readMinutes: 8,
    answer:
      "Dry hire offers more control but shifts coordination, supplier and infrastructure work to you. All-inclusive packages offer convenience and clearer early pricing but may reduce flexibility. Compare the complete delivered wedding, not the starting fee.",
    intro: [
      "Dry hire and all-inclusive are not quality levels. They are different ways of buying and organising a wedding. One gives you a space and varying degrees of freedom; the other bundles more of the day into one venue relationship.",
      "The right choice depends on how much control you want, how much coordination you can take on and whether the complete cost still works."
    ],
    takeaways: [
      "Dry hire can be flexible without necessarily being cheaper.",
      "Packages can reduce workload without necessarily including everything.",
      "Price staffing, equipment, setup and risk before comparing totals."
    ],
    sections: [
      {
        heading: "What dry hire can involve",
        paragraphs: [
          "At its simplest, dry hire gives you the venue space. Depending on the property, you may also need to source catering, bar, furniture, tableware, linen, staffing, power, waste removal and a coordinator. Some dry-hire venues include several of those essentials, so read the specification rather than relying on the label."
        ],
        bullets: [
          "More freedom to choose food, drink, styling and suppliers.",
          "More contracts, deliveries and responsibilities to coordinate.",
          "Potential to prioritise spend, but also more unpriced gaps early on.",
          "Greater need to understand access, storage, kitchen, power and clean-up."
        ]
      },
      {
        heading: "What all-inclusive usually means",
        paragraphs: [
          "An all-inclusive package normally combines the venue with selected food, drink and service. It may also include a coordinator, furniture, linen, cake stand, menu tasting, accommodation or small styling items. The phrase has no universal definition, so treat the written inclusions as the product."
        ],
        bullets: [
          "Fewer core suppliers and payment relationships to manage.",
          "A clearer early estimate when your guest count is stable.",
          "Possible restrictions on menus, drinks, suppliers and personalisation.",
          "Optional upgrades and minimum numbers can still change the final total."
        ]
      },
      {
        heading: "A fair comparison",
        table: {
          headers: ["Question", "Dry hire", "All-inclusive"],
          rows: [
            ["Catering", "Who can cater and what facilities are supplied?", "What menu, service and dietary choices are included?"],
            ["Drink", "Licence, bar operator, corkage, glassware and staff?", "Package quantities, brands, upgrades and bar prices?"],
            ["Equipment", "Furniture, linen, tableware, lighting, power and heating?", "Which items are standard and which are upgrades?"],
            ["People", "Who coordinates setup, service, turnaround and pack-down?", "What does the venue coordinator actually manage?"],
            ["Risk", "What happens if a key supplier fails?", "What can the venue substitute or reprice?" ]
          ]
        }
      },
      {
        heading: "Who each format tends to suit",
        paragraphs: [
          "Dry hire can suit couples with a strong creative plan, unusual catering needs, trusted suppliers or professional coordination. All-inclusive can suit couples who value a simpler planning path, predictable core service and one experienced venue team.",
          "Neither removes the need for a full quote and contract review. Add every known component to the budget planner and leave an allowance for the gaps that are not yet quoted."
        ]
      }
    ],
    venueLinks: [
      { label: "Explore country estate venues", href: "/wedding-venues/country-estates" },
      { label: "Explore castle venues", href: "/wedding-venues/castles" },
      { label: "Compare luxury hotel packages", href: "/wedding-venues/luxury-hotels" },
      { label: "Search every venue type", href: "/venues" }
    ],
    faqs: [
      {
        question: "Is dry hire cheaper than an all-inclusive venue?",
        answer:
          "Not necessarily. The hire fee may be lower, but catering, bar, equipment, staffing, setup and coordination can make the complete cost higher. Obtain quotes for the missing parts before comparing."
      },
      {
        question: "Can we bring our own alcohol to a dry-hire venue?",
        answer:
          "It depends on the venue licence and contract. Ask about corkage, bar operation, licensed hours, glassware, chilling, staffing and what happens to unopened drink."
      },
      {
        question: "Does all-inclusive include accommodation?",
        answer:
          "Sometimes, but often not. Check whether bedrooms are included, discounted, optional or subject to a minimum commitment."
      }
    ]
  },
  {
    slug: "wedding-venue-capacity-layouts",
    title: "How many guests can different wedding venue layouts hold?",
    shortTitle: "Guest capacity and layouts",
    description:
      "Why venue capacity changes with table shape, dance floors and room use, and how to check whether your guest list will feel comfortable.",
    category: "Venue practicalities",
    publishedAt,
    updatedAt: publishedAt,
    readMinutes: 7,
    answer:
      "A venue's maximum capacity is only meaningful for a named room and layout. Round tables, banqueting rows, cabaret seating, dance floors, stages and accessible routes all use space differently, so ask for a floor plan using your actual numbers.",
    intro: [
      "A venue advertised for 120 guests may feel generous for one wedding and crowded for another. Capacity changes when you add a dance floor, stage, bar, photo booth, children's space, band equipment or wider access routes.",
      "Do not eliminate or shortlist a venue using one capacity number. Ask which room, setup and part of the day that number describes."
    ],
    takeaways: [
      "Ask for comfortable capacity in your exact layout, not only the licensed maximum.",
      "Day and evening capacity may use different rooms and assumptions.",
      "Protect sightlines, service routes and accessibility when adding extras."
    ],
    sections: [
      {
        heading: "What common layout names mean",
        table: {
          headers: ["Layout", "How it uses the room", "Useful for"],
          rows: [
            ["Theatre", "Rows of chairs with no dining tables", "Ceremonies and speeches"],
            ["Round tables", "Guests around separate circular tables", "Traditional wedding breakfasts"],
            ["Banquet rows", "Long rectangular tables in rows", "Shared dining and narrower rooms"],
            ["Cabaret", "Guests face a stage with one side of tables left open", "Presentations; less common for the meal"],
            ["Standing reception", "Few or no assigned seats", "Drinks and evening guests, not a seated meal"],
            ["U-shape or horseshoe", "Tables form an open-sided shape", "Smaller meals and intimate ceremonies"]
          ]
        }
      },
      {
        heading: "Why the advertised maximum can mislead",
        bullets: [
          "The maximum may leave no permanent dance floor until tables are removed.",
          "A band can need substantially more space than a DJ.",
          "Columns, fireplaces and fixed bars can affect views and circulation.",
          "Service aisles and emergency exits must remain clear.",
          "Wheelchairs, mobility aids, highchairs and prams need deliberate space, not leftovers.",
          "A room that seats everyone may not hold the ceremony, meal and evening setup at once."
        ]
      },
      {
        heading: "Ask the venue to prove the layout",
        paragraphs: [
          "Request a scaled floor plan or a sample layout for your expected day guests, not a generic maximum. Add your entertainment, dance floor, bar, cake, gifts, photo booth and any cultural requirements. Then ask where guests go during every room change.",
          "Photographs from a real wedding with similar numbers are helpful, but check whether furniture was removed later and whether the image shows the full room."
        ]
      },
      {
        heading: "Use capacity as a budget control",
        paragraphs: [
          "Guest count affects far more than chairs. It can move you into a larger room or package, trigger a different staffing level and increase food, drink, stationery, transport and hire costs together.",
          "Search EverAft using your current guest estimate, then test the venue and per-person assumptions in the budget planner before increasing the list."
        ]
      }
    ],
    venueLinks: [
      { label: "Find venues for up to 60 guests", href: "/venues?guests=60" },
      { label: "Find venues for up to 100 guests", href: "/venues?guests=100" },
      { label: "Find venues for up to 150 guests", href: "/venues?guests=150" },
      { label: "Browse all Scottish venues", href: "/venues" }
    ],
    faqs: [
      {
        question: "What is the difference between seated and standing capacity?",
        answer:
          "Seated capacity assumes chairs and often tables; standing capacity usually allows many more people but is not suitable for a formal meal. Confirm which number applies to each part of your wedding."
      },
      {
        question: "Should we book a venue exactly the size of our guest list?",
        answer:
          "Only if the venue demonstrates a comfortable layout including every feature you need. Some breathing room can improve circulation, accessibility and the wet-weather plan."
      },
      {
        question: "Do evening guests count towards venue capacity?",
        answer:
          "Yes. The venue must stay within the safe capacity for the rooms open in the evening, including your day guests, evening guests, staff and sometimes suppliers. Ask the venue how it calculates this."
      }
    ]
  },
  {
    slug: "wedding-venue-deposits-cancellation-terms",
    title: "Wedding venue deposits and cancellation terms explained",
    shortTitle: "Deposits and cancellation terms",
    description:
      "How wedding venue deposits, payment schedules and cancellation scales work, with the contract questions to ask before paying.",
    category: "Venue practicalities",
    publishedAt,
    updatedAt: publishedAt,
    readMinutes: 9,
    answer:
      "A deposit usually reserves the date and forms part of the contract price, but calling a payment 'non-refundable' does not automatically make every term fair. Read the full contract, payment schedule and cancellation scale, and get advice on your circumstances if a dispute arises.",
    intro: [
      "Paying a venue deposit is often the first large, irreversible-feeling moment in wedding planning. It can also be the point where couples discover that a friendly brochure and a legal contract are not the same document.",
      "This guide explains the questions to ask. It is general information, not legal advice; contracts and circumstances differ."
    ],
    takeaways: [
      "Read the full contract and cancellation scale before paying.",
      "Record what the deposit reserves and whether later prices can change.",
      "Unfair terms may not be enforceable simply because they were signed."
    ],
    sections: [
      {
        heading: "What a venue deposit does",
        paragraphs: [
          "A booking deposit commonly secures your date and is credited against the final price. The contract should say what service is being reserved, the total or pricing basis, when the agreement becomes binding and what happens to the payment if either side cancels.",
          "Ask whether the date is held before payment, after payment or only once the contract is signed. If the venue uses both a non-refundable booking fee and later deposits, understand the purpose of each."
        ]
      },
      {
        heading: "Read the whole payment schedule",
        bullets: [
          "Every instalment amount or percentage and its due date.",
          "When final guest numbers are fixed and whether the total can fall afterwards.",
          "How food, drink or package price increases are calculated.",
          "Charges for late payment, changing date or reducing the booking.",
          "Whether card, transfer or payment-plan methods affect protection or fees."
        ],
        paragraphs: [
          "Add the full contract value to your budget and record deposits as payments against it. A £2,000 deposit on a £12,000 booking is still a £12,000 commitment."
        ]
      },
      {
        heading: "Cancellation charges still have to be fair",
        paragraphs: [
          "The Competition and Markets Authority says a cancellation charge is not fair merely because it appears in a signed contract. Its consumer guidance says a business is generally entitled to cover actual losses that directly result from cancellation and should take reasonable steps to reduce those losses.",
          "CMA guidance to wedding and event venues says terms are more likely to be fair where deposits are a small reservation payment and cancellation scales reflect a genuine estimate of direct loss. A large fixed charge in every circumstance or recovery beyond the likely loss may be challengeable."
        ]
      },
      {
        heading: "Questions for the contract",
        bullets: [
          "What happens if we cancel, postpone or move to a cheaper date?",
          "Does the cancellation charge change as the wedding approaches?",
          "Will sums be recalculated if the venue rebooks our date?",
          "What happens if the venue cancels, closes or cannot provide a key part of the package?",
          "Which events count as force majeure and what choices follow?",
          "How are disputes handled and which law governs the contract?"
        ]
      },
      {
        heading: "If something goes wrong",
        paragraphs: [
          "Keep the contract, quote, brochure version, invoices and every material email together. Raise the issue with the venue in writing and explain the outcome you want. Citizens Advice Scotland can help you understand consumer options; legal advice may be appropriate for a significant dispute.",
          "Wedding insurance can cover some defined events, but it does not replace your contractual rights. Read exclusions, supplier-failure cover and change-of-mind terms before relying on a policy."
        ]
      }
    ],
    venueLinks: [
      { label: "Compare Scottish venues before committing", href: "/venues" },
      { label: "Compare hotel venue packages", href: "/wedding-venues/luxury-hotels" },
      { label: "Compare exclusive-use estates", href: "/wedding-venues/country-estates" }
    ],
    faqs: [
      {
        question: "Are wedding venue deposits always non-refundable?",
        answer:
          "No universal rule makes every venue deposit non-refundable in every circumstance. The contract and actual circumstances matter, and consumer terms must be fair. Seek advice if a venue is retaining an amount you believe is disproportionate."
      },
      {
        question: "Do we get a 14-day cooling-off period?",
        answer:
          "Do not assume so. Consumer cancellation rules contain exceptions, including some services connected with accommodation, catering or leisure activities on specific dates. Check your contract and obtain advice for your exact booking."
      },
      {
        question: "Should we pay the venue deposit by credit card?",
        answer:
          "Payment method can affect consumer protection. For qualifying purchases, Section 75 protection may apply when at least part is paid by credit card, subject to legal conditions. Check current guidance and your card provider rather than assuming every payment is covered."
      }
    ],
    sources: [
      { label: "GOV.UK: Cancelling goods or services", href: "https://www.gov.uk/government/publications/cancelling-goods-or-services-guide-for-consumers/cancelling-goods-or-services" },
      { label: "CMA: Wedding and event venue contract terms", href: "https://www.gov.uk/government/publications/wedding-and-event-venue-providers-letter-from-the-cma-on-contract-terms" },
      { label: "Citizens Advice: Cancelling a service you arranged", href: "https://www.citizensadvice.org.uk/consumer/changed-your-mind/cancelling-a-service-youve-arranged/" }
    ]
  },
  {
    slug: "how-to-divide-wedding-budget-15000-20000-30000",
    title: "How to divide a £15,000, £20,000 or £30,000 wedding budget",
    shortTitle: "Divide a £15k, £20k or £30k budget",
    description:
      "Editable wedding budget examples for £15,000, £20,000 and £30,000, with the decisions that matter more than rigid percentages.",
    category: "Costs",
    publishedAt,
    updatedAt: publishedAt,
    readMinutes: 9,
    answer:
      "Fund the venue, food and guest experience first, protect a contingency, then divide what remains around your own priorities. EverAft's editable starters use roughly 60, 80 and 100 guests as planning examples - not rules.",
    intro: [
      "Percentage breakdowns are useful until they pretend every couple wants the same wedding. A city restaurant, castle weekend and village-hall celebration should not have identical allocations.",
      "The examples below give you a workable first draft. Open the matching EverAft starter and change every line to reflect your guest count and priorities."
    ],
    takeaways: [
      "Start with a firm total and protect contingency before upgrades.",
      "Venue and catering must be considered together, especially with packages.",
      "Use examples to begin the conversation, then replace them with your own quotes."
    ],
    sections: [
      {
        heading: "Three editable starting points",
        table: {
          headers: ["Budget", "Example shape", "Venue + food allowance", "Keep flexible"],
          rows: [
            ["£15,000", "Focused plan for around 60 guests", "About £7,000", "Protect photography and keep supporting details disciplined"],
            ["£20,000", "Balanced plan for around 80 guests", "About £10,000", "Leave room for contingency and personal priorities"],
            ["£30,000", "More flexible plan for around 100 guests", "About £15,000", "Avoid letting every category rise just because the total is higher"]
          ]
        },
        paragraphs: [
          "These are planning shapes, not market promises. If your preferred venue uses most of the venue-and-food allowance before drinks, decide whether to reduce guests, change date, raise the total or deliberately spend less elsewhere."
        ]
      },
      {
        heading: "A sensible order for dividing the money",
        bullets: [
          "Set the total from money genuinely available, not the cost of the first venue you like.",
          "Reserve a contingency - often five to ten percent while many prices remain estimates.",
          "Choose a realistic guest count and cost the venue, food and drink together.",
          "Protect your top two or three priorities before filling every category.",
          "Add ceremony, clothing, photography, entertainment and essential logistics.",
          "Only then fund optional details and upgrades."
        ]
      },
      {
        heading: "What changes between £15k and £30k",
        paragraphs: [
          "A larger budget can buy a higher guest count, a different venue format, more supplier coverage or more headroom. It does not have to make every line more expensive. If photography matters greatly but elaborate flowers do not, keep that asymmetry.",
          "At every level, guest count is one of the most powerful controls because it can affect the venue room, food, drink, stationery, furniture, transport and favours simultaneously."
        ]
      },
      {
        heading: "Use estimates honestly",
        paragraphs: [
          "Mark researched allowances as estimates and supplier proposals as quotes. Once booked, keep the confirmed total, deposit paid, remaining balance and due date separate. This stops a low deposit from making a large booking look affordable.",
          "Open one of EverAft's starters below. It creates a working planner in your browser, and every category, guest number and estimate can be changed."
        ]
      }
    ],
    venueLinks: [
      { label: "Find venues for a £15,000 total budget", href: "/venues?budget=15000" },
      { label: "Find venues for a £20,000 total budget", href: "/venues?budget=20000" },
      { label: "Find venues for a £30,000 total budget", href: "/venues?budget=30000" },
      { label: "Browse all Scottish venues", href: "/venues" }
    ],
    faqs: [
      {
        question: "Can you have a wedding for £15,000 in Scotland?",
        answer:
          "Yes, but the viable format depends on guest count, date, venue and priorities. Start with a full scenario rather than assuming a national average determines what is possible."
      },
      {
        question: "Does the EverAft starter save my changes?",
        answer:
          "The planner can save locally in your browser and, where available, sync for a signed-in user. The starter is fully editable, so replace every example with your own research and quotes."
      },
      {
        question: "Should the honeymoon be inside the wedding budget?",
        answer:
          "Either approach is fine if you are consistent. Decide together whether your total includes the honeymoon, engagement ring, hen or stag events and next-day celebrations, then label those boundaries clearly."
      }
    ]
  },
  {
    slug: "hidden-wedding-venue-costs",
    title: "Hidden wedding venue costs couples forget",
    shortTitle: "Hidden venue costs",
    description:
      "A practical list of venue-related charges that often sit outside the headline package, from corkage and bedrooms to setup and overtime.",
    category: "Costs",
    publishedAt,
    updatedAt: publishedAt,
    readMinutes: 8,
    answer:
      "The most commonly missed venue costs sit around the edges of the package: ceremony fees, minimum numbers, corkage, service charge, supplier meals, required bedrooms, furniture, power, cleaning, security, transport and overtime.",
    intro: [
      "Most venue costs are not deliberately hidden. They are hidden by timing: the brochure gives one attractive starting figure, while the practical charges only become visible as your plans become specific.",
      "Bring these lines into the first quote. An unknown cost should stay marked as unknown, not silently become zero."
    ],
    takeaways: [
      "Ask for every compulsory and likely optional charge in one written estimate.",
      "Check accommodation, supplier and end-of-night logistics early.",
      "Keep an explicit contingency for costs that cannot yet be confirmed."
    ],
    sections: [
      {
        heading: "Charges around the venue and ceremony",
        bullets: [
          "Separate ceremony-room hire or an outdoor ceremony fee.",
          "Room turnaround charges when the same space is used twice.",
          "Exclusive-use upgrades or minimum spends for private areas.",
          "Furniture moves, non-standard chairs, staging and dance floors.",
          "Heating, generators, additional power or wet-weather structures.",
          "Cleaning, waste removal, security and damage deposits."
        ]
      },
      {
        heading: "Food, drink and people",
        bullets: [
          "Minimum adult numbers even if fewer guests attend.",
          "Evening-guest, children's and supplier-meal prices.",
          "Menu tastings, upgrades, dietary alternatives and late-night food.",
          "Corkage, bar staffing, glassware, ice and drinks outside the package.",
          "Service charge or gratuity added after the headline prices.",
          "Cake cutting, plating or external-caterer kitchen fees."
        ]
      },
      {
        heading: "Accommodation and travel",
        bullets: [
          "Required bedrooms or cottages and minimum-night stays.",
          "Responsibility for rooms guests do not book by the release date.",
          "Breakfast, early check-in, late checkout and extra beds.",
          "Coaches, taxis or minibuses where public transport is limited.",
          "Parking attendants, permits or overnight parking restrictions."
        ]
      },
      {
        heading: "Time and supplier restrictions",
        bullets: [
          "Early access for styling or late access for collection.",
          "Overtime for the venue, coordinator, bar, security or entertainment.",
          "Fees for using suppliers outside an approved list.",
          "Delivery, storage and collection charges across multiple days.",
          "Sound-limit equipment, additional production or an earlier finish.",
          "Insurance requirements for you and external suppliers."
        ]
      },
      {
        heading: "Turn the surprise list into a quote",
        paragraphs: [
          "Send venues the same schedule and guest assumptions, then ask them to identify which lines are included, optional, compulsory or not permitted. Add the likely options to your planner now; you can remove them later if the written quote confirms they are included.",
          "A slightly higher package with fewer gaps can be better value than a low headline price surrounded by unknowns. Compare certainty as well as cost."
        ]
      }
    ],
    venueLinks: [
      { label: "Compare venue pricing and inclusions", href: "/venues" },
      { label: "Review country estate venues", href: "/wedding-venues/country-estates" },
      { label: "Review castle venues", href: "/wedding-venues/castles" },
      { label: "Review hotel venues", href: "/wedding-venues/luxury-hotels" }
    ],
    faqs: [
      {
        question: "Should wedding venue quotes include VAT?",
        answer:
          "Ask explicitly. Consumer-facing prices should be clear, but brochures and supplier proposals can present figures differently. Confirm whether every line, minimum spend and service charge in your total includes VAT."
      },
      {
        question: "What is corkage?",
        answer:
          "Corkage is a charge connected with bringing or serving drink not bought through the venue. Ask what it covers, which drinks it applies to and whether glassware, chilling, disposal or bar staff are additional."
      },
      {
        question: "How much should we allow for forgotten costs?",
        answer:
          "A contingency of five to ten percent is a common planning range, but use a larger buffer where the venue, catering or logistics still contain many unknowns."
      }
    ]
  },
  {
    slug: "wedding-photographer-cost-scotland-2026",
    title: "How much does a wedding photographer cost in Scotland in 2026?",
    shortTitle: "Wedding photographer costs in Scotland",
    description:
      "Current wedding photography cost context for Scotland, what different packages include and how to compare quotes without losing sight of the whole budget.",
    category: "Photography",
    publishedAt: "2026-07-21",
    updatedAt: "2026-07-21",
    readMinutes: 9,
    answer:
      "Bridebook's 2026 data gives a UK average wedding photography spend of £1,484, while its Scotland cost guide suggests a typical figure around £1,560. Real quotes vary widely: coverage length, experience, a second photographer, travel, albums and delivery all change what you are buying.",
    intro: [
      "Photography is one of the larger supplier decisions in a wedding budget, but a price on its own tells you very little. A short digital-only package and full-day coverage with two photographers, an album and travel are not comparable purchases.",
      "Use current averages as context rather than a target. The useful number is the complete price for the coverage, deliverables and safeguards you actually want."
    ],
    takeaways: [
      "Bridebook's 2026 UK average is £1,484, with its Scotland guide suggesting a typical figure around £1,560.",
      "Compare hours, photographers, deliverables, travel and usage rights before comparing totals.",
      "Record the complete booking, deposit and remaining balance in the wider wedding budget."
    ],
    sections: [
      {
        heading: "What the 2026 figures say",
        paragraphs: [
          "Bridebook reports a UK average wedding photography spend of £1,484 from its 2026 data. Its Scotland wedding-cost guide places the typical Scottish figure at around £1,560 and gives broad examples ranging from £800–£1,200 for half-day coverage to £1,400–£2,500 for a full day.",
          "Those figures describe a varied market, not a tariff. Location, date, coverage and the photographer's experience can all move the price. Treat any range as a planning allowance until you have a written quote for your own wedding."
        ]
      },
      {
        heading: "Useful package ranges — and what they may buy",
        table: {
          headers: ["Coverage", "Published 2026 context", "What to confirm"],
          rows: [
            ["Half day", "Roughly £800–£1,200", "Exact hours, which parts of the day are covered and image delivery"],
            ["Full day", "Roughly £1,400–£2,500", "Start and finish time, evening coverage, travel and final gallery"],
            ["Full day with a second photographer", "Roughly £2,000–£3,500", "Who the second photographer is and when two-person coverage is provided"],
            ["Premium or destination coverage", "Often £3,000+", "Travel, accommodation, multi-day work, albums and additional events"]
          ]
        },
        paragraphs: [
          "The ranges above come from Bridebook's Scotland cost guide. They are useful for early budgeting, but they do not guarantee what an individual photographer will charge or include."
        ]
      },
      {
        heading: "What changes the price most",
        bullets: [
          "Coverage time: ceremony-only, half-day, full-day and multi-day packages require very different commitments.",
          "Experience and demand: an established photographer with limited annual availability may charge more.",
          "One photographer or two: a second photographer can cover simultaneous preparations, extra angles and larger guest groups.",
          "Travel and accommodation: rural, island and destination weddings may require mileage, ferries, flights or an overnight stay.",
          "Deliverables: edited digital images, previews, prints, albums and engagement sessions can be bundled or priced separately.",
          "Date and timing: peak Saturdays, late finishes and extra hours can affect availability and price."
        ]
      },
      {
        heading: "Check what the package actually includes",
        paragraphs: [
          "Ask every photographer to quote the same version of the day. Give them the date, venue, likely timings, locations and the parts you most want covered. A clear brief makes the responses easier to compare."
        ],
        bullets: [
          "The named photographer who will attend and any second photographer or assistant.",
          "The precise number of coverage hours and the price of extra time.",
          "An expected delivery window and how the finished gallery is supplied.",
          "Whether the number of final edited images is fixed, estimated or uncapped.",
          "Travel, accommodation, parking and ferry costs.",
          "Prints, albums, preview images and engagement sessions.",
          "Backup arrangements for equipment, files and photographer illness.",
          "The personal-use licence and any permission requested for portfolio or social-media use."
        ]
      },
      {
        heading: "Costs that can sit outside the headline figure",
        bullets: [
          "Travel beyond an included radius, parking, ferries and accommodation.",
          "Additional coverage when timings run late.",
          "A second photographer or assistant.",
          "Albums, parent albums, fine-art prints and postage.",
          "An engagement or pre-wedding shoot.",
          "Fast-turnaround previews or expedited full-gallery delivery.",
          "Rescheduling, postponement or date-change charges under the contract."
        ],
        paragraphs: [
          "Ask for the likely complete total rather than assuming an unmentioned cost is included. Keep optional album upgrades separate if you have not decided whether to buy them."
        ]
      },
      {
        heading: "Compare photographers like for like",
        table: {
          headers: ["Line to compare", "Question to answer"],
          rows: [
            ["Coverage", "Which hours, locations and parts of the day are included?"],
            ["People", "Who attends, and is a second photographer included?"],
            ["Gallery", "What is delivered, in what format and on what timescale?"],
            ["Reliability", "What backup equipment, file protection and illness plan are in place?"],
            ["Rights and privacy", "What may you do with the images, and may the photographer publish them?"],
            ["Complete price", "What are the deposit, balance dates and every likely additional charge?"]
          ]
        },
        paragraphs: [
          "Look at complete galleries from weddings with conditions similar to yours, not only a small selection of highlights. A winter hotel, dark ceremony room and exposed Highland venue test different skills.",
          "In the UK, the photographer will generally be the first copyright owner unless the contract assigns copyright or a legal exception applies. Your contract should clearly explain the personal-use permission you receive and how the photographer may use the images."
        ]
      },
      {
        heading: "Put the confirmed cost into the whole wedding plan",
        paragraphs: [
          "Add the full photography price to the EverAft budget planner, then record the deposit as a payment against that total. Keep the remaining balance and due date visible; a manageable deposit does not make the rest of the commitment disappear.",
          "If a preferred photographer costs more than the planning allowance, decide deliberately whether photography is a priority, another category should change or the package can be adjusted. Avoid increasing the total by accident."
        ]
      }
    ],
    venueLinks: [
      { label: "Browse Scottish wedding photographers", href: "/photographers" },
      { label: "Open the wedding budget planner", href: "/wedding-budget-planner" },
      { label: "Explore Scottish wedding venues", href: "/venues" }
    ],
    faqs: [
      {
        question: "What is the average cost of a wedding photographer in Scotland in 2026?",
        answer:
          "Bridebook's UK average is £1,484. Its 2026 Scotland cost guide suggests a typical Scottish figure around £1,560, but individual quotes vary substantially with hours, experience, travel, a second photographer and deliverables."
      },
      {
        question: "How much should we budget for full-day wedding photography?",
        answer:
          "Bridebook's Scotland guide gives a broad full-day range of roughly £1,400–£2,500. Confirm the exact hours and inclusions before using that range because packages and weddings differ."
      },
      {
        question: "Is a second wedding photographer worth paying for?",
        answer:
          "It can be useful when preparations happen in different places, guest numbers are large, the venue has several spaces or you want simultaneous angles. Ask the lead photographer what a second person would add to your specific timeline."
      },
      {
        question: "Do we own the copyright in our wedding photographs?",
        answer:
          "Not automatically. In the UK, the photographer will generally be the first copyright owner unless copyright is assigned or a legal exception applies. The contract normally gives the couple a licence for agreed personal uses, so read the rights and publication terms carefully."
      }
    ],
    sources: [
      { label: "Bridebook: Wedding photography prices UK (2026)", href: "https://bridebook.com/uk/article/wedding-prices-photography" },
      { label: "Bridebook: Average wedding cost in Scotland (2026)", href: "https://bridebook.com/uk/article/average-wedding-cost-scotland" },
      { label: "Bridebook: UK Wedding Report 2026", href: "https://partners.bridebook.com/uk/wedding-report-2026" },
      { label: "UK Intellectual Property Office: copyright in digital images and photographs", href: "https://www.gov.uk/government/publications/copyright-notice-digital-images-photographs-and-the-internet/copyright-notice-digital-images-photographs-and-the-internet" }
    ]
  },
  {
    "slug": "how-to-choose-wedding-photographer-scotland",
    "title": "How to choose a wedding photographer in Scotland",
    "shortTitle": "Choosing a Scottish photographer",
    "description": "A practical framework for comparing wedding photographers by style, complete galleries, reliability, coverage and fit—not just price or Instagram highlights.",
    "category": "Photography",
    "publishedAt": "2026-07-21",
    "updatedAt": "2026-07-21",
    "readMinutes": 9,
    "answer": "Choose the photographer whose complete galleries consistently match the feeling, lighting and pace of your wedding. Then confirm the named person, coverage, deliverables, backup plan, rights and complete price in writing.",
    "intro": [
      "Great wedding photography is not one look. The right choice is the photographer whose way of seeing people and moments fits the day you want—and whose process makes you feel comfortable.",
      "A polished social feed can start a shortlist, but it cannot show how someone covers a full ceremony, difficult light, family groups, rain, dinner and a fast-moving dance floor. The decision needs stronger evidence."
    ],
    "takeaways": [
      "Decide the feeling and coverage you want before comparing names.",
      "Ask to see complete galleries from weddings with similar conditions.",
      "Confirm the person, process, safeguards and deliverables in the contract."
    ],
    "sections": [
      {
        "heading": "Start with how you want the photographs to feel",
        "paragraphs": [
          "Use words about the result rather than labels alone: relaxed, energetic, elegant, cinematic, colourful, quiet or candid. Most photographers blend approaches, so two people using the word 'documentary' may still produce very different work."
        ],
        "bullets": [
          "Notice whether you prefer natural moments or more direction.",
          "Decide how important portraits, groups, details and the dance floor are.",
          "Think about whether true-to-life, warm, dark, bright or film-inspired editing will age well for you."
        ]
      },
      {
        "heading": "Look beyond the highlight reel",
        "paragraphs": [
          "Request two or three complete delivered galleries, ideally from a similar season or venue. Look for consistency from preparations to evening rather than judging only the strongest twenty images."
        ],
        "bullets": [
          "Are indoor and low-light photographs as confident as outdoor portraits?",
          "Are skin tones and colours consistent across changing light?",
          "Do family groups look organised without taking over the day?",
          "Are ordinary transitions and guest reactions covered well?",
          "Would you be happy if your gallery looked like the whole set, not only its best image?"
        ]
      },
      {
        "heading": "Match experience to your actual conditions",
        "paragraphs": [
          "A December hotel, an exposed island ceremony and a bright summer marquee create different challenges. Relevant experience is more useful than a raw number of weddings."
        ],
        "bullets": [
          "Ask for examples from rain, winter darkness or mixed indoor and outdoor light.",
          "Check how travel, ferries and overnight stays are planned for rural or island dates.",
          "Ask how the photographer works with venue restrictions, celebrants and videographers."
        ]
      },
      {
        "heading": "Compare the person as well as the pictures",
        "paragraphs": [
          "You will spend a large part of the wedding day near the photographer. A call or meeting should leave you feeling understood rather than performed. Ask who will actually attend if the business uses associates."
        ],
        "bullets": [
          "Do they listen to priorities and explain trade-offs clearly?",
          "Can they direct groups without making the day feel like a shoot?",
          "Do reviews mention communication, calmness and delivery as well as image quality?"
        ]
      },
      {
        "heading": "Confirm the complete service",
        "table": {
          "headers": [
            "Area",
            "Confirm before booking"
          ],
          "rows": [
            [
              "Coverage",
              "Start and finish, locations, breaks and overtime"
            ],
            [
              "People",
              "Named lead, second photographer and any assistant"
            ],
            [
              "Delivery",
              "Estimated image range, previews, gallery and turnaround"
            ],
            [
              "Reliability",
              "Backup cameras, file copies and illness contingency"
            ],
            [
              "Rights",
              "Your personal-use licence and their publication permissions"
            ],
            [
              "Price",
              "Deposit, balance, travel, albums and likely extras"
            ]
          ]
        },
        "paragraphs": [
          "Compare the complete service with the price guide separately. A cheaper quote is not better value if it omits the hours, travel or safeguards you need."
        ]
      },
      {
        "heading": "Build a shortlist you can explain",
        "paragraphs": [
          "Save three to five photographers whose full work fits the brief. Record one reason for each choice, then compare availability, complete price and contract terms. If you cannot explain why someone is on the shortlist beyond 'beautiful', keep looking."
        ]
      }
    ],
    "venueLinks": [
      {
        "label": "Browse Scottish wedding photographers",
        "href": "/photographers"
      },
      {
        "label": "Read the 2026 photographer cost guide",
        "href": "/guides/wedding-photographer-cost-scotland-2026"
      },
      {
        "label": "Open the wedding budget planner",
        "href": "/wedding-budget-planner"
      }
    ],
    "faqs": [
      {
        "question": "How many wedding photographers should we contact?",
        "answer": "A focused shortlist of three to five is usually easier to compare than a long enquiry list. Check each one's availability, full galleries, complete quote and contract before deciding."
      },
      {
        "question": "Should our photographer have worked at our venue before?",
        "answer": "It can help, but it is not essential. Strong photographers can assess light and logistics in advance; ask how they prepare for an unfamiliar venue and request relevant work from similar conditions."
      },
      {
        "question": "Is photography style more important than experience?",
        "answer": "Both matter. Style determines whether you love the result, while relevant experience and reliable systems help the photographer produce it consistently under real wedding-day conditions."
      }
    ],
    "sources": [
      {
        "label": "Bridebook: An introduction to wedding photography styles",
        "href": "https://bridebook.com/uk/article/introduction-different-styles-of-wedding-photography"
      },
      {
        "label": "UK Intellectual Property Office: copyright in digital images and photographs",
        "href": "https://www.gov.uk/government/publications/copyright-notice-digital-images-photographs-and-the-internet/copyright-notice-digital-images-photographs-and-the-internet"
      }
    ]
  },
  {
    "slug": "questions-to-ask-wedding-photographer-before-booking",
    "title": "Questions to ask a wedding photographer before booking",
    "shortTitle": "Questions for your photographer",
    "description": "The essential questions to ask about galleries, coverage, backups, delivery, copyright, privacy and the complete cost before signing a photography contract.",
    "category": "Photography",
    "publishedAt": "2026-07-21",
    "updatedAt": "2026-07-21",
    "readMinutes": 9,
    "answer": "Before booking, confirm who will photograph the day, see complete relevant galleries, define the coverage and deliverables, understand backup and illness plans, and put the total price, rights, privacy choices and cancellation terms in writing.",
    "intro": [
      "A good conversation tells you whether a photographer understands the wedding. A good contract tells you what happens after that conversation.",
      "Use these questions with every shortlisted photographer. The answers become much easier to compare when the brief is the same."
    ],
    "takeaways": [
      "Ask for evidence from complete, comparable weddings.",
      "Put coverage, delivery, backup, privacy and money in writing.",
      "A photography booking normally gives you a licence to use images—not automatic ownership of copyright."
    ],
    "sections": [
      {
        "heading": "Availability and who attends",
        "bullets": [
          "Are you personally available for our date?",
          "Will you be the lead photographer named in the contract?",
          "Do you use associates, assistants or a second photographer?",
          "How many weddings do you cover that week or weekend?",
          "What happens if you are ill or unable to attend?"
        ]
      },
      {
        "heading": "Experience and complete galleries",
        "bullets": [
          "Can we see two or three complete galleries, not only highlights?",
          "Can we see a wedding from a similar venue, season, guest count or lighting situation?",
          "How do you handle rain, dark rooms and winter ceremonies?",
          "How do you organise family photographs efficiently?",
          "How much direction do you give during portraits and natural moments?"
        ]
      },
      {
        "heading": "Coverage and coordination",
        "bullets": [
          "What exact time does coverage begin and end?",
          "Which locations and parts of the day are included?",
          "What does additional time cost and who can approve it on the day?",
          "Would a second photographer add value for our timings or guest count?",
          "Will you coordinate with the venue, celebrant and videographer?"
        ]
      },
      {
        "heading": "What we receive",
        "bullets": [
          "What is the expected range of finished images?",
          "Are all delivered photographs individually edited?",
          "Will we receive previews, and when?",
          "What is the estimated full-gallery delivery window?",
          "How long will the online gallery remain available?",
          "What resolution and download permissions are included?",
          "Which albums, prints or engagement sessions cost extra?"
        ]
      },
      {
        "heading": "Backups, rights and privacy",
        "bullets": [
          "What backup cameras and lenses do you bring?",
          "How are image files backed up during and after the wedding?",
          "What personal-use licence do we receive?",
          "May we print and share the images, and are there restrictions?",
          "May you publish our images on your website, awards or social media?",
          "Can particular guests or images be excluded from publication?",
          "How are galleries protected and shared?"
        ]
      },
      {
        "heading": "Money and contract terms",
        "table": {
          "headers": [
            "Ask about",
            "What to pin down"
          ],
          "rows": [
            [
              "Total",
              "Coverage, VAT where applicable and every included deliverable"
            ],
            [
              "Extras",
              "Travel, accommodation, parking, overtime and albums"
            ],
            [
              "Payments",
              "Deposit, instalments, final balance and payment method"
            ],
            [
              "Changes",
              "Postponement, date changes and reduced coverage"
            ],
            [
              "Cancellation",
              "What each party may cancel and the financial result"
            ],
            [
              "Delivery",
              "Estimated timescale and remedy if it is materially delayed"
            ]
          ]
        },
        "paragraphs": [
          "Read the final contract and package description together. Any answer that matters to your decision should appear in the documents, not only in messages."
        ]
      },
      {
        "heading": "Understand copyright without turning it into a fight",
        "paragraphs": [
          "In the UK, the photographer is generally the first owner of copyright unless copyright is assigned or an exception applies. Paying for the service does not by itself transfer copyright. What most couples need is a clear licence to download, share and print their photographs for personal use, alongside an agreed privacy position."
        ]
      }
    ],
    "venueLinks": [
      {
        "label": "Browse Scottish wedding photographers",
        "href": "/photographers"
      },
      {
        "label": "How to choose your photographer",
        "href": "/guides/how-to-choose-wedding-photographer-scotland"
      },
      {
        "label": "Compare photography costs",
        "href": "/guides/wedding-photographer-cost-scotland-2026"
      }
    ],
    "faqs": [
      {
        "question": "Do wedding photographers own the copyright?",
        "answer": "In the UK, the photographer will generally be the first copyright owner unless the contract assigns copyright or a legal exception applies. Your contract should state what personal uses are licensed to you."
      },
      {
        "question": "Should we ask for unedited RAW files?",
        "answer": "Most photographers do not include RAW files because the edit is part of the finished work. Ask what will be delivered and judge complete edited galleries before booking."
      },
      {
        "question": "What if our photographer becomes ill?",
        "answer": "Ask for the written contingency: whether they use a trusted replacement network, who chooses the substitute, what standards apply and what happens financially if coverage cannot be provided."
      }
    ],
    "sources": [
      {
        "label": "UK Intellectual Property Office: copyright in digital images and photographs",
        "href": "https://www.gov.uk/government/publications/copyright-notice-digital-images-photographs-and-the-internet/copyright-notice-digital-images-photographs-and-the-internet"
      },
      {
        "label": "UK Intellectual Property Office: copyright notice for digital images",
        "href": "https://assets.publishing.service.gov.uk/media/5a7eaf0ae5274a2e87db13f3/c-notice-201402.pdf"
      }
    ]
  },
  {
    "slug": "how-to-get-legally-married-in-scotland",
    "title": "How to get legally married in Scotland: notice, forms and ceremonies",
    "shortTitle": "Getting legally married in Scotland",
    "description": "A clear guide to Scottish marriage notice forms, registrar timing, ceremony choices, witnesses and the Marriage Schedule, checked against current NRS guidance.",
    "category": "Legal & ceremonies",
    "publishedAt": "2026-07-21",
    "updatedAt": "2026-07-21",
    "readMinutes": 10,
    "answer": "Both people must independently submit marriage notice forms and the required documents to the registrar for the district where the ceremony will take place. The registrar must receive complete notices at least 29 days beforehand; NRS says 10–12 weeks is helpful. Confirm the current process with that registrar.",
    "intro": [
      "The legal process sits beside the celebration. Booking a venue or registrar does not by itself give legal notice, and each person must complete their own part of the paperwork.",
      "This guide reflects National Records of Scotland guidance available on 21 July 2026. Requirements can depend on nationality, previous relationships and documents, so the local registrar remains the authority for your case."
    ],
    "takeaways": [
      "Contact the registrar for the ceremony district early.",
      "Both parties give notice; the minimum is 29 days and 10–12 weeks is helpful.",
      "Confirm documents, fees and the Marriage Schedule process directly with the registrar."
    ],
    "sections": [
      {
        "heading": "Choose the ceremony and the person conducting it",
        "paragraphs": [
          "In Scotland, a marriage may be civil, religious or belief. For a civil ceremony, plan with the registrar. For a religious or belief ceremony, contact the celebrant and check with the local registrar that they are authorised."
        ],
        "bullets": [
          "Agree the place, date and time with the registrar or celebrant.",
          "Confirm availability before treating the ceremony as booked.",
          "Remember that booking a registrar is separate from submitting legal notice."
        ]
      },
      {
        "heading": "Send notice to the correct registrar",
        "paragraphs": [
          "Both parties must independently complete and sign the relevant notice. Submit it with the required documents to the registrar in the local authority district where the ceremony will happen—not simply where you live."
        ],
        "bullets": [
          "The registrar must receive complete notices at least 29 days before the ceremony.",
          "NRS says submitting 10–12 weeks in advance is helpful for checking.",
          "Ask the office for its submission method, appointment needs and current fees.",
          "Do not leave the minimum date as your planning target; incomplete documents can cause delay."
        ]
      },
      {
        "heading": "Gather documents for your circumstances",
        "paragraphs": [
          "The registrar will explain the current list. It commonly relates to identity, birth, residence, nationality and marital or civil-partnership status. Divorce, dissolution, widowhood or documents issued abroad can add requirements."
        ],
        "bullets": [
          "Use the current NRS forms and guidance, not an old downloaded copy.",
          "Check whether original documents, certified translations or additional declarations are required.",
          "If either person is not a UK national, ask early about immigration-status and declaration requirements.",
          "Do not post valuable originals until the registrar confirms how the office accepts them."
        ]
      },
      {
        "heading": "Arrange two witnesses",
        "paragraphs": [
          "Every Scottish marriage ceremony requires two witnesses aged 16 or over. Give their details in the format and by the deadline the registrar requests. Ask before the day if a witness may need language or access support."
        ]
      },
      {
        "heading": "Understand the Marriage Schedule",
        "paragraphs": [
          "The Marriage Schedule is the document that allows the marriage to proceed and be registered. The collection and return process differs between civil and religious or belief ceremonies, so follow the registrar's instructions exactly.",
          "Ask who collects it, when it can be collected, who returns it after the ceremony and the deadline. Do not assume the couple always handles it."
        ]
      },
      {
        "heading": "Use one legal-paperwork checkpoint",
        "table": {
          "headers": [
            "When",
            "Check"
          ],
          "rows": [
            [
              "Before booking",
              "Ceremony type, authorised person and district"
            ],
            [
              "10–12 weeks or earlier",
              "Forms, documents, fees and submission method"
            ],
            [
              "After notice",
              "Any registrar queries and outstanding evidence"
            ],
            [
              "Before the ceremony",
              "Witness details and Marriage Schedule arrangements"
            ],
            [
              "After the ceremony",
              "Who returns the Schedule and how to order certificates"
            ]
          ]
        }
      },
      {
        "heading": "Recheck before relying on this guide",
        "paragraphs": [
          "NRS launched a consultation on registration fees in July 2026, so this article deliberately does not quote a fixed fee. Follow the current NRS page and your local registrar's written instructions. This is practical information, not individual legal or immigration advice."
        ]
      }
    ],
    "venueLinks": [
      {
        "label": "Read current NRS marriage guidance",
        "href": "https://www.nrscotland.gov.uk/registration/registering-a-marriage-or-civil-partnership/"
      },
      {
        "label": "Browse Scottish wedding venues",
        "href": "/venues"
      },
      {
        "label": "Plan an outdoor Scottish wedding",
        "href": "/guides/outdoor-weddings-scotland"
      }
    ],
    "faqs": [
      {
        "question": "How much notice do you need to get married in Scotland?",
        "answer": "The registrar must receive complete notices at least 29 days before the ceremony. NRS says 10–12 weeks in advance is helpful. Ask the registrar for your ceremony district because incomplete or complex cases can take longer."
      },
      {
        "question": "Can we get legally married outdoors in Scotland?",
        "answer": "Yes. NRS says ceremonies may take place at an indoor or outdoor location as long as it is accessible to the chosen registrar or authorised celebrant and they agree to the arrangements."
      },
      {
        "question": "How many witnesses do we need?",
        "answer": "Two witnesses aged 16 or over are required for all types of Scottish marriage ceremony."
      },
      {
        "question": "Is booking the registrar the same as giving notice?",
        "answer": "No. NRS explicitly treats them as separate steps. Both parties must still submit the required notice forms and documents."
      }
    ],
    "sources": [
      {
        "label": "National Records of Scotland: registering a marriage or civil partnership",
        "href": "https://www.nrscotland.gov.uk/registration/registering-a-marriage-or-civil-partnership/"
      },
      {
        "label": "National Records of Scotland: making arrangements",
        "href": "https://www.nrscotland.gov.uk/registration/making-arrangements-for-a-marriage-or-civil-partnership/"
      },
      {
        "label": "National Records of Scotland: what your ceremony must include",
        "href": "https://www.nrscotland.gov.uk/registration/what-your-ceremony-must-include/"
      }
    ]
  },
  {
    "slug": "best-month-to-get-married-scotland",
    "title": "What is the best month to get married in Scotland?",
    "shortTitle": "The best month in Scotland",
    "description": "A month-by-month way to choose a Scottish wedding date using daylight, climate averages, demand, venue setting and a realistic weather plan.",
    "category": "Seasons & outdoors",
    "publishedAt": "2026-07-21",
    "updatedAt": "2026-07-21",
    "readMinutes": 9,
    "answer": "There is no single best month. May and June offer long days and comparatively strong sunshine totals in Scotland's 1991–2020 averages; summer brings the mildest temperatures and strong demand; autumn adds colour; winter can improve availability but limits daylight. The best choice matches your place, priorities and Plan B.",
    "intro": [
      "A Scottish date is a bundle of trade-offs, not a weather guarantee. Long summer evenings do not promise a dry ceremony, and a winter date can be beautiful when the timeline is designed around darkness.",
      "Use long-term climate averages to compare seasons, then use the exact venue's location, access and indoor spaces to make the decision."
    ],
    "takeaways": [
      "Choose for the setting and usable daylight—not a promise of sunshine.",
      "National averages hide major east, west, Highland and island differences.",
      "Ask venues to show the weather plan with your real guest count."
    ],
    "sections": [
      {
        "heading": "A quick month-by-month view",
        "table": {
          "headers": [
            "Months",
            "Typical planning advantage",
            "Main trade-off"
          ],
          "rows": [
            [
              "January–February",
              "Atmosphere, winter styling and possible date flexibility",
              "Short days, frost and travel disruption"
            ],
            [
              "March–April",
              "Increasing daylight and early-season availability",
              "Cool, changeable conditions"
            ],
            [
              "May–June",
              "Very long days; May has Scotland's highest average sunshine total",
              "High demand and no guarantee of dry weather"
            ],
            [
              "July–August",
              "Highest average temperatures and long evenings",
              "Popular dates; rain and midges remain possible"
            ],
            [
              "September–October",
              "Autumn colour and softer light",
              "Days shorten quickly and rain exposure rises"
            ],
            [
              "November–December",
              "Candlelight, festive settings and indoor focus",
              "Least daylight and greater cold/travel risk"
            ]
          ]
        }
      },
      {
        "heading": "What the long-term averages actually say",
        "paragraphs": [
          "Met Office 1991–2020 Scotland averages show the highest average maximum temperatures in July and August. May records the highest average monthly sunshine total, while April to June have lower average rainfall totals than the autumn and winter months at Scotland-wide level.",
          "These are broad climate averages, not forecasts. A west-coast estate, Edinburgh hotel and island beach can behave very differently on the same date."
        ]
      },
      {
        "heading": "Spring: more light, more uncertainty",
        "paragraphs": [
          "March and April gain daylight quickly. May combines very long evenings with strong historical sunshine totals. Temperatures can still feel cool, particularly in shade, exposed locations and after sunset."
        ],
        "bullets": [
          "Ask when heating is normally switched off.",
          "Plan layers and sheltered photographs.",
          "Check when gardens, trees and local seasonal colour usually appear."
        ]
      },
      {
        "heading": "Summer: long days, strong demand",
        "paragraphs": [
          "June offers the longest usable evenings; July and August have the highest average temperatures. None is reliably dry, and exposed or western locations still need a serious indoor plan."
        ],
        "bullets": [
          "Check date and accommodation demand before committing.",
          "Ask about ventilation, shade and water for warm indoor spaces.",
          "Discuss midges with Highland, lochside and woodland venues.",
          "Confirm how late outdoor music and photographs may continue."
        ]
      },
      {
        "heading": "Autumn and winter: design around the light",
        "paragraphs": [
          "Autumn colour is location-specific and can be brief. From October, usable daylight falls sharply. Winter photographs, travel and outdoor transitions need deliberate timing rather than being squeezed into a summer-shaped schedule."
        ],
        "bullets": [
          "Ask the photographer for a light-based ceremony recommendation.",
          "Keep travel margins for dark, wet or icy roads.",
          "Check heating, cloakroom space, paths and external lighting.",
          "Make the indoor version feel intentional rather than secondary."
        ]
      },
      {
        "heading": "Choose the month by asking five questions",
        "bullets": [
          "What setting do we want to see in the photographs?",
          "How much daylight does the ceremony time leave?",
          "Can every important part work indoors at full guest count?",
          "How exposed are the venue, roads and transport connections?",
          "What does date flexibility change in the complete quote?"
        ]
      }
    ],
    "venueLinks": [
      {
        "label": "Browse Scottish wedding venues",
        "href": "/venues"
      },
      {
        "label": "Explore outdoor wedding planning",
        "href": "/guides/outdoor-weddings-scotland"
      },
      {
        "label": "Compare Edinburgh venues",
        "href": "/wedding-venues/edinburgh"
      },
      {
        "label": "Explore Perthshire venues",
        "href": "/wedding-venues/perthshire"
      }
    ],
    "faqs": [
      {
        "question": "What is the driest month for a Scottish wedding?",
        "answer": "Scotland-wide 1991–2020 averages show May with the lowest monthly rainfall total, closely followed by June and April. That does not predict a particular day, and local west, east, Highland and island patterns differ."
      },
      {
        "question": "Which month has the most sunshine in Scotland?",
        "answer": "In the Met Office's Scotland-wide 1991–2020 averages, May has the highest monthly sunshine total. June has longer days but a lower average sunshine total in that dataset."
      },
      {
        "question": "Is a winter wedding cheaper in Scotland?",
        "answer": "Some venues and suppliers offer more flexibility outside peak dates, but it is not automatic. Price the full version, including heating, lighting, transport and accommodation, before comparing."
      }
    ],
    "sources": [
      {
        "label": "Met Office: location-specific long-term averages",
        "href": "https://www.metoffice.gov.uk/research/climate/maps-and-data/location-specific-long-term-averages"
      },
      {
        "label": "Met Office: UK regional climates",
        "href": "https://www.metoffice.gov.uk/research/climate/maps-and-data/regional-climates"
      },
      {
        "label": "Met Office: UK climate averages",
        "href": "https://www.metoffice.gov.uk/research/climate/maps-and-data/uk-climate-averages"
      }
    ]
  },
  {
    "slug": "do-you-need-wedding-insurance-uk",
    "title": "Do you need wedding insurance? What UK couples should check",
    "shortTitle": "Do you need wedding insurance?",
    "description": "What wedding insurance may cover, common exclusions, policy limits and how it differs from supplier contracts and card protection.",
    "category": "Costs",
    "publishedAt": "2026-07-21",
    "updatedAt": "2026-07-21",
    "readMinutes": 9,
    "answer": "Wedding insurance is not compulsory, but it may be useful if cancellation, postponement or supplier failure would create a loss you could not comfortably absorb. Cover varies: compare the policy wording, limits and exclusions against your actual bookings before buying.",
    "intro": [
      "Insurance is easiest to assess before deposits become large. The useful question is not whether weddings generally need cover; it is what you stand to lose under your own contracts and whether a policy would respond to those circumstances.",
      "This is general information, not a recommendation for a particular policy. Read the current wording and ask the insurer about anything unclear."
    ],
    "takeaways": [
      "Match cover limits to the real value and timing of your bookings.",
      "A policy does not replace contracts, careful payments or written evidence.",
      "Known problems, change of mind and unlisted circumstances may be excluded."
    ],
    "sections": [
      {
        "heading": "What wedding insurance is designed to do",
        "paragraphs": [
          "MoneyHelper describes wedding insurance as protection against certain financial losses when problems affect the event. Policies and tiers vary, but may include cancellation or rearrangement for insured reasons, venue or supplier problems, and loss or damage to specified wedding items."
        ]
      },
      {
        "heading": "Common areas to compare",
        "bullets": [
          "Cancellation or postponement: which reasons are insured and what evidence is needed?",
          "Venue and supplier failure: which insolvency or non-performance situations count?",
          "Attire, rings, gifts, cake and flowers: what are the total and single-item limits?",
          "Photography: is non-appearance or loss of original media addressed?",
          "Public liability: is it included, optional or required by the venue?",
          "Overseas elements: are they covered or excluded?"
        ]
      },
      {
        "heading": "Read the exclusions before the benefits",
        "bullets": [
          "Change of mind or a voluntary change of venue or date.",
          "A circumstance already known when the policy was bought.",
          "Medical conditions outside the policy's declaration rules.",
          "Weather that is disappointing but does not meet the policy trigger.",
          "Items left unattended or stored contrary to the wording.",
          "Costs above a category, single-item or total limit.",
          "Honeymoon losses that belong under separate travel insurance."
        ]
      },
      {
        "heading": "Work from the contracts you already have",
        "paragraphs": [
          "List every non-refundable amount and the dates at which more money becomes committed. Read what happens if you cancel, the supplier cancels, the date moves or the service changes. Insurance can cover some losses, but it does not rewrite those contracts."
        ],
        "table": {
          "headers": [
            "Evidence to keep",
            "Why"
          ],
          "rows": [
            [
              "Signed contracts",
              "Shows the service, dates and cancellation terms"
            ],
            [
              "Invoices and receipts",
              "Proves the amount and payment"
            ],
            [
              "Written correspondence",
              "Records changes and attempts to resolve the issue"
            ],
            [
              "Policy schedule and wording",
              "Shows the cover bought and limits"
            ],
            [
              "Guest and supplier details",
              "May support a claim where the wording requires them"
            ]
          ]
        }
      },
      {
        "heading": "Insurance, Section 75 and chargeback are different",
        "paragraphs": [
          "Card protection is not the same as wedding insurance. Section 75 may make a credit provider jointly liable for certain breaches of contract or misrepresentation where the cash price is over £100 and no more than £30,000, subject to the legal conditions. Chargeback is a card-scheme process with different rules and deadlines.",
          "Do not choose a payment method on a slogan alone. Deposits, intermediaries, payment links and the way a booking is structured can affect protection. MoneyHelper's current guidance and your card provider can explain the route for a specific payment."
        ]
      },
      {
        "heading": "A practical decision test",
        "bullets": [
          "How much would we lose if the wedding could not proceed for an insured reason?",
          "Could we absorb that loss without debt or serious hardship?",
          "Do our supplier contracts already allow useful flexibility?",
          "Does the policy cover the risks we care about at adequate limits?",
          "Are we comfortable with the exclusions, excess and evidence requirements?",
          "Are all major items and events within the policy period and territorial limits?"
        ]
      }
    ],
    "venueLinks": [
      {
        "label": "Open the wedding budget planner",
        "href": "/wedding-budget-planner"
      },
      {
        "label": "Review venue cancellation terms",
        "href": "/guides/wedding-venue-deposits-and-cancellation-terms"
      },
      {
        "label": "Compare Scottish wedding venues",
        "href": "/venues"
      }
    ],
    "faqs": [
      {
        "question": "Is wedding insurance legally required in the UK?",
        "answer": "No. MoneyHelper says it is not essential, although a venue may ask for public-liability cover. Whether it is useful depends on your financial exposure, contracts and the policy terms."
      },
      {
        "question": "When should we buy wedding insurance?",
        "answer": "Consider it before or as major bookings begin, then check the policy's purchase window, event period and treatment of existing bookings. A policy will not normally cover a problem already known when you buy it."
      },
      {
        "question": "Does wedding insurance cover changing your mind?",
        "answer": "Normally no. MoneyHelper lists change of mind among typical exclusions. Read the exact policy wording."
      },
      {
        "question": "Does paying by credit card mean we do not need insurance?",
        "answer": "No. Section 75 addresses certain supplier breaches or misrepresentation under specific conditions; it is not broad event-cancellation insurance. The protections can complement each other."
      }
    ],
    "sources": [
      {
        "label": "MoneyHelper: What is wedding insurance?",
        "href": "https://www.moneyhelper.org.uk/en/blog/life-events/what-is-wedding-insurance"
      },
      {
        "label": "MoneyHelper: Section 75 and chargeback explained",
        "href": "https://www.moneyhelper.org.uk/en/everyday-money/credit-and-purchases/section-75-and-chargeback-protection"
      }
    ]
  },
  {
    "slug": "outdoor-weddings-scotland",
    "title": "Outdoor weddings in Scotland: legalities, weather and Plan B",
    "shortTitle": "Outdoor weddings in Scotland",
    "description": "How to plan a legal and comfortable outdoor Scottish wedding, from celebrant approval and notices to wind, rain, access, sound and a genuine Plan B.",
    "category": "Seasons & outdoors",
    "publishedAt": "2026-07-21",
    "updatedAt": "2026-07-21",
    "readMinutes": 9,
    "answer": "A legal Scottish ceremony may take place at an outdoor location if it is accessible to the registrar or authorised celebrant and they agree. The legal notice process still applies. Build an indoor or sheltered version that works for every guest, then set a clear weather decision time.",
    "intro": [
      "Scotland gives couples unusual freedom over ceremony locations. That makes an outdoor wedding possible; it does not make every patch of landscape practical, permitted or safe.",
      "Treat the outdoor version and the backup as two complete layouts. If one only works when guests tolerate rain, mud, cold or inaudible vows, it is not a finished plan."
    ],
    "takeaways": [
      "Agree the location with the registrar or authorised celebrant.",
      "Check land permission, access and supplier logistics separately from legal notice.",
      "Give Plan B equal capacity, comfort and attention."
    ],
    "sections": [
      {
        "heading": "Legal does not mean automatically available",
        "paragraphs": [
          "NRS says ceremonies may take place at any indoor or outdoor location as long as it is accessible to the chosen celebrant or registrar. You still need their agreement, two witnesses and the standard notice process."
        ],
        "bullets": [
          "Confirm the exact spot, not only the estate or postcode.",
          "Ask whether the registrar or celebrant has safety, access or weather conditions.",
          "Secure the landowner's permission and any event permissions.",
          "Check whether amplified sound, structures, vehicles or alcohol need separate consent."
        ]
      },
      {
        "heading": "Design for wind before rain",
        "paragraphs": [
          "Wind affects audibility, hair, clothing, flowers, signage, candles, structures and safe supplier setup. A light shower can be manageable; strong gusts can make a ceremony impractical."
        ],
        "bullets": [
          "Ask the sound supplier for a battery and wind-protected microphone plan.",
          "Use weighted, secured decor and follow structure suppliers' wind limits.",
          "Avoid relying on umbrellas as the only shelter.",
          "Confirm who has authority to move or cancel the outdoor setup for safety."
        ]
      },
      {
        "heading": "Make Plan B a real wedding",
        "bullets": [
          "Seat the full guest count comfortably.",
          "Give everyone a clear view and audible ceremony.",
          "Allow enough turnaround time and staff to move the setup.",
          "Create a photography plan that works without a break in the weather.",
          "Tell suppliers which version they should prepare and by when.",
          "Style the indoor space enough that it does not feel like a penalty."
        ]
      },
      {
        "heading": "Set a weather decision process",
        "table": {
          "headers": [
            "Decision",
            "Name the owner"
          ],
          "rows": [
            [
              "Forecast monitoring",
              "Venue coordinator or named planner"
            ],
            [
              "Safety limits",
              "Venue and structure or production supplier"
            ],
            [
              "Ceremony-location call",
              "Couple plus registrar or celebrant within their rules"
            ],
            [
              "Guest communication",
              "Named wedding-party member or coordinator"
            ],
            [
              "Supplier update",
              "One contact who messages the full team"
            ]
          ]
        },
        "paragraphs": [
          "Set the decision time around supplier setup, not the moment guests sit down. Agree whether the decision is final and what happens if conditions improve later."
        ]
      },
      {
        "heading": "Protect guest comfort and access",
        "bullets": [
          "Provide a firm, step-free route where required; wet grass is not an accessible route.",
          "Check seating stability, accessible toilets and distance from parking.",
          "Plan warmth, shade, water and insect protection for the season.",
          "Give guests honest clothing and footwear information.",
          "Keep blankets and umbrellas dry and easy to collect.",
          "Plan lighting for paths, toilets and transport after dark."
        ]
      },
      {
        "heading": "Cost the outdoor infrastructure",
        "paragraphs": [
          "Add shelter, seating, power, sound, toilets, transport, lighting, flooring, setup labour and removal to the quote. A free outdoor location can cost more to make functional than an equipped venue.",
          "Keep accommodation and travel contingencies visible for island, remote and weather-exposed plans."
        ]
      }
    ],
    "venueLinks": [
      {
        "label": "Browse Scottish wedding venues",
        "href": "/venues"
      },
      {
        "label": "Choose the best month for your wedding",
        "href": "/guides/best-month-to-get-married-scotland"
      },
      {
        "label": "Explore country estate venues",
        "href": "/wedding-venues/country-estates"
      },
      {
        "label": "Plan an accessible wedding",
        "href": "/guides/planning-accessible-wedding-checklist"
      }
    ],
    "faqs": [
      {
        "question": "Can you legally get married anywhere in Scotland?",
        "answer": "NRS says a ceremony may take place at an indoor or outdoor location accessible to the chosen registrar or authorised celebrant. Their agreement, land permission and the full legal notice process are still required."
      },
      {
        "question": "Do we need an indoor backup?",
        "answer": "Even when it is not a legal condition, a workable shelter or indoor option is responsible planning. Confirm what your venue, registrar, celebrant and suppliers require."
      },
      {
        "question": "When should we decide to move the ceremony indoors?",
        "answer": "Agree a deadline based on safe supplier setup and guest communication. The venue, celebrant and structure suppliers may have non-negotiable weather or safety limits."
      }
    ],
    "sources": [
      {
        "label": "National Records of Scotland: making arrangements for a marriage",
        "href": "https://www.nrscotland.gov.uk/registration/making-arrangements-for-a-marriage-or-civil-partnership/"
      },
      {
        "label": "National Records of Scotland: registering a marriage",
        "href": "https://www.nrscotland.gov.uk/registration/registering-a-marriage-or-civil-partnership/"
      },
      {
        "label": "Met Office: location-specific long-term averages",
        "href": "https://www.metoffice.gov.uk/research/climate/maps-and-data/location-specific-long-term-averages"
      }
    ]
  },
  {
    "slug": "wedding-photography-styles-explained",
    "title": "Wedding photography styles explained",
    "shortTitle": "Photography styles explained",
    "description": "Documentary, editorial, fine-art and traditional wedding photography explained—plus how editing, direction and delivery affect the finished gallery.",
    "category": "Photography",
    "publishedAt": "2026-07-21",
    "updatedAt": "2026-07-21",
    "readMinutes": 8,
    "answer": "Style is a combination of what the photographer notices, how much they direct, how they compose and light a scene, and how they edit the final images. Most photographers blend styles, so judge complete galleries rather than choosing from a label.",
    "intro": [
      "Photography labels are useful shorthand until they hide the actual work. 'Documentary' can still include elegant portraits; 'editorial' can still preserve spontaneous moments.",
      "Instead of asking which style is best, ask how you want the day to feel while it is photographed and how you want the full story to look afterwards."
    ],
    "takeaways": [
      "Most photographers mix approaches rather than fitting one label.",
      "Separate shooting approach from editing colour and tone.",
      "Use complete galleries to test whether the style stays consistent all day."
    ],
    "sections": [
      {
        "heading": "The four labels you will see most",
        "table": {
          "headers": [
            "Style",
            "Typical emphasis",
            "Check in a full gallery"
          ],
          "rows": [
            [
              "Documentary or reportage",
              "Unscripted moments and observation",
              "Whether key people and formal needs are still covered"
            ],
            [
              "Editorial",
              "Directed composition, fashion influence and polish",
              "How much portrait time and confidence in posing it needs"
            ],
            [
              "Fine art",
              "Refined details, soft or intentional composition and a cohesive finish",
              "Performance in dark, fast-moving parts of the day"
            ],
            [
              "Traditional or classic",
              "Clear groups, portraits and chronological coverage",
              "Whether candid energy and modern delivery also suit you"
            ]
          ]
        }
      },
      {
        "heading": "Style has four separate parts",
        "bullets": [
          "Observation: which people, gestures and details the photographer notices.",
          "Direction: how often they stage, pose or prompt moments.",
          "Technique: use of natural light, flash, motion, framing and lenses.",
          "Editing: colour, contrast, grain, brightness and consistency."
        ]
      },
      {
        "heading": "Documentary does not mean no planning",
        "paragraphs": [
          "A documentary-led photographer may intervene very little during events, but still plan family groups, portrait time, light and logistics. Ask when they direct and how they prevent important people or moments being missed."
        ]
      },
      {
        "heading": "Editorial does not mean every minute is posed",
        "paragraphs": [
          "Editorial work often uses deliberate composition and confident direction for selected portraits. A skilled photographer may combine that with candid coverage for the rest of the day. Ask how much time the signature images require."
        ]
      },
      {
        "heading": "Editing changes the memory of colour",
        "bullets": [
          "True-to-life editing aims to keep colours recognisable.",
          "Warm editing can shift whites, greens and skin tones toward gold.",
          "Dark or moody editing prioritises atmosphere and contrast.",
          "Light or airy editing favours brightness and softer contrast.",
          "Film-inspired editing may use grain, muted colour or a particular palette."
        ]
      },
      {
        "heading": "Use a gallery test",
        "paragraphs": [
          "Open a complete gallery and choose ten images you would actually print: a wide scene, ceremony, family group, portrait, guest reaction, dark-room image, detail, meal, evening and movement. If the style works across all ten, the label matters less."
        ]
      }
    ],
    "venueLinks": [
      {
        "label": "Browse Scottish wedding photographers",
        "href": "/photographers"
      },
      {
        "label": "How to choose your photographer",
        "href": "/guides/how-to-choose-wedding-photographer-scotland"
      },
      {
        "label": "Questions before booking",
        "href": "/guides/questions-to-ask-wedding-photographer-before-booking"
      }
    ],
    "faqs": [
      {
        "question": "What is documentary wedding photography?",
        "answer": "It prioritises real events and reactions with limited interruption. Photographers vary in how they handle groups and portraits, so check a complete gallery and ask when they direct."
      },
      {
        "question": "Can a photographer combine styles?",
        "answer": "Yes. Many blend documentary coverage with editorial portraits, classic family groups or fine-art details. The balance matters more than the label."
      },
      {
        "question": "How do we know whether an editing style will age well?",
        "answer": "There is no objective answer. Compare several full galleries across seasons and skin tones, then choose a finish you enjoy consistently rather than one striking image."
      }
    ],
    "sources": [
      {
        "label": "Bridebook: An introduction to wedding photography styles",
        "href": "https://bridebook.com/uk/article/introduction-different-styles-of-wedding-photography"
      }
    ]
  },
  {
    "slug": "realistic-wedding-day-timeline",
    "title": "How to build a realistic wedding-day timeline",
    "shortTitle": "Build the wedding-day timeline",
    "description": "A practical wedding-day schedule that starts with fixed times, protects travel and photography buffers, and gives every supplier one dependable version.",
    "category": "Planning",
    "publishedAt": "2026-07-21",
    "updatedAt": "2026-07-21",
    "readMinutes": 9,
    "answer": "Build the timeline from fixed ceremony, meal and venue times. Work backwards for preparation and travel, then add realistic buffers, named owners and supplier-specific detail. Protect guest comfort and avoid scheduling every minute.",
    "intro": [
      "A useful timeline is not a long list of ideal moments. It is a shared map of fixed commitments, movement, setup and decisions.",
      "Start with the times that cannot move. The shape of the rest of the day becomes much clearer once travel, room turnaround and supplier access are visible."
    ],
    "takeaways": [
      "Anchor the plan around fixed venue and ceremony times.",
      "Include travel, setup, room turns and breathing space.",
      "Keep one master version and share only relevant details with guests."
    ],
    "sections": [
      {
        "heading": "Place the immovable anchors",
        "bullets": [
          "Supplier access and venue opening time.",
          "Ceremony start and any registrar or celebrant arrival requirement.",
          "Drinks reception length and photography priorities.",
          "Meal call, service time and speech position.",
          "Room turnaround or evening-guest arrival.",
          "Entertainment setup, first dance, bar close and final departure."
        ]
      },
      {
        "heading": "Work backwards through preparation",
        "paragraphs": [
          "Ask hair, makeup, dressing and photography suppliers how long their work takes for the actual number of people. Put the person getting married near the front of the beauty schedule rather than automatically last, then allow dressing and quiet time before departure."
        ],
        "bullets": [
          "List every person receiving hair or makeup.",
          "Include breaks, touch-ups and equipment pack-down.",
          "Protect time for getting dressed without photography pressure.",
          "Add vehicle loading, difficult fastenings and final checks."
        ]
      },
      {
        "heading": "Calculate travel door to door",
        "paragraphs": [
          "A ten-minute drive is not a ten-minute movement. Add gathering people, stairs, parking, unloading, walking, traffic and weather. Use separate calculations for the couple, guests and suppliers when they travel differently."
        ]
      },
      {
        "heading": "Give photography a priority list, not a fantasy list",
        "bullets": [
          "Choose a manageable set of formal groups and name a helper who knows the guests.",
          "Ask the photographer when light is best for a short portrait window.",
          "Keep drinks and canapés available while groups are photographed.",
          "Plan a rain or darkness alternative before the day.",
          "Do not make the couple miss the entire reception for photographs."
        ]
      },
      {
        "heading": "A flexible example shape",
        "table": {
          "headers": [
            "Stage",
            "Planning allowance"
          ],
          "rows": [
            [
              "Final preparation",
              "Protect 30–45 calm minutes after hair and makeup"
            ],
            [
              "Travel to ceremony",
              "Route time plus parking, walking and a buffer"
            ],
            [
              "Ceremony",
              "Use the registrar or celebrant's confirmed duration"
            ],
            [
              "Reception",
              "Enough time for greetings, refreshments and priority photographs"
            ],
            [
              "Meal and speeches",
              "Use the caterer's service timings, not guesswork"
            ],
            [
              "Evening transition",
              "Allow room turn, band setup and evening arrivals"
            ],
            [
              "Finish",
              "Include transport loading and venue clear-down rules"
            ]
          ]
        },
        "paragraphs": [
          "These are planning principles, not fixed durations. Your suppliers should replace every allowance with the timing for your day."
        ]
      },
      {
        "heading": "Make one person the timeline owner",
        "paragraphs": [
          "The couple should not coordinate supplier arrivals from the ceremony. Give the latest master version to the venue coordinator, planner or a named trusted person, with phone numbers and authority to make small operational decisions.",
          "Freeze guest-facing times earlier than the full working schedule. Guests need arrival, ceremony, meal and transport information—not every photography or setup detail."
        ]
      }
    ],
    "venueLinks": [
      {
        "label": "Open the wedding table planner",
        "href": "/wedding-table-planner"
      },
      {
        "label": "Browse Scottish wedding venues",
        "href": "/venues"
      },
      {
        "label": "Plan day and evening guest lists",
        "href": "/guides/day-guests-vs-evening-guests"
      }
    ],
    "faqs": [
      {
        "question": "How long should a wedding drinks reception be?",
        "answer": "There is no universal duration. Ask the venue, caterer and photographer to agree a length that covers room turnaround, refreshments and priority photographs without leaving guests waiting."
      },
      {
        "question": "Who should manage the timeline on the day?",
        "answer": "Use the venue coordinator, professional planner or one named trusted person. Suppliers should know who can make practical decisions without interrupting the couple."
      },
      {
        "question": "Should guests receive the full timeline?",
        "answer": "Usually no. Share the times they need for arrival, ceremony, food, evening entry and transport. Keep setup and supplier detail in the working schedule."
      }
    ]
  },
  {
    "slug": "day-guests-vs-evening-guests",
    "title": "Day guests vs evening guests: how to build the guest list",
    "shortTitle": "Day guests and evening guests",
    "description": "How to divide day and evening invitations fairly, understand the budget impact, protect venue capacity and communicate each invitation clearly.",
    "category": "Planning",
    "publishedAt": "2026-07-21",
    "updatedAt": "2026-07-21",
    "readMinutes": 8,
    "answer": "Start with ceremony and meal capacity, budget and the people you most want present for the whole day. Use consistent rules for wider circles, price day and evening guests separately, and make every invitation unmistakably clear.",
    "intro": [
      "A two-tier guest list is a practical tool, but it can feel personal to the people on it. The fairest approach is to agree the limits first and apply them consistently.",
      "Do not build an evening list to make the wedding look bigger. Build it because there are people you genuinely want to celebrate with when the later format suits the relationship, venue and budget."
    ],
    "takeaways": [
      "Set capacity and budget before discussing individual names.",
      "Use shared rules across families and friendship groups.",
      "Count evening food, furniture, drinks and transport—not only invitations."
    ],
    "sections": [
      {
        "heading": "Define what each invitation includes",
        "table": {
          "headers": [
            "Day guest",
            "Evening guest"
          ],
          "rows": [
            [
              "Ceremony",
              "Arrives for the evening reception"
            ],
            [
              "Drinks reception",
              "Usually joins after the meal and speeches"
            ],
            [
              "Wedding meal",
              "Evening food if provided"
            ],
            [
              "Speeches and formalities",
              "Entertainment, bar and dancing"
            ],
            [
              "Full-day seating and catering",
              "Evening capacity, service and facilities"
            ]
          ]
        }
      },
      {
        "heading": "Set limits before names",
        "paragraphs": [
          "Ask the venue for comfortable ceremony, meal and evening capacities in the actual layout. Add the total cost per day and evening guest, then agree how many places each tier can hold before either family starts nominating people."
        ]
      },
      {
        "heading": "Build circles together",
        "bullets": [
          "Essential: people you both want present for the whole day.",
          "Close: relatives and friends with an active relationship to you.",
          "Wider: colleagues, neighbours, extended family and newer friendships.",
          "Obligation-only: names included mainly to avoid discomfort."
        ],
        "paragraphs": [
          "Start from the centre, compare both partners' lists and decide exceptions together. A consistent rule can still allow individual judgment, but hidden rules create resentment."
        ]
      },
      {
        "heading": "Handle couples, children and households consistently",
        "bullets": [
          "Decide when partners are named guests rather than generic plus-ones.",
          "Choose a children policy that the venue and family circumstances can support.",
          "Avoid splitting a household between day and evening without a clear reason.",
          "Consider carers and support persons as access requirements, not social extras.",
          "Keep reserve lists private and never imply that someone is waiting for a better guest to decline."
        ]
      },
      {
        "heading": "Price evening guests honestly",
        "paragraphs": [
          "Evening invitations can still affect food, bar staffing, security, furniture, cloakrooms, transport and venue capacity. Ask the venue which charges apply per person and which step up at a threshold.",
          "Add the likely acceptance rate only for forecasting. The safe operational plan must remain within the maximum number invited and the venue's capacity."
        ]
      },
      {
        "heading": "Make invitations impossible to misunderstand",
        "bullets": [
          "Name every invited person.",
          "State whether the invitation is for the ceremony and day, or the evening reception.",
          "Give the correct arrival time and location.",
          "Make children and plus-one wording explicit.",
          "Use separate RSVP questions where meal choices differ.",
          "Do not rely on colour, card size or subtle wording to communicate the tier."
        ]
      }
    ],
    "venueLinks": [
      {
        "label": "Open the wedding table planner",
        "href": "/wedding-table-planner"
      },
      {
        "label": "Build the wedding budget",
        "href": "/wedding-budget-planner"
      },
      {
        "label": "Check venue capacities and layouts",
        "href": "/guides/wedding-venue-capacities-and-layouts"
      }
    ],
    "faqs": [
      {
        "question": "Is it rude to invite someone only to the evening reception?",
        "answer": "Not automatically. Clear wording, a genuine relationship, appropriate notice and consistent choices matter. Avoid making the invitation sound like a last-minute replacement."
      },
      {
        "question": "Do evening guests need food?",
        "answer": "It depends on timing and venue arrangements, but guests arriving for several hours will usually expect refreshments. Confirm quantity, dietary collection and service time with the caterer."
      },
      {
        "question": "Should evening guests be included in the venue capacity?",
        "answer": "Yes. Use the venue's comfortable evening capacity for the actual furniture, bar, entertainment and room layout—not only the legal maximum."
      }
    ]
  },
  {
    "slug": "planning-accessible-wedding-checklist",
    "title": "Planning an accessible wedding: a practical checklist",
    "shortTitle": "Accessible wedding checklist",
    "description": "A practical accessibility checklist covering routes, toilets, seating, communication, sensory needs, food, transport and respectful guest conversations.",
    "category": "Accessibility",
    "publishedAt": "2026-07-21",
    "updatedAt": "2026-07-21",
    "readMinutes": 10,
    "answer": "Ask guests privately what would help them participate, audit the complete journey from arrival to departure, confirm adjustments with each supplier, and communicate accurate access information early. Step-free entrance alone does not make a wedding accessible.",
    "intro": [
      "Accessibility is part of hospitality. It includes mobility, sight, hearing, communication, neurodivergence, chronic illness, fatigue, dietary needs and support from carers or assistance animals.",
      "Plan from real requirements rather than guessing. Disabled people are the experts in what helps them, and suppliers should confirm what they can provide."
    ],
    "takeaways": [
      "Audit the whole guest journey, not only the front door.",
      "Ask privately and record agreed requirements with consent.",
      "Name an access contact and create backups for essential adjustments."
    ],
    "sections": [
      {
        "heading": "Ask the right question early",
        "paragraphs": [
          "Add an optional, private RSVP question such as: 'Is there anything we can arrange to help you attend and enjoy the day?' Give a named contact and another way to reply. Do not ask guests to disclose a diagnosis when a practical requirement is enough."
        ],
        "bullets": [
          "Confirm who may receive or share the information.",
          "Repeat the agreed adjustment back clearly.",
          "Do not promise an adjustment before the venue or supplier confirms it.",
          "Recheck if the location, room or timeline changes."
        ]
      },
      {
        "heading": "Follow the journey from arrival to departure",
        "table": {
          "headers": [
            "Stage",
            "Check"
          ],
          "rows": [
            [
              "Arrival",
              "Accessible parking or drop-off, surface, gradient and entrance"
            ],
            [
              "Ceremony",
              "Step-free route, seating choice, sightline, sound and space"
            ],
            [
              "Reception",
              "Table access, quiet space, toilets and room transitions"
            ],
            [
              "Food and drink",
              "Dietary process, ingredient safety and reachable service"
            ],
            [
              "Evening",
              "Lighting, sound, seating, exits and fatigue breaks"
            ],
            [
              "Departure",
              "Accessible transport, pickup point, lighting and shelter"
            ]
          ]
        }
      },
      {
        "heading": "Check routes and facilities precisely",
        "bullets": [
          "Measure door widths and identify every step, threshold and slope.",
          "Confirm lift dimensions, hours, keys and a failure plan.",
          "Inspect the route in wet weather and after dark.",
          "Place accessible seating among other guests, with companions where requested.",
          "Check accessible toilets remain unlocked and are not used for storage.",
          "Keep cables, furniture and decor out of circulation routes."
        ]
      },
      {
        "heading": "Plan for hearing, sight and communication",
        "bullets": [
          "Ask whether a hearing loop, microphone, captions or interpreter is needed.",
          "Give speakers and readers a microphone; do not rely on projection.",
          "Offer key information in an accessible digital format.",
          "Use clear, high-contrast signs and direct language.",
          "Describe emergency arrangements and identify who can assist.",
          "Confirm that all parties can understand the ceremony language; NRS recognises interpreters where required."
        ]
      },
      {
        "heading": "Make sensory needs part of the production plan",
        "bullets": [
          "Identify a genuinely quiet, low-traffic space with seating.",
          "Share likely sound levels, flashing lights, confetti and surprise performances.",
          "Offer seating away from speakers and busy service routes.",
          "Allow movement and breaks without drawing attention.",
          "Tell the photographer and entertainment team about agreed boundaries.",
          "Avoid scented decor where a guest has identified sensitivity."
        ]
      },
      {
        "heading": "Food, medication and personal support",
        "bullets": [
          "Use a confidential process for allergies and dietary requirements.",
          "Ask the caterer how cross-contamination risks are controlled and communicated.",
          "Provide water and a suitable place for medication where requested.",
          "Include carers, personal assistants and assistance dogs in capacity and meal planning.",
          "Never separate a person from their mobility aid without explicit agreement."
        ]
      },
      {
        "heading": "Know the legal baseline, then plan the good experience",
        "paragraphs": [
          "Service providers have duties under the Equality Act 2010 to anticipate barriers and make reasonable adjustments where disabled people would otherwise face substantial disadvantage. The practical standard for your wedding should still be participation with dignity, choice and accurate information—not merely technical compliance.",
          "Ask the venue to document agreed adjustments and name the staff member responsible on the day."
        ]
      }
    ],
    "venueLinks": [
      {
        "label": "Browse Scottish wedding venues",
        "href": "/venues"
      },
      {
        "label": "Use the venue viewing checklist",
        "href": "/guides/wedding-venue-viewing-checklist"
      },
      {
        "label": "Plan an outdoor wedding",
        "href": "/guides/outdoor-weddings-scotland"
      },
      {
        "label": "Open the wedding table planner",
        "href": "/wedding-table-planner"
      }
    ],
    "faqs": [
      {
        "question": "What makes a wedding venue accessible?",
        "answer": "It depends on the guests. Check the entire journey: transport, surfaces, entrances, rooms, seating, toilets, communication, food, sensory environment and departure. Ask for measurements and real routes rather than a yes-or-no label."
      },
      {
        "question": "How should we ask guests about access needs?",
        "answer": "Use a private, optional question focused on practical support, give a named contact and confirm the agreed arrangement. Share the information only with consent and only where needed."
      },
      {
        "question": "Can a venue charge a disabled guest for a reasonable adjustment?",
        "answer": "Government Equality Act guidance says service providers cannot charge disabled customers for reasonable adjustments. What is reasonable depends on the circumstances; discuss the specific request with the provider."
      }
    ],
    "sources": [
      {
        "label": "GOV.UK: disability quick-start guide for service providers",
        "href": "https://www.gov.uk/government/publications/equality-act-guidance/disability-quick-start-guide-for-service-providers-html"
      },
      {
        "label": "GOV.UK: using communication channels to reach disabled people",
        "href": "https://www.gov.uk/government/publications/inclusive-communication/using-a-range-of-communication-channels-to-reach-disabled-people"
      },
      {
        "label": "National Records of Scotland: what your ceremony must include",
        "href": "https://www.nrscotland.gov.uk/registration/what-your-ceremony-must-include/"
      }
    ]
  },
  {
    "slug": "getting-married-scotland-live-elsewhere",
    "title": "Getting married in Scotland when you live elsewhere",
    "shortTitle": "Getting married here from elsewhere",
    "description": "A practical guide for couples travelling to Scotland: registrar contact, notice forms, overseas documents, immigration checks, ceremony logistics and local planning.",
    "category": "Legal & ceremonies",
    "publishedAt": "2026-07-21",
    "updatedAt": "2026-07-21",
    "readMinutes": 10,
    "answer": "You do not need to live in Scotland to marry there, but both people must give notice to the registrar for the ceremony district and meet the current document and immigration requirements. Contact that office early, especially if documents were issued abroad or either person is not a UK national.",
    "intro": [
      "Planning from another part of the UK or overseas creates two linked projects: the legal Scottish process and the practical movement of people, documents and suppliers.",
      "Start with the registrar for the district where the ceremony will happen. Generic checklists cannot decide whether a foreign document, translation, visa or declaration is acceptable in your circumstances."
    ],
    "takeaways": [
      "Contact the ceremony district's registrar before finalising travel assumptions.",
      "Allow extra time for foreign documents, translations and immigration questions.",
      "Design the venue, supplier and guest plan around realistic Scottish travel."
    ],
    "sections": [
      {
        "heading": "Start with the ceremony district",
        "paragraphs": [
          "The legal notices go to the registrar for the local authority area where the ceremony will take place. Both parties must complete their own notice. Booking the ceremony or venue is not the same as submitting notice."
        ],
        "bullets": [
          "Confirm the exact registration office responsible for the location.",
          "Ask how that office accepts forms, originals and payments.",
          "Check appointment, collection and return arrangements before booking travel.",
          "Keep copies and use tracked, secure methods where the registrar permits posting."
        ]
      },
      {
        "heading": "Build more than the minimum 29 days",
        "paragraphs": [
          "The registrar must receive complete notices at least 29 days before the ceremony, and NRS says 10–12 weeks is helpful. Couples living elsewhere should contact the office earlier because overseas documents, translations, prior marriages or immigration-status checks may add steps."
        ]
      },
      {
        "heading": "Ask about documents before ordering them",
        "bullets": [
          "Current notice forms for each person.",
          "Identity, birth, address and nationality evidence.",
          "Divorce, dissolution or death documents from previous relationships.",
          "Certified translations for documents not in English, where required.",
          "A certificate of no impediment or equivalent if the registrar requests one.",
          "Immigration-status documents and declarations for non-UK nationals.",
          "Any country-specific legalisation or authentication requirement."
        ]
      },
      {
        "heading": "Do not treat immigration advice as a wedding detail",
        "paragraphs": [
          "If either person is subject to UK immigration control, the correct visa or status may be required and the notice process can involve additional referral or evidence. Use official GOV.UK guidance and, where needed, regulated immigration advice. A venue, photographer or celebrant should not be your authority on entry permission."
        ]
      },
      {
        "heading": "Plan the Marriage Schedule handover",
        "paragraphs": [
          "For a religious or belief ceremony, ask who may collect the Marriage Schedule, when and from which office, then who returns it after the ceremony. For a civil ceremony, ask the registrar how it will be handled. Build any in-person requirement into travel and accommodation."
        ]
      },
      {
        "heading": "Make the destination practical for guests",
        "bullets": [
          "Show travel times from the likely airport or railway station, not only mileage.",
          "Check the last public transport and realistic taxi supply.",
          "Hold accessible rooms or nearby accommodation where possible.",
          "Avoid asking guests to change hotel every night of a multi-day plan.",
          "Give international guests a payment and booking timeline.",
          "Keep a weather margin around ferries, flights and Highland roads."
        ]
      },
      {
        "heading": "One cross-border checklist",
        "table": {
          "headers": [
            "Area",
            "Owner"
          ],
          "rows": [
            [
              "Registrar and legal forms",
              "Couple"
            ],
            [
              "Immigration status or visa",
              "Each affected person with official advice"
            ],
            [
              "Celebrant authorisation",
              "Couple, celebrant and registrar"
            ],
            [
              "Document translation or legalisation",
              "Couple following registrar instructions"
            ],
            [
              "Marriage Schedule",
              "Named collector and returner"
            ],
            [
              "Guest travel",
              "Couple or planner"
            ],
            [
              "Supplier travel and accommodation",
              "Each contract, checked by couple"
            ]
          ]
        }
      },
      {
        "heading": "Keep the article open only as a starting point",
        "paragraphs": [
          "NRS updated its marriage guidance in May 2026 and opened a fee consultation in July. Recheck the official pages and the registrar's written instructions before sending documents or paying fees."
        ]
      }
    ],
    "venueLinks": [
      {
        "label": "Read current NRS marriage guidance",
        "href": "https://www.nrscotland.gov.uk/registration/registering-a-marriage-or-civil-partnership/"
      },
      {
        "label": "Browse Scottish wedding venues",
        "href": "/venues"
      },
      {
        "label": "Explore Edinburgh venues",
        "href": "/wedding-venues/edinburgh"
      },
      {
        "label": "Explore castle venues",
        "href": "/wedding-venues/castles"
      }
    ],
    "faqs": [
      {
        "question": "Can you get married in Scotland if you do not live there?",
        "answer": "Yes, subject to the current legal and immigration requirements. Both people must give notice to the registrar for the district where the ceremony will take place."
      },
      {
        "question": "How early should overseas couples contact the registrar?",
        "answer": "As early as practical. The legal minimum for complete notices is 29 days and NRS says 10–12 weeks is helpful, but foreign documents or immigration questions can require more preparation."
      },
      {
        "question": "Do foreign documents need translating?",
        "answer": "The registrar will tell you which documents and translations are acceptable. Ask before commissioning work because certification, legalisation or format requirements can vary."
      },
      {
        "question": "Do we need a marriage visitor visa?",
        "answer": "That depends on nationality, immigration status and plans in the UK. Check current official GOV.UK guidance or regulated immigration advice; do not rely on a general wedding article."
      }
    ],
    "sources": [
      {
        "label": "National Records of Scotland: registering a marriage or civil partnership",
        "href": "https://www.nrscotland.gov.uk/registration/registering-a-marriage-or-civil-partnership/"
      },
      {
        "label": "National Records of Scotland: making arrangements",
        "href": "https://www.nrscotland.gov.uk/registration/making-arrangements-for-a-marriage-or-civil-partnership/"
      },
      {
        "label": "GOV.UK: Marriage Visitor visa",
        "href": "https://www.gov.uk/marriage-visa"
      }
    ]
  }
] as const;

export function getPlanningGuide(slug: string) {
  return planningGuides.find((guide) => guide.slug === slug);
}

export function getRelatedGuides(guide: PlanningGuide, limit = 3) {
  const sameCategory = planningGuides.filter((candidate) => candidate.slug !== guide.slug && candidate.category === guide.category);
  const other = planningGuides.filter((candidate) => candidate.slug !== guide.slug && candidate.category !== guide.category);
  return [...sameCategory, ...other].slice(0, limit);
}
