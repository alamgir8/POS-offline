import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const LoginScreen = () => {
  const { login, isLoading, error } = useAuth();
  const [email, setEmail] = useState("demo");
  const [password, setPassword] = useState("demo");
  const [tenantId, setTenantId] = useState("demo");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password, tenantId);
    } catch (err) {
      // Error is handled by the auth context
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Login to POS</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Type
            </label>
            <select
              value={tenantId}
              onChange={(e) => {
                setTenantId(e.target.value);
                if (e.target.value === "demo") {
                  setEmail("demo");
                  setPassword("demo");
                } else if (e.target.value === "restaurant_demo") {
                  setEmail("admin@restaurant.demo");
                  setPassword("password123");
                } else {
                  setEmail("admin@retail.demo");
                  setPassword("password123");
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="demo">Simple Demo</option>
              <option value="restaurant_demo">Restaurant Demo</option>
              <option value="retail_demo">Retail Demo</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="mt-4 text-sm text-gray-600">
          <p className="font-medium">Demo Accounts:</p>
          <p>Simple: demo / demo</p>
          <p>Restaurant: admin@restaurant.demo / password123</p>
          <p>Retail: admin@retail.demo / password123</p>
          <p>Cashier: cashier@restaurant.demo / cashier123</p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
