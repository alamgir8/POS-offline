import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useData } from '../../contexts/DataContext';
import { useSync } from '../../contexts/SyncContext';

export default function BDSScreen() {
  const { bdsOrders, isLoading, loadOrders, updateOrder } = useData();
  const { isOnline, isConnectedToServer } = useSync();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#f59e0b';
      case 'preparing':
        return '#3b82f6';
      case 'ready':
        return '#10b981';
      case 'completed':
        return '#6b7280';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getTimeElapsed = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    return diffMins;
  };

  const getTimeColor = (minutes) => {
    if (minutes > 15) return '#ef4444'; // Red for very late
    if (minutes > 10) return '#f59e0b'; // Orange for late
    return '#10b981'; // Green for on time
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await updateOrder(orderId, { status: newStatus });
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  // Filter only active orders (not completed or cancelled)
  const activeOrders = bdsOrders
    .filter(
      (order) => order.status !== 'completed' && order.status !== 'cancelled'
    )
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#7c2d12" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="wine" size={24} color="#ffffff" />
          <Text style={styles.title}>Bar Display</Text>
        </View>
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isOnline ? '#10b981' : '#ef4444' },
            ]}
          />
          <Text style={styles.statusText}>
            {isConnectedToServer
              ? 'Connected'
              : isOnline
              ? 'Online'
              : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {activeOrders.filter((o) => o.status === 'pending').length}
          </Text>
          <Text style={styles.statLabel}>New Orders</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {activeOrders.filter((o) => o.status === 'preparing').length}
          </Text>
          <Text style={styles.statLabel}>Preparing</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {activeOrders.filter((o) => o.status === 'ready').length}
          </Text>
          <Text style={styles.statLabel}>Ready</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{activeOrders.length}</Text>
          <Text style={styles.statLabel}>Total Active</Text>
        </View>
      </View>

      {/* Orders Grid */}
      <ScrollView
        style={styles.ordersContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="wine-outline" size={64} color="#6b7280" />
            <Text style={styles.emptyStateText}>No bar orders</Text>
            <Text style={styles.emptyStateSubtext}>
              Drink orders will appear here
            </Text>
          </View>
        ) : (
          <View style={styles.ordersGrid}>
            {activeOrders.map((order) => {
              const timeElapsed = getTimeElapsed(order.createdAt);
              return (
                <View
                  key={order.id}
                  style={[
                    styles.orderCard,
                    {
                      backgroundColor:
                        order.status === 'pending'
                          ? '#fef3c7'
                          : order.status === 'preparing'
                          ? '#dbeafe'
                          : '#d1fae5',
                    },
                  ]}
                >
                  {/* Order Header */}
                  <View style={styles.orderHeader}>
                    <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                    <View
                      style={[
                        styles.timeBadge,
                        { backgroundColor: getTimeColor(timeElapsed) },
                      ]}
                    >
                      <Text style={styles.timeText}>{timeElapsed}m</Text>
                    </View>
                  </View>

                  {/* Customer Info */}
                  {(order.customerName || order.tableNumber) && (
                    <View style={styles.customerInfo}>
                      {order.customerName && (
                        <Text style={styles.customerText}>
                          👤 {order.customerName}
                        </Text>
                      )}
                      {order.tableNumber && (
                        <Text style={styles.customerText}>
                          🪑 Table {order.tableNumber}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Bar Items */}
                  <View style={styles.barItems}>
                    <Text style={styles.sectionTitle}>🍺 Bar Items</Text>
                    {order.items
                      .filter((item) => item.category === 'beverage')
                      .map((item, index) => (
                        <View key={index} style={styles.barItem}>
                          <Text style={styles.itemQuantity}>
                            {item.quantity}x
                          </Text>
                          <Text style={styles.itemName}>{item.name}</Text>
                          {item.notes && (
                            <Text style={styles.itemNotes}>
                              Note: {item.notes}
                            </Text>
                          )}
                        </View>
                      ))}
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actionButtons}>
                    {order.status === 'pending' && (
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          { backgroundColor: '#3b82f6' },
                        ]}
                        onPress={() =>
                          handleStatusUpdate(order.id, 'preparing')
                        }
                      >
                        <Ionicons name="play" size={16} color="#ffffff" />
                        <Text style={styles.actionButtonText}>Start</Text>
                      </TouchableOpacity>
                    )}

                    {order.status === 'preparing' && (
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          { backgroundColor: '#10b981' },
                        ]}
                        onPress={() => handleStatusUpdate(order.id, 'ready')}
                      >
                        <Ionicons name="checkmark" size={16} color="#ffffff" />
                        <Text style={styles.actionButtonText}>Ready</Text>
                      </TouchableOpacity>
                    )}

                    {order.status === 'ready' && (
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          { backgroundColor: '#6b7280' },
                        ]}
                        onPress={() =>
                          handleStatusUpdate(order.id, 'completed')
                        }
                      >
                        <Ionicons
                          name="checkmark-done"
                          size={16}
                          color="#ffffff"
                        />
                        <Text style={styles.actionButtonText}>Complete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#7c2d12',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  ordersContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#d1d5db',
    marginTop: 8,
  },
  ordersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  orderCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#7c2d12',
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  timeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  customerInfo: {
    marginBottom: 12,
  },
  customerText: {
    fontSize: 12,
    color: '#4b5563',
    marginBottom: 2,
  },
  barItems: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  barItem: {
    marginBottom: 8,
  },
  itemQuantity: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7c2d12',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  itemNotes: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
});
