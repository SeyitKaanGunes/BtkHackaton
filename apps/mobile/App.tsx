import { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, Text, View } from "react-native";
import type {
  BusinessDashboard,
  CollectionScore,
  DashboardSummary,
  SpendingDna,
  SubscriptionLeak,
  WhatIfResponse
} from "@fintwin/shared";
import { loadBusiness, loadMobileHome } from "./src/api";
import { ThemeProvider } from "./src/components/ThemeProvider";
import { ThemeToggle } from "./src/components/ThemeToggle";
import { TabBar, type Tab } from "./src/components/TabBar";
import { HomeScreen } from "./src/screens/HomeScreen";
import { WhatIfScreen } from "./src/screens/WhatIfScreen";
import { AgentScreen } from "./src/screens/AgentScreen";
import { ScanScreen } from "./src/screens/ScanScreen";
import { SubscriptionsScreen } from "./src/screens/SubscriptionsScreen";
import { BusinessScreen } from "./src/screens/BusinessScreen";
import { usePalette } from "./src/theme";

type HomeRoute = "main" | "whatif" | "subs";

export default function App() {
  return (
    <ThemeProvider initial="system">
      <Shell />
    </ThemeProvider>
  );
}

function Shell() {
  const p = usePalette();
  const [tab, setTab] = useState<Tab>("home");
  const [homeRoute, setHomeRoute] = useState<HomeRoute>("main");
  const [home, setHome] = useState<{
    dashboard: DashboardSummary;
    dna: SpendingDna;
    leaks: SubscriptionLeak[];
    simulation: WhatIfResponse;
  } | null>(null);
  const [business, setBusiness] = useState<{ dashboard: BusinessDashboard; scores: CollectionScore[] } | null>(null);

  useEffect(() => {
    void loadMobileHome().then((res) => setHome({ dashboard: res.dashboard, dna: res.dna, leaks: res.leaks, simulation: res.simulation }));
    void loadBusiness().then(setBusiness);
  }, []);

  function changeTab(next: Tab) {
    setTab(next);
    if (next === "home") setHomeRoute("main");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110, gap: 16 }} showsVerticalScrollIndicator={false}>
          <TopBar tabLabel={tab} />

          {tab === "home" &&
            (home ? (
              homeRoute === "main" ? (
                <HomeScreen
                  {...home}
                  onOpenWhatIf={() => setHomeRoute("whatif")}
                  onOpenSubs={() => setHomeRoute("subs")}
                />
              ) : homeRoute === "whatif" ? (
                <WhatIfScreen simulation={home.simulation} onBack={() => setHomeRoute("main")} />
              ) : (
                <SubscriptionsScreen leaks={home.leaks} onBack={() => setHomeRoute("main")} />
              )
            ) : (
              <Loading />
            ))}

          {tab === "agent" && <AgentScreen />}
          {tab === "scan" && (
            <ScanScreen
              onImported={() => {
                void loadMobileHome().then((res) =>
                  setHome({ dashboard: res.dashboard, dna: res.dna, leaks: res.leaks, simulation: res.simulation })
                );
              }}
            />
          )}
          {tab === "business" && (business ? <BusinessScreen {...business} /> : <Loading />)}
        </ScrollView>

        <TabBar active={tab} onChange={changeTab} />
      </View>
    </SafeAreaView>
  );
}

function TopBar({ tabLabel }: { tabLabel: Tab }) {
  const p = usePalette();
  const titles: Record<Tab, string> = {
    home: "Fintwin",
    agent: "Fintwin · Agent",
    scan: "Fintwin · Belge",
    business: "Fintwin · KOBİ"
  };
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            backgroundColor: p.accent,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text style={{ color: p.onAccent, fontWeight: "900", fontSize: 14 }}>F</Text>
        </View>
        <Text style={{ color: p.ink, fontWeight: "900", fontSize: 16 }}>{titles[tabLabel]}</Text>
      </View>
      <ThemeToggle />
    </View>
  );
}

function Loading() {
  const p = usePalette();
  return (
    <View style={{ paddingTop: 80, alignItems: "center", gap: 8 }}>
      <ActivityIndicator color={p.accent} />
      <Text style={{ color: p.muted, fontSize: 12 }}>Demo veri yükleniyor…</Text>
    </View>
  );
}
