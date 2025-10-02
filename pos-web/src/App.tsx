import { useState } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import WiFiTestPage from './components/WiFiTestPage';
import { CartProvider } from './contexts/CartContext';
import { NotificationProvider } from './contexts/NotificationContext';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [deviceType, setDeviceType] = useState<'normal' | 'master'>('normal');
  const [tenantId, setTenantId] = useState('');

  const handleLogin = (
    selectedDeviceType: 'normal' | 'master',
    restaurantId: string
  ) => {
    setDeviceType(selectedDeviceType);
    setTenantId(restaurantId);
    setIsAuthenticated(true);

    console.log(
      `✅ Logged in as ${selectedDeviceType} device for restaurant: ${restaurantId}`
    );
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setDeviceType('normal');
    setTenantId('');

    console.log('👋 Logged out');
  };

  // Check for WiFi test mode in URL
  const urlParams = new URLSearchParams(window.location.search);
  const isWiFiTest = urlParams.get('test') === 'wifi';

  if (isWiFiTest) {
    return (
      <NotificationProvider>
        <CartProvider>
          <div className="App">
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4">
              <div className="flex">
                <div>
                  <p className="text-sm">
                    🧪 <strong>WiFi Discovery Test Mode</strong> -
                    <a
                      href="/"
                      className="ml-2 underline hover:text-yellow-800"
                    >
                      Return to normal app
                    </a>
                  </p>
                </div>
              </div>
            </div>
            <WiFiTestPage />
          </div>
        </CartProvider>
      </NotificationProvider>
    );
  }

  console.log('isAuthenticated:', isAuthenticated);
  console.log('deviceType:', deviceType);
  console.log('tenantId:', tenantId);

  return (
    <NotificationProvider>
      <CartProvider>
        <div className="App">
          {!isAuthenticated ? (
            <Login onLogin={handleLogin} />
          ) : (
            <Dashboard
              deviceType={deviceType}
              tenantId={tenantId}
              onLogout={handleLogout}
            />
          )}
        </div>
      </CartProvider>
    </NotificationProvider>
  );
}

export default App;
