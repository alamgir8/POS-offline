import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import KitchenDisplay from "../pos-native/components/KitchenDisplay";
import ParkedOrdersManager from "../pos-native/components/ParkedOrdersManager";

const KitchenManagementScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"kitchen" | "bar" | "parked">(
    "kitchen"
  );

  const renderContent = () => {
    switch (activeTab) {
      case "kitchen":
        return <KitchenDisplay station="kitchen" />;
      case "bar":
        return <KitchenDisplay station="bar" />;
      case "parked":
        return <ParkedOrdersManager />;
      default:
        return <KitchenDisplay station="kitchen" />;
    }
  };

  return (
    <View className="flex-1 bg-gray-100">
      {/* Tab Navigation */}
      <View className="bg-white border-b border-gray-200">
        <View className="flex-row">
          <TouchableOpacity
            onPress={() => setActiveTab("kitchen")}
            className={`flex-1 py-4 px-6 ${
              activeTab === "kitchen"
                ? "bg-blue-600 border-b-2 border-blue-600"
                : "bg-gray-50"
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                activeTab === "kitchen" ? "text-white" : "text-gray-700"
              }`}
            >
              Kitchen Display
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("bar")}
            className={`flex-1 py-4 px-6 ${
              activeTab === "bar"
                ? "bg-green-600 border-b-2 border-green-600"
                : "bg-gray-50"
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                activeTab === "bar" ? "text-white" : "text-gray-700"
              }`}
            >
              Bar Display
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("parked")}
            className={`flex-1 py-4 px-6 ${
              activeTab === "parked"
                ? "bg-purple-600 border-b-2 border-purple-600"
                : "bg-gray-50"
            }`}
          >
            <Text
              className={`text-center font-semibold ${
                activeTab === "parked" ? "text-white" : "text-gray-700"
              }`}
            >
              Parked Orders
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {renderContent()}
    </View>
  );
};

export default KitchenManagementScreen;
