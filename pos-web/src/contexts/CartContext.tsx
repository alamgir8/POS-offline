import React, {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
} from 'react';
import type { CartItem, Product, Order } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface CartState {
  items: CartItem[];
  orders: Order[];
  total: number;
}

type CartAction =
  | { type: 'ADD_TO_CART'; product: Product }
  | { type: 'REMOVE_FROM_CART'; productId: string }
  | { type: 'UPDATE_QUANTITY'; productId: string; quantity: number }
  | { type: 'CLEAR_CART' }
  | { type: 'PLACE_ORDER'; customerName?: string; notes?: string }
  | { type: 'UPDATE_ORDER_STATUS'; orderId: string; status: Order['status'] };

interface CartContextType {
  state: CartState;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  placeOrder: (customerName?: string, notes?: string) => void;
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const existingItem = state.items.find(
        (item) => item.product.id === action.product.id
      );

      if (existingItem) {
        const updatedItems = state.items.map((item) =>
          item.product.id === action.product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.product.price,
              }
            : item
        );

        return {
          ...state,
          items: updatedItems,
          total: updatedItems.reduce((sum, item) => sum + item.subtotal, 0),
        };
      } else {
        const newItem: CartItem = {
          id: uuidv4(),
          product: action.product,
          quantity: 1,
          subtotal: action.product.price,
        };

        const updatedItems = [...state.items, newItem];

        return {
          ...state,
          items: updatedItems,
          total: updatedItems.reduce((sum, item) => sum + item.subtotal, 0),
        };
      }
    }

    case 'REMOVE_FROM_CART': {
      const updatedItems = state.items.filter(
        (item) => item.product.id !== action.productId
      );

      return {
        ...state,
        items: updatedItems,
        total: updatedItems.reduce((sum, item) => sum + item.subtotal, 0),
      };
    }

    case 'UPDATE_QUANTITY': {
      if (action.quantity <= 0) {
        return cartReducer(state, {
          type: 'REMOVE_FROM_CART',
          productId: action.productId,
        });
      }

      const updatedItems = state.items.map((item) =>
        item.product.id === action.productId
          ? {
              ...item,
              quantity: action.quantity,
              subtotal: action.quantity * item.product.price,
            }
          : item
      );

      return {
        ...state,
        items: updatedItems,
        total: updatedItems.reduce((sum, item) => sum + item.subtotal, 0),
      };
    }

    case 'CLEAR_CART': {
      return {
        ...state,
        items: [],
        total: 0,
      };
    }

    case 'PLACE_ORDER': {
      if (state.items.length === 0) return state;

      const newOrder: Order = {
        id: uuidv4(),
        items: [...state.items],
        total: state.total,
        status: 'pending',
        timestamp: new Date(),
        customerName: action.customerName,
        notes: action.notes,
      };

      return {
        items: [],
        total: 0,
        orders: [newOrder, ...state.orders],
      };
    }

    case 'UPDATE_ORDER_STATUS': {
      const updatedOrders = state.orders.map((order) =>
        order.id === action.orderId
          ? { ...order, status: action.status }
          : order
      );

      return {
        ...state,
        orders: updatedOrders,
      };
    }

    default:
      return state;
  }
};

const initialState: CartState = {
  items: [],
  orders: [],
  total: 0,
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const addToCart = (product: Product) => {
    dispatch({ type: 'ADD_TO_CART', product });
  };

  const removeFromCart = (productId: string) => {
    dispatch({ type: 'REMOVE_FROM_CART', productId });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', productId, quantity });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const placeOrder = (customerName?: string, notes?: string) => {
    dispatch({ type: 'PLACE_ORDER', customerName, notes });
  };

  const updateOrderStatus = (orderId: string, status: Order['status']) => {
    dispatch({ type: 'UPDATE_ORDER_STATUS', orderId, status });
  };

  return (
    <CartContext.Provider
      value={{
        state,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        placeOrder,
        updateOrderStatus,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
