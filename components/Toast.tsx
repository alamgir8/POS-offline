import React, { useState, useEffect } from 'react';
import { View, Text, Animated } from 'react-native';
import { CheckCircle, ArrowLeftRight } from 'lucide-react-native';

type ToastType = 'sync' | 'success' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  visible: boolean;
  onHide: () => void;
}

export function Toast({ message, type, visible, onHide }: ToastProps) {
  const [opacity] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(3000),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onHide();
      });
    }
  }, [visible]);

  if (!visible) return null;

  const getToastConfig = () => {
    switch (type) {
      case 'sync':
        return {
          bgColor: 'bg-blue-500',
          icon: <ArrowLeftRight size={16} color="white" />,
        };
      case 'success':
        return {
          bgColor: 'bg-green-500',
          icon: <CheckCircle size={16} color="white" />,
        };
      default:
        return {
          bgColor: 'bg-gray-700',
          icon: null,
        };
    }
  };

  const config = getToastConfig();

  return (
    <Animated.View
      style={{ opacity }}
      className={`absolute top-16 left-4 right-4 ${config.bgColor} rounded-lg px-4 py-3 flex-row items-center shadow-lg z-50`}
    >
      {config.icon && <View className="mr-2">{config.icon}</View>}
      <Text className="text-white font-medium flex-1">{message}</Text>
    </Animated.View>
  );
}

// Toast Manager Hook
export function useToast() {
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
    visible: boolean;
  }>({ message: '', type: 'info', visible: false });

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type, visible: true });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, visible: false }));
  };

  return {
    toast,
    showToast,
    hideToast,
  };
}
