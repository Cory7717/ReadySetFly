// src/screens/ConfirmationScreen.js

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // Import Firebase Auth

const ConfirmationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { rentalRequestId } = route.params || {}; // Destructure with default

  const [loading, setLoading] = useState(true);
  const [rentalRequest, setRentalRequest] = useState(null);
  const [error, setError] = useState(null);

  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    if (!rentalRequestId) {
      setError("No rental request ID provided.");
      setLoading(false);
      return;
    }

    if (!user) {
      setError("User not authenticated.");
      setLoading(false);
      return;
    }

    const db = getFirestore();
    const rentalRef = doc(db, "renters", user.uid, "rentalRequests", rentalRequestId);

    const unsubscribe = onSnapshot(
      rentalRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setRentalRequest(docSnap.data());
          setLoading(false);
        } else {
          setError("Rental request not found.");
          setLoading(false);
        }
      },
      (err) => {
        console.error("Error fetching rental request:", err);
        setError("Failed to fetch rental request.");
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [rentalRequestId, user]);

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

  // Determine the payment status
  const { paymentStatus, rentalStatus, paidAt } = rentalRequest;

  return (
    <View style={styles.container}>
      {paymentStatus === "paid" ? (
        <>
          <Text style={styles.title}>Payment Successful!</Text>
          <Text style={styles.message}>
            Thank you for your payment. Your rental request is now active.
          </Text>
          <Text style={styles.detail}>
            Paid At: {paidAt ? new Date(paidAt.seconds * 1000).toLocaleString() : "N/A"}
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleContinueMessaging}>
            <Text style={styles.buttonText}>Continue Messaging</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buttonOutline} onPress={handleGoHome}>
            <Text style={styles.buttonOutlineText}>Go to Home</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.title}>Payment Pending</Text>
          <Text style={styles.message}>
            Your payment is being processed. Please wait a moment.
          </Text>
          <ActivityIndicator size="small" color="#3182ce" style={{ marginBottom: 20 }} />
          <TouchableOpacity style={styles.buttonOutline} onPress={handleGoHome}>
            <Text style={styles.buttonOutlineText}>Go to Home</Text>
          </TouchableOpacity>
        </>
      )}
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
    marginBottom: 20,
  },
  detail: {
    fontSize: 14,
    color: "#4a5568",
    textAlign: "center",
    marginBottom: 20,
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
