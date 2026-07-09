import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AppLayout } from "@/presentation/components/layout/app-layout"

import { Loader2 } from "lucide-react"

const LoginPage = lazy(() => import("@/presentation/pages/login-page").then((m) => ({ default: m.LoginPage })))
const DashboardPage = lazy(() => import("@/presentation/pages/dashboard-page").then((m) => ({ default: m.DashboardPage })))
const TherapyDetailPage = lazy(() => import("@/presentation/pages/therapy-detail-page").then((m) => ({ default: m.TherapyDetailPage })))
const HistoryPage = lazy(() => import("@/presentation/pages/history-page").then((m) => ({ default: m.HistoryPage })))
const EquivalencesPage = lazy(() => import("@/presentation/pages/equivalences-page").then((m) => ({ default: m.EquivalencesPage })))
const AdminPage = lazy(() => import("@/presentation/pages/admin-page").then((m) => ({ default: m.AdminPage })))
const SignalsPage = lazy(() => import("@/presentation/pages/signals-page").then((m) => ({ default: m.SignalsPage })))
const LiveMonitorPage = lazy(() => import("@/presentation/pages/live-monitor-page").then((m) => ({ default: m.LiveMonitorPage })))
const ProfilePage = lazy(() => import("@/presentation/pages/profile-page").then((m) => ({ default: m.ProfilePage })))
const SettingsPage = lazy(() => import("@/presentation/pages/settings-page").then((m) => ({ default: m.SettingsPage })))
const NotFoundPage = lazy(() => import("@/presentation/pages/not-found-page").then((m) => ({ default: m.NotFoundPage })))

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />

            <Route path="therapy/:id" element={<TherapyDetailPage />} />
            <Route path="history/:id" element={<HistoryPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="equivalences" element={<EquivalencesPage />} />
            <Route path="signals" element={<SignalsPage />} />
            <Route path="live" element={<LiveMonitorPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
