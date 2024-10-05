import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, StyleSheet, Animated, Easing } from 'react-native';
import { CardField, useConfirmPayment } from '@stripe/stripe-react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const PaymentScreen = ({ route }) => {
  const navigation = useNavigation();
  const { totalCost = 0, listingDetails = {}, selectedPricing = '' } = route.params || {};
  const [loading, setLoading] = useState(false);
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false); // To track payment status
  const { confirmPayment } = useConfirmPayment();

  // For displaying animation
  const bounceValue = useRef(new Animated.Value(0)).current;

  // Convert totalCost to a fixed amount for displaying
  const displayTotal = (totalCost / 100).toFixed(2);

  useEffect(() => {
    // Start the bounce animation on component mount
    startBouncing();
  }, []);

  // Start the bouncing animation
  const startBouncing = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceValue, {
          toValue: -20, // Move up
          duration: 1000,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
        Animated.timing(bounceValue, {
          toValue: 0, // Move back down
          duration: 1000,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const handlePayment = async () => {
    try {
      setLoading(true);
  
      // Fetch payment intent client secret from your server in test mode
      const response = await fetch('https://awaited-hippo-85.clerk.accounts.dev', { // Use your actual backend endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: totalCost }), // Total cost in cents
      });
  
      const { clientSecret } = await response.json();
      if (!clientSecret) {
        Alert.alert('Error', 'Unable to process payment');
        setLoading(false);
        return;
      }
  
      // Confirm the payment with Stripe using the client secret
      const { error, paymentIntent } = await confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
        paymentMethodData: {
          billingDetails: { name: listingDetails.email || 'Renter' },
        },
      });
  
      if (error) {
        Alert.alert('Payment failed', error.message);
      } else if (paymentIntent.status === 'Succeeded') {
        Alert.alert('Success', 'Payment processed successfully');
        setIsPaymentSuccess(true); // Update state to reflect successful payment
        // Optionally, navigate back to Classifieds or display a success screen
        navigation.navigate('Classifieds');
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Error', 'Payment processing failed.');
    } finally {
      // Ensure loading is set to false no matter what
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (!loading) {
      navigation.goBack();
    } else {
      Alert.alert('Please wait', 'Payment is being processed. Please wait until it finishes.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Cancel button */}
      <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
        <Ionicons name="close-outline" size={28} color="#FF5A5F" />
      </TouchableOpacity>

      {/* Bouncing animation */}
      <Animated.View style={[styles.animatedContainer, { transform: [{ translateY: bounceValue }] }]}>
        <Ionicons
          name={isPaymentSuccess ? "checkmark-circle-outline" : "card-outline"}
          size={80}
          color={isPaymentSuccess ? "#32CD32" : "#FF5A5F"} // Green on success, red otherwise
        />
      </Animated.View>

      <Text style={styles.title}>Complete Your Payment</Text>
      <Text style={styles.description}>You are purchasing a {selectedPricing} package.</Text>
      <Text style={styles.amount}>Total Amount: ${displayTotal}</Text>

      {/* Stripe CardField component */}
      <CardField
        postalCodeEnabled={true}
        placeholders={{ number: '4242 4242 4242 4242' }} // Stripe test card
        style={styles.cardField}
        onCardChange={(cardDetails) => console.log('Card details:', cardDetails)}
      />

      {/* Button to trigger payment */}
      <TouchableOpacity
        onPress={handlePayment}
        disabled={loading}
        style={styles.payButton}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.payButtonText}>Pay ${displayTotal}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
  },
  cancelButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  },
  animatedContainer: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
    color: '#555',
  },
  amount: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    color: '#000',
  },
  cardField: {
    width: '100%',
    height: 50,
    marginVertical: 30,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    backgroundColor: 'white',
  },
  payButton: {
    backgroundColor: '#FF5A5F',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  payButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PaymentScreen;
