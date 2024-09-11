import React, { useState, useEffect } from 'react';
import { Button, Alert, TextInput, View } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';

const API_URL = 'https://ready-set-fly-71506-default-rtdb.firebaseio.com'; // Replace with your actual server URL

export default function CheckoutScreen() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");  // In dollars

  const fetchPaymentSheetParams = async () => {
    try {
      const response = await fetch(`${API_URL}/PaymentScreen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: amount.replace(".", "") * 100 }), // Convert to cents
      });
      const { paymentIntent, ephemeralKey, customer } = await response.json();

      return { paymentIntent, ephemeralKey, customer };
    } catch (error) {
      console.error("Error fetching payment sheet params:", error);
      Alert.alert("Error", "Failed to fetch payment details.");
    }
  };

  const initializePaymentSheet = async () => {
    const { paymentIntent, ephemeralKey, customer } = await fetchPaymentSheetParams();

    const { error } = await initPaymentSheet({
      merchantDisplayName: "YourApp, Inc.",
      customerId: customer,
      customerEphemeralKeySecret: ephemeralKey,
      paymentIntentClientSecret: paymentIntent,
      allowsDelayedPaymentMethods: true,
      defaultBillingDetails: { name: 'Customer' },
    });

    if (!error) setLoading(true);
  };

  const openPaymentSheet = async () => {
    const { error } = await presentPaymentSheet();
    if (error) {
      Alert.alert(`Error: ${error.code}`, error.message);
    } else {
      Alert.alert('Success', 'Payment complete!');
    }
  };

  useEffect(() => {
    initializePaymentSheet();
  }, []);

  return (
    <View style={{ padding: 50, paddingTop: 200 }}>
      <TextInput
        style={{ borderWidth: 1, borderColor: 'black', marginBottom: 20 }}
        placeholder="Enter Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />
      <Button disabled={!loading} title="Checkout" onPress={openPaymentSheet} />
    </View>
  );
}
