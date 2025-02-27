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
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { db, storage } from '../../firebaseConfig';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import wingtipClouds from '../../Assets/images/wingtip_clouds.jpg';
import * as ImagePicker from 'expo-image-picker';
import { Formik } from 'formik';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import classifiedsPaymentScreen from '../payment/classifiedsPaymentScreen';
// import CheckoutScreen from '../payment/CheckoutScreen'; // For rental payments (commented out)

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
  green: '#10B981',
};

const Stack = createStackNavigator();
const API_URL = 'https://us-central1-ready-set-fly-71506.cloudfunctions.net/api';

/** Helper function: Returns maximum images allowed based on category and pricing */
const getMaxImages = (selectedCategory, selectedPricing) => {
  if (selectedCategory === 'Aviation Jobs') return 3;
  if (selectedCategory === 'Flight Schools') return 5;
  if (selectedCategory === 'Aviation Gear') return 5; // Aviation Gear allows up to 5 images
  if (selectedCategory === 'Aircraft for Sale') {
    if (selectedPricing === 'Basic') return 7;
    if (selectedPricing === 'Featured') return 14;
    return 20;
  }
  return 1;
};

/** Helper function: Renders listing details UI based on category */
const renderListingDetails = (item) => {
  if (item.category === 'Aviation Jobs') {
    return (
      <View style={{ padding: 10, borderRadius: 10, backgroundColor: COLORS.white, marginBottom: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.black, marginBottom: 5 }}>
          {item.jobTitle || 'No Job Title'}
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.secondary, marginBottom: 5 }}>
          {item.companyName || 'No Company Name'}
        </Text>
        <Text style={{ fontSize: 14, color: COLORS.gray }}>
          {item.city || 'No City'}, {item.state || 'No State'}
        </Text>
      </View>
    );
  } else if (item.category === 'Flight Schools') {
    return (
      <View style={{ padding: 10, borderRadius: 10, backgroundColor: COLORS.white, marginBottom: 10 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.black }}>
          {item.flightSchoolName || 'No Flight School Name'}
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.gray, marginVertical: 5 }}>
          {item.flightSchoolDetails || 'No Details Provided'}
        </Text>
      </View>
    );
  } else {
    return (
      <View style={{ padding: 10, borderRadius: 10, backgroundColor: COLORS.white, marginBottom: 10 }}>
        <Text style={{ fontSize: 16, color: COLORS.black, marginBottom: 5 }}>
          Tail Number: {item.tailNumber || 'N/A'}
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.black, marginBottom: 5 }}>
          Email: {item.email || 'N/A'}
        </Text>
        <Text style={{ fontSize: 16, color: COLORS.black, marginBottom: 5 }}>
          Phone: {item.phone || 'N/A'}
        </Text>
      </View>
    );
  }
};

// Updated categories including new ones
const categories = [
  'Aircraft for Sale',
  'Aviation Jobs',
  'Flight Schools',
  'Flight Instructors',
  'Aviation Mechanic',
  'Aviation Gear',
];

// Default pricing packages (used for Aircraft for Sale)
const defaultPricingPackages = { Basic: 25, Featured: 70, Enhanced: 150 };

// Pricing descriptions including new categories
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
  'Flight Instructors': `Flight Instructor Package Includes:
• 30-day listing
• Designed for flight instructors
• $30/month listing`,
  'Aviation Mechanic': `Aviation Mechanic Package Includes:
• 30-day listing
• Designed for aviation mechanics
• $30/month listing`,
  Free: `Free Listing:
• 30-day listing
• Posted for free`,
};

// Initialize pricing modal visibility state for all pricing options
const initialPricingModalState = Object.keys(pricingDescriptions).reduce((acc, key) => {
  acc[key] = false;
  return acc;
}, {});

