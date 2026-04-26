import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route, Switch } from "wouter";
import { Toaster } from "sonner";
import ChatPage from "./pages/ChatPage";
import SettingsPage from "./pages/SettingsPage";
import CustomizePage from "./pages/CustomizePage";
import NotFound from "./pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5_000, refetchOnWindowFocus: false },
  },
});

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router base={base}>
        <Switch>
          <Route path="/" component={ChatPage} />
          <Route path="/c/:id" component={ChatPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/customize" component={CustomizePage} />
          <Route component={NotFound} />
        </Switch>
      </Router>
      <Toaster theme="dark" position="bottom-right" />
    </QueryClientProvider>
  );
}
