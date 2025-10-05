import { AuthProvider } from "./contexts/AuthContext";
import { DataProvider } from "./contexts/DataContext";
import { CartProvider } from "./contexts/CartContext";
import LoginScreen from "./components/LoginScreen";
import POSScreen from "./components/POSScreen";
import { useAuth } from "./contexts/AuthContext";

// Main app wrapper
function AppContent() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <POSScreen />;
}

// Root app with providers
function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <CartProvider>
          <AppContent />
        </CartProvider>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