const Classifieds = () => {
  const auth = getAuth();
  const navigation = useNavigation();
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
  const [editingListing, setEditingListing] = useState(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [fullScreenModalVisible, setFullScreenModalVisible] = useState(false);
  const [zoomImageUri, setZoomImageUri] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('Aircraft for Sale');
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const scaleValue = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);
  const [showUpButton, setShowUpButton] = useState(false);

  // Pricing packages state (overrides defaultPricingPackages for specific categories)
  const [pricingPackages, setPricingPackages] = useState(defaultPricingPackages);
  const [pricingModalVisible, setPricingModalVisible] = useState(initialPricingModalState);

  // -----------------------
  // Category-specific Pricing Setup
  // -----------------------
  useEffect(() => {
    if (selectedCategory === 'Aviation Jobs') {
      setPricingPackages({ Basic: 15 });
      setSelectedPricing('Basic');
    } else if (selectedCategory === 'Flight Schools') {
      setPricingPackages({ Basic: 250 });
      setSelectedPricing('Basic');
    } else if (selectedCategory === 'Flight Instructors') {
      setPricingPackages({ 'Flight Instructors': 30 });
      setSelectedPricing('Flight Instructors');
    } else if (selectedCategory === 'Aviation Mechanic') {
      setPricingPackages({ 'Aviation Mechanic': 30 });
      setSelectedPricing('Aviation Mechanic');
    } else if (selectedCategory === 'Aviation Gear') {
      setPricingPackages({ Free: 0 });
      setSelectedPricing('Free');
    } else {
      setPricingPackages(defaultPricingPackages);
      setSelectedPricing('Basic');
    }
  }, [selectedCategory]);

  // -----------------------
  // Authentication & Location
  // -----------------------
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribeAuth();
  }, [auth]);

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
          Alert.alert('Error fetching location', 'Ensure location services are enabled.');
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

  // -----------------------
  // Firestore Listings Subscription
  // -----------------------
  useEffect(() => {
    if (user) {
      const collectionName = 'listings';
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
        },
        (error) => {
          console.error('Error fetching listings:', error);
          Alert.alert('Error', 'Failed to fetch listings.');
        }
      );
      return () => unsubscribe();
    } else {
      setListings([]);
      setFilteredListings([]);
    }
  }, [selectedCategory, user]);

  useEffect(() => {
    if (listings && selectedCategory) {
      setFilteredListings(listings.filter((listing) => listing.category === selectedCategory));
    } else {
      setFilteredListings(listings);
    }
  }, [listings, selectedCategory]);

  useEffect(() => {
    const listener = scrollY.addListener(({ value }) => {
      setShowUpButton(value > 200);
    });
    return () => scrollY.removeListener(listener);
  }, [scrollY]);

  // -----------------------
  // Image Picker & Upload
  // -----------------------
  const pickImage = async () => {
    const maxImages = getMaxImages(selectedCategory, selectedPricing);
    if (images.length >= maxImages) {
      Alert.alert(`You can only upload up to ${maxImages} images.`);
      return;
    }
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Permission to access the camera roll is required!');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: maxImages - images.length,
      quality: 1,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selectedImages = result.assets.map((asset) =>
        asset.uri.startsWith('file://') ? asset.uri : `file://${asset.uri}`
      );
      setImages([...images, ...selectedImages].slice(0, maxImages));
    }
  };

  const renderImageUploadButton = () => {
    const maxImages = getMaxImages(selectedCategory, selectedPricing);
    const remainingUploads = maxImages - images.length;
    return (
      <TouchableOpacity
        onPress={pickImage}
        disabled={images.length >= maxImages}
        style={{
          backgroundColor: remainingUploads > 0 ? COLORS.primary : COLORS.lightGray,
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

  // -----------------------
  // Listing Images Render
  // -----------------------
  const renderListingImages = (item) => (
    <View style={{ position: 'relative' }}>
      <FlatList
        data={item.images || []}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(imageUri, index) => `${item.id}-${index}`}
        renderItem={({ item: imageUri }) => (
          <TouchableOpacity
            onPress={() => handleImagePress(imageUri)}
            activeOpacity={0.9}
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
      {item.category === 'Aircraft for Sale' && (
        <View style={styles.priceLocationOverlay}>
          <Text style={styles.priceText}>
            Price: ${item.salePrice != null ? String(item.salePrice) : 'N/A'}
          </Text>
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

  // -----------------------
  // Distance Filter Helpers
  // -----------------------
  const deg2rad = (deg) => deg * (Math.PI / 180);
  const getDistanceFromLatLonInMiles = (lat1, lon1, lat2, lon2) => {
    const R = 3958.8;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const filterListingsByDistance = (radiusMiles) => {
    if (!location) {
      Alert.alert('Error', 'Location is not available.');
      return;
    }
    const { latitude: userLat, longitude: userLng } = location.coords;
    const filtered = listings.filter((listing) => {
      if (listing.location && listing.location.lat && listing.location.lng) {
        const { lat, lng } = listing.location;
        const distance = getDistanceFromLatLonInMiles(userLat, userLng, lat, lng);
        return distance <= radiusMiles;
      }
      return false;
    });
    setFilteredListings(filtered);
  };

  // -----------------------
  // Listing Interaction Handlers
  // -----------------------
  const handleListingPress = (listing) => {
    setSelectedListing(listing);
    if (listing.category === 'Aviation Jobs') setJobDetailsModalVisible(true);
    else setDetailsModalVisible(true);
  };

  const handleEditListing = (listing) => {
    setEditingListing(listing);
    setImages(listing.images || []);
    setSelectedCategory(listing.category);
    const currentPricing =
      listing.packageType && pricingPackages[listing.packageType]
        ? listing.packageType
        : 'Basic';
    setSelectedPricing(currentPricing);
    setModalVisible(true);
  };

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

  // Updated handleAskQuestion to check gearEmail if it's an Aviation Gear listing
  const handleAskQuestion = () => {
    if (!selectedListing) {
      Alert.alert('Error', 'No listing selected.');
      return;
    }

    // If it's Aviation Gear, use gearEmail if available
    const contactEmail =
      selectedListing.category === 'Aviation Gear'
        ? selectedListing.gearEmail
        : selectedListing.email;

    if (contactEmail) {
      const subject = encodeURIComponent(
        `Inquiry about ${selectedListing.title || selectedListing.gearTitle || 'Your Listing'}`
      );
      const mailUrl = `mailto:${contactEmail}?subject=${subject}`;
      Linking.openURL(mailUrl).catch((error) => {
        console.error('Error opening mail app:', error);
        Alert.alert('Error', 'Unable to open mail app.');
      });
    } else {
      Alert.alert('Error', 'Contact email not available.');
    }
  };

  // Implement a delete function if needed
  const handleDeleteListing = (listingId) => {
    Alert.alert('Delete Listing', 'This feature is not yet implemented in the sample.');
  };

  // -----------------------
  // Updated onSubmitMethod for listing submission/editing
  // -----------------------
  const onSubmitMethod = (values) => {
    const listingDetails = {
      ...values,
      images,
      location: location ? { lat: location.coords.latitude, lng: location.coords.longitude } : {},
    };

    if (editingListing) {
      // Update the existing listing without proceeding to payment.
      getFirebaseIdToken().then((token) => {
        fetch(`${API_URL}/updateListing`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ listingId: editingListing.id, listingDetails }),
        })
          .then((response) => {
            if (response.ok) {
              Alert.alert('Listing Updated', 'Your listing has been updated successfully.');
              setModalVisible(false);
              setEditingListing(null);
              setImages([]);
            } else {
              response.text().then((text) => {
                try {
                  const data = JSON.parse(text);
                  Alert.alert('Error', data.error || 'Failed to update listing.');
                } catch (err) {
                  console.error('Error parsing updateListing error data:', err);
                  Alert.alert('Error', 'Failed to update listing. ' + text);
                }
              });
            }
          })
          .catch((error) => {
            console.error('Error updating listing:', error);
            Alert.alert('Error', 'Failed to update listing.');
          });
      });
    } else if (values.category === 'Aviation Gear') {
      // Directly post the listing without requiring payment.
      getFirebaseIdToken().then((token) => {
        fetch(`${API_URL}/createListing`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ listingDetails, selectedCategory: values.category, selectedPricing }),
        })
          .then((response) => {
            if (response.ok) {
              Alert.alert('Listing Posted', 'Your listing has been posted successfully.');
              setModalVisible(false);
              setEditingListing(null);
              setImages([]);
            } else {
              response.text().then((text) => {
                try {
                  const data = JSON.parse(text);
                  Alert.alert('Error', data.error || 'Failed to post listing.');
                } catch (err) {
                  console.error('Error parsing createListing error data:', err);
                  Alert.alert('Error', 'Failed to post listing. ' + text);
                }
              });
            }
          })
          .catch((error) => {
            console.error('Error posting listing:', error);
            Alert.alert('Error', 'Failed to post listing.');
          });
      });
    } else {
      navigation.navigate('classifiedsPaymentScreen', {
        listingDetails,
        selectedCategory,
        selectedPricing,
      });
    }
  };

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

  const handleImagePress = (uri) => {
    setZoomImageUri(uri);
    setFullScreenModalVisible(true);
  };

  // Header animations
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
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    if (modalVisible) {
      Animated.spring(scaleValue, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    } else {
      scaleValue.setValue(0);
    }
  }, [modalVisible]);

  if (loadingAuth || locationLoading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.white }}>
        <ActivityIndicator size="large" color={COLORS.primary} accessibilityLabel="Loading indicator" />
        <Text style={{ marginTop: 10, color: COLORS.black }}>Loading...</Text>
      </SafeAreaView>
    );
  }
  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.white, padding: 16 }}>
        <Text style={{ fontSize: 18, color: COLORS.black, marginBottom: 20, textAlign: 'center' }}>
          You need to be signed in to view classifieds. Please sign in or create an account.
        </Text>
      </SafeAreaView>
    );
  }

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.white }}>
      <Animated.View style={{ overflow: 'hidden', height: headerHeight, opacity: headerOpacity }}>
        <ImageBackground source={wingtipClouds} style={{ flex: 1, justifyContent: 'flex-end' }} resizeMode="cover">
          <Animated.View style={{ paddingHorizontal: 16, paddingTop: headerPaddingTop, paddingBottom: 20 }}>
            <Animated.Text
              style={{ color: COLORS.white, fontWeight: 'bold', fontSize: headerFontSize }}
              accessibilityLabel="Greeting Text"
            >
              Good Morning
            </Animated.Text>
            <Animated.Text
              style={{ color: COLORS.white, fontWeight: 'bold', fontSize: headerFontSize }}
              accessibilityLabel="User Name"
            >
              {user?.displayName ? user.displayName : 'User'}
            </Animated.Text>
          </Animated.View>
        </ImageBackground>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ padding: 16 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ fontSize: 18, color: COLORS.secondary }}>Filter by Location or Aircraft Make</Text>
          <TouchableOpacity
            onPress={() => setFilterModalVisible(true)}
            style={{ backgroundColor: COLORS.lightGray, padding: 8, borderRadius: 50 }}
            accessibilityLabel="Open Filter Modal"
            accessibilityRole="button"
          >
            <Ionicons name="filter" size={24} color="gray" />
          </TouchableOpacity>
        </View>

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
                backgroundColor: selectedCategory === item ? COLORS.primary : COLORS.lightGray,
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

        <Text
          style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center', color: COLORS.black }}
        >
          Aviation Marketplace
        </Text>

        <TouchableOpacity
          onPress={() => {
            setEditingListing(null);
            setImages([]);
            setModalVisible(true);
          }}
          style={{ backgroundColor: COLORS.red, borderRadius: 50, paddingVertical: 12, marginBottom: 24 }}
          accessibilityLabel="Add Listing"
          accessibilityRole="button"
        >
          <Text style={{ color: COLORS.white, textAlign: 'center', fontWeight: 'bold' }}>Add Listing</Text>
        </TouchableOpacity>

        {filteredListings.length > 0 ? (
          filteredListings.map((item) => (
            <View
              key={item.id}
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
            >
              <TouchableOpacity
                onPress={() => handleListingPress(item)}
                style={{ flex: 1 }}
                accessibilityLabel={`View details of listing ${item.title || 'No Title'}`}
                accessibilityRole="button"
              >
                {item.images && item.images.length > 0 ? (
                  <View>{renderListingImages(item)}</View>
                ) : (
                  <Text style={{ textAlign: 'center', color: COLORS.gray, marginTop: 10, padding: 10 }}>
                    No Images Available
                  </Text>
                )}
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
                {renderListingDetails(item)}
              </TouchableOpacity>
              {renderEditAndDeleteButtons(item)}
            </View>
          ))
        ) : (
          <Text style={{ textAlign: 'center', color: COLORS.gray }}>No listings available</Text>
        )}
      </Animated.ScrollView>

      {showUpButton && (
        <TouchableOpacity
          onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
          style={styles.upButton}
          accessibilityLabel="Scroll to top"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-up" size={24} color={COLORS.white} />
        </TouchableOpacity>
      )}

      {/* Aviation Jobs - Details Modal */}
      <Modal
        visible={jobDetailsModalVisible}
        transparent={true}
        onRequestClose={() => setJobDetailsModalVisible(false)}
        animationType="slide"
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <SafeAreaView style={{ width: '90%', backgroundColor: COLORS.white, borderRadius: 8, padding: 20 }}>
            <TouchableOpacity
              style={{ position: 'absolute', top: 10, right: 10 }}
              onPress={() => setJobDetailsModalVisible(false)}
              accessibilityLabel="Close Job Details Modal"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={30} color={COLORS.black} />
            </TouchableOpacity>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: COLORS.black, marginBottom: 10 }}>
              {selectedListing?.jobTitle || 'No Job Title'}
            </Text>
            <Text style={{ fontSize: 18, color: COLORS.secondary, marginBottom: 5 }}>
              {selectedListing?.companyName || 'No Company Name'}
            </Text>
            <View style={styles.centeredRow}>
              <Ionicons name="location-outline" size={20} color={COLORS.gray} />
              <Text style={{ fontSize: 16, color: COLORS.gray, marginLeft: 5 }}>
                {selectedListing?.city || 'No City'}, {selectedListing?.state || 'No State'}
              </Text>
            </View>
            <Text style={{ fontSize: 16, color: COLORS.black, marginBottom: 20 }}>
              {selectedListing?.jobDescription || 'No Description Provided'}
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: COLORS.primary, padding: 10, borderRadius: 10, alignItems: 'center', marginTop: 20 }}
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

      {/* Details Modal (including fix for Aviation Gear) */}
      <Modal
        visible={detailsModalVisible}
        transparent={true}
        onRequestClose={() => setDetailsModalVisible(false)}
        animationType="slide"
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' }}>
          <SafeAreaView style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <TouchableOpacity
                style={{ alignSelf: 'flex-end', marginBottom: 10 }}
                onPress={() => setDetailsModalVisible(false)}
                accessibilityLabel="Close Details Modal"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={30} color={COLORS.white} />
              </TouchableOpacity>

              {selectedListing?.images && selectedListing.images.length > 0 ? (
                <View style={{ position: 'relative' }}>
                  <Animated.ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
                      useNativeDriver: false,
                      listener: (event) => {
                        const offsetX = event.nativeEvent.contentOffset.x;
                        const index = Math.round(offsetX / (SCREEN_WIDTH - 32));
                        setImageIndex(index);
                      },
                    })}
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
                          style={{ width: SCREEN_WIDTH - 32, height: 250, resizeMode: 'cover' }}
                        />
                      </TouchableOpacity>
                    ))}
                  </Animated.ScrollView>
                  {renderPaginationDots()}
                </View>
              ) : (
                <Text style={{ color: COLORS.white, marginTop: 20 }}>No Images Available</Text>
              )}

              {selectedListing?.category === 'Aviation Gear' ? (
                <>
                  <Text
                    style={{
                      color: COLORS.white,
                      fontSize: 24,
                      fontWeight: 'bold',
                      marginTop: 20,
                      textAlign: 'center',
                    }}
                  >
                    {selectedListing?.gearTitle || 'No Title'}
                  </Text>
                  <View style={styles.centeredRow}>
                    <Ionicons name="location-outline" size={20} color={COLORS.gray} />
                    <Text style={{ fontSize: 16, color: COLORS.gray, marginLeft: 5 }}>
                      {selectedListing?.gearCity || 'No City'}, {selectedListing?.gearState || 'No State'}
                    </Text>
                  </View>
                  <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 10 }}>
                    Email: {selectedListing?.gearEmail || 'N/A'}
                  </Text>
                  <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}>
                    Phone: {selectedListing?.gearPhone || 'N/A'}
                  </Text>
                  <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}>
                    Price: $
                    {selectedListing?.gearPrice != null
                      ? String(selectedListing.gearPrice)
                      : 'N/A'}
                  </Text>
                  <Text
                    style={{
                      color: COLORS.white,
                      fontSize: 18,
                      marginTop: 20,
                      textAlign: 'left',
                      paddingHorizontal: 20,
                    }}
                  >
                    {selectedListing?.gearDescription || 'No Description'}
                  </Text>
                </>
              ) : (
                <>
                  <Text
                    style={{
                      color: COLORS.white,
                      fontSize: 24,
                      fontWeight: 'bold',
                      marginTop: 20,
                      textAlign: 'center',
                    }}
                  >
                    {selectedListing?.flightSchoolName || selectedListing?.title || 'No Title'}
                  </Text>
                  <View style={styles.centeredRow}>
                    <Ionicons name="location-outline" size={20} color={COLORS.gray} />
                    <Text style={{ fontSize: 16, color: COLORS.gray, marginLeft: 5 }}>
                      {selectedListing?.city || 'No City'}, {selectedListing?.state || 'No State'}
                    </Text>
                  </View>
                  <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 10 }}>
                    Email: {selectedListing?.email || 'N/A'}
                  </Text>
                  <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}>
                    Phone: {selectedListing?.phone || 'N/A'}
                  </Text>
                  <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}>
                    Tail Number: {selectedListing?.tailNumber || 'N/A'}
                  </Text>
                  <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 5 }}>
                    Price: $
                    {selectedListing?.salePrice != null
                      ? String(selectedListing.salePrice)
                      : 'N/A'}
                  </Text>
                  <Text
                    style={{
                      color: COLORS.white,
                      fontSize: 18,
                      marginTop: 20,
                      textAlign: 'left',
                      paddingHorizontal: 20,
                    }}
                  >
                    {selectedListing?.flightSchoolDetails ||
                      selectedListing?.description ||
                      'No Description'}
                  </Text>
                </>
              )}

              <TouchableOpacity
                style={{ marginTop: 20, backgroundColor: COLORS.primary, padding: 10, borderRadius: 10, alignItems: 'center' }}
                onPress={handleAskQuestion}
                accessibilityLabel="Ask a question"
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '90%', maxHeight: '90%', backgroundColor: COLORS.white, borderRadius: 24, padding: 0 }}
          >
            <ScrollView contentContainerStyle={{ padding: 24 }} style={{ width: '100%' }} nestedScrollEnabled={true}>
              <View style={{ width: '100%' }}>
                <Text
                  style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center', color: COLORS.black }}
                >
                  Filter Listings
                </Text>
                <TouchableOpacity
                  onPress={() => filterListingsByDistance(100)}
                  style={{ backgroundColor: COLORS.red, paddingVertical: 12, borderRadius: 50, marginBottom: 12 }}
                  accessibilityLabel="View Listings Within 100 Miles"
                  accessibilityRole="button"
                >
                  <Text style={{ color: COLORS.white, textAlign: 'center', fontWeight: 'bold' }}>
                    View Listings Within 100 Miles
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFilteredListings(listings)}
                  style={{ backgroundColor: COLORS.red, paddingVertical: 12, borderRadius: 50, marginBottom: 12 }}
                  accessibilityLabel="View All Listings"
                  accessibilityRole="button"
                >
                  <Text style={{ color: COLORS.white, textAlign: 'center', fontWeight: 'bold' }}>
                    View All Listings
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFilterModalVisible(false)}
                  style={{ marginTop: 16, paddingVertical: 8, borderRadius: 50, backgroundColor: COLORS.lightGray }}
                  accessibilityLabel="Cancel Filter Modal"
                  accessibilityRole="button"
                >
                  <Text style={{ textAlign: 'center', color: COLORS.black }}>Cancel</Text>
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
          onRequestClose={() => setPricingModalVisible((prev) => ({ ...prev, [key]: false }))}
        >
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View style={{ width: '80%', backgroundColor: COLORS.white, borderRadius: 20, padding: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>{key} Package</Text>
              <Text style={{ fontSize: 16, textAlign: 'center', marginBottom: 20 }}>
                {pricingDescriptions[key]}
              </Text>
              <TouchableOpacity
                onPress={() => setPricingModalVisible((prev) => ({ ...prev, [key]: false }))}
                style={{ backgroundColor: COLORS.primary, padding: 10, borderRadius: 10, alignItems: 'center' }}
                accessibilityLabel={`Close ${key} Pricing Info Modal`}
                accessibilityRole="button"
              >
                <Text style={{ color: COLORS.white }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ))}

      {/* Add / Edit Listing Modal */}
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
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
            <ScrollView contentContainerStyle={{ padding: 24 }} style={{ width: '100%' }} nestedScrollEnabled={true}>
              <View style={{ width: '100%' }}>
                <Text
                  style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center', color: COLORS.black }}
                >
                  {editingListing ? 'Edit Your Listing' : 'Submit Your Listing'}
                </Text>
                <Formik
                  initialValues={{
                    // New fields for Flight Instructors
                    firstName:
                      editingListing && editingListing.category === 'Flight Instructors'
                        ? editingListing.firstName || ''
                        : '',
                    lastName:
                      editingListing && editingListing.category === 'Flight Instructors'
                        ? editingListing.lastName || ''
                        : '',
                    certifications:
                      editingListing && editingListing.category === 'Flight Instructors'
                        ? editingListing.certifications || ''
                        : '',
                    flightHours:
                      editingListing && editingListing.category === 'Flight Instructors'
                        ? editingListing.flightHours?.toString() || ''
                        : '',
                    fiEmail:
                      editingListing && editingListing.category === 'Flight Instructors'
                        ? editingListing.email || ''
                        : '',
                    fiPhone:
                      editingListing && editingListing.category === 'Flight Instructors'
                        ? editingListing.phone || ''
                        : '',
                    fiDescription:
                      editingListing && editingListing.category === 'Flight Instructors'
                        ? editingListing.description || ''
                        : '',
                    serviceLocations:
                      editingListing && editingListing.category === 'Flight Instructors'
                        ? editingListing.serviceLocations || ''
                        : '',
                    fiCostPerHour:
                      editingListing && editingListing.category === 'Flight Instructors'
                        ? editingListing.fiCostPerHour?.toString() || ''
                        : '',
                    // New fields for Aviation Mechanic
                    amFirstName:
                      editingListing && editingListing.category === 'Aviation Mechanic'
                        ? editingListing.firstName || ''
                        : '',
                    amLastName:
                      editingListing && editingListing.category === 'Aviation Mechanic'
                        ? editingListing.lastName || ''
                        : '',
                    amCertifications:
                      editingListing && editingListing.category === 'Aviation Mechanic'
                        ? editingListing.certifications || ''
                        : '',
                    amEmail:
                      editingListing && editingListing.category === 'Aviation Mechanic'
                        ? editingListing.email || ''
                        : '',
                    amPhone:
                      editingListing && editingListing.category === 'Aviation Mechanic'
                        ? editingListing.phone || ''
                        : '',
                    amDescription:
                      editingListing && editingListing.category === 'Aviation Mechanic'
                        ? editingListing.description || ''
                        : '',
                    amServiceLocations:
                      editingListing && editingListing.category === 'Aviation Mechanic'
                        ? editingListing.serviceLocations || ''
                        : '',
                    // New fields for Aviation Gear
                    gearTitle:
                      editingListing && editingListing.category === 'Aviation Gear'
                        ? editingListing.title || ''
                        : '',
                    gearDescription:
                      editingListing && editingListing.category === 'Aviation Gear'
                        ? editingListing.description || ''
                        : '',
                    gearCity:
                      editingListing && editingListing.category === 'Aviation Gear'
                        ? editingListing.city || ''
                        : '',
                    gearState:
                      editingListing && editingListing.category === 'Aviation Gear'
                        ? editingListing.state || ''
                        : '',
                    gearEmail:
                      editingListing && editingListing.category === 'Aviation Gear'
                        ? editingListing.email || ''
                        : '',
                    gearPhone:
                      editingListing && editingListing.category === 'Aviation Gear'
                        ? editingListing.phone || ''
                        : '',
                    gearPrice:
                      editingListing && editingListing.category === 'Aviation Gear'
                        ? editingListing.gearPrice?.toString() || ''
                        : '',
                    // Original fields for Aircraft for Sale, Aviation Jobs, Flight Schools
                    title: editingListing ? editingListing.title || '' : '',
                    tailNumber: editingListing ? editingListing.tailNumber || '' : '',
                    salePrice: editingListing?.salePrice?.toString() || '',
                    description: editingListing ? editingListing.description || '' : '',
                    city: editingListing ? editingListing.city || '' : '',
                    state: editingListing ? editingListing.state || '' : '',
                    email: editingListing ? editingListing.email || '' : '',
                    phone: editingListing ? editingListing.phone || '' : '',
                    companyName: editingListing ? editingListing.companyName || '' : '',
                    jobTitle: editingListing ? editingListing.jobTitle || '' : '',
                    jobDescription: editingListing ? editingListing.jobDescription || '' : '',
                    flightSchoolName: editingListing ? editingListing.flightSchoolName || '' : '',
                    flightSchoolDetails: editingListing ? editingListing.flightSchoolDetails || '' : '',
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
                    // Category is taken from editingListing if present; otherwise use selectedCategory
                    category: editingListing ? editingListing.category || selectedCategory : selectedCategory,
                  }}
                  enableReinitialize={true}
                  validate={(values) => {
                    const errors = {};
                    const { category, selectedPricing } = values;
                    if (category === 'Flight Instructors') {
                      if (!values.firstName) errors.firstName = 'First name is required.';
                      if (!values.lastName) errors.lastName = 'Last name is required.';
                      if (!values.certifications) errors.certifications = 'Certifications are required.';
                      if (!values.fiEmail) {
                        errors.fiEmail = 'Contact email is required.';
                      } else if (!/\S+@\S+\.\S+/.test(values.fiEmail)) {
                        errors.fiEmail = 'Invalid email address.';
                      }
                      if (!values.fiDescription) errors.fiDescription = 'Description is required.';
                      if (!values.serviceLocations) errors.serviceLocations = 'Service locations are required.';
                      if (!values.fiCostPerHour) errors.fiCostPerHour = 'Cost per hour is required.';
                      else if (isNaN(Number(values.fiCostPerHour))) {
                        errors.fiCostPerHour = 'Cost per hour must be a valid number.';
                      }
                    } else if (category === 'Aviation Mechanic') {
                      if (!values.amFirstName) errors.amFirstName = 'First name is required.';
                      if (!values.amLastName) errors.amLastName = 'Last name is required.';
                      if (!values.amCertifications) errors.amCertifications = 'Certifications are required.';
                      if (!values.amEmail) {
                        errors.amEmail = 'Contact email is required.';
                      } else if (!/\S+@\S+\.\S+/.test(values.amEmail)) {
                        errors.amEmail = 'Invalid email address.';
                      }
                      if (!values.amDescription) errors.amDescription = 'Description is required.';
                      if (!values.amServiceLocations) errors.amServiceLocations = 'Service locations are required.';
                    } else if (category === 'Aviation Gear') {
                      if (!values.gearTitle) errors.gearTitle = 'Title is required.';
                      if (!values.gearDescription) errors.gearDescription = 'Description is required.';
                      if (!values.gearCity) errors.gearCity = 'City is required.';
                      if (!values.gearState) errors.gearState = 'State is required.';
                      if (!values.gearEmail) {
                        errors.gearEmail = 'Contact email is required.';
                      } else if (!/\S+@\S+\.\S+/.test(values.gearEmail)) {
                        errors.gearEmail = 'Invalid email address.';
                      }
                      if (!values.gearPrice) errors.gearPrice = 'Price is required.';
                      else if (isNaN(Number(values.gearPrice))) {
                        errors.gearPrice = 'Price must be a valid number.';
                      }
                    } else if (category === 'Aviation Jobs') {
                      if (!values.companyName) errors.companyName = 'Company Name is required.';
                      if (!values.jobTitle) errors.jobTitle = 'Job Title is required.';
                      if (!values.jobDescription) errors.jobDescription = 'Job Description is required.';
                    } else if (category === 'Flight Schools') {
                      if (!values.flightSchoolName) errors.flightSchoolName = 'Flight School Name is required.';
                      if (!values.flightSchoolDetails) errors.flightSchoolDetails = 'Flight School Details are required.';
                    } else {
                      // Aircraft for Sale
                      if (!values.title) errors.title = 'Title is required.';
                      if (!values.description) errors.description = 'Description is required.';
                      if (!values.salePrice) errors.salePrice = 'Sale Price is required.';
                      if (!values.email) {
                        errors.email = 'Contact email is required.';
                      } else if (!/\S+@\S+\.\S+/.test(values.email)) {
                        errors.email = 'Invalid email address.';
                      }
                    }
                    if (!values.lat || !values.lng) {
                      errors.location = 'Location is required.';
                    } else {
                      const lat = parseFloat(values.lat);
                      const lng = parseFloat(values.lng);
                      if (isNaN(lat) || isNaN(lng)) {
                        errors.location = 'Latitude and Longitude must be valid numbers.';
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
                      {/* Conditional Fields Based on Category */}
                      {values.category === 'Flight Instructors' ? (
                        <>
                          <TextInput
                            placeholder="First Name"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('firstName')}
                            onBlur={handleBlur('firstName')}
                            value={values.firstName}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="First Name Input"
                          />
                          {touched.firstName && errors.firstName && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.firstName}</Text>
                          )}
                          <TextInput
                            placeholder="Last Name"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('lastName')}
                            onBlur={handleBlur('lastName')}
                            value={values.lastName}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Last Name Input"
                          />
                          {touched.lastName && errors.lastName && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.lastName}</Text>
                          )}
                          <TextInput
                            placeholder="Certifications"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('certifications')}
                            onBlur={handleBlur('certifications')}
                            value={values.certifications}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Certifications Input"
                          />
                          {touched.certifications && errors.certifications && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.certifications}</Text>
                          )}
                          <TextInput
                            placeholder="Current Flight Hours"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('flightHours')}
                            onBlur={handleBlur('flightHours')}
                            value={values.flightHours}
                            keyboardType="numeric"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Current Flight Hours Input"
                          />
                          <TextInput
                            placeholder="Contact Email"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('fiEmail')}
                            onBlur={handleBlur('fiEmail')}
                            value={values.fiEmail}
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
                          {touched.fiEmail && errors.fiEmail && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.fiEmail}</Text>
                          )}
                          <TextInput
                            placeholder="Phone Number (Optional)"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('fiPhone')}
                            onBlur={handleBlur('fiPhone')}
                            value={values.fiPhone}
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
                          <TextInput
                            placeholder="Description"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('fiDescription')}
                            onBlur={handleBlur('fiDescription')}
                            value={values.fiDescription}
                            multiline
                            numberOfLines={10}
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
                          {touched.fiDescription && errors.fiDescription && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.fiDescription}</Text>
                          )}
                          <TextInput
                            placeholder="Service Locations (local airports or city)"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('serviceLocations')}
                            onBlur={handleBlur('serviceLocations')}
                            value={values.serviceLocations}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Service Locations Input"
                          />
                          {touched.serviceLocations && errors.serviceLocations && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.serviceLocations}</Text>
                          )}
                          <TextInput
                            placeholder="Cost per Hour"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('fiCostPerHour')}
                            onBlur={handleBlur('fiCostPerHour')}
                            value={values.fiCostPerHour}
                            keyboardType="numeric"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Cost per Hour Input"
                          />
                          {touched.fiCostPerHour && errors.fiCostPerHour && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.fiCostPerHour}</Text>
                          )}
                        </>
                      ) : values.category === 'Aviation Mechanic' ? (
                        <>
                          <TextInput
                            placeholder="First Name"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('amFirstName')}
                            onBlur={handleBlur('amFirstName')}
                            value={values.amFirstName}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="First Name Input"
                          />
                          {touched.amFirstName && errors.amFirstName && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.amFirstName}</Text>
                          )}
                          <TextInput
                            placeholder="Last Name"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('amLastName')}
                            onBlur={handleBlur('amLastName')}
                            value={values.amLastName}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Last Name Input"
                          />
                          {touched.amLastName && errors.amLastName && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.amLastName}</Text>
                          )}
                          <TextInput
                            placeholder="Certifications"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('amCertifications')}
                            onBlur={handleBlur('amCertifications')}
                            value={values.amCertifications}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Certifications Input"
                          />
                          {touched.amCertifications && errors.amCertifications && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.amCertifications}</Text>
                          )}
                          <TextInput
                            placeholder="Contact Email"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('amEmail')}
                            onBlur={handleBlur('amEmail')}
                            value={values.amEmail}
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
                          {touched.amEmail && errors.amEmail && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.amEmail}</Text>
                          )}
                          <TextInput
                            placeholder="Phone Number (Optional)"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('amPhone')}
                            onBlur={handleBlur('amPhone')}
                            value={values.amPhone}
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
                          <TextInput
                            placeholder="Description"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('amDescription')}
                            onBlur={handleBlur('amDescription')}
                            value={values.amDescription}
                            multiline
                            numberOfLines={10}
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
                          {touched.amDescription && errors.amDescription && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.amDescription}</Text>
                          )}
                          <TextInput
                            placeholder="Service Locations (local airports or city)"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('amServiceLocations')}
                            onBlur={handleBlur('amServiceLocations')}
                            value={values.amServiceLocations}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Service Locations Input"
                          />
                          {touched.amServiceLocations && errors.amServiceLocations && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.amServiceLocations}</Text>
                          )}
                        </>
                      ) : values.category === 'Aviation Gear' ? (
                        <>
                          <TextInput
                            placeholder="Title"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('gearTitle')}
                            onBlur={handleBlur('gearTitle')}
                            value={values.gearTitle}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Title Input"
                          />
                          {touched.gearTitle && errors.gearTitle && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.gearTitle}</Text>
                          )}
                          <TextInput
                            placeholder="Description"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('gearDescription')}
                            onBlur={handleBlur('gearDescription')}
                            value={values.gearDescription}
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
                          {touched.gearDescription && errors.gearDescription && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.gearDescription}</Text>
                          )}
                          <TextInput
                            placeholder="City"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('gearCity')}
                            onBlur={handleBlur('gearCity')}
                            value={values.gearCity}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="City Input"
                          />
                          {touched.gearCity && errors.gearCity && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.gearCity}</Text>
                          )}
                          <TextInput
                            placeholder="State"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('gearState')}
                            onBlur={handleBlur('gearState')}
                            value={values.gearState}
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="State Input"
                          />
                          {touched.gearState && errors.gearState && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.gearState}</Text>
                          )}
                          <TextInput
                            placeholder="Contact Email"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('gearEmail')}
                            onBlur={handleBlur('gearEmail')}
                            value={values.gearEmail}
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
                          {touched.gearEmail && errors.gearEmail && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.gearEmail}</Text>
                          )}
                          <TextInput
                            placeholder="Phone Number (Optional)"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('gearPhone')}
                            onBlur={handleBlur('gearPhone')}
                            value={values.gearPhone}
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
                          <TextInput
                            placeholder="Price"
                            placeholderTextColor={COLORS.gray}
                            onChangeText={handleChange('gearPrice')}
                            onBlur={handleBlur('gearPrice')}
                            value={values.gearPrice}
                            keyboardType="numeric"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                            accessibilityLabel="Price Input"
                          />
                          {touched.gearPrice && errors.gearPrice && (
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.gearPrice}</Text>
                          )}
                        </>
                      ) : values.category === 'Aviation Jobs' ? (
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
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.companyName}</Text>
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
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.jobTitle}</Text>
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
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.jobDescription}</Text>
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
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.flightSchoolName}</Text>
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
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.flightSchoolDetails}</Text>
                          )}
                        </>
                      ) : (
                        // Default: Aircraft for Sale
                        <>
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
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.title}</Text>
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
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.tailNumber}</Text>
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
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.salePrice}</Text>
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
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.description}</Text>
                          )}
                        </>
                      )}

                      {/* For default categories, show common Location & Contact Fields */}
                      {['Aviation Jobs', 'Flight Schools', 'Aircraft for Sale'].includes(values.category) && (
                        <>
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
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.city}</Text>
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
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.state}</Text>
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
                            <Text style={{ color: 'red', marginBottom: 8 }}>{errors.email}</Text>
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
                        </>
                      )}

                      {/* For Aviation Gear, also show image upload but skip pricing package selection */}
                      {['Aviation Jobs', 'Flight Schools', 'Aircraft for Sale', 'Aviation Gear'].includes(
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
                                  style={{ width: 96, height: 96, marginRight: 8, borderRadius: 8 }}
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
                            keyExtractor={(imgItem, idx) => idx.toString()}
                            nestedScrollEnabled={true}
                          />
                          {renderImageUploadButton()}
                        </>
                      )}

                      {/* Conditionally render Pricing Package Section only if category is NOT Aviation Gear */}
                      {values.category !== 'Aviation Gear' && (
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
                          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 }}>
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
                                    selectedPricing === packageType ? COLORS.primary : COLORS.lightGray,
                                  alignItems: 'center',
                                  width: '30%',
                                }}
                                accessibilityLabel={`Select ${packageType} package`}
                                accessibilityRole="button"
                              >
                                <Text
                                  style={{
                                    color: selectedPricing === packageType ? COLORS.white : COLORS.black,
                                    fontWeight: 'bold',
                                  }}
                                >
                                  {packageType}
                                </Text>
                                <Text
                                  style={{
                                    color: selectedPricing === packageType ? COLORS.white : COLORS.black,
                                  }}
                                >
                                  ${pricingPackages[packageType]}
                                </Text>
                                <TouchableOpacity
                                  onPress={() =>
                                    setPricingModalVisible((prev) => ({ ...prev, [packageType]: true }))
                                  }
                                  style={{ marginTop: 4 }}
                                  accessibilityLabel={`View details for ${packageType} package`}
                                  accessibilityRole="button"
                                >
                                  <Ionicons
                                    name="information-circle-outline"
                                    size={20}
                                    color={
                                      selectedPricing === packageType ? COLORS.white : COLORS.black
                                    }
                                  />
                                </TouchableOpacity>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </>
                      )}

                      {loading ? (
                        <ActivityIndicator size="large" color={COLORS.red} accessibilityLabel="Submitting Listing" />
                      ) : (
                        <TouchableOpacity
                          onPress={handleSubmit}
                          style={{ backgroundColor: COLORS.red, paddingVertical: 12, borderRadius: 50 }}
                          accessibilityLabel={
                            values.category === 'Aviation Gear'
                              ? 'Post for Free'
                              : editingListing
                              ? 'Save'
                              : 'Proceed to pay'
                          }
                          accessibilityRole="button"
                        >
                          <Text style={{ color: COLORS.white, textAlign: 'center', fontWeight: 'bold' }}>
                            {values.category === 'Aviation Gear'
                              ? 'Post for Free'
                              : editingListing
                              ? 'Save'
                              : 'Proceed to pay'}
                          </Text>
                        </TouchableOpacity>
                      )}

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
                        <Text style={{ textAlign: 'center', color: COLORS.black }}>Cancel</Text>
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
            <Ionicons name="close" size={30} color={COLORS.white} />
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
              <Image source={{ uri: zoomImageUri }} style={styles.zoomImage} resizeMode="contain" />
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const AppNavigator = () => (
  <NavigationContainer independent={true}>
    <Stack.Navigator initialRouteName="Classifieds">
      <Stack.Screen name="Classifieds" component={Classifieds} options={{ headerShown: false }} />
      {/* For rental payments */}
      {/* <Stack.Screen name="CheckoutScreen" component={CheckoutScreen} options={{ headerShown: false }} /> */}
      {/* New screen for classifieds payment */}
      <Stack.Screen
        name="classifiedsPaymentScreen"
        component={classifiedsPaymentScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  </NavigationContainer>
);

export default AppNavigator;

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
