import { AuthProvider } from "./contexts/AuthContext";
import { DataProvider } from "./contexts/DataContext";
import { CartProvider } from "./contexts/CartContext";
import LoginScreen from "./components/LoginScreen";
import POSScreen from "./components/POSScreen";
import { useAuth } from "./contexts/AuthContext";

// Simple test to see React error boundaries
function TestComponent() {
  console.log("TestComponent rendering");
  return <div>Test Component Works!</div>;
}

// Main app wrapper
function AppContent() {
  try {
    const { isAuthenticated } = useAuth();

    console.log("AppContent rendering, isAuthenticated:", isAuthenticated);

    if (!isAuthenticated) {
      return <LoginScreen />;
    }

    return <POSScreen />;
  } catch (error) {
    console.error("Error in AppContent:", error);
    return (
      <div style={{ padding: "20px", background: "red", color: "white" }}>
        <h1>Error in AppContent</h1>
        <p>{error?.toString()}</p>
      </div>
    );
  }
}

// Root app with providers
function App() {
  try {
    console.log("App component rendering");

    return (
      <AuthProvider>
        <DataProvider>
          <CartProvider>
            <AppContent />
          </CartProvider>
        </DataProvider>
      </AuthProvider>
    );
  } catch (error) {
    console.error("Error in App:", error);
    return (
      <div style={{ padding: "20px", background: "red", color: "white" }}>
        <h1>Error in App</h1>
        <p>{error?.toString()}</p>
      </div>
    );
  }
}

export default App;
