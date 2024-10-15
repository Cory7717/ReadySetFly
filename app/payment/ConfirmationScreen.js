// src/screens/ConfirmationScreen.js

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { getFirestore, doc, updateDoc, getDoc } from "firebase/firestore";

const ConfirmationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { rentalRequestId } = route.params || {}; // Destructure with default

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!rentalRequestId) {
      setError("No rental request ID provided.");
      setLoading(false);
      return;
    }

    const updatePaymentStatus = async () => {
      const db = getFirestore();
      const rentalRef = doc(db, "renters", "RENTER_ID", "rentalRequests", rentalRequestId); // Replace 'RENTER_ID' with dynamic ID if possible

      try {
        const rentalSnap = await getDoc(rentalRef);

        if (!rentalSnap.exists()) {
          setError("Rental request not found.");
          setLoading(false);
          return;
        }

        await updateDoc(rentalRef, {
          paymentStatus: "paid",
          rentalStatus: "paid", // Update status if necessary
          paidAt: new Date(),
        });

        setLoading(false);
      } catch (err) {
        console.error("Error updating payment status:", err);
        setError("Failed to update payment status.");
        setLoading(false);
      }
    };

    updatePaymentStatus();
  }, [rentalRequestId]);

  const handleContinueMessaging = () => {
    navigation.navigate("Messages", { rentalRequestId });
  };

  const handleGoHome = () => {
    navigation.navigate("Home");
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3182ce" />
        <Text style={styles.message}>Processing your payment...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.buttonOutline} onPress={handleGoHome}>
          <Text style={styles.buttonOutlineText}>Go to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment Successful!</Text>
      <Text style={styles.message}>
        Thank you for your payment. Your rental request is now active.
      </Text>
      <TouchableOpacity style={styles.button} onPress={handleContinueMessaging}>
        <Text style={styles.buttonText}>Continue Messaging</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.buttonOutline} onPress={handleGoHome}>
        <Text style={styles.buttonOutlineText}>Go to Home</Text>
      </TouchableOpacity>
    </View>
  );
};

export default ConfirmationScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0fff4",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#38a169",
    marginBottom: 20,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#4a5568",
    textAlign: "center",
    marginBottom: 40,
  },
  errorText: {
    fontSize: 16,
    color: "#e53e3e",
    textAlign: "center",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#3182ce",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 20,
    width: "80%",
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  buttonOutline: {
    borderColor: "#3182ce",
    borderWidth: 2,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    width: "80%",
    alignItems: "center",
  },
  buttonOutlineText: {
    color: "#3182ce",
    fontWeight: "bold",
    fontSize: 16,
  },
});
