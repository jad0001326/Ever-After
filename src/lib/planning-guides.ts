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
  category: "Costs" | "Choosing a venue" | "Venue practicalities";
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
