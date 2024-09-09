import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { useEffect, useState } from 'react';
import { View, Button, Alert } from 'react-native';

export default function Payments() {
  const [paymentSheetEnabled, setPaymentSheetEnabled] = useState(false);

  const fetchPaymentSheetParams = async () => {
    const response = await fetch(`${API_URL}/payment-sheet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: 1000, // example amount in cents
      }),
    });
    const { paymentIntent, ephemeralKey, customer } = await response.json();

    return {
      paymentIntent,
      ephemeralKey,
      customer,
    };
  };

  const initializePaymentSheet = async () => {
    const { paymentIntent, ephemeralKey, customer } = await fetchPaymentSheetParams();

    const { error } = await initPaymentSheet({
      customerId: customer,
      customerEphemeralKeySecret: ephemeralKey,
      paymentIntentClientSecret: paymentIntent,
    });

    if (!error) {
      setPaymentSheetEnabled(true);
    } else {
      console.error('Error initializing payment sheet:', error);
    }
  };

  const openPaymentSheet = async () => {
    const { error } = await presentPaymentSheet();

    if (error) {
      Alert.alert(`Error code: ${error.code}`, error.message);
    } else {
      Alert.alert('Success', 'Your order is confirmed!');
    }
  };

  useEffect(() => {
    initializePaymentSheet();
  }, []);

  return (
    <View>
      <Button
        disabled={!paymentSheetEnabled}
        title="Checkout"
        onPress={openPaymentSheet}
      />
    </View>
  );
}
