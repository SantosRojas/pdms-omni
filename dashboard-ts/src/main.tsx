import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { useThemeStore } from "@/application/stores/theme-store"
import { useAuthStore } from "@/application/stores/auth-store"
import App from "./App"
import "./index.css"

useThemeStore.getState().init()
useAuthStore.getState().initialize()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
