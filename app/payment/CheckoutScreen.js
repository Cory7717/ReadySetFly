// src/payment/CheckoutScreen.js

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
import { getAuth } from 'firebase/auth'; // Firebase Auth
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig'; 
import { Formik } from 'formik';
import * as Yup from 'yup';

// Configuration Constants
const API_URL = 'https://us-central1-ready-set-fly-71506.cloudfunctions.net/api'; // Your backend

// Colors Constants
const COLORS = {
  primary: '#FF5A5F',
  secondary: '#6B7280',
  background: '#F9F9F9',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#9CA3AF',
  lightGray: '#D1D5DB',
  green: '#32CD32', // Success color
  red: '#EF4444',  // Error color
};

// Stylesheet
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
    justifyContent: 'flex-start',
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
    color: COLORS.black,
  },
  description: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
    color: COLORS.gray,
  },
  detailsContainer: {
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  detail: {
    fontSize: 16,
    marginBottom: 5,
    color: COLORS.black,
  },
  amount: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
    color: COLORS.black,
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
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: COLORS.white,
    fontSize: 16,
  },
  applyButton: {
    marginLeft: 10,
    backgroundColor: COLORS.green,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  applyButtonDisabled: {
    backgroundColor: '#a5d6a7',
  },
  applyButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  errorText: {
    color: COLORS.red,
    marginTop: 10,
    textAlign: 'center',
    fontSize: 14,
  },
  nameInput: {
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: COLORS.white,
    marginBottom: 15,
    fontSize: 16,
    color: COLORS.black,
  },
  cardField: {
    width: '100%',
    height: 50,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    padding: 10,
    backgroundColor: COLORS.white,
  },
  payButton: {
    backgroundColor: COLORS.primary,
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
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
  },
  finalizeButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  finalizeButtonDisabled: {
    backgroundColor: '#ccc',
  },
  finalizeButtonText: {
    color: COLORS.white,
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

// MAIN COMPONENT
export default function CheckoutScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { confirmPayment } = useConfirmPayment();

  // Firebase Auth
  const auth = getAuth();
  const user = auth.currentUser;

  // Destructure route params
  const {
    paymentType = 'rental',        // "rental" or "classified"
    costPerHour = 0,              
    rentalHours = 1,              
    rentalRequestId: routeRentalRequestId = '',
    listingDetails = {},          
    selectedPricing: initialSelectedPricing = '',
    images: listingImages = [],   
    amount = 0,  // For "classified"
  } = route.params || {};

  console.log("CheckoutScreen received params:", route.params);

  // Local state
  const [loading, setLoading] = useState(false);
  const [isOperationSuccess, setIsOperationSuccess] = useState(false);

  // For rentals
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Cardholder Name
  const [cardholderName, setCardholderName] = useState(user?.displayName || '');

  // Manage totalAmount (in cents)
  const [totalAmount, setTotalAmount] = useState(0);
  const [selectedPricing, setSelectedPricing] = useState(initialSelectedPricing);

  // For rentals
  const [rentalRequestId, setRentalRequestId] = useState(routeRentalRequestId || '');

  // Animation
  const bounceValue = useRef(new Animated.Value(0)).current;

  // Convert cents to dollars
  const displayTotal = (totalAmount / 100).toFixed(2);

  // On mount
  useEffect(() => {
    console.log("CheckoutScreen useEffect triggered");
    startBouncing();

    // Validate and set amounts
    const validateParamsAndSetAmount = () => {
      const validPaymentTypes = ['rental', 'classified'];
      if (!validPaymentTypes.includes(paymentType)) {
        Alert.alert('Invalid Payment Type', `Unsupported payment type: ${paymentType}`);
        navigation.goBack();
        return;
      }

      // For rentals
      if (paymentType === 'rental') {
        if (isNaN(costPerHour) || costPerHour <= 0) {
          Alert.alert('Invalid Cost Per Hour', 'Please provide a valid cost per hour.');
          navigation.goBack();
          return;
        }
        if (isNaN(rentalHours) || rentalHours <= 0) {
          Alert.alert('Invalid Rental Hours', 'Please provide valid rental hours.');
          navigation.goBack();
          return;
        }
        calculateRentalTotal(parseFloat(costPerHour), parseFloat(rentalHours));
      } 
      // For classifieds
      else if (paymentType === 'classified') {
        if (isNaN(amount) || amount <= 0) {
          Alert.alert('Invalid Payment Amount', 'Unable to process payment. The listing cost is invalid.');
          navigation.goBack();
          return;
        }
        setTotalAmount(amount);
      }
    };

    validateParamsAndSetAmount();
  }, [paymentType, costPerHour, rentalHours, amount, navigation]);

  // Bouncing animation
  const startBouncing = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceValue, {
          toValue: -20,
          duration: 1000,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
        Animated.timing(bounceValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // Calculate total for rentals
  const calculateRentalTotal = (costHr, hours) => {
    const baseAmount = costHr * hours;
    const bookingFee = baseAmount * 0.06;
    const processingFee = baseAmount * 0.03;
    const tax = (baseAmount + bookingFee) * 0.0825;
    const totalCents = Math.round((baseAmount + bookingFee + processingFee + tax) * 100);
    setTotalAmount(totalCents);
  };

  // Get Firebase token
  const getFirebaseIdToken = async () => {
    try {
      if (user) {
        const token = await user.getIdToken(true);
        console.log("Firebase ID Token:", token);
        return token;
      } else {
        throw new Error('User not authenticated.');
      }
    } catch (error) {
      console.error('Error fetching Firebase ID token:', error);
      Alert.alert('Authentication Error', 'Failed to authenticate user.');
      return '';
    }
  };

  // For rentals, apply discount
  const applyDiscount = async () => {
    if (paymentType !== 'rental') return;

    const code = discountCode.trim().toUpperCase();
    if (!code) {
      setErrorMessage('Please enter a discount code.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');

      const response = await fetch(`${API_URL}/validateDiscount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discountCode: code, amount: totalAmount }),
      });

      let data;
      try {
        data = await response.json();
      } catch (err) {
        const text = await response.text();
        console.error('Response is not JSON:', text);
        setErrorMessage('Failed to apply discount. Please try again.');
        setLoading(false);
        return;
      }

      if (response.ok && data.valid) {
        setDiscountApplied(true);
        setTotalAmount(data.adjustedAmount);
        setSelectedPricing(data.pricingTier);
        Alert.alert('Discount Applied', data.message || 'Discount has been successfully applied.', 
          [{ text: 'OK' }],
          { cancelable: false }
        );
      } else {
        // Revert to original total
        setDiscountApplied(false);
        calculateRentalTotal(costPerHour, rentalHours);
        setErrorMessage(data.message || 'Invalid discount code.');
      }
    } catch (error) {
      console.error('Discount application error:', error);
      setErrorMessage('Failed to apply discount. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Create rental request in Firestore
  const createRentalRequest = async () => {
    if (paymentType !== 'rental') return null;

    try {
      const actualOwnerId = listingDetails.ownerId;
      const actualListingId = listingDetails.id;

      if (!actualOwnerId) {
        Alert.alert('Error', 'Owner info is missing from listing details.');
        return null;
      }
      if (!actualListingId) {
        Alert.alert('Error', 'Listing info is missing.');
        return null;
      }

      const rentalRequestData = {
        renterId: user.uid,
        ownerId: actualOwnerId,
        listingId: actualListingId,
        rentalStatus: 'pending',
        costPerHour: parseFloat(costPerHour),
        rentalHours: parseFloat(rentalHours),
        createdAt: serverTimestamp(),
      };

      const rentalRequestRef = await addDoc(
        collection(db, 'owners', actualOwnerId, 'rentalRequests'),
        rentalRequestData
      );

      const newRentalRequestId = rentalRequestRef.id;
      setRentalRequestId(newRentalRequestId);
      console.log(`Rental Request Created with ID: ${newRentalRequestId}`);
      return newRentalRequestId;
    } catch (error) {
      console.error('Error creating rental request:', error);
      Alert.alert('Error', 'Failed to create rental request.');
      return null;
    }
  };

  /**
   * Create the final listing on the backend (Classified).
   */
  const finalizeClassifiedListingOnBackend = async () => {
    try {
      const token = await getFirebaseIdToken();
      if (!token) {
        throw new Error('Failed to get user token for listing creation.');
      }

      // Example POST to finalize on your backend
      const response = await fetch(`${API_URL}/createListing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ listingDetails }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create classified listing.');
      }

      const result = await response.json();
      console.log('Classified listing creation success:', result);
      return true;
    } catch (error) {
      console.error('Classified listing creation error:', error);
      Alert.alert('Error', error.message || 'Unable to finalize your listing.');
      return false;
    }
  };

  // Final payment logic for classifieds
  const handleClassifiedPayment = async (values) => {
    try {
      setLoading(true);

      if (values.cardholderName.trim() === '') {
        Alert.alert('Validation Error', 'Please enter the name on the credit card.');
        setLoading(false);
        return;
      }

      // 1) Create Payment Intent for classifieds
      const token = await getFirebaseIdToken();
      if (!token) {
        throw new Error('Authentication token is missing for classifieds payment.');
      }

      const body = {
        amount: totalAmount,    // in cents
        listingId: listingDetails.id || '', 
      };

      const response = await fetch(`${API_URL}/create-classified-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        const text = await response.text();
        console.error('Response is not JSON:', text);
        Alert.alert('Error', 'Failed to create payment intent for classified.');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        Alert.alert('Error', data.error || 'Failed to create payment intent.');
        setLoading(false);
        return;
      }

      const clientSecret = data.clientSecret;
      if (!clientSecret) {
        console.error("Error: Client secret is missing for classified payment.");
        Alert.alert('Error', 'Payment details are missing.');
        setLoading(false);
        return;
      }

      // 2) Confirm Payment with Stripe
      const { error, paymentIntent } = await confirmPayment(clientSecret, {
        type: 'Card',
        billingDetails: { name: values.cardholderName.trim() },
      });

      if (error) {
        Alert.alert('Payment failed', error.message);
        setLoading(false);
      } else if (paymentIntent && paymentIntent.status === 'Succeeded') {
        // 3) Payment success: finalize listing on backend
        const success = await finalizeClassifiedListingOnBackend();
        if (success) {
          Alert.alert(
            'Success',
            'Payment processed and your listing has been finalized!',
            [
              {
                text: 'OK',
                onPress: () => {
                  navigation.navigate('Classifieds', { refresh: true });
                },
              },
            ],
            { cancelable: false }
          );
          setIsOperationSuccess(true);
        }
      }
    } catch (error) {
      console.error('Classified payment error:', error);
      Alert.alert('Error', 'Payment processing failed for your listing.');
    } finally {
      setLoading(false);
    }
  };

  // Universal form submission
  const handleFormSubmit = async (values) => {
    if (loading) {
      console.warn("Operation is already in progress.");
      return;
    }

    // For rental
    if (paymentType === 'rental') {
      handleRentalPayment(values);
    } 
    // For classified
    else if (paymentType === 'classified') {
      handleClassifiedPayment(values);
    }
  };

  // Payment for rentals
  const handleRentalPayment = async (values) => {
    if (values.cardholderName.trim() === '') {
      Alert.alert('Validation Error', 'Please enter the name on the credit card.');
      return;
    }

    try {
      setLoading(true);

      let currentRentalRequestId = rentalRequestId;
      if (!currentRentalRequestId) {
        currentRentalRequestId = await createRentalRequest();
        if (!currentRentalRequestId) {
          setLoading(false);
          return;
        }
      }

      const endpoint = '/create-rental-payment-intent';
      const body = {
        rentalRequestId: currentRentalRequestId,
        ownerId: listingDetails.ownerId,
      };

      const token = await getFirebaseIdToken();
      if (!token) {
        throw new Error('Authentication token is missing for rental payment.');
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        const text = await response.text();
        console.error('Response is not JSON:', text);
        Alert.alert('Error', 'Failed to create payment intent.');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        Alert.alert('Error', data.error || 'Failed to create payment intent.');
        setLoading(false);
        return;
      }

      const clientSecret = data.clientSecret;
      if (!clientSecret) {
        console.error("Error: Client secret is missing for rental payment.");
        Alert.alert('Error', 'Payment details are missing.');
        setLoading(false);
        return;
      }

      const { error, paymentIntent } = await confirmPayment(clientSecret, {
        type: 'Card',
        billingDetails: { name: values.cardholderName.trim() },
      });

      if (error) {
        Alert.alert('Payment failed', error.message);
      } else if (paymentIntent && paymentIntent.status === 'Succeeded') {
        Alert.alert(
          'Success',
          'Payment processed successfully, your rental request is created.',
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.navigate('ConfirmationScreen', { rentalRequestId: currentRentalRequestId });
              },
            },
          ],
          { cancelable: false }
        );
        setIsOperationSuccess(true);
      }
    } catch (error) {
      console.error('Rental payment error:', error);
      Alert.alert('Error', 'Payment processing failed for your rental.');
    } finally {
      setLoading(false);
    }
  };

  // Cancel
  const handleCancel = () => {
    if (!loading) {
      navigation.goBack();
    } else {
      Alert.alert('Please wait', 'Operation is in progress. Please wait until it finishes.');
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
        <TouchableOpacity
          onPress={handleCancel}
          style={styles.cancelButton}
          accessibilityLabel="Cancel operation"
          accessibilityRole="button"
        >
          <Ionicons name="close-outline" size={28} color={COLORS.red} />
        </TouchableOpacity>

        <View style={styles.content}>
          {/* Bouncing icon */}
          <Animated.View style={[styles.animatedContainer, { transform: [{ translateY: bounceValue }] }]}>
            <Ionicons
              name={isOperationSuccess ? "checkmark-circle-outline" : "card-outline"}
              size={80}
              color={isOperationSuccess ? COLORS.green : COLORS.primary}
              accessibilityLabel={isOperationSuccess ? "Operation Successful" : "Operation Required"}
            />
          </Animated.View>

          <Text style={styles.title}>
            {paymentType === 'rental' ? 'Complete Your Payment' : 'Finalize Your Listing'}
          </Text>
          <Text style={styles.description}>
            {paymentType === 'rental'
              ? 'Verify your payment details below.'
              : 'Provide your payment details below to finalize your listing.'}
          </Text>

          <Formik
            initialValues={{
              cardholderName: cardholderName,
              discountCode: discountCode,
              listingDetails: listingDetails,
            }}
            validationSchema={Yup.object({
              cardholderName: Yup.string().required('Name on card is required.'),
              discountCode: paymentType === 'rental' 
                ? Yup.string() 
                : Yup.string().notRequired(),
            })}
            onSubmit={handleFormSubmit}
            enableReinitialize
          >
            {({
              handleChange,
              handleBlur,
              handleSubmit,
              values,
              errors,
              touched,
              setFieldValue,
            }) => (
              <>
                {/* RENTAL Cost Breakdown */}
                {paymentType === 'rental' && (
                  <View style={styles.detailsContainer}>
                    <Text style={styles.detail}>
                      Cost Per Hour: ${parseFloat(costPerHour).toFixed(2)}
                    </Text>
                    <Text style={styles.detail}>
                      Rental Hours: {parseFloat(rentalHours).toFixed(0)}
                    </Text>
                    <Text style={styles.detail}>
                      Booking Fee (6%): ${(
                        parseFloat(costPerHour) * parseFloat(rentalHours) * 0.06
                      ).toFixed(2)}
                    </Text>
                    <Text style={styles.detail}>
                      Processing Fee (3%): ${(
                        parseFloat(costPerHour) * parseFloat(rentalHours) * 0.03
                      ).toFixed(2)}
                    </Text>
                    <Text style={styles.detail}>
                      Tax (8.25%): ${(
                        parseFloat(costPerHour) * parseFloat(rentalHours) * 0.06 * 0.0825
                      ).toFixed(2)}
                    </Text>
                    <Text style={styles.amount}>Total Amount: ${displayTotal}</Text>
                  </View>
                )}

                {/* CLASSIFIED Payment: NO 'Sale Price (Display Only)' line anymore */}
                {paymentType === 'classified' && (
                  <View style={styles.detailsContainer}>
                    <Text style={styles.detail}>
                      Listing Title: {listingDetails.title || 'N/A'}
                    </Text>
                    <Text style={styles.detail}>
                      Package Type: {selectedPricing || 'N/A'}
                    </Text>
                    <Text style={styles.amount}>
                      Total Amount: ${displayTotal}
                    </Text>
                  </View>
                )}

                {/* Discount code only for rentals */}
                {paymentType === 'rental' && !discountApplied && (
                  <View style={styles.discountContainer}>
                    <TextInput
                      style={styles.discountInput}
                      placeholder="Enter Discount Code"
                      placeholderTextColor="#888"
                      value={discountCode}
                      onChangeText={(text) => {
                        setDiscountCode(text);
                        setFieldValue('discountCode', text);
                      }}
                      autoCapitalize="characters"
                      editable={!loading}
                      accessibilityLabel="Discount Code Input"
                    />
                    <TouchableOpacity
                      onPress={applyDiscount}
                      style={[
                        styles.applyButton,
                        (loading || discountApplied) && styles.applyButtonDisabled
                      ]}
                      disabled={loading || discountApplied}
                      accessibilityLabel="Apply Discount"
                      accessibilityRole="button"
                    >
                      <Text style={styles.applyButtonText}>Apply</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Show any error messages */}
                {errorMessage !== '' && (
                  <Text style={styles.errorText} accessibilityLiveRegion="polite">
                    {errorMessage}
                  </Text>
                )}

                {/* Name on Card (both rental & classified) */}
                <TextInput
                  style={styles.nameInput}
                  placeholder="Name on Card"
                  placeholderTextColor="#888"
                  value={values.cardholderName}
                  onChangeText={(text) => {
                    setCardholderName(text);
                    setFieldValue('cardholderName', text);
                  }}
                  autoCapitalize="words"
                  editable={!loading}
                  accessibilityLabel="Cardholder Name Input"
                />
                {touched.cardholderName && errors.cardholderName && (
                  <Text style={styles.errorText}>
                    {errors.cardholderName}
                  </Text>
                )}

                {/* Credit Card Fields */}
                <CardField
                  postalCodeEnabled={true}
                  placeholders={{ number: '**** **** **** ****' }}
                  placeholderTextColor="#888"
                  style={styles.cardField}
                  onCardChange={(cardDetails) => {
                    console.log('Card details:', cardDetails);
                  }}
                  onFocus={() => console.log('CardField focused')}
                  editable={!loading}
                  accessibilityLabel="Credit Card Input"
                />

                {/* Payment / Finalize Button */}
                {paymentType === 'rental' ? (
                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={loading || (discountApplied && totalAmount === 0)}
                    style={[
                      styles.payButton,
                      (loading || (discountApplied && totalAmount === 0)) && styles.payButtonDisabled
                    ]}
                    accessibilityLabel={
                      discountApplied && totalAmount === 0
                        ? "Finalize Rental"
                        : `Pay $${displayTotal}`
                    }
                    accessibilityRole="button"
                  >
                    {loading ? (
                      <ActivityIndicator color="white" accessibilityLabel="Processing Payment" />
                    ) : (
                      <Text style={styles.payButtonText}>
                        {discountApplied && totalAmount === 0
                          ? 'Finalize Rental'
                          : `Pay $${displayTotal}`}
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={loading}
                    style={[
                      styles.finalizeButton,
                      loading && styles.finalizeButtonDisabled
                    ]}
                    accessibilityLabel="Finalize Listing"
                    accessibilityRole="button"
                  >
                    {loading ? (
                      <ActivityIndicator
                        color="white"
                        accessibilityLabel="Finalizing Listing"
                      />
                    ) : (
                      <Text style={styles.finalizeButtonText}>
                        Finalize Listing
                      </Text>
                    )}
                  </TouchableOpacity>
                )}

                {/* Secure Payment Note for rentals */}
                {paymentType === 'rental' && (
                  <View style={styles.securePaymentContainer}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={16}
                      color="#555"
                      accessibilityLabel="Secure Payment Lock Icon"
                    />
                    <Text style={styles.securePaymentText}>
                      Your payment is secure and encrypted.
                    </Text>
                  </View>
                )}
              </>
            )}
          </Formik>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
