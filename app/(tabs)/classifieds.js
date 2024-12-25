// src/screens/Classifieds.js

import React, { useEffect, useState, useRef } from 'react';
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Modal,
  ImageBackground,
  Image,
  Alert,
  SafeAreaView,
  Animated,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  Platform,
  Dimensions,
  Linking,
  StyleSheet,
} from 'react-native';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; // Firebase Auth
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { db, storage } from '../../firebaseConfig';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import wingtipClouds from '../../Assets/images/wingtip_clouds.jpg';
import * as ImagePicker from 'expo-image-picker';
import { Formik } from 'formik';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import CheckoutScreen from '../payment/CheckoutScreen'; // Standardized Import

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
  primary: '#1D4ED8',
  secondary: '#6B7280',
  background: '#F3F4F6',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#9CA3AF',
  lightGray: '#D1D5DB',
  red: '#EF4444',
  green: '#10B981', // Added green color for free listings
};

const Stack = createStackNavigator();

// Define API_URL as a constant
const API_URL =
  'https://us-central1-ready-set-fly-71506.cloudfunctions.net/api';

const Classifieds = () => {
  const auth = getAuth(); // Initialize Firebase Auth
  const navigation = useNavigation();
  
  // Existing state variables
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [jobDetailsModalVisible, setJobDetailsModalVisible] = useState(false);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPricing, setSelectedPricing] = useState('Basic');
  const [selectedListing, setSelectedListing] = useState(null);
  const [editingListing, setEditingListing] = useState(null); // State to hold the listing being edited
  const [imageIndex, setImageIndex] = useState(0);
  const [fullScreenModalVisible, setFullScreenModalVisible] = useState(false);
  const [zoomImageUri, setZoomImageUri] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('Aircraft for Sale'); // Default category
  
  // **Added location state**
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true); // Track location loading state
  
  const scaleValue = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  
  // **Added scrollX state**
  const scrollX = useRef(new Animated.Value(0)).current;
  
  const categories = ['Aircraft for Sale', 'Aviation Jobs', 'Flight Schools'];
  
  const defaultPricingPackages = {
    Basic: 25,
    Featured: 70,
    Enhanced: 150, // This will be updated to allow up to 20 images
  };
  
  const [pricingPackages, setPricingPackages] = useState(defaultPricingPackages);
  
  const pricingDescriptions = {
    Basic: `Basic Package Includes:
• 30-day listing
• Add up to 5 images
• Add up to 7 lines of listing description`,

    Featured: `Featured Package Includes:
• 46-day listing
• Add up to 10 images
• Add up to 12 lines of description
• Listing will be periodically refreshed to keep closer to the top of the listing page`,

    Enhanced: `Enhanced Package Includes:
• 60-day listing
• Add up to 20 images
• Unlimited lines of aircraft description
• Listing will frequently be refreshed to keep closer to the top of the listings page`,
  };
  
  const openPricingInfo = (packageType) => {
    setPricingModalVisible((prev) => ({ ...prev, [packageType]: true }));
  };
  
  const closePricingInfo = (packageType) => {
    setPricingModalVisible((prev) => ({ ...prev, [packageType]: false }));
  };
  
  const [pricingModalVisible, setPricingModalVisible] = useState({
    Basic: false,
    Featured: false,
    Enhanced: false,
  });
  
  // **Added scrollViewRef for the up button functionality**
  const scrollViewRef = useRef(null);
  
  // **Added state for showing the up button**
  const [showUpButton, setShowUpButton] = useState(false);
  
  // Listen to authentication state changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });

    return () => unsubscribeAuth();
  }, [auth]);

  // Fetch user location if authenticated
  useEffect(() => {
    if (user) {
      const fetchLocation = async () => {
        try {
          let { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission denied', 'Location access is required.');
            setLocation(null);
            setLocationLoading(false);
            return;
          }

          let currentLocation = await Location.getCurrentPositionAsync({});
          setLocation(currentLocation);
        } catch (error) {
          console.error('Error fetching location: ', error);
          Alert.alert(
            'Error fetching location',
            'Location is unavailable. Make sure that location services are enabled.'
          );
          setLocation(null);
        } finally {
          setLocationLoading(false);
        }
      };

      fetchLocation();
    } else {
      setLocation(null);
      setLocationLoading(false);
    }
  }, [user]);

  // Update pricing packages based on selectedCategory
  useEffect(() => {
    if (selectedCategory === 'Aviation Jobs') {
      setPricingPackages({
        Basic: 15,
      });
      setSelectedPricing('Basic');
    } else if (selectedCategory === 'Flight Schools') {
      setPricingPackages({
        Basic: 250,
      });
      setSelectedPricing('Basic');
    } else {
      setPricingPackages(defaultPricingPackages);
      setSelectedPricing('Basic');
    }
  }, [selectedCategory]);

  // Listen to Firestore listings based on selected category and user authentication
  useEffect(() => {
    if (user) {
      const collectionName = 'listings'; // Updated Collection Name
      const q = selectedCategory
        ? query(
            collection(db, collectionName),
            where('category', '==', selectedCategory),
            orderBy('createdAt', 'desc')
          )
        : query(collection(db, collectionName), orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const listingsData = [];
          querySnapshot.forEach((doc) => {
            listingsData.push({ id: doc.id, ...doc.data() });
          });

          setListings(listingsData);
          // Do not set filteredListings here; handled by useEffect below
        },
        (error) => {
          console.error('Error fetching listings:', error);
          Alert.alert('Error', 'Failed to fetch listings. Please try again later.');
        }
      );

      return () => unsubscribe();
    } else {
      setListings([]);
      setFilteredListings([]);
    }
  }, [selectedCategory, user]);

  // Update filteredListings whenever listings or selectedCategory change
  useEffect(() => {
    if (listings && selectedCategory) {
      setFilteredListings(
        listings.filter((listing) => listing.category === selectedCategory)
      );
    } else {
      setFilteredListings(listings);
    }
  }, [listings, selectedCategory]);

  // **Added listener for scrollY to show/hide up button**
  useEffect(() => {
    const listener = scrollY.addListener(({ value }) => {
      if (value > 200 && !showUpButton) {
        setShowUpButton(true);
      } else if (value <= 200 && showUpButton) {
        setShowUpButton(false);
      }
    });

    return () => {
      scrollY.removeListener(listener);
    };
  }, [scrollY, showUpButton]);

  // Image picker functionality
  const pickImage = async () => {
    let maxImages = 1;

    if (selectedCategory === 'Aviation Jobs') {
      maxImages = 3;
    } else if (selectedCategory === 'Flight Schools') {
      maxImages = 5;
    } else if (selectedCategory === 'Aircraft for Sale') {
      // Updated to allow up to 20 images in Enhanced package
      maxImages =
        selectedPricing === 'Basic'
          ? 7
          : selectedPricing === 'Featured'
          ? 14
          : 20;
    }

    if (images.length >= maxImages) {
      Alert.alert(`You can only upload up to ${maxImages} images.`);
      return;
    }

    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert(
        'Permission Required',
        'Permission to access the camera roll is required!'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: maxImages - images.length,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selectedImages = result.assets.map((asset) => {
        // Ensure the URI is correctly formatted
        const uri = asset.uri.startsWith('file://')
          ? asset.uri
          : `file://${asset.uri}`;
        return uri;
      });
      setImages([...images, ...selectedImages].slice(0, maxImages));
    }
  };

  // Render image upload button with dynamic limits
  const renderImageUploadButton = () => {
    let maxImages = 1;
    if (selectedCategory === 'Aviation Jobs') {
      maxImages = 3;
    } else if (selectedCategory === 'Flight Schools') {
      maxImages = 5;
    } else if (selectedCategory === 'Aircraft for Sale') {
      maxImages =
        selectedPricing === 'Basic'
          ? 7
          : selectedPricing === 'Featured'
          ? 14
          : 20; // Updated to 20
    }

    const remainingUploads = maxImages - images.length;

    return (
      <TouchableOpacity
        onPress={pickImage}
        disabled={images.length >= maxImages}
        style={{
          backgroundColor:
            remainingUploads > 0 ? COLORS.primary : COLORS.lightGray,
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderRadius: 8,
          marginTop: 8,
          marginBottom: 16,
        }}
        accessibilityLabel="Upload Images"
        accessibilityRole="button"
      >
        <Text style={{ textAlign: 'center', color: COLORS.white }}>
          {images.length >= maxImages
            ? `Maximum ${maxImages} Images Reached`
            : `Add Image (${remainingUploads} remaining)`}
        </Text>
      </TouchableOpacity>
    );
  };

  // Render listing images in FlatList
  const renderListingImages = (item) => {
    return (
      <View style={{ position: 'relative' }}>
        <FlatList
          data={item.images || []} // Ensure data is an array
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(imageUri, index) => `${item.id}-${index}`}
          renderItem={({ item: imageUri }) => (
            <TouchableOpacity
              onPress={() => handleImagePress(imageUri)}
              activeOpacity={0.9}
              accessible={true}
              accessibilityLabel="View Listing Image"
              accessibilityRole="imagebutton"
            >
              <Image
                source={{ uri: imageUri }}
                style={{
                  width: SCREEN_WIDTH - 32,
                  height: 200,
                  borderRadius: 10,
                  marginBottom: 10,
                }}
              />
            </TouchableOpacity>
          )}
        />
        {/* Overlay for Price and Location */}
        {item.category === 'Aircraft for Sale' && (
          <View style={styles.priceLocationOverlay}>
            {/* Price on the left */}
            <Text style={styles.priceText}>
              Price: $
              {item.salePrice != null
                ? String(item.salePrice)
                : 'N/A'}
            </Text>

            {/* Location on the right with pin icon */}
            <View style={styles.locationContainer}>
              <Ionicons name="location-outline" size={20} color={COLORS.white} />
              <Text style={styles.locationText}>
                {item.city ? item.city : 'N/A'}, {item.state ? item.state : 'N/A'}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  // Filter listings by distance (in miles)
  const filterListingsByDistance = (radiusMiles) => {
    if (!location) {
      Alert.alert('Error', 'Location is not available.');
      return;
    }

    const { latitude: userLat, longitude: userLng } = location.coords;

    const filtered = listings.filter((listing) => {
      if (listing.location && listing.location.lat && listing.location.lng) {
        const { lat, lng } = listing.location;
        const distance = getDistanceFromLatLonInMiles(
          userLat,
          userLng,
          lat,
          lng
        );
        return distance <= radiusMiles;
      }
      return false;
    });

    setFilteredListings(filtered);
  };

  // Helper function to calculate distance between two coordinates
  const getDistanceFromLatLonInMiles = (lat1, lon1, lat2, lon2) => {
    const R = 3958.8; // Radius of the Earth in miles
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
  };

  // Convert degrees to radians
  const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
  };

  // Handle listing press to show details
  const handleListingPress = (listing) => {
    setSelectedListing(listing);
    if (listing.category === 'Aviation Jobs') {
      setJobDetailsModalVisible(true);
    } else {
      setDetailsModalVisible(true);
    }
  };

  // Handle editing a listing
  const handleEditListing = (listing) => {
    setEditingListing(listing);
    setImages(listing.images || []);

    // Set selectedCategory based on the listing's category
    setSelectedCategory(listing.category);

    // Determine selectedPricing based on listing.packageType
    let currentPricing = 'Basic';
    if (listing.packageType && pricingPackages[listing.packageType]) {
      currentPricing = listing.packageType;
    }

    setSelectedPricing(currentPricing);
    setModalVisible(true);
  };

  // Utility to get Firebase token
  const getFirebaseIdToken = async () => {
    try {
      const token = await user.getIdToken(true);
      return token;
    } catch (error) {
      console.error('Error fetching Firebase ID token:', error);
      Alert.alert('Authentication Error', 'Failed to authenticate user.');
      return '';
    }
  };

  // Handle deleting a listing
  const handleDeleteListing = async (listingId) => {
    try {
      Alert.alert('Confirm Delete', 'Are you sure you want to delete this listing?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const token = await getFirebaseIdToken();
            const response = await fetch(`${API_URL}/deleteListing`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ listingId }),
            });

            if (response.ok) {
              Alert.alert('Listing Deleted', 'Your listing has been deleted.');
              setDetailsModalVisible(false);
              setJobDetailsModalVisible(false);
              // Refresh listings by filtering out the deleted one
              const updatedListings = listings.filter(
                (listing) => listing.id !== listingId
              );
              setListings(updatedListings);
              setFilteredListings(updatedListings);
            } else {
              // Try reading JSON carefully to avoid parse errors
              let errorMsg = 'Failed to delete listing.';
              try {
                const errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
              } catch (err) {
                console.error('Error parsing deleteListing error data:', err);
              }
              throw new Error(errorMsg);
            }
          },
        },
      ]);
    } catch (error) {
      console.error('Error deleting listing: ', error);
      Alert.alert('Error', error.message || 'Failed to delete the listing.');
    }
  };

  // Handle asking a question via email
  const handleAskQuestion = () => {
    if (selectedListing && selectedListing.email) {
      const email = selectedListing.email;
      const subject = encodeURIComponent(
        `Inquiry about ${selectedListing.title || 'Your Listing'}`
      );
      const mailUrl = `mailto:${email}?subject=${subject}`;

      Linking.openURL(mailUrl).catch((error) => {
        console.error('Error opening mail app:', error);
        Alert.alert('Error', 'Unable to open mail app.');
      });
    } else {
      Alert.alert('Error', 'Contact email not available.');
    }
  };

  // Upload images to Firebase Storage and return their URLs
  const uploadImagesToFirebase = async (imageUris) => {
    try {
      const uploadPromises = imageUris.map(async (uri, index) => {
        // If the uri is already a URL, skip uploading
        if (uri.startsWith('http')) {
          return uri;
        }
        const response = await fetch(uri);
        const blob = await response.blob();
        const fileName = `${user.uid}/${Date.now()}-${index}.jpg`;
        const fileRef = storageRef(storage, fileName);
        await uploadBytes(fileRef, blob);
        const downloadURL = await getDownloadURL(fileRef);
        return downloadURL;
      });

      const imageUrls = await Promise.all(uploadPromises);
      return imageUrls;
    } catch (error) {
      console.error('Error uploading images to Firebase:', error);
      Alert.alert('Error', 'Failed to upload images.');
      return [];
    }
  };

  /**
   * Create listing on the backend
   * Updated with fallback logic for non-JSON error responses.
   */
  const createListingBackend = async (values, isFree = false) => {
    try {
      const token = await getFirebaseIdToken();
      if (!location) {
        Alert.alert('Error', 'Location data is not available.');
        return false;
      }

      const imageUrls = await uploadImagesToFirebase(images);
      const listingDetailsWithLocation = {
        ...values,
        location: {
          lat: parseFloat(values.lat),
          lng: parseFloat(values.lng),
        },
        salePrice: values.salePrice, // Keep as string
        isFreeListing: isFree,
        packageType: isFree ? null : values.selectedPricing,
        packageCost: isFree ? 0 : parseFloat(values.packageCost),
        images: imageUrls,
        ownerId: user.uid,
      };

      // Category requirements
      const categoryRequirements = {
        'Aircraft for Sale': ['title', 'description'],
        'Aviation Jobs': ['companyName', 'jobTitle', 'jobDescription'],
        'Flight Schools': ['flightSchoolName', 'flightSchoolDetails'],
      };
      const requiredFields = categoryRequirements[values.category];

      // Validate required
      for (const field of requiredFields) {
        if (!listingDetailsWithLocation[field]) {
          throw new Error(`Missing required fields: ${field}`);
        }
      }

      console.log('Listing Details with Location:', listingDetailsWithLocation);

      const response = await fetch(`${API_URL}/createListing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ listingDetails: listingDetailsWithLocation }),
      });

      // Read entire response as text
      const responseText = await response.text();
      console.log('Raw createListing response text:', responseText); // <--- Added logging
      let responseData = null;

      // Attempt to parse JSON
      try {
        responseData = JSON.parse(responseText);
      } catch (err) {
        console.error('Error parsing createListing response text:', responseText, err);
        responseData = null;
      }

      if (!response.ok) {
        if (responseData && responseData.error) {
          throw new Error(responseData.error);
        } else {
          throw new Error(responseText || 'Failed to create listing.');
        }
      }

      // If OK, we have a successful create
      console.log('Listing creation response:', responseData);
      return true;
    } catch (error) {
      console.error('Listing creation error:', error);
      Alert.alert('Error', error.message || 'Failed to create listing.');
      return false;
    }
  };

  /**
   * Update listing on the backend
   * Updated with fallback logic for non-JSON error responses.
   */
  const updateListingBackend = async (listingId, values, isFree = false) => {
    try {
      const token = await getFirebaseIdToken();
      if (!location) {
        Alert.alert('Error', 'Location data is not available.');
        return false;
      }

      let imageUrls = [];
      if (images.length > 0) {
        imageUrls = await uploadImagesToFirebase(images);
      } else {
        imageUrls = selectedListing.images || [];
      }

      const listingDetailsWithLocation = {
        ...values,
        location: {
          lat: parseFloat(values.lat),
          lng: parseFloat(values.lng),
        },
        salePrice: values.salePrice, // Keep as string
        isFreeListing: isFree,
        packageType: isFree ? null : values.selectedPricing,
        packageCost: isFree ? 0 : parseFloat(values.packageCost),
        images: imageUrls,
        ownerId: user.uid,
      };

      // Category requirements
      const categoryRequirements = {
        'Aircraft for Sale': ['title', 'description'],
        'Aviation Jobs': ['companyName', 'jobTitle', 'jobDescription'],
        'Flight Schools': ['flightSchoolName', 'flightSchoolDetails'],
      };
      const requiredFields = categoryRequirements[values.category];

      // Validate required
      for (const field of requiredFields) {
        if (!listingDetailsWithLocation[field]) {
          throw new Error(`Missing required fields: ${field}`);
        }
      }

      console.log('Listing Details with Location:', listingDetailsWithLocation);

      const response = await fetch(`${API_URL}/updateListing`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          listingId,
          listingDetails: listingDetailsWithLocation,
        }),
      });

      // Read entire response as text
      const responseText = await response.text();
      console.log('Raw updateListing response text:', responseText); // <--- Added logging
      let responseData = null;

      // Attempt to parse JSON
      try {
        responseData = JSON.parse(responseText);
      } catch (err) {
        console.error('Error parsing updateListing response text:', responseText, err);
        responseData = null;
      }

      if (!response.ok) {
        if (responseData && responseData.error) {
          throw new Error(responseData.error);
        } else {
          throw new Error(responseText || 'Failed to update listing.');
        }
      }

      console.log('Listing update response:', responseData);
      return true;
    } catch (error) {
      console.error('Listing update error:', error);
      Alert.alert('Error', error.message || 'Failed to update listing.');
      return false;
    }
  };

  // Handle form submission for listing
  const onSubmitMethod = async (values) => {
    if (!user) {
      Alert.alert('Error', 'User information is not available.');
      setLoading(false);
      return;
    }
    if (!location) {
      Alert.alert('Error', 'Location data is not available.');
      setLoading(false);
      return;
    }

    setLoading(true);

    // If it's a free listing, create or update immediately
    if (values.isFreeListing) {
      if (editingListing) {
        // Update existing listing as free
        const success = await updateListingBackend(editingListing.id, values, true);
        if (success) {
          Alert.alert('Success', 'Your free listing has been updated successfully.', [
            {
              text: 'OK',
              onPress: () => {
                setModalVisible(false);
                setEditingListing(null);
                setImages([]);
              },
            },
          ]);
        }
      } else {
        // Create new free listing
        const success = await createListingBackend(values, true);
        if (success) {
          Alert.alert('Success', 'Your free listing has been posted successfully.', [
            {
              text: 'OK',
              onPress: () => {
                setModalVisible(false);
                setImages([]);
              },
            },
          ]);
        }
      }
      setLoading(false);
      return;
    }

    // For Paid Listings: do NOT create listing immediately.
    // Instead, pass listing details to CheckoutScreen
    try {
      // Upload images to get their URLs
      const imageUrls = await uploadImagesToFirebase(images);

      // Prepare listing details object (NOT created in DB yet)
      const listingDetails = {
        ...values,
        location: {
          lat: parseFloat(values.lat),
          lng: parseFloat(values.lng),
        },
        salePrice: parseFloat(values.salePrice), // Convert to float
        isFreeListing: false,
        packageType: selectedPricing,
        packageCost: parseFloat(pricingPackages[selectedPricing]),
        images: imageUrls,
        ownerId: user.uid,
      };

      // Validate required fields for the chosen category
      const categoryRequirements = {
        'Aircraft for Sale': ['title', 'description'],
        'Aviation Jobs': ['companyName', 'jobTitle', 'jobDescription'],
        'Flight Schools': ['flightSchoolName', 'flightSchoolDetails'],
      };
      const requiredFields = categoryRequirements[selectedCategory];
      for (const field of requiredFields) {
        if (!listingDetails[field]) {
          Alert.alert('Validation Error', `Missing required fields: ${field}`);
          setLoading(false);
          return;
        }
      }

      // If editing, pass listingId as well
      const listingId = editingListing ? editingListing.id : null;

      // Pricing + 8.25% tax
      const totalCost = pricingPackages[selectedPricing];
      const totalWithTax = totalCost * 1.0825;
      const amountInCents = Math.round(totalWithTax * 100);

      // Navigate to CheckoutScreen for payment
      navigation.navigate('CheckoutScreen', {
        paymentType: 'classified',
        amount: amountInCents,
        listingDetails,
        selectedCategory,
        selectedPricing,
        listingId,
      });
    } catch (error) {
      console.error('Error preparing for payment:', error);
      Alert.alert('Error', 'Failed to prepare listing for payment.');
    } finally {
      setLoading(false);
    }
  };

  // Handle test submission (no payment) — for dev/test only
  const handleTestSubmitListing = async (values, { setFieldValue }) => {
    if (!user) {
      Alert.alert('Error', 'User information is not available.');
      setLoading(false);
      return;
    }
    if (!location) {
      Alert.alert('Error', 'Location data is not available.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const categoryRequirements = {
        'Aircraft for Sale': ['title', 'description'],
        'Aviation Jobs': ['companyName', 'jobTitle', 'jobDescription'],
        'Flight Schools': ['flightSchoolName', 'flightSchoolDetails'],
      };
      let requiredFields = categoryRequirements[selectedCategory];
      if (selectedCategory === 'Aircraft for Sale' && !values.isFreeListing) {
        requiredFields = [...requiredFields, 'salePrice'];
      }

      const missingFields = requiredFields.filter((field) => !values[field]);
      if (missingFields.length > 0) {
        Alert.alert(
          'Validation Error',
          `Please fill in the following fields: ${missingFields.join(', ')}`
        );
        setLoading(false);
        return;
      }

      if (editingListing) {
        const success = await updateListingBackend(editingListing.id, values, values.isFreeListing);
        if (success) {
          setImages([]);
          Alert.alert('Success', 'Your listing has been submitted successfully.');
        }
      } else {
        const success = await createListingBackend(values, values.isFreeListing);
        if (success) {
          setImages([]);
          Alert.alert('Success', 'Your listing has been submitted successfully.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Reset modals when screen regains focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setModalVisible(false);
      setFilterModalVisible(false);
      setDetailsModalVisible(false);
      setJobDetailsModalVisible(false);
      setEditingListing(null);
      setImages([]);
    });
    return unsubscribe;
  }, [navigation]);

  // Zoom modal
  const handleImagePress = (uri) => {
    setZoomImageUri(uri);
    setFullScreenModalVisible(true);
  };

  // Animated header styles
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [200, 70],
    extrapolate: 'clamp',
  });

  const headerFontSize = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [24, 16],
    extrapolate: 'clamp',
  });

  const headerPaddingTop = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [40, 10],
    extrapolate: 'clamp',
  });

  // Header opacity
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Animate modal scaling
  useEffect(() => {
    if (modalVisible) {
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }).start();
    } else {
      scaleValue.setValue(0);
    }
  }, [modalVisible]);

  // If auth or location is loading
  if (loadingAuth || locationLoading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: COLORS.white,
        }}
      >
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          accessibilityLabel="Loading indicator"
        />
        <Text style={{ marginTop: 10, color: COLORS.black }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  // If not authenticated
  if (!user) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: COLORS.white,
          padding: 16,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            color: COLORS.black,
            marginBottom: 20,
            textAlign: 'center',
          }}
        >
          You need to be signed in to view classifieds. Please sign in or create an
          account.
        </Text>
      </SafeAreaView>
    );
  }

  // Render Edit and Delete buttons
  const renderEditAndDeleteButtons = (listing) => {
    if (user && listing?.ownerId === user.uid) {
      return (
        <View style={styles.editDeleteContainer}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => handleEditListing(listing)}
            accessibilityLabel="Edit Listing"
            accessibilityRole="button"
          >
            <Ionicons name="create-outline" size={20} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteListing(listing.id)}
            accessibilityLabel="Delete Listing"
            accessibilityRole="button"
          >
            <Ionicons name="trash-outline" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };

  // Render pagination dots
  const renderPaginationDots = () => {
    if (!selectedListing || !selectedListing.images) return null;
    return (
      <View style={styles.paginationDotsContainer}>
        {selectedListing.images.map((_, index) => (
          <View
            key={index}
            style={[
              styles.paginationDot,
              index === imageIndex ? styles.activeDot : styles.inactiveDot,
            ]}
          />
        ))}
      </View>
    );
  };

  // Main UI
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.white }}>
      {/* Animated Header */}
      <Animated.View style={{ overflow: 'hidden', height: headerHeight, opacity: headerOpacity }}>
        <ImageBackground
          source={wingtipClouds}
          style={{ flex: 1, justifyContent: 'flex-end' }}
          resizeMode="cover"
        >
          <Animated.View
            style={{
              paddingHorizontal: 16,
              paddingTop: headerPaddingTop,
              paddingBottom: 20,
            }}
          >
            <Animated.Text
              style={{ color: COLORS.white, fontWeight: 'bold', fontSize: headerFontSize }}
              accessibilityLabel="Greeting Text"
            >
              Good Morning
            </Animated.Text>
            <Animated.Text
              style={{
                color: COLORS.white,
                fontWeight: 'bold',
                fontSize: headerFontSize,
              }}
              accessibilityLabel="User Name"
            >
              {user?.displayName ? user.displayName : 'User'}
            </Animated.Text>
          </Animated.View>
        </ImageBackground>
      </Animated.View>

      {/* Main ScrollView */}
      <Animated.ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ padding: 16 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
      >
        {/* Filter Section */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ fontSize: 18, color: COLORS.secondary }}>
            Filter by Location or Aircraft Make
          </Text>
          <TouchableOpacity
            onPress={() => setFilterModalVisible(true)}
            style={{ backgroundColor: COLORS.lightGray, padding: 8, borderRadius: 50 }}
            accessibilityLabel="Open Filter Modal"
            accessibilityRole="button"
          >
            <Ionicons name="filter" size={24} color="gray" />
          </TouchableOpacity>
        </View>

        {/* Category Selection */}
        <FlatList
          data={categories}
          renderItem={({ item }) => (
            <TouchableOpacity
              key={item}
              onPress={() => {
                setSelectedCategory(item);
                setFilteredListings(listings.filter((listing) => listing.category === item));
              }}
              style={{
                padding: 8,
                borderRadius: 8,
                marginRight: 8,
                backgroundColor:
                  selectedCategory === item ? COLORS.primary : COLORS.lightGray,
              }}
              accessibilityLabel={`Select category ${item}`}
              accessibilityRole="button"
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: 'bold',
                  color: selectedCategory === item ? COLORS.white : COLORS.black,
                }}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
          horizontal
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 16 }}
        />

        {/* Title */}
        <Text
          style={{
            fontSize: 24,
            fontWeight: 'bold',
            marginBottom: 16,
            textAlign: 'center',
            color: COLORS.black,
          }}
        >
          Aviation Marketplace
        </Text>

        {/* Add Listing Button */}
        <TouchableOpacity
          onPress={() => {
            setEditingListing(null);
            setImages([]);
            setModalVisible(true);
          }}
          style={{
            backgroundColor: COLORS.red,
            borderRadius: 50,
            paddingVertical: 12,
            marginBottom: 24,
          }}
          accessibilityLabel="Add Listing"
          accessibilityRole="button"
        >
          <Text style={{ color: COLORS.white, textAlign: 'center', fontWeight: 'bold' }}>
            Add Listing
          </Text>
        </TouchableOpacity>

        {/* Listings */}
        {filteredListings.length > 0 ? (
          filteredListings.map((item) => (
            <View
              style={{
                borderRadius: 10,
                overflow: 'hidden',
                backgroundColor: COLORS.white,
                marginBottom: 20,
                shadowColor: COLORS.black,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
                elevation: 3,
              }}
              key={item.id}
            >
              <TouchableOpacity
                onPress={() => handleListingPress(item)}
                style={{ flex: 1 }}
                accessibilityLabel={`View details of listing ${item.title || 'No Title'}`}
                accessibilityRole="button"
              >
                {/* Images with Overlay */}
                {item.images && item.images.length > 0 ? (
                  <View>{renderListingImages(item)}</View>
                ) : (
                  <Text
                    style={{
                      textAlign: 'center',
                      color: COLORS.gray,
                      marginTop: 10,
                      padding: 10,
                    }}
                  >
                    No Images Available
                  </Text>
                )}

                {/* Main Title */}
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: COLORS.black,
                    paddingHorizontal: 10,
                    marginTop: 10,
                  }}
                >
                  {item.title ? item.title : 'No Title'}
                </Text>

                {/* Category-Specific Details */}
                {item.category === 'Aviation Jobs' ? (
                  <View
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: COLORS.white,
                      marginBottom: 20,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: 'bold',
                        color: COLORS.black,
                        marginBottom: 5,
                      }}
                    >
                      {item.jobTitle ? item.jobTitle : 'No Job Title'}
                    </Text>
                    <Text style={{ fontSize: 16, color: COLORS.secondary, marginBottom: 5 }}>
                      {item.companyName ? item.companyName : 'No Company Name'}
                    </Text>
                    <Text style={{ fontSize: 14, color: COLORS.gray }}>
                      {item.city ? item.city : 'No City'}, {item.state ? item.state : 'No State'}
                    </Text>
                  </View>
                ) : item.category === 'Flight Schools' ? (
                  <View
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: COLORS.white,
                      marginBottom: 10,
                    }}
                  >
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.black }}>
                      {item.flightSchoolName
                        ? item.flightSchoolName
                        : 'No Flight School Name'}
                    </Text>
                    <Text
                      style={{
                        fontSize: 16,
                        color: COLORS.gray,
                        marginVertical: 5,
                      }}
                    >
                      {item.flightSchoolDetails
                        ? item.flightSchoolDetails
                        : 'No Details Provided'}
                    </Text>
                  </View>
                ) : (
                  // Aircraft for Sale Details
                  <View
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: COLORS.white,
                      marginBottom: 10,
                    }}
                  >
                    {/* Tail Number */}
                    <Text
                      style={{
                        fontSize: 16,
                        color: COLORS.black,
                        marginBottom: 5,
                      }}
                    >
                      Tail Number: {item.tailNumber ? item.tailNumber : 'N/A'}
                    </Text>

                    {/* Contact Email */}
                    <Text
                      style={{
                        fontSize: 16,
                        color: COLORS.black,
                        marginBottom: 5,
                      }}
                    >
                      Email: {item.email ? item.email : 'N/A'}
                    </Text>

                    {/* Phone Number */}
                    <Text
                      style={{
                        fontSize: 16,
                        color: COLORS.black,
                        marginBottom: 5,
                      }}
                    >
                      Phone: {item.phone ? item.phone : 'N/A'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              {renderEditAndDeleteButtons(item)}
            </View>
          ))
        ) : (
          <Text style={{ textAlign: 'center', color: COLORS.gray }}>
            No listings available
          </Text>
        )}
      </Animated.ScrollView>

      {/* Up Button */}
      {showUpButton && (
        <TouchableOpacity
          onPress={() => {
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
          }}
          style={styles.upButton}
          accessibilityLabel="Scroll to top"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-up" size={24} color={COLORS.white} />
        </TouchableOpacity>
      )}

      {/* Job Details Modal */}
      <Modal
        visible={jobDetailsModalVisible}
        transparent={true}
        onRequestClose={() => setJobDetailsModalVisible(false)}
        animationType="slide"
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <SafeAreaView
            style={{
              width: '90%',
              backgroundColor: COLORS.white,
              borderRadius: 20,
              padding: 20,
            }}
          >
            <TouchableOpacity
              style={{ position: 'absolute', top: 10, right: 10, zIndex: 1 }}
              onPress={() => setJobDetailsModalVisible(false)}
              accessibilityLabel="Close Job Details Modal"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={30} color={COLORS.black} />
            </TouchableOpacity>
            <Text
              style={{
                fontSize: 24,
                fontWeight: 'bold',
                color: COLORS.black,
                marginBottom: 10,
              }}
            >
              {selectedListing?.jobTitle ? selectedListing.jobTitle : 'No Job Title'}
            </Text>
            <Text style={{ fontSize: 18, color: COLORS.secondary, marginBottom: 5 }}>
              {selectedListing?.companyName
                ? selectedListing.companyName
                : 'No Company Name'}
            </Text>
            {/* Centered Location and Icon */}
            <View style={styles.centeredRow}>
              <Ionicons name="location-outline" size={20} color={COLORS.gray} />
              <Text style={{ fontSize: 16, color: COLORS.gray, marginLeft: 5 }}>
                {selectedListing?.city ? selectedListing.city : 'No City'},{' '}
                {selectedListing?.state ? selectedListing.state : 'No State'}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 16,
                color: COLORS.black,
                marginBottom: 20,
              }}
            >
              {selectedListing?.jobDescription
                ? selectedListing.jobDescription
                : 'No Description Provided'}
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: COLORS.primary,
                padding: 10,
                borderRadius: 10,
                alignItems: 'center',
                marginTop: 20,
              }}
              onPress={handleAskQuestion}
              accessibilityLabel="Apply for Job"
              accessibilityRole="button"
            >
              <Text style={{ color: COLORS.white, fontSize: 16 }}>Apply Now</Text>
            </TouchableOpacity>
            {renderEditAndDeleteButtons(selectedListing)}
          </SafeAreaView>
        </View>
      </Modal>

      {/* Details Modal */}
      <Modal
        visible={detailsModalVisible}
        transparent={true}
        onRequestClose={() => setDetailsModalVisible(false)}
        animationType="slide"
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)' }}>
          <SafeAreaView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {/* Close Button */}
              <TouchableOpacity
                style={{ alignSelf: 'flex-end', marginBottom: 10 }}
                onPress={() => setDetailsModalVisible(false)}
                accessibilityLabel="Close Details Modal"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={30} color={COLORS.white} />
              </TouchableOpacity>

              {/* Image Carousel */}
              {selectedListing?.images && selectedListing.images.length > 0 ? (
                <View style={{ position: 'relative' }}>
                  <Animated.ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={Animated.event(
                      [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                      {
                        useNativeDriver: false,
                        listener: (event) => {
                          const offsetX = event.nativeEvent.contentOffset.x;
                          const index = Math.round(offsetX / (SCREEN_WIDTH - 32));
                          setImageIndex(index);
                        },
                      }
                    )}
                    scrollEventThrottle={16}
                    style={{ height: 250, borderRadius: 10, overflow: 'hidden' }}
                  >
                    {selectedListing.images.map((image, index) => (
                      <TouchableOpacity
                        key={index}
                        activeOpacity={0.9}
                        onPress={() => handleImagePress(image)}
                        accessibilityLabel={`View Image ${index + 1}`}
                        accessibilityRole="imagebutton"
                      >
                        <Image
                          source={{ uri: image }}
                          style={{
                            width: SCREEN_WIDTH - 32,
                            height: 250,
                            resizeMode: 'cover',
                          }}
                        />
                      </TouchableOpacity>
                    ))}
                  </Animated.ScrollView>

                  {/* Pagination Dots */}
                  {renderPaginationDots()}
                </View>
              ) : (
                <Text style={{ color: COLORS.white, marginTop: 20 }}>
                  No Images Available
                </Text>
              )}

              {/* Title */}
              <Text
                style={{
                  color: COLORS.white,
                  fontSize: 24,
                  fontWeight: 'bold',
                  marginTop: 20,
                  textAlign: 'center',
                }}
              >
                {selectedListing?.flightSchoolName
                  ? selectedListing.flightSchoolName
                  : selectedListing?.title
                  ? selectedListing.title
                  : 'No Title'}
              </Text>

              {/* Location and Icon */}
              <View style={styles.centeredRow}>
                <Ionicons name="location-outline" size={20} color={COLORS.gray} />
                <Text style={{ fontSize: 16, color: COLORS.gray, marginLeft: 5 }}>
                  {selectedListing?.city ? selectedListing.city : 'No City'},{' '}
                  {selectedListing?.state ? selectedListing.state : 'No State'}
                </Text>
              </View>

              {/* Contact Email */}
              <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 10 }}>
                Email: {selectedListing?.email ? selectedListing.email : 'N/A'}
              </Text>

              {/* Phone Number */}
              <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}>
                Phone: {selectedListing?.phone ? selectedListing.phone : 'N/A'}
              </Text>

              {/* Tail Number */}
              <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}>
                Tail Number: {selectedListing?.tailNumber ? selectedListing.tailNumber : 'N/A'}
              </Text>

              {/* Price */}
              <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}>
                Price: $
                {selectedListing?.salePrice != null
                  ? String(selectedListing.salePrice)
                  : 'N/A'}
              </Text>

              {/* Description */}
              <Text
                style={{
                  color: COLORS.white,
                  fontSize: 18,
                  marginTop: 20,
                  textAlign: 'left',
                  paddingHorizontal: 20,
                }}
              >
                {selectedListing?.flightSchoolDetails
                  ? selectedListing.flightSchoolDetails
                  : selectedListing?.description
                  ? selectedListing.description
                  : 'No Description'}
              </Text>

              {/* Ask a Question Button */}
              <TouchableOpacity
                style={{
                  marginTop: 20,
                  backgroundColor: COLORS.primary,
                  padding: 10,
                  borderRadius: 10,
                }}
                onPress={handleAskQuestion}
                accessibilityLabel="Ask a Question"
                accessibilityRole="button"
              >
                <Text style={{ color: COLORS.white, fontSize: 16 }}>Ask a question</Text>
              </TouchableOpacity>
              {renderEditAndDeleteButtons(selectedListing)}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{
              width: '90%',
              maxHeight: '90%',
              backgroundColor: COLORS.white,
              borderRadius: 24,
              padding: 0,
            }}
          >
            <ScrollView
              contentContainerStyle={{ padding: 24 }}
              style={{ width: '100%' }}
              nestedScrollEnabled={true}
            >
              <View style={{ width: '100%' }}>
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: 'bold',
                    marginBottom: 24,
                    textAlign: 'center',
                    color: COLORS.black,
                  }}
                >
                  Filter Listings
                </Text>

                <TouchableOpacity
                  onPress={() => filterListingsByDistance(100)}
                  style={{
                    backgroundColor: COLORS.red,
                    paddingVertical: 12,
                    borderRadius: 50,
                    marginBottom: 12,
                  }}
                  accessibilityLabel="View Listings Within 100 Miles"
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      color: COLORS.white,
                      textAlign: 'center',
                      fontWeight: 'bold',
                    }}
                  >
                    View Listings Within 100 Miles
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setFilteredListings(listings)}
                  style={{
                    backgroundColor: COLORS.red,
                    paddingVertical: 12,
                    borderRadius: 50,
                    marginBottom: 12,
                  }}
                  accessibilityLabel="View All Listings"
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      color: COLORS.white,
                      textAlign: 'center',
                      fontWeight: 'bold',
                    }}
                  >
                    View All Listings
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setFilterModalVisible(false)}
                  style={{
                    marginTop: 16,
                    paddingVertical: 8,
                    borderRadius: 50,
                    backgroundColor: COLORS.lightGray,
                  }}
                  accessibilityLabel="Cancel Filter Modal"
                  accessibilityRole="button"
                >
                  <Text style={{ textAlign: 'center', color: COLORS.black }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Pricing Info Modals */}
      {Object.keys(pricingDescriptions).map((key) => (
        <Modal
          key={key}
          visible={pricingModalVisible[key]}
          transparent={true}
          animationType="slide"
          onRequestClose={() => closePricingInfo(key)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            }}
          >
            <View
              style={{
                width: '80%',
                backgroundColor: COLORS.white,
                borderRadius: 20,
                padding: 20,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: 'bold',
                  marginBottom: 10,
                }}
              >
                {key} Package
              </Text>
              <Text style={{ fontSize: 16, textAlign: 'center', marginBottom: 20 }}>
                {pricingDescriptions[key]}
              </Text>
              <TouchableOpacity
                onPress={() => closePricingInfo(key)}
                style={{
                  backgroundColor: COLORS.primary,
                  padding: 10,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
                accessibilityLabel={`Close ${key} Pricing Info Modal`}
                accessibilityRole="button"
              >
                <Text style={{ color: COLORS.white }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ))}

      {/* Submit Your Listing Modal */}
      <Modal
        animationType="none"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          setEditingListing(null);
          setImages([]);
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }}
        >
          <Animated.View
            style={{
              width: '90%',
              maxHeight: '90%',
              backgroundColor: COLORS.white,
              borderRadius: 24,
              padding: 0,
              shadowColor: COLORS.black,
              shadowOffset: { width: 0, height: 5 },
              shadowOpacity: 0.3,
              shadowRadius: 10,
              elevation: 10,
              transform: [{ scale: scaleValue }],
            }}
          >
            <ScrollView
              contentContainerStyle={{ padding: 24 }}
              style={{ width: '100%' }}
              nestedScrollEnabled={true}
            >
              <View style={{ width: '100%' }}>
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: 'bold',
                    marginBottom: 24,
                    textAlign: 'center',
                    color: COLORS.black,
                  }}
                >
                  {editingListing ? 'Edit Your Listing' : 'Submit Your Listing'}
                </Text>

                <Formik
                  initialValues={{
                    title: editingListing ? editingListing.title || '' : '',
                    tailNumber: editingListing ? editingListing.tailNumber || '' : '',
                    salePrice: editingListing?.salePrice?.toString() || '', // handle as string
                    description: editingListing ? editingListing.description || '' : '',
                    city: editingListing ? editingListing.city || '' : '',
                    state: editingListing ? editingListing.state || '' : '',
                    email: editingListing ? editingListing.email || '' : '',
                    phone: editingListing ? editingListing.phone || '' : '',
                    companyName: editingListing ? editingListing.companyName || '' : '',
                    jobTitle: editingListing ? editingListing.jobTitle || '' : '',
                    jobDescription: editingListing ? editingListing.jobDescription || '' : '',
                    category: editingListing ? editingListing.category || selectedCategory : selectedCategory,
                    flightSchoolName: editingListing ? editingListing.flightSchoolName || '' : '',
                    flightSchoolDetails: editingListing
                      ? editingListing.flightSchoolDetails || ''
                      : '',
                    isFreeListing: editingListing ? editingListing.isFreeListing || false : false,
                    lat:
                      editingListing?.location?.lat?.toString() ||
                      location?.coords?.latitude?.toString() ||
                      '',
                    lng:
                      editingListing?.location?.lng?.toString() ||
                      location?.coords?.longitude?.toString() ||
                      '',
                    selectedPricing: selectedPricing || 'Basic',
                    packageCost: selectedPricing ? pricingPackages[selectedPricing] || 0 : 0,
                  }}
                  enableReinitialize={true}
                  validate={(values) => {
                    const errors = {};
                    const { category, isFreeListing, selectedPricing } = values;

                    // Category requirements
                    const categoryRequirements = {
                      'Aircraft for Sale': ['title', 'description'],
                      'Aviation Jobs': ['companyName', 'jobTitle', 'jobDescription'],
                      'Flight Schools': ['flightSchoolName', 'flightSchoolDetails'],
                    };
                    let requiredFields = categoryRequirements[category];

                    // For non-free Aircraft for Sale, also require salePrice
                    if (category === 'Aircraft for Sale' && !isFreeListing) {
                      requiredFields = [...requiredFields, 'salePrice'];
                    }

                    requiredFields.forEach((field) => {
                      if (!values[field]) {
                        errors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is required for ${category}.`;
                      }
                    });

                    // Validate location
                    if (!values.lat || !values.lng) {
                      errors.location = 'Location is required.';
                    } else {
                      const lat = parseFloat(values.lat);
                      const lng = parseFloat(values.lng);
                      if (isNaN(lat) || isNaN(lng)) {
                        errors.location = 'Latitude and Longitude must be valid numbers.';
                      }
                    }

                    // Validate email
                    if (!values.email) {
                      errors.email = 'Contact email is required.';
                    } else if (!/\S+@\S+\.\S+/.test(values.email)) {
                      errors.email = 'Invalid email address.';
                    }

                    // Extra check for selectedPricing if user chooses paid package
                    if (!isFreeListing && category === 'Aircraft for Sale') {
                      if (selectedPricing && !pricingPackages[selectedPricing]) {
                        errors.selectedPricing = 'Invalid pricing package selected.';
                      }
                    }

                    return errors;
                  }}
                  onSubmit={onSubmitMethod}
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
                      {/* Free Basic Listing Button */}
                      {!editingListing && (
                        <TouchableOpacity
                          onPress={() => {
                            setFieldValue('isFreeListing', true);
                            handleSubmit();
                          }}
                          style={{
                            backgroundColor: COLORS.green,
                            paddingVertical: 12,
                            borderRadius: 50,
                            marginBottom: 16,
                          }}
                          accessibilityLabel="Free Basic Listing"
                          accessibilityRole="button"
                        >
                          <Text
                            style={{
                              color: COLORS.white,
                              textAlign: 'center',
                              fontWeight: 'bold',
                            }}
                          >
                            Free Basic Listing
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Pricing Package Selection */}
                      {!values.isFreeListing && (
                        <>
                          <Text
                            style={{
                              marginBottom: 8,
                              color: COLORS.black,
                              fontWeight: 'bold',
                              textAlign: 'center',
                            }}
                            accessibilityLabel="Select Pricing Package Label"
                          >
                            Select Pricing Package
                          </Text>

                          <View
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-around',
                              marginBottom: 16,
                            }}
                          >
                            {Object.keys(pricingPackages).map((packageType) => (
                              <TouchableOpacity
                                key={packageType}
                                onPress={() => {
                                  setSelectedPricing(packageType);
                                  setFieldValue('selectedPricing', packageType);
                                  setFieldValue('packageCost', pricingPackages[packageType]);
                                }}
                                style={{
                                  padding: 10,
                                  borderRadius: 8,
                                  backgroundColor:
                                    selectedPricing === packageType
                                      ? COLORS.primary
                                      : COLORS.lightGray,
                                  alignItems: 'center',
                                  width: '30%',
                                }}
                                accessibilityLabel={`Select ${packageType} package`}
                                accessibilityRole="button"
                              >
                                <Text
                                  style={{
                                    color:
                                      selectedPricing === packageType
                                        ? COLORS.white
                                        : COLORS.black,
                                    fontWeight: 'bold',
                                  }}
                                >
                                  {packageType}
                                </Text>
                                <Text
                                  style={{
                                    color:
                                      selectedPricing === packageType
                                        ? COLORS.white
                                        : COLORS.black,
                                  }}
                                >
                                  ${pricingPackages[packageType]}
                                </Text>
                                <TouchableOpacity
                                  onPress={() => openPricingInfo(packageType)}
                                  style={{ marginTop: 4 }}
                                  accessibilityLabel={`View details for ${packageType} package`}
                                  accessibilityRole="button"
                                >
                                  <Ionicons
                                    name="information-circle-outline"
                                    size={20}
                                    color={
                                      selectedPricing === packageType
                                        ? COLORS.white
                                        : COLORS.black
                                    }
                                  />
                                </TouchableOpacity>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}

                      {/* Category Selection */}
                      <Text
                        style={{
                          marginBottom: 8,
                          color: COLORS.black,
                          fontWeight: 'bold',
                          textAlign: 'center',
                        }}
                        accessibilityLabel="Select Category Label"
                      >
                        Select Category
                      </Text>

                      <FlatList
                        data={categories}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            key={item}
                            onPress={() => {
                              setFieldValue('category', item);
                              setSelectedCategory(item);
                            }}
                            style={{
                              padding: 8,
                              borderRadius: 8,
                              marginRight: 8,
                              backgroundColor:
                                values.category === item
                                  ? COLORS.primary
                                  : COLORS.lightGray,
                            }}
                            accessibilityLabel={`Select category ${item}`}
                            accessibilityRole="button"
                          >
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: 'bold',
                                color:
                                  values.category === item
                                    ? COLORS.white
                                    : COLORS.black,
                              }}
                            >
                              {item}
                            </Text>
                          </TouchableOpacity>
                        )}
                        horizontal
                        keyExtractor={(item) => item}
                        showsHorizontalScrollIndicator={false}
                        style={{ marginBottom: 16 }}
                      />

                      {touched.category && errors.category && (
                        <Text style={{ color: 'red', marginBottom: 8 }}>
                          {errors.category}
                        </Text>
                      )}

                      {/* Category-Specific Fields */}
                      {values.category === 'Aviation Jobs' ? (
                        <>
                          <TextInput
                            placeholder="Company Name"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('companyName')}
                            onBlur={handleBlur('companyName')}
                            value={values.companyName}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Company Name Input"
                          />
                          {touched.companyName && errors.companyName && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>
                              {errors.companyName}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Job Title"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('jobTitle')}
                            onBlur={handleBlur('jobTitle')}
                            value={values.jobTitle}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Job Title Input"
                          />
                          {touched.jobTitle && errors.jobTitle && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>
                              {errors.jobTitle}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Job Description"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('jobDescription')}
                            onBlur={handleBlur('jobDescription')}
                            value={values.jobDescription}
                            multiline
                            numberOfLines={4}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                              textAlignVertical: 'top',
                            }}
                            accessibilityLabel="Job Description Input"
                          />
                          {touched.jobDescription && errors.jobDescription && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>
                              {errors.jobDescription}
                            </Text>
                          )}
                        </>
                      ) : values.category === 'Flight Schools' ? (
                        <>
                          <TextInput
                            placeholder="Flight School Name"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('flightSchoolName')}
                            onBlur={handleBlur('flightSchoolName')}
                            value={values.flightSchoolName}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Flight School Name Input"
                          />
                          {touched.flightSchoolName && errors.flightSchoolName && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>
                              {errors.flightSchoolName}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Flight School Details"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('flightSchoolDetails')}
                            onBlur={handleBlur('flightSchoolDetails')}
                            value={values.flightSchoolDetails}
                            multiline
                            numberOfLines={4}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                              textAlignVertical: 'top',
                            }}
                            accessibilityLabel="Flight School Details Input"
                          />
                          {touched.flightSchoolDetails && errors.flightSchoolDetails && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>
                              {errors.flightSchoolDetails}
                            </Text>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Aircraft for Sale Fields */}
                          <TextInput
                            placeholder="Aircraft Year/Make/Model"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('title')}
                            onBlur={handleBlur('title')}
                            value={values.title}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Aircraft Year/Make/Model Input"
                          />
                          {touched.title && errors.title && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>
                              {errors.title}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Aircraft Tail Number"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('tailNumber')}
                            onBlur={handleBlur('tailNumber')}
                            value={values.tailNumber}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Aircraft Tail Number Input"
                          />
                          {touched.tailNumber && errors.tailNumber && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>
                              {errors.tailNumber}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Sale Price"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('salePrice')}
                            onBlur={handleBlur('salePrice')}
                            value={values.salePrice}
                            keyboardType="numeric"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Sale Price Input"
                          />
                          {touched.salePrice && errors.salePrice && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>
                              {errors.salePrice}
                            </Text>
                          )}
                          <TextInput
                            placeholder="Description"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('description')}
                            onBlur={handleBlur('description')}
                            value={values.description}
                            multiline
                            numberOfLines={4}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                              textAlignVertical: 'top',
                            }}
                            accessibilityLabel="Description Input"
                          />
                          {touched.description && errors.description && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>
                              {errors.description}
                            </Text>
                          )}
                        </>
                      )}

                      {/* Common Fields */}
                      <TextInput
                        placeholder="City"
                        placeholderTextColor={COLORS.gray}
                        onChangeText={handleChange('city')}
                        onBlur={handleBlur('city')}
                        value={values.city}
                        style={{
                          borderBottomWidth: 1,
                          borderBottomColor: COLORS.lightGray,
                          marginBottom: 16,
                          padding: 8,
                          color: COLORS.black,
                        }}
                        accessibilityLabel="City Input"
                      />
                      {touched.city && errors.city && (
                        <Text style={{ color: 'red', marginBottom: 8 }}>
                          {errors.city}
                        </Text>
                      )}
                      <TextInput
                        placeholder="State"
                        placeholderTextColor={COLORS.gray}
                        onChangeText={handleChange('state')}
                        onBlur={handleBlur('state')}
                        value={values.state}
                        style={{
                          borderBottomWidth: 1,
                          borderBottomColor: COLORS.lightGray,
                          marginBottom: 16,
                          padding: 8,
                          color: COLORS.black,
                        }}
                        accessibilityLabel="State Input"
                      />
                      {touched.state && errors.state && (
                        <Text style={{ color: 'red', marginBottom: 8 }}>
                          {errors.state}
                        </Text>
                      )}
                      <TextInput
                        placeholder="Contact Email (Required)"
                        placeholderTextColor={COLORS.gray}
                        onChangeText={handleChange('email')}
                        onBlur={handleBlur('email')}
                        value={values.email}
                        keyboardType="email-address"
                        style={{
                          borderBottomWidth: 1,
                          borderBottomColor: COLORS.lightGray,
                          marginBottom: 16,
                          padding: 8,
                          color: COLORS.black,
                        }}
                        accessibilityLabel="Contact Email Input"
                      />
                      {touched.email && errors.email && (
                        <Text style={{ color: 'red', marginBottom: 8 }}>
                          {errors.email}
                        </Text>
                      )}
                      <TextInput
                        placeholder="Phone Number (Optional)"
                        placeholderTextColor={COLORS.gray}
                        onChangeText={handleChange('phone')}
                        onBlur={handleBlur('phone')}
                        value={values.phone}
                        keyboardType="phone-pad"
                        style={{
                          borderBottomWidth: 1,
                          borderBottomColor: COLORS.lightGray,
                          marginBottom: 16,
                          padding: 8,
                          color: COLORS.black,
                        }}
                        accessibilityLabel="Phone Number Input"
                      />

                      {/* Upload Images */}
                      {['Aviation Jobs', 'Flight Schools', 'Aircraft for Sale'].includes(
                        values.category
                      ) && (
                        <>
                          <Text
                            style={{
                              marginBottom: 8,
                              color: COLORS.black,
                              fontWeight: 'bold',
                              textAlign: 'center',
                            }}
                            accessibilityLabel="Upload Images Label"
                          >
                            Upload Images
                          </Text>
                          <FlatList
                            data={images}
                            horizontal
                            renderItem={({ item, index }) => (
                              <View key={index.toString()} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Image
                                  source={{ uri: item }}
                                  style={{
                                    width: 96,
                                    height: 96,
                                    marginRight: 8,
                                    borderRadius: 8,
                                  }}
                                  accessible={true}
                                  accessibilityLabel={`Uploaded Image ${index + 1}`}
                                />
                                <TouchableOpacity
                                  onPress={() => {
                                    const updatedImages = images.filter((img) => img !== item);
                                    setImages(updatedImages);
                                  }}
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    right: 0,
                                    backgroundColor: 'rgba(0,0,0,0.5)',
                                    borderRadius: 12,
                                    padding: 2,
                                  }}
                                  accessibilityLabel={`Remove Image ${index + 1}`}
                                  accessibilityRole="button"
                                >
                                  <Ionicons name="close-circle" size={20} color="white" />
                                </TouchableOpacity>
                              </View>
                            )}
                            keyExtractor={(item, index) => index.toString()}
                            nestedScrollEnabled={true}
                          />
                          {renderImageUploadButton()}
                        </>
                      )}

                      {/* If editing an existing listing */}
                      {editingListing ? (
                        <>
                          {loading ? (
                            <ActivityIndicator
                              size="large"
                              color={COLORS.red}
                              accessibilityLabel="Saving Changes"
                            />
                          ) : (
                            <TouchableOpacity
                              onPress={handleSubmit}
                              style={{
                                backgroundColor: COLORS.primary,
                                paddingVertical: 12,
                                borderRadius: 50,
                              }}
                              accessibilityLabel="Save Changes"
                              accessibilityRole="button"
                            >
                              <Text
                                style={{
                                  color: COLORS.white,
                                  textAlign: 'center',
                                  fontWeight: 'bold',
                                }}
                              >
                                Save Changes
                              </Text>
                            </TouchableOpacity>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Post for Free Button */}
                          {!values.isFreeListing && (
                            <TouchableOpacity
                              onPress={() => {
                                setFieldValue('isFreeListing', true);
                                handleSubmit();
                              }}
                              style={{
                                backgroundColor: COLORS.green,
                                paddingVertical: 12,
                                borderRadius: 50,
                                marginTop: 16,
                                marginBottom: 16,
                              }}
                              accessibilityLabel="Post for Free"
                              accessibilityRole="button"
                            >
                              <Text
                                style={{
                                  color: COLORS.white,
                                  textAlign: 'center',
                                  fontWeight: 'bold',
                                }}
                              >
                                Post for Free
                              </Text>
                            </TouchableOpacity>
                          )}

                          {/* Submit Listing & Proceed to Pay */}
                          {!values.isFreeListing && (
                            loading ? (
                              <ActivityIndicator
                                size="large"
                                color={COLORS.red}
                                accessibilityLabel="Submitting Listing"
                              />
                            ) : (
                              <TouchableOpacity
                                onPress={handleSubmit}
                                style={{
                                  backgroundColor: COLORS.red,
                                  paddingVertical: 12,
                                  borderRadius: 50,
                                }}
                                accessibilityLabel="Submit Listing & Proceed to Pay"
                                accessibilityRole="button"
                              >
                                <Text
                                  style={{
                                    color: COLORS.white,
                                    textAlign: 'center',
                                    fontWeight: 'bold',
                                  }}
                                >
                                  Submit Listing & Proceed to Pay
                                </Text>
                              </TouchableOpacity>
                            )
                          )}

                          {/* Submit Without Payment (Test) */}
                          <TouchableOpacity
                            onPress={() => handleTestSubmitListing(values, { setFieldValue })}
                            style={{
                              backgroundColor: COLORS.secondary,
                              paddingVertical: 12,
                              borderRadius: 50,
                              marginTop: 16,
                              marginBottom: 16,
                            }}
                            accessibilityLabel="Submit Without Payment (Test)"
                            accessibilityRole="button"
                          >
                            <Text
                              style={{
                                color: COLORS.white,
                                textAlign: 'center',
                                fontWeight: 'bold',
                              }}
                            >
                              Submit Without Payment (Test)
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {/* Cancel Button */}
                      <TouchableOpacity
                        onPress={() => {
                          setModalVisible(false);
                          setEditingListing(null);
                          setImages([]);
                        }}
                        style={{
                          marginTop: 16,
                          paddingVertical: 8,
                          borderRadius: 50,
                          backgroundColor: COLORS.lightGray,
                        }}
                        accessibilityLabel="Cancel Submit Listing Modal"
                        accessibilityRole="button"
                      >
                        <Text style={{ textAlign: 'center', color: COLORS.black }}>
                          Cancel
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </Formik>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      {/* Full-Screen Image Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={fullScreenModalVisible}
        onRequestClose={() => setFullScreenModalVisible(false)}
      >
        <View style={styles.zoomModalContainer}>
          <TouchableOpacity
            onPress={() => setFullScreenModalVisible(false)}
            style={styles.zoomCloseButton}
            accessibilityLabel="Close zoomed image"
            accessibilityRole="button"
          >
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          <ScrollView
            contentContainerStyle={styles.zoomScrollView}
            maximumZoomScale={3}
            minimumZoomScale={1}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            centerContent={true}
          >
            {zoomImageUri && (
              <Image
                source={{ uri: zoomImageUri }}
                style={styles.zoomImage}
                resizeMode="contain"
              />
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const AppNavigator = () => {
  return (
    <NavigationContainer independent={true}>
      <Stack.Navigator initialRouteName="Classifieds">
        <Stack.Screen
          name="Classifieds"
          component={Classifieds}
          options={{ headerShown: false }} // Hides the header for the Classifieds screen
        />
        <Stack.Screen
          name="CheckoutScreen"
          component={CheckoutScreen}
          options={{ headerShown: false }} // Hides the header for the CheckoutScreen
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

// =====================
// Styles
// =====================
const styles = StyleSheet.create({
  paginationDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: COLORS.primary,
  },
  inactiveDot: {
    backgroundColor: COLORS.lightGray,
  },
  zoomModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomCloseButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 30,
    right: 20,
    zIndex: 1,
  },
  zoomScrollView: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  // New Styles for Price and Location Overlay
  priceLocationOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  priceText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    color: COLORS.white,
    fontSize: 16,
    marginLeft: 5,
  },
  centeredRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  editDeleteContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 10,
  },
  editButton: {
    backgroundColor: COLORS.primary,
    padding: 8,
    borderRadius: 20,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: COLORS.red,
    padding: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: COLORS.primary,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 1000,
  },
});
