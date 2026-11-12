import { LoginView, useAppSession } from "../shared";
import { AppShell } from "./layouts";
import { AppSessionProvider } from "./providers";
import { AppRouter } from "./router";

function AppContent() {
  const { authed, loginError, login } = useAppSession();

  if (!authed) {
    return <LoginView error={loginError} onSubmit={login} />;
  }

  return (
    <AppShell>
      <AppRouter />
    </AppShell>
  );
}

export default function App() {
  return (
    <AppSessionProvider>
      <AppContent />
    </AppSessionProvider>
  );
}

