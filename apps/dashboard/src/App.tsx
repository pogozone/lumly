import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import { APP_BASENAME } from "./runtime";
import { FiltersProvider } from "./filters";
import { AcquisitionPage } from "./pages/Acquisition";
import { ContentPage } from "./pages/Content";
import { DevicesPage } from "./pages/Devices";
import { EngagementPage } from "./pages/Engagement";
import { EventsPage } from "./pages/Events";
import { FunnelsPage } from "./pages/Funnels";
import { GeographyPage } from "./pages/Geography";
import { LoginPage } from "./pages/Login";
import { OverviewPage } from "./pages/Overview";
import { PerformancePage } from "./pages/Performance";
import { PrivacyPage } from "./pages/Privacy";
import { RetentionPage } from "./pages/Retention";
import { SitesPage } from "./pages/Sites";
import { TrafficPage } from "./pages/Traffic";

function Shell() {
  const { email, loading } = useAuth();
  if (loading) return <div className="loading">Lade…</div>;
  if (!email) return <LoginPage />;
  return (
    <FiltersProvider>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/traffic" element={<TrafficPage />} />
        <Route path="/content" element={<ContentPage />} />
        <Route path="/acquisition" element={<AcquisitionPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/engagement" element={<EngagementPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/geography" element={<GeographyPage />} />
        <Route path="/performance" element={<PerformancePage />} />
        <Route path="/funnels" element={<FunnelsPage />} />
        <Route path="/retention" element={<RetentionPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/sites" element={<SitesPage />} />
        <Route path="*" element={<OverviewPage />} />
      </Routes>
    </FiltersProvider>
  );
}

export function App() {
  return (
    <BrowserRouter basename={APP_BASENAME}>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </BrowserRouter>
  );
}
