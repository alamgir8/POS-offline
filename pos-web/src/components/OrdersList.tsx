import React, { useState } from 'react';
import type { Order } from '../types';

interface OrdersListProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, status: Order['status']) => void;
}

const OrdersList: React.FC<OrdersListProps> = ({ orders, onUpdateStatus }) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'preparing':
        return 'bg-blue-100 text-blue-800';
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusOptions = (currentStatus: Order['status']) => {
    const allStatuses: Order['status'][] = [
      'pending',
      'preparing',
      'ready',
      'completed',
      'cancelled',
    ];
    return allStatuses.filter((status) => status !== currentStatus);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Orders</h2>
        <span className="text-sm text-gray-600">
          {orders.length} total orders
        </span>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-medium mb-2">No orders yet</h3>
          <p>Orders will appear here once customers start placing them.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-800">
                      Order #{order.id.slice(-8)}
                    </h3>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {order.status.charAt(0).toUpperCase() +
                        order.status.slice(1)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Customer:</strong>{' '}
                        {order.customerName || 'Walk-in'}
                      </p>
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Time:</strong>{' '}
                        {order.timestamp.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600">
                        <strong>Total:</strong>{' '}
                        <span className="font-semibold text-green-600">
                          ${order.total.toFixed(2)}
                        </span>
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 mb-1">
                        <strong>Items:</strong>
                      </p>
                      <div className="text-sm text-gray-700">
                        {order.items.slice(0, 3).map((item, index) => (
                          <div key={index} className="flex justify-between">
                            <span>
                              {item.product.name} x{item.quantity}
                            </span>
                            <span>${item.subtotal.toFixed(2)}</span>
                          </div>
                        ))}
                        {order.items.length > 3 && (
                          <p className="text-gray-500 italic">
                            +{order.items.length - 3} more items
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {order.notes && (
                    <div className="mt-3 p-2 bg-yellow-50 rounded border">
                      <p className="text-sm">
                        <strong>Notes:</strong> {order.notes}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                  >
                    View Details
                  </button>

                  {order.status !== 'completed' &&
                    order.status !== 'cancelled' && (
                      <select
                        value={order.status}
                        onChange={(e) =>
                          onUpdateStatus(
                            order.id,
                            e.target.value as Order['status']
                          )
                        }
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value={order.status}>{order.status}</option>
                        {getStatusOptions(order.status).map((status) => (
                          <option key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </option>
                        ))}
                      </select>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Order Details</h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p>
                    <strong>Order ID:</strong> {selectedOrder.id}
                  </p>
                  <p>
                    <strong>Customer:</strong>{' '}
                    {selectedOrder.customerName || 'Walk-in'}
                  </p>
                  <p>
                    <strong>Status:</strong>
                    <span
                      className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        selectedOrder.status
                      )}`}
                    >
                      {selectedOrder.status.charAt(0).toUpperCase() +
                        selectedOrder.status.slice(1)}
                    </span>
                  </p>
                </div>
                <div>
                  <p>
                    <strong>Date:</strong>{' '}
                    {selectedOrder.timestamp.toLocaleDateString()}
                  </p>
                  <p>
                    <strong>Time:</strong>{' '}
                    {selectedOrder.timestamp.toLocaleTimeString()}
                  </p>
                  <p>
                    <strong>Total:</strong>{' '}
                    <span className="font-semibold text-green-600">
                      ${selectedOrder.total.toFixed(2)}
                    </span>
                  </p>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="p-3 bg-yellow-50 rounded border">
                  <p>
                    <strong>Notes:</strong> {selectedOrder.notes}
                  </p>
                </div>
              )}

              <div>
                <h4 className="font-semibold mb-2">Items:</h4>
                <div className="border rounded overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3 font-medium">Item</th>
                        <th className="text-center p-3 font-medium">Qty</th>
                        <th className="text-right p-3 font-medium">Price</th>
                        <th className="text-right p-3 font-medium">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-3">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">
                                {item.product.image}
                              </span>
                              <span>{item.product.name}</span>
                            </div>
                          </td>
                          <td className="text-center p-3">{item.quantity}</td>
                          <td className="text-right p-3">
                            ${item.product.price.toFixed(2)}
                          </td>
                          <td className="text-right p-3 font-medium">
                            ${item.subtotal.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t">
                      <tr>
                        <td
                          colSpan={3}
                          className="text-right p-3 font-semibold"
                        >
                          Total:
                        </td>
                        <td className="text-right p-3 font-bold text-green-600">
                          ${selectedOrder.total.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersList;
