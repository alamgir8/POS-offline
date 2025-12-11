import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useCart } from "../contexts/CartContext";

const POSScreen = () => {
  const { user, logout } = useAuth();
  const {
    products,
    orders,
    isLoading,
    createOrder,
    updateOrder,
    pendingKdsTickets,
    pendingBdsTickets,
    completeKdsTicket,
    completeBdsTicket,
    isConnected,
    connectionStatus,
    deviceId: contextDeviceId,
  } = useData();
  const { items, total, addItem, removeItem, updateQuantity, clearCart } =
    useCart();

  const [activeTab, setActiveTab] = useState<"pos" | "orders" | "kds" | "bds">(
    "pos"
  );
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | "food" | "other"
  >("all");
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");

  // Filter products by category
  const filteredProducts = products.filter(
    (product) =>
      selectedCategory === "all" || product.category === selectedCategory
  );

  const handleAddToCart = (product: any) => {
    addItem(product);
  };

  const handleCreateOrder = async () => {
    if (items.length === 0) {
      alert("Please add items to cart before creating order");
      return;
    }

    try {
      const order = {
        tenantId: user?.tenantId || "demo",
        storeId: user?.storeId || "store-1",
        deviceId: contextDeviceId,
        tableNumber: tableNumber || undefined,
        customerName: customerName || undefined,
        items: items.map((item) => ({
          id: `${item.product.id}_${Date.now()}`,
          name: item.product.name,
          price: item.product.price,
          quantity: item.quantity,
          category: item.product.category as "food" | "beverage" | "other",
          notes: "",
        })),
        total,
        tax: total * 0.1, // 10% tax
        subtotal: total - total * 0.1,
        status: "draft" as const,
      };

      await createOrder(order);
      clearCart();
      setTableNumber("");
      setCustomerName("");
      alert("Order created successfully!");
    } catch (error) {
      alert("Failed to create order: " + (error as Error).message);
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await updateOrder(orderId, { status: newStatus as any });
    } catch (error) {
      alert("Failed to update order status: " + (error as Error).message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#f59e0b";
      case "preparing":
        return "#3b82f6";
      case "ready":
        return "#10b981";
      case "completed":
        return "#6b7280";
      case "cancelled":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">POS System</h1>
              <p className="text-sm text-gray-600">Welcome, {user?.userName}</p>
            </div>
            <div className="flex items-center space-x-4">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  isConnected
                    ? "bg-green-100 text-green-800"
                    : connectionStatus === "connecting"
                    ? "bg-yellow-100 text-yellow-800"
                    : connectionStatus === "error"
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {isConnected
                  ? "🟢 Connected (LAN)"
                  : connectionStatus === "connecting"
                  ? "🟡 Connecting..."
                  : connectionStatus === "error"
                  ? "🔴 Connection Error"
                  : "⚫ Offline"}
              </span>
              <button
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {["pos", "orders", "kds", "bds"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "pos" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Products */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Products</h2>
                  <div className="flex space-x-2">
                    {["all", "food", "other"].map((category) => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category as any)}
                        className={`px-3 py-1 rounded-md text-sm ${
                          selectedCategory === category
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="border rounded-lg p-4 hover:shadow-md cursor-pointer"
                      onClick={() => handleAddToCart(product)}
                    >
                      <h3 className="font-medium">{product.name}</h3>
                      <p className="text-sm text-gray-600">
                        {product.description}
                      </p>
                      <p className="text-lg font-bold text-blue-600">
                        ${product.price.toFixed(2)}
                      </p>
                      <span
                        className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          product.category === "food"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {product.category}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Cart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Current Order</h2>

              <div className="space-y-2 mb-4">
                <input
                  type="text"
                  placeholder="Table Number"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Customer Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                {items.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No items in cart
                  </p>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex justify-between items-center border-b pb-2"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.product.name}</p>
                        <p className="text-sm text-gray-600">
                          ${item.product.price.toFixed(2)} each
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() =>
                            updateQuantity(item.product.id, item.quantity - 1)
                          }
                          className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-sm"
                        >
                          -
                        </button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() =>
                            updateQuantity(item.product.id, item.quantity + 1)
                          }
                          className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-sm"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeItem(item.product.id)}
                          className="text-red-600 ml-2"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-semibold">
                    Total: ${total.toFixed(2)}
                  </span>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={handleCreateOrder}
                    disabled={items.length === 0}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Order
                  </button>
                  <button
                    onClick={clearCart}
                    className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700"
                  >
                    Clear Cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "orders" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Active Orders</h2>
            <div className="space-y-4">
              {orders.filter(
                (order) =>
                  order.status !== "completed" && order.status !== "cancelled"
              ).length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No active orders
                </p>
              ) : (
                orders
                  .filter(
                    (order) =>
                      order.status !== "completed" &&
                      order.status !== "cancelled"
                  )
                  .map((order) => (
                    <div key={order.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold">{order.orderNumber}</h3>
                          <p className="text-sm text-gray-600">
                            {order.tableNumber &&
                              `Table: ${order.tableNumber} • `}
                            {order.customerName &&
                              `Customer: ${order.customerName} • `}
                            Total: ${order.total.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span
                            className="px-2 py-1 rounded-full text-xs font-medium text-white"
                            style={{
                              backgroundColor: getStatusColor(order.status),
                            }}
                          >
                            {order.status.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="text-sm text-gray-600 mb-2">
                        Items:{" "}
                        {order.items
                          .map((item) => `${item.quantity}x ${item.name}`)
                          .join(", ")}
                      </div>

                      {order.status !== "completed" &&
                        order.status !== "cancelled" && (
                          <div className="flex space-x-2">
                            {(order.status === "draft" ||
                              order.status === "active") && (
                              <button
                                onClick={() =>
                                  handleStatusUpdate(order.id, "preparing")
                                }
                                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                              >
                                Start Preparing
                              </button>
                            )}
                            {order.status === "preparing" && (
                              <button
                                onClick={() =>
                                  handleStatusUpdate(order.id, "ready")
                                }
                                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                              >
                                Mark Ready
                              </button>
                            )}
                            {order.status === "ready" && (
                              <button
                                onClick={() =>
                                  handleStatusUpdate(order.id, "completed")
                                }
                                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                              >
                                Complete
                              </button>
                            )}
                            <button
                              onClick={() =>
                                handleStatusUpdate(order.id, "cancelled")
                              }
                              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        {activeTab === "kds" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">
              Kitchen Display System
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingKdsTickets.length === 0 ? (
                <p className="text-gray-500 text-center py-8 col-span-full">
                  No pending kitchen tickets
                </p>
              ) : (
                pendingKdsTickets.map((ticket) => (
                  <div
                    key={ticket.ticketId}
                    className="border-l-4 border-orange-500 bg-orange-50 p-4 rounded"
                  >
                    <h3 className="font-semibold">
                      Order: {ticket.orderNumber}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Ticket: {ticket.ticketId.slice(0, 8)}...
                    </p>
                    <p className="text-sm text-gray-600">
                      Status: {ticket.status.toUpperCase()}
                    </p>
                    <div className="mt-2">
                      <p className="font-medium">Food Items:</p>
                      {ticket.items.map((item, idx) => (
                        <p key={idx} className="text-sm">
                          • {item.quantity}x {item.name}
                          {item.notes && (
                            <span className="text-orange-600">
                              {" "}
                              ({item.notes})
                            </span>
                          )}
                        </p>
                      ))}
                    </div>
                    <div className="mt-2 flex space-x-2">
                      <button
                        onClick={() => completeKdsTicket(ticket.ticketId)}
                        className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                      >
                        Complete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "bds" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Bar Display System</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingBdsTickets.length === 0 ? (
                <p className="text-gray-500 text-center py-8 col-span-full">
                  No pending bar tickets
                </p>
              ) : (
                pendingBdsTickets.map((ticket) => (
                  <div
                    key={ticket.ticketId}
                    className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded"
                  >
                    <h3 className="font-semibold">
                      Order: {ticket.orderNumber}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Ticket: {ticket.ticketId.slice(0, 8)}...
                    </p>
                    <p className="text-sm text-gray-600">
                      Status: {ticket.status.toUpperCase()}
                    </p>
                    <div className="mt-2">
                      <p className="font-medium">Drinks:</p>
                      {ticket.items.map((item, idx) => (
                        <p key={idx} className="text-sm">
                          • {item.quantity}x {item.name}
                          {item.notes && (
                            <span className="text-blue-600">
                              {" "}
                              ({item.notes})
                            </span>
                          )}
                        </p>
                      ))}
                    </div>
                    <div className="mt-2 flex space-x-2">
                      <button
                        onClick={() => completeBdsTicket(ticket.ticketId)}
                        className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                      >
                        Complete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default POSScreen;
