// src/main.tsx
import { createRoot } from "react-dom/client";
import App from "./App";
// FIX: AuthProvider removed from here.
// It now lives inside App.tsx, correctly wrapped inside BrowserRouter,
// so it can use useNavigate() instead of window.location.href.
// Having it here (outside BrowserRouter) was the root cause of the
// infinite reload loop.
import "./index.css";
import "./styles/globals.css";

createRoot(document.getElementById("root")!).render(<App />);