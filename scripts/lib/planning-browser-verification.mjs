import path from "node:path";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

const browserCandidates = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ],
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ],
};

export function resolvePlanningBrowserConfig({
  env = process.env,
  exists,
  platform = process.platform,
} = {}) {
  const parsedBaseUrl = new URL(
    env.PLANNING_HUB_BROWSER_BASE_URL?.trim() || "http://127.0.0.1:3000",
  );
  if (!["http:", "https:"].includes(parsedBaseUrl.protocol)) {
    throw new Error("PLANNING_HUB_BROWSER_BASE_URL must use HTTP or HTTPS.");
  }
  if (!LOOPBACK_HOSTS.has(parsedBaseUrl.hostname)) {
    throw new Error(
      "Planning Hub browser verification refuses non-local URLs. Run it against a local development or optimized server.",
    );
  }
  if (parsedBaseUrl.username || parsedBaseUrl.password) {
    throw new Error("PLANNING_HUB_BROWSER_BASE_URL must not contain credentials.");
  }

  const browserPath = resolveBrowserExecutable({
    configuredPath: env.PLANNING_HUB_BROWSER_EXECUTABLE,
    exists,
    platform,
  });

  return {
    baseUrl: parsedBaseUrl.origin,
    browserPath,
  };
}

export function resolveBrowserExecutable({
  configuredPath,
  exists,
  platform = process.platform,
}) {
  if (typeof exists !== "function") {
    throw new Error("Browser verification requires an executable existence check.");
  }

  const configured = configuredPath?.trim();
  if (configured) {
    const pathImplementation = platform === "win32" ? path.win32 : path.posix;
    if (!pathImplementation.isAbsolute(configured)) {
      throw new Error("PLANNING_HUB_BROWSER_EXECUTABLE must be an absolute path.");
    }
    const absolute = pathImplementation.normalize(configured);
    if (!exists(absolute)) {
      throw new Error(`PLANNING_HUB_BROWSER_EXECUTABLE does not exist: ${absolute}`);
    }
    return absolute;
  }

  const match = (browserCandidates[platform] ?? []).find((candidate) => exists(candidate));
  if (!match) {
    throw new Error(
      "No supported local Chrome or Edge executable was found. Set PLANNING_HUB_BROWSER_EXECUTABLE explicitly.",
    );
  }
  return match;
}

export function getPlanningBrowserScenarios() {
  const contextQuery = new URLSearchParams({
    context: "plan",
    planDate: "2027-06-12",
    planLocation: "Fife",
    remainingPence: "1700000",
    venueName: "Our village hall",
  });

  const surfaces = [
    {
      expectedText: [
        "Turn venue browsing into your wedding plan.",
        "Find your venue",
        "Venue not listed?",
      ],
      name: "venue",
      path: "/planning-hub",
    },
    {
      expectedText: [
        "Choose photography that fits your real plan.",
        "Venue: Our village hall",
        "Date: 12 Jun 2027",
        "£17,000 remaining overall",
        "From your Wedding Profile.",
        "Using the amount remaining in your connected plan.",
      ],
      name: "photography-context",
      path: `/planning-hub/photography?${contextQuery}`,
    },
    {
      expectedText: [
        "Keep every moving part in one calm place.",
        "Budget & bookings",
        "Payments & deadlines",
        "Help EverAft narrow the choices",
        "Your tasks",
        "Guests & seating",
      ],
      name: "organise",
      path: "/planning-hub/organise",
    },
    {
      expectedText: [
        "Wedding Budget Planner",
        "Set your total budget, add venues and suppliers",
        "Start with your total budget",
        "Use an editable starter budget",
      ],
      name: "public-budget",
      path: "/wedding-budget-planner",
    },
    {
      expectedText: [
        "Wedding table planner",
        "Add your guests, set the relationships that matter",
        "Try an example",
      ],
      name: "public-table",
      path: "/wedding-table-planner",
    },
  ];

  return [
    ...surfaces.map((surface) => ({
      ...surface,
      name: `${surface.name}-mobile`,
      viewport: { height: 844, width: 390 },
    })),
    ...surfaces.map((surface) => ({
      ...surface,
      name: `${surface.name}-desktop`,
      viewport: { height: 900, width: 1440 },
    })),
  ];
}

export function getPlanningBrowserJourney() {
  return {
    expectedPhotographyText: [
      "Choose photography that fits your real plan.",
      "Venue: Browser journey hall",
      "Date: 12 Jun 2027",
      "£25,000 remaining overall",
      "From your Wedding Profile.",
      "Using the amount remaining in your connected plan.",
    ],
    guestCount: "80",
    location: "Fife",
    manualVenueCost: "5000",
    manualVenueName: "Browser journey hall",
    paymentAmount: "1000",
    paymentDueDate: "2027-06-01",
    paymentLabel: "Booking deposit",
    paymentPaid: "500",
    totalBudget: "30000",
    viewport: { height: 844, width: 390 },
    weddingDate: "2027-06-12",
  };
}
