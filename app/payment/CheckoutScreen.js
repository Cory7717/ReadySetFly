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
import { db } from '../../firebaseConfig'; // Adjust the import based on your project structure
import { Formik } from 'formik';
import * as Yup from 'yup';

// Configuration Constants
const API_URL = 'https://us-central1-ready-set-fly-71506.cloudfunctions.net/api'; // Backend API URL

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
  red: '#EF4444', // Error color
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
  detailsText: {
    fontSize: 16,
    color: COLORS.black,
    marginBottom: 5,
  },
  // Add other styles as needed
});

export default function CheckoutScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { confirmPayment } = useConfirmPayment();

  const auth = getAuth(); // Initialize Firebase Auth
  const user = auth.currentUser; // Get current Firebase user

  // Extract parameters from navigation route
  const {
    paymentType = 'rental', // Default to 'rental' if not provided
    amount: initialAmount = 0, // For 'classified' payments (in cents)
    costPerHour = 0, // For 'rental' payments
    rentalHours = 1, // For 'rental' payments
    rentalRequestId: routeRentalRequestId = '', // Existing rental request ID, if any
    listingDetails = {}, // Details of the listing
    selectedPricing: initialSelectedPricing = '', // Pricing tier selected
    images: listingImages = [], // Images for classified listings
  } = route.params || {};

  // Log received parameters for debugging
  console.log("CheckoutScreen received params:", route.params);

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

  // State to hold rentalRequestId
  const [rentalRequestId, setRentalRequestId] = useState(routeRentalRequestId || '');

  // For displaying animation
  const bounceValue = useRef(new Animated.Value(0)).current;

  // Convert totalAmount to a fixed amount for displaying
  const displayTotal = (totalAmount / 100).toFixed(2);

  /**
   * Effect to validate navigation parameters upon component mount
   * Ensures that all required data is present before proceeding
   */
  useEffect(() => {
    console.log("CheckoutScreen useEffect triggered");
    startBouncing();

    // Parameter Validation
    const validateParameters = () => {
      // Validate paymentType
      const validPaymentTypes = ['rental', 'classified'];
      if (!validPaymentTypes.includes(paymentType)) {
        Alert.alert('Invalid Payment Type', `Unsupported payment type: ${paymentType}`);
        navigation.goBack();
        return false;
      }

      if (paymentType === 'rental') {
        // For Rentals, ensure costPerHour and rentalHours are positive numbers
        if (isNaN(costPerHour) || costPerHour <= 0) {
          Alert.alert('Invalid Cost Per Hour', 'Please provide a valid cost per hour for the rental.');
          navigation.goBack();
          return false;
        }

        if (isNaN(rentalHours) || rentalHours <= 0) {
          Alert.alert('Invalid Rental Hours', 'Please provide valid rental hours.');
          navigation.goBack();
          return false;
        }

        calculateRentalTotal(parseFloat(costPerHour), parseFloat(rentalHours));
      } else if (paymentType === 'classified') {
        // For Classifieds, ensure initialAmount is a positive number
        if (isNaN(initialAmount) || initialAmount <= 0) {
          Alert.alert('Invalid Amount', 'Please provide a valid amount for the listing.');
          navigation.goBack();
          return false;
        }

        // Ensure listingDetails has required fields: id and ownerId
        if (!listingDetails.id || !listingDetails.ownerId) {
          Alert.alert('Invalid Listing Details', 'Listing details are incomplete.');
          navigation.goBack();
          return false;
        }

        // Ensure lat and lng are present in listingDetails
        if (!listingDetails.lat || !listingDetails.lng) {
          Alert.alert('Invalid Location Data', 'Listing location information is missing.');
          navigation.goBack();
          return false;
        }

        setTotalAmount(initialAmount);
      }

      return true;
    };

    // Proceed only if parameters are valid
    if (validateParameters()) {
      // Additional setup if needed
    }
  }, [paymentType, costPerHour, rentalHours, initialAmount, listingDetails, navigation]);

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

  /**
   * Function to calculate total amount for Rentals
   */
  const calculateRentalTotal = (costPerHour, rentalHours) => {
    // Ensure valid inputs
    const validCostPerHour = parseFloat(costPerHour);
    const validRentalHours = parseFloat(rentalHours);

    if (isNaN(validCostPerHour) || isNaN(validRentalHours) || validCostPerHour <= 0 || validRentalHours <= 0) {
      setErrorMessage('Invalid rental details. Please check your rental hours and cost per hour.');
      setTotalAmount(0);
      return;
    }

    const baseAmount = validCostPerHour * validRentalHours; // in dollars
    const bookingFee = baseAmount * 0.06; // 6%
    const processingFee = baseAmount * 0.03; // 3%
    const tax = (baseAmount + bookingFee) * 0.0825; // 8.25% on (baseAmount + bookingFee)
    const total = Math.round((baseAmount + bookingFee + processingFee + tax) * 100); // Convert to cents

    setTotalAmount(total);
  };

  /**
   * Function to get Firebase ID Token
   * Ensures authenticated requests to the backend.
   */
  const getFirebaseIdToken = async () => {
    try {
      if (user) {
        const token = await user.getIdToken(true);
        console.log("Firebase ID Token:", token); // Add this line for debugging
        return token;
      } else {
        throw new Error('User is not authenticated.');
      }
    } catch (error) {
      console.error('Error fetching Firebase ID token:', error);
      Alert.alert('Authentication Error', 'Failed to authenticate user.');
      return '';
    }
  };

  /**
   * Function to apply discount code by validating it with the backend
   */
  const applyDiscount = async () => {
    const code = discountCode.trim().toUpperCase();

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
        body: JSON.stringify({ discountCode: code, amount: totalAmount }), // Pass current amount for accurate discount
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        const text = await response.text();
        console.error('Response is not JSON:', text);
        setErrorMessage('Failed to apply discount. Please try again.');
        setLoading(false);
        return;
      }

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
          calculateRentalTotal(costPerHour, rentalHours); // Recalculate for Rentals
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

  /**
   * Function to create a rental request under the correct Firestore path
   */
  const createRentalRequest = async () => {
    try {
      // Ensure ownerId and listingId are correctly obtained from listingDetails
      const actualOwnerId = listingDetails.ownerId;
      const actualListingId = listingDetails.id;

      if (!actualOwnerId) {
        Alert.alert('Error', 'Owner information is missing from listing details.');
        return null;
      }

      if (!actualListingId) {
        Alert.alert('Error', 'Listing information is missing.');
        return null;
      }

      const rentalRequestData = {
        renterId: user.uid,
        ownerId: actualOwnerId,
        listingId: actualListingId,
        rentalStatus: 'pending', // Initial status
        costPerHour: parseFloat(costPerHour),
        rentalHours: parseFloat(rentalHours),
        createdAt: serverTimestamp(),
        // Add other relevant fields as necessary
      };

      // Create the rental request under the correct Firestore path
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
   * Function to create the listing on the backend
   */
  const createListingBackend = async (values, isFree = false) => {
    try {
      const token = await getFirebaseIdToken();
      if (!token) {
        throw new Error('Authentication token is missing.');
      }

      // Merge selectedPricing into listingDetails if not a free listing
      const mergedListingDetails = { ...values.listingDetails };
      if (!isFree) {
        mergedListingDetails.selectedPricing = selectedPricing;
      }

      // Ensure that 'isFreeListing' is set correctly
      mergedListingDetails.isFreeListing = isFree;

      // Validate that all required fields are present before sending
      const category = mergedListingDetails.category;
      const requiredFieldsByCategory = {
        'Aircraft for Sale': ['title', 'description'],
        'Aviation Jobs': ['companyName', 'jobTitle', 'jobDescription'],
        'Flight Schools': ['flightSchoolName', 'flightSchoolDetails'],
      };

      const requiredFields = requiredFieldsByCategory[category];
      if (!requiredFields) {
        throw new Error(`Invalid category: ${category}`);
      }

      // Conditionally require 'price' and 'selectedPricing' if not a free listing and category is 'Aircraft for Sale'
      if (category === 'Aircraft for Sale' && !isFree) {
        requiredFields.push('price', 'selectedPricing');
      }

      // Check for missing required fields
      const missingFields = requiredFields.filter(field => !mergedListingDetails[field]);
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Ensure 'lat' and 'lng' are present and valid
      const { lat, lng } = mergedListingDetails;
      if (!lat || !lng || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
        throw new Error("Invalid or missing location data (lat, lng).");
      }

      // Construct FormData
      const formData = new FormData();

      // Append listing details as a JSON string
      formData.append('listingDetails', JSON.stringify(mergedListingDetails));

      // Append images if any (assuming images are passed via route.params as local URIs)
      if (listingImages.length > 0) {
        listingImages.forEach((imageUri, index) => {
          if (typeof imageUri === 'string' && imageUri.startsWith('file://')) {
            formData.append('images', {
              uri: imageUri,
              name: `image_${index}.jpg`,
              type: 'image/jpeg',
            });
          } else {
            console.warn(`Invalid image URI at index ${index}:`, imageUri);
          }
        });
      } else {
        console.log('No images to upload.');
      }

      const response = await fetch(`${API_URL}/createListing`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          // 'Content-Type': 'multipart/form-data' is set automatically by fetch when using FormData
        },
        body: formData,
      });

      let responseData;
      try {
        responseData = await response.json();
      } catch (e) {
        const text = await response.text();
        console.error('Response is not JSON:', text);
        throw new Error('Failed to create listing. Please try again.');
      }

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to create listing.');
      }

      console.log('Listing creation response:', responseData);
      return responseData.listingId; // Return the listingId for further processing
    } catch (error) {
      console.error('Listing creation error:', error);
      Alert.alert('Error', error.message || 'Failed to create listing.');
      return null;
    }
  };

  /**
   * Function to handle form submission
   */
  const handleFormSubmit = async (values) => {
    // If discount is applied and totalAmount is zero (free listing)
    if (discountApplied && totalAmount === 0) {
      try {
        setLoading(true);
        const listingId = await createListingBackend(values, true); // Pass 'true' to indicate a free listing
        if (listingId) {
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

    // Proceed with payment
    handlePayment(values);
  };

  /**
   * Handle payment processing
   */
  const handlePayment = async (values) => {
    // Validate cardholder name
    if (values.cardholderName.trim() === '') {
      Alert.alert('Validation Error', 'Please enter the name on the credit card.');
      return;
    }

    // If discount is applied and totalAmount is zero (free listing)
    if (discountApplied && totalAmount === 0) {
      try {
        setLoading(true);
        const listingId = await createListingBackend(values, true); // Pass 'true' to indicate a free listing
        if (listingId) {
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

      let currentRentalRequestId = rentalRequestId;
      let currentListingId = listingDetails.id;

      // If paymentType is 'rental' and rentalRequestId is not provided, create a new rental request
      if (paymentType === 'rental' && !currentRentalRequestId) {
        currentRentalRequestId = await createRentalRequest();
        if (!currentRentalRequestId) {
          setLoading(false);
          return;
        }
      }

      // For 'classified', create the listing first to get listingId if not already present
      if (paymentType === 'classified' && !currentListingId) {
        const listingId = await createListingBackend(values);
        if (!listingId) {
          setLoading(false);
          return;
        }
        currentListingId = listingId;
        // Update listingDetails with listingId if necessary
        // Note: Since listingDetails is extracted from route.params, it's immutable. 
        // If you need to update it, consider using a state or a context.
      }

      let clientSecret = '';

      const endpoint =
        paymentType === 'rental'
          ? '/create-rental-payment-intent'
          : '/create-classified-payment-intent';

      // Prepare request body based on payment type
      let body = {};
      if (paymentType === 'rental') {
        body = { rentalRequestId: currentRentalRequestId };
      } else if (paymentType === 'classified') {
        body = { 
          amount: totalAmount, 
          currency: 'usd', 
          listingId: currentListingId 
        };
      }

      // Fetch Firebase ID token for authenticated requests
      const token = await getFirebaseIdToken();
      if (!token) {
        throw new Error('Authentication token is missing.');
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', // JSON since server expects JSON body
          Authorization: `Bearer ${token}`, // Include Firebase ID Token
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

      clientSecret = data.clientSecret;

      if (!clientSecret) {
        console.error("Error: Client secret is missing in the payment response.");
        Alert.alert('Error', 'Payment details are missing.');
        setLoading(false);
        return;
      }

      // Confirm the payment with Stripe using the client secret
      const { error, paymentIntent } = await confirmPayment(clientSecret, {
        type: 'Card',
        billingDetails: { name: values.cardholderName.trim() }, // Use user's input name
      });

      if (error) {
        Alert.alert('Payment failed', error.message);
      } else if (paymentIntent && paymentIntent.status === 'Succeeded') {
        // After successful payment, navigate accordingly
        Alert.alert(
          'Success',
          'Payment processed successfully and your listing has been created.',
          [
            {
              text: 'OK',
              onPress: () => {
                if (paymentType === 'rental') {
                  navigation.navigate('ConfirmationScreen', { rentalRequestId: currentRentalRequestId });
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
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Error', 'Payment processing failed.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle cancellation
   */
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
        <TouchableOpacity 
          onPress={handleCancel} 
          style={styles.cancelButton} 
          accessibilityLabel="Cancel payment" 
          accessibilityRole="button"
        >
          <Ionicons name="close-outline" size={28} color={COLORS.red} />
        </TouchableOpacity>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Bouncing animation */}
          <Animated.View style={[styles.animatedContainer, { transform: [{ translateY: bounceValue }] }]}>
            <Ionicons
              name={isPaymentSuccess ? "checkmark-circle-outline" : "card-outline"}
              size={80}
              color={isPaymentSuccess ? COLORS.green : COLORS.primary} // Green on success, red otherwise
              accessibilityLabel={isPaymentSuccess ? "Payment Successful" : "Payment Required"}
            />
          </Animated.View>

          <Text style={styles.title}>Complete Your Payment</Text>
          <Text style={styles.description}>Verify your payment details below.</Text>

          {/* Formik Form */}
          <Formik
            initialValues={{
              cardholderName: cardholderName,
              discountCode: discountCode,
              listingDetails: listingDetails,
            }}
            validationSchema={Yup.object({
              cardholderName: Yup.string()
                .required('Name on card is required.'),
              discountCode: Yup.string(),
            })}
            onSubmit={handleFormSubmit}
            enableReinitialize={true}
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
                {/* Display Payment Details */}
                {paymentType === 'rental' ? (
                  <View style={styles.detailsContainer}>
                    <Text style={styles.detail}>Cost Per Hour: ${parseFloat(costPerHour).toFixed(2)}</Text>
                    <Text style={styles.detail}>Rental Hours: {parseFloat(rentalHours).toFixed(0)}</Text>
                    <Text style={styles.detail}>Booking Fee (6%): ${(parseFloat(costPerHour) * parseFloat(rentalHours) * 0.06).toFixed(2)}</Text>
                    <Text style={styles.detail}>Processing Fee (3%): ${(parseFloat(costPerHour) * parseFloat(rentalHours) * 0.03).toFixed(2)}</Text>
                    <Text style={styles.detail}>Tax (8.25%): ${(parseFloat(costPerHour) * parseFloat(rentalHours) * 0.06 * 0.0825).toFixed(2)}</Text>
                    <Text style={styles.amount}>
                      Total Amount: $
                      {(totalAmount / 100).toFixed(2)}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.detailsContainer}>
                    <Text style={styles.detail}>Listing Type: {listingDetails.type || 'N/A'}</Text>
                    <Text style={styles.detail}>Amount: ${(initialAmount / 100).toFixed(2)}</Text>
                    {/* Display selected pricing tier if available */}
                    {!listingDetails.isFreeListing && selectedPricing && (
                      <Text style={styles.detail}>Package Type: {selectedPricing}</Text>
                    )}
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
                      style={[styles.applyButton, (loading || discountApplied) && styles.applyButtonDisabled]}
                      disabled={loading || discountApplied}
                      accessibilityLabel="Apply Discount"
                      accessibilityRole="button"
                    >
                      <Text style={styles.applyButtonText}>Apply</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Display error message if any */}
                {errorMessage !== '' && (
                  <Text style={styles.errorText} accessibilityLiveRegion="polite">{errorMessage}</Text>
                )}

                {/* Cardholder Name Input */}
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
                  <Text style={styles.errorText}>{errors.cardholderName}</Text>
                )}

                {/* Stripe CardField component */}
                <CardField
                  postalCodeEnabled={true}
                  placeholders={{ number: '**** **** **** ****' }} // Stripe test card
                  placeholderTextColor="#888"
                  style={styles.cardField}
                  onCardChange={(cardDetails) => {
                    console.log('Card details:', cardDetails);
                  }}
                  onFocus={() => console.log('CardField focused')}
                  editable={!(discountApplied && totalAmount === 0)} // Disable card input if discount makes it free
                  accessibilityLabel="Credit Card Input"
                />

                {/* Pay Button */}
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={loading || (discountApplied && totalAmount === 0)}
                  style={[
                    styles.payButton, 
                    (loading || (discountApplied && totalAmount === 0)) && styles.payButtonDisabled
                  ]}
                  accessibilityLabel={discountApplied && totalAmount === 0 ? "Finalize Listing" : `Pay $${displayTotal}`}
                  accessibilityRole="button"
                >
                  {loading ? (
                    <ActivityIndicator color="white" accessibilityLabel="Processing Payment" />
                  ) : (
                    <Text style={styles.payButtonText}>
                      {discountApplied && totalAmount === 0 ? 'Finalize Listing' : `Pay $${displayTotal}`}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Secure Payment Text */}
                <View style={styles.securePaymentContainer}>
                  <Ionicons name="lock-closed-outline" size={16} color="#555" accessibilityLabel="Secure Payment Lock Icon" />
                  <Text style={styles.securePaymentText}>
                    Your payment is secure and encrypted.
                  </Text>
                </View>
              </>
            )}
          </Formik>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
