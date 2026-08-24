import { useRouter } from "expo-router";

import { TodayScreen } from "../../src/features/today/TodayScreen";

export default function TodayRoute() {
  const router = useRouter();

  return <TodayScreen onExploreVenues={() => router.push("/discover")} />;
}
