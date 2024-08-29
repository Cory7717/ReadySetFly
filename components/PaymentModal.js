import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
} from "react-native";

const PaymentModal = ({ visible, onClose }) => {
  return (
    <Modal
      transparent={true}
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
        >
          <View
            style={{
              backgroundColor: "white",
              padding: 20,
              borderRadius: 10,
              width: "80%",
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 15 }}>
              Pricing Information
            </Text>
            <Text style={{ marginBottom: 15 }}>
              Here you can add information about pricing for listing aircraft. For example:
              {"\n"}
              - Basic Listing: $50
              {"\n"}
              - Premium Listing: $100
              {"\n"}
              - Featured Listing: $200
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={{
                marginTop: 15,
                backgroundColor: "#3B82F6",
                padding: 10,
                borderRadius: 5,
              }}
            >
              <Text style={{ color: "white", textAlign: "center" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default PaymentModal;
