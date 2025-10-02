import React, { useState } from 'react';
import ProductGrid from './ProductGrid';
import CartPanel from './CartPanel';
import OrdersList from './OrdersList';
import { useCart } from '../contexts/CartContext';

const POS: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'products' | 'orders'>('products');
  const {
    state,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    placeOrder,
    updateOrderStatus,
  } = useCart();

  const handleOrderPlaced = () => {
    // Show a success message or notification
    console.log('Order placed successfully!');
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-800">POS System</h1>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('products')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'products'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Products
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'orders'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Orders ({state.orders.length})
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              Cart: {state.items.length} items • ${state.total.toFixed(2)}
            </div>
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Online</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Products or Orders */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            {activeTab === 'products' && (
              <ProductGrid onAddToCart={addToCart} />
            )}

            {activeTab === 'orders' && (
              <OrdersList
                orders={state.orders}
                onUpdateStatus={updateOrderStatus}
              />
            )}
          </div>
        </div>

        {/* Right Panel - Cart (only show on products tab) */}
        {activeTab === 'products' && (
          <div className="w-80 lg:w-96">
            <CartPanel
              items={state.items}
              total={state.total}
              onUpdateQuantity={updateQuantity}
              onRemoveItem={removeFromCart}
              onClearCart={clearCart}
              onPlaceOrder={(customerName, notes) => {
                placeOrder(customerName, notes);
                handleOrderPlaced();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default POS;
