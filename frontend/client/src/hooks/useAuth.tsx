// src/hooks/useAuth.tsx
//
// FIX: This file is now a thin re-export of context/AuthProvider.tsx.
//
// Previously this file had its OWN AuthProvider with separate state,
// a separate useEffect, and window.location.href redirects. It was
// mounted in main.tsx OUTSIDE BrowserRouter, so it couldn't use
// useNavigate — causing hard page reloads → infinite reload loop.
//
// Now: ONE AuthProvider in context/AuthProvider.tsx owns all auth state.
// This file just re-exports so all existing imports keep working.

export {
  AuthProvider,
  AuthContext,
  useAuth,
} from "../context/AuthProvider";

export type { AuthUser } from "../context/AuthProvider";