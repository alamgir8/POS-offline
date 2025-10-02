import React, { useState, useEffect } from 'react';
import ProductGridEnhanced from './ProductGridEnhanced';
import CartPanelEnhanced from './CartPanelEnhanced';
import OrdersList from './OrdersList';
import { useCart } from '../contexts/CartContext';

const POSEnhanced: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'products' | 'orders' | 'analytics'
  >('products');
  const [syncStatus, setSyncStatus] = useState<
    'online' | 'offline' | 'syncing'
  >('online');
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const {
    state,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    placeOrder,
    updateOrderStatus,
  } = useCart();

  // Simulate sync status updates
  useEffect(() => {
    const interval = setInterval(() => {
      const statuses: ('online' | 'offline' | 'syncing')[] = [
        'online',
        'syncing',
      ];
      const randomStatus =
        statuses[Math.floor(Math.random() * statuses.length)];
      setSyncStatus(randomStatus);

      if (randomStatus === 'online') {
        setLastSync(new Date());
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return (
          <div className="flex items-center space-x-2 text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Online</span>
          </div>
        );
      case 'syncing':
        return (
          <div className="flex items-center space-x-2 text-yellow-600">
            <svg
              className="w-4 h-4 animate-spin"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span className="text-sm font-medium">Syncing</span>
          </div>
        );
      case 'offline':
        return (
          <div className="flex items-center space-x-2 text-red-600">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-sm font-medium">Offline</span>
          </div>
        );
      default:
        return null;
    }
  };

  const getTabStats = () => {
    const todayOrders = state.orders.filter((order) => {
      const today = new Date();
      const orderDate = new Date(order.timestamp);
      return orderDate.toDateString() === today.toDateString();
    });

    const todayRevenue = todayOrders.reduce(
      (sum, order) => sum + order.total,
      0
    );
    const pendingOrders = state.orders.filter(
      (order) => order.status === 'pending'
    ).length;

    return { todayOrders: todayOrders.length, todayRevenue, pendingOrders };
  };

  const stats = getTabStats();

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Enhanced Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gradient">
                    POS System
                  </h1>
                  <p className="text-sm text-gray-600">
                    Point of Sale Terminal
                  </p>
                </div>
              </div>

              <div className="hidden md:flex bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setActiveTab('products')}
                  className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    activeTab === 'products'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Products
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    activeTab === 'orders'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Orders
                  {state.orders.length > 0 && (
                    <span className="ml-2 badge badge-primary">
                      {state.orders.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-6 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    activeTab === 'analytics'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Analytics
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              {/* Quick Stats */}
              <div className="hidden lg:flex items-center space-x-6 text-sm">
                <div className="text-center">
                  <div className="font-bold text-blue-600">
                    {state.items.length}
                  </div>
                  <div className="text-gray-600">Cart Items</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-green-600">
                    ${state.total.toFixed(2)}
                  </div>
                  <div className="text-gray-600">Cart Total</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-purple-600">
                    {stats.todayOrders}
                  </div>
                  <div className="text-gray-600">Today's Orders</div>
                </div>
              </div>

              {/* Sync Status */}
              {getStatusIcon(syncStatus)}

              {/* Last Sync Time */}
              <div className="text-xs text-gray-500">
                Last sync: {lastSync.toLocaleTimeString()}
              </div>
            </div>
          </div>

          {/* Mobile Tab Navigation */}
          <div className="md:hidden mt-4 flex bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('products')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                activeTab === 'products'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600'
              }`}
            >
              Products
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                activeTab === 'orders'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600'
              }`}
            >
              Orders ({state.orders.length})
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                activeTab === 'analytics'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600'
              }`}
            >
              Analytics
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            {activeTab === 'products' && (
              <ProductGridEnhanced onAddToCart={addToCart} />
            )}

            {activeTab === 'orders' && (
              <OrdersList
                orders={state.orders}
                onUpdateStatus={updateOrderStatus}
              />
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-2xl font-bold text-gradient mb-1">
                    Analytics Dashboard
                  </h2>
                  <p className="text-gray-600">
                    Track your sales performance and insights
                  </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="card p-6 text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-2">
                      {stats.todayOrders}
                    </div>
                    <div className="text-gray-600 mb-1">Today's Orders</div>
                    <div className="text-xs text-green-600">
                      ↗ +12% from yesterday
                    </div>
                  </div>

                  <div className="card p-6 text-center">
                    <div className="text-3xl font-bold text-green-600 mb-2">
                      ${stats.todayRevenue.toFixed(2)}
                    </div>
                    <div className="text-gray-600 mb-1">Today's Revenue</div>
                    <div className="text-xs text-green-600">
                      ↗ +8% from yesterday
                    </div>
                  </div>

                  <div className="card p-6 text-center">
                    <div className="text-3xl font-bold text-yellow-600 mb-2">
                      {stats.pendingOrders}
                    </div>
                    <div className="text-gray-600 mb-1">Pending Orders</div>
                    <div className="text-xs text-yellow-600">⏱ Avg: 15 min</div>
                  </div>

                  <div className="card p-6 text-center">
                    <div className="text-3xl font-bold text-purple-600 mb-2">
                      {state.orders.length}
                    </div>
                    <div className="text-gray-600 mb-1">Total Orders</div>
                    <div className="text-xs text-purple-600">📈 All time</div>
                  </div>
                </div>

                {/* Charts Placeholder */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="card p-6">
                    <h3 className="text-lg font-semibold mb-4">Sales Trend</h3>
                    <div className="h-64 bg-gray-50 rounded-xl flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <svg
                          className="w-12 h-12 mx-auto mb-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                        <p>Chart visualization will be here</p>
                      </div>
                    </div>
                  </div>

                  <div className="card p-6">
                    <h3 className="text-lg font-semibold mb-4">
                      Popular Items
                    </h3>
                    <div className="space-y-3">
                      {[
                        { name: 'Coffee', sales: 45, icon: '☕' },
                        { name: 'Burger', sales: 32, icon: '🍔' },
                        { name: 'Pizza Slice', sales: 28, icon: '🍕' },
                        { name: 'Sandwich', sales: 24, icon: '🥪' },
                        { name: 'Soda', sales: 18, icon: '🥤' },
                      ].map((item) => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl">{item.icon}</span>
                            <span className="font-medium">{item.name}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">
                              {item.sales} sold
                            </span>
                            <div className="w-12 h-2 bg-gray-200 rounded-full">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${(item.sales / 45) * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Cart (only show on products tab) */}
        {activeTab === 'products' && (
          <div className="w-80 lg:w-96">
            <CartPanelEnhanced
              items={state.items}
              total={state.total}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeFromCart}
              onClearCart={clearCart}
              onPlaceOrder={placeOrder}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default POSEnhanced;
