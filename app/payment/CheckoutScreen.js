// src/screens/CheckoutScreen.js

import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  StyleSheet, 
  Animated, 
  Easing, 
  TextInput, 
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { CardField, useConfirmPayment } from '@stripe/stripe-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getAuth } from 'firebase/auth'; // Import Firebase Auth

// Configuration Constants
const API_URL = 'https://us-central1-ready-set-fly-71506.cloudfunctions.net/api'; // Replace with your actual server URL

export default function CheckoutScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { confirmPayment } = useConfirmPayment();

  const auth = getAuth(); // Initialize Firebase Auth
  const user = auth.currentUser; // Get current Firebase user

  // Extract parameters from navigation route
  const {
    paymentType = 'rental', // 'classified' or 'rental'
    amount: initialAmount = 0, // For Classifieds (in cents)
    perHour: initialPerHour = 0, // For Rentals
    ownerId = '', // For Rentals
    rentalRequestId = '', // For Rentals
    listingDetails = {}, // Additional details for listing creation
    selectedPricing: initialSelectedPricing = '', // Initial pricing tier
  } = route.params || {};

  // State Variables
  const [loading, setLoading] = useState(false);
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);
  
  // Discount Code State
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Cardholder Name State
  const [cardholderName, setCardholderName] = useState(user?.displayName || '');

  // Manage totalAmount and selectedPricing as state to allow updates
  const [totalAmount, setTotalAmount] = useState(paymentType === 'rental' ? 0 : initialAmount);
  const [selectedPricing, setSelectedPricing] = useState(initialSelectedPricing);

  // For displaying animation
  const bounceValue = useRef(new Animated.Value(0)).current;

  // Convert totalAmount to a fixed amount for displaying
  const displayTotal = (totalAmount / 100).toFixed(2);

  useEffect(() => {
    startBouncing();
    if (paymentType === 'rental') {
      // For Rentals, totalAmount is calculated based on perHour and fees
      calculateRentalTotal(initialPerHour);
    } else if (paymentType === 'classified') {
      // For Classifieds, use the initialAmount passed
      setTotalAmount(initialAmount);
    }
  }, [initialAmount, paymentType, initialPerHour]);

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

  // Function to calculate total amount for Rentals
  const calculateRentalTotal = (perHour) => {
    const bookingFee = perHour * 0.06; // 6%
    const processingFee = perHour * 0.03; // 3%
    const tax = (perHour + bookingFee) * 0.0825; // 8.25% on (perHour + bookingFee)
    const total = Math.round((perHour + bookingFee + processingFee + tax) * 100); // Convert to cents
    setTotalAmount(total);
  };

  // Function to apply discount code by validating it with the backend
  const applyDiscount = async () => {
    const code = discountCode.trim().toLowerCase();

    if (code === '') {
      setErrorMessage('Please enter a discount code.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');

      // Send discount code to backend for validation and get discount details
      const response = await fetch(`${API_URL}/validateDiscount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discountCode: code }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        setDiscountApplied(true);
        setTotalAmount(data.adjustedAmount); // Updated amount from backend
        setSelectedPricing(data.pricingTier); // Updated pricing tier from backend
        Alert.alert(
          'Discount Applied',
          data.message || 'Discount has been successfully applied.',
          [{ text: 'OK' }],
          { cancelable: false }
        );
      } else {
        setDiscountApplied(false);
        if (paymentType === 'rental') {
          calculateRentalTotal(initialPerHour); // Recalculate for Rentals
        } else {
          setTotalAmount(initialAmount); // Reset to initial amount for Classifieds
        }
        setErrorMessage(data.message || 'Invalid discount code.');
      }
    } catch (error) {
      console.error('Discount application error:', error);
      setErrorMessage('Failed to apply discount. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle payment processing
  const handlePayment = async () => {
    // Validate cardholder name
    if (cardholderName.trim() === '') {
      Alert.alert('Validation Error', 'Please enter the name on the credit card.');
      return;
    }

    // If discount is applied and totalAmount is zero (free listing)
    if (discountApplied && totalAmount === 0) {
      try {
        setLoading(true);
        const listingCreated = await createListing();
        if (listingCreated) {
          Alert.alert(
            'Success',
            'Your listing has been created with a free package.',
            [
              {
                text: 'OK',
                onPress: () => {
                  if (paymentType === 'rental') {
                    navigation.navigate('ConfirmationScreen', { rentalRequestId });
                  } else {
                    navigation.navigate('Classifieds', { refresh: true });
                  }
                },
              },
            ],
            { cancelable: false }
          );
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);

      let clientSecret = '';

      if (paymentType === 'rental') {
        // For Rentals, call /create-rental-payment-intent
        const response = await fetch(`${API_URL}/create-rental-payment-intent`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getFirebaseIdToken()}`, // Include Firebase ID Token
          },
          body: JSON.stringify({ 
            perHour: initialPerHour, 
            ownerId: ownerId,
            rentalRequestId: rentalRequestId, // Pass rentalRequestId
          }),
        });

        const { clientSecret: rentalClientSecret, error } = await response.json();

        if (error) {
          Alert.alert('Error', error);
          setLoading(false);
          return;
        }

        clientSecret = rentalClientSecret;
      } else if (paymentType === 'classified') {
        // For Classifieds, call /create-classified-payment-intent
        const response = await fetch(`${API_URL}/create-classified-payment-intent`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getFirebaseIdToken()}`, // Include Firebase ID Token
          },
          body: JSON.stringify({ 
            amount: initialAmount, // Amount in cents
            currency: 'usd', // Default to USD or pass as needed
          }),
        });

        const { clientSecret: classifiedClientSecret, error } = await response.json();

        if (error) {
          Alert.alert('Error', error);
          setLoading(false);
          return;
        }

        clientSecret = classifiedClientSecret;
      }

      if (!clientSecret) {
        Alert.alert('Error', 'Payment details are missing.');
        setLoading(false);
        return;
      }

      // Confirm the payment with Stripe using the client secret
      const { error, paymentIntent } = await confirmPayment(clientSecret, {
        type: 'Card',
        billingDetails: { name: cardholderName.trim() }, // Use user's input name
      });

      if (error) {
        Alert.alert('Payment failed', error.message);
      } else if (paymentIntent.status === 'Succeeded') {
        // After successful payment, create the listing
        const listingCreated = await createListing();
        if (listingCreated) {
          Alert.alert(
            'Success',
            'Payment processed successfully and your listing has been created.',
            [
              {
                text: 'OK',
                onPress: () => {
                  if (paymentType === 'rental') {
                    navigation.navigate('ConfirmationScreen', { rentalRequestId });
                  } else {
                    navigation.navigate('Classifieds', { refresh: true });
                  }
                },
              },
            ],
            { cancelable: false }
          );
          setIsPaymentSuccess(true); // Update state to reflect successful payment
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Error', 'Payment processing failed.');
    } finally {
      setLoading(false);
    }
  };

  // Function to get Firebase ID Token
  const getFirebaseIdToken = async () => {
    try {
      const token = await user.getIdToken(true);
      return token;
    } catch (error) {
      console.error("Error fetching Firebase ID token:", error);
      Alert.alert('Authentication Error', 'Failed to authenticate user.');
      return '';
    }
  };

  // Function to create the listing on the backend
  const createListing = async () => {
    try {
      const response = await fetch(`${API_URL}/createListing`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getFirebaseIdToken()}`, // Include Firebase ID Token
        },
        body: JSON.stringify({ listingDetails }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create listing');
      }

      return true;
    } catch (error) {
      console.error('Listing creation error:', error);
      Alert.alert('Error', error.message || 'Failed to create listing.');
      return false;
    }
  };

  // Handle cancellation
  const handleCancel = () => {
    if (!loading) {
      navigation.goBack();
    } else {
      Alert.alert('Please wait', 'Payment is being processed. Please wait until it finishes.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={60}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Cancel button */}
        <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
          <Ionicons name="close-outline" size={28} color="#FF5A5F" />
        </TouchableOpacity>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Bouncing animation */}
          <Animated.View style={[styles.animatedContainer, { transform: [{ translateY: bounceValue }] }]}>
            <Ionicons
              name={isPaymentSuccess ? "checkmark-circle-outline" : "card-outline"}
              size={80}
              color={isPaymentSuccess ? "#32CD32" : "#FF5A5F"} // Green on success, red otherwise
            />
          </Animated.View>

          <Text style={styles.title}>Complete Your Payment</Text>
          <Text style={styles.description}>Verify your payment details below.</Text>

          {/* Display Payment Details */}
          {paymentType === 'rental' ? (
            <View style={styles.detailsContainer}>
              <Text style={styles.detail}>Per Hour Amount: ${initialPerHour.toFixed(2)}</Text>
              <Text style={styles.detail}>Booking Fee (6%): ${(initialPerHour * 0.06).toFixed(2)}</Text>
              <Text style={styles.detail}>Processing Fee (3%): ${(initialPerHour * 0.03).toFixed(2)}</Text>
              <Text style={styles.detail}>Tax (8.25%): ${((initialPerHour + initialPerHour * 0.06) * 0.0825).toFixed(2)}</Text>
              <Text style={styles.amount}>
                Total Amount: $
                {((initialPerHour + initialPerHour * 0.06 + initialPerHour * 0.03 + (initialPerHour + initialPerHour * 0.06) * 0.0825) / 100).toFixed(2)}
              </Text>
            </View>
          ) : (
            <View style={styles.detailsContainer}>
              <Text style={styles.detail}>Listing Type: {listingDetails.type || 'N/A'}</Text>
              <Text style={styles.detail}>Amount: ${(initialAmount / 100).toFixed(2)}</Text>
            </View>
          )}

          {/* Discount Code Input */}
          {!discountApplied && (
            <View style={styles.discountContainer}>
              <TextInput
                style={styles.discountInput}
                placeholder="Enter Discount Code"
                placeholderTextColor="#888"
                value={discountCode}
                onChangeText={setDiscountCode}
                autoCapitalize="characters"
                editable={!loading}
              />
              <TouchableOpacity 
                onPress={applyDiscount} 
                style={styles.applyButton}
                disabled={loading || discountApplied}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Display error message if any */}
          {errorMessage !== '' && (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}

          {/* Cardholder Name Input */}
          <TextInput
            style={styles.nameInput}
            placeholder="Name on Card"
            placeholderTextColor="#888"
            value={cardholderName}
            onChangeText={setCardholderName}
            autoCapitalize="words"
            editable={!loading}
          />

          {/* Stripe CardField component */}
          <CardField
            postalCodeEnabled={true}
            placeholders={{ number: '**** **** **** ****' }} // Stripe test card
            placeholderTextColor="#888"
            style={styles.cardField}
            onCardChange={(cardDetails) => console.log('Card details:', cardDetails)}
            editable={!discountApplied || totalAmount > 0} // Disable card input if discount makes it free
          />

          {/* Pay Button */}
          <TouchableOpacity
            onPress={handlePayment}
            disabled={loading || (discountApplied && totalAmount === 0)}
            style={[
              styles.payButton, 
              (loading || (discountApplied && totalAmount === 0)) && styles.payButtonDisabled
            ]}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.payButtonText}>
                {discountApplied && totalAmount === 0 ? 'Finalize Listing' : `Pay $${displayTotal}`}
              </Text>
            )}
          </TouchableOpacity>

          {/* Secure Payment Text */}
          <View style={styles.securePaymentContainer}>
            <Ionicons name="lock-closed-outline" size={16} color="#555" />
            <Text style={styles.securePaymentText}>
              Your payment is secure and encrypted.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  scrollContent: {
    padding: 20,
    justifyContent: 'flex-start', // Accommodate the logo and content
    flexGrow: 1,
  },
  cancelButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
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
  detailsContainer: {
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  detail: {
    fontSize: 16,
    marginBottom: 5,
    color: '#333',
  },
  amount: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
    color: '#000',
  },
  discountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  discountInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: 'white',
    fontSize: 16,
  },
  applyButton: {
    marginLeft: 10,
    backgroundColor: '#32CD32',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  applyButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  errorText: {
    color: '#FF5A5F',
    marginTop: 10,
    textAlign: 'center',
    fontSize: 14,
  },
  nameInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: 'white',
    marginBottom: 15,
    fontSize: 16,
  },
  cardField: {
    width: '100%',
    height: 50,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    backgroundColor: 'white',
  },
  payButton: {
    backgroundColor: '#FF5A5F',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  payButtonDisabled: {
    backgroundColor: '#ccc',
  },
  payButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  securePaymentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 30,
    justifyContent: 'center',
  },
  securePaymentText: {
    marginLeft: 5,
    color: '#555',
    fontSize: 14,
  },
});
