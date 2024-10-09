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
} from 'react-native';
import auth from '@react-native-firebase/auth'; // Firebase Auth import
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { db, storage } from '../../firebaseConfig';
import {
  collection,
  onSnapshot,
  orderBy,
  addDoc,
  query,
  where,
  deleteDoc,
  doc,
  updateDoc,
} from 'firebase/firestore';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import wingtipClouds from '../../Assets/images/wingtip_clouds.jpg';
import * as ImagePicker from 'expo-image-picker';
import { Formik } from 'formik';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useStripe } from '@stripe/stripe-react-native';
import { API_URL } from '@env';
import PaymentScreen from '../payment/PaymentScreen';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#1D4ED8',
  secondary: '#6B7280',
  background: '#F3F4F6',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#9CA3AF',
  lightGray: '#D1D5DB',
  red: '#EF4444',
};

const Stack = createStackNavigator();

const Classifieds = () => {
  const user = auth().currentUser; // Use Firebase's current user
  const { initPaymentSheet } = useStripe();
  const navigation = useNavigation();
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [jobDetailsModalVisible, setJobDetailsModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPricing, setSelectedPricing] = useState('Basic');
  const [totalCost, setTotalCost] = useState(0);
  const [listingDetails, setListingDetails] = useState({});
  const [selectedListing, setSelectedListing] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [location, setLocation] = useState(null);
  const [pricingModalVisible, setPricingModalVisible] = useState({ Basic: false, Featured: false, Enhanced: false });

  const scaleValue = useRef(new Animated.Value(0)).current;

  const categories = ['Aircraft for Sale', 'Aviation Jobs', 'Flight Schools'];

  const defaultPricingPackages = {
    Basic: 25,
    Featured: 70,
    Enhanced: 150,
  };

  const [pricingPackages, setPricingPackages] = useState(defaultPricingPackages);

  const scrollY = useRef(new Animated.Value(0)).current;

  const pricingDescriptions = {
    Basic: 'Basic package includes 7 days of listing.',
    Featured: 'Featured package includes 14 days of listing and enhanced visibility.',
    Enhanced: 'Enhanced package includes 30 days of listing and premium placement.',
  };

  const openPricingInfo = (packageType) => {
    setPricingModalVisible((prev) => ({ ...prev, [packageType]: true }));
  };

  const closePricingInfo = (packageType) => {
    setPricingModalVisible((prev) => ({ ...prev, [packageType]: false }));
  };

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission denied', 'Location access is required.');
          setLocation(null);
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
      }
    };

    fetchLocation();
  }, [user]);

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

  useEffect(() => {
    const q = selectedCategory
      ? query(
          collection(db, 'UserPost'),
          where('category', '==', selectedCategory),
          orderBy('createdAt', 'desc')
        )
      : query(collection(db, 'UserPost'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const listingsData = [];
      querySnapshot.forEach((doc) => {
        listingsData.push({ id: doc.id, ...doc.data() });
      });

      setListings(listingsData);
      setFilteredListings(listingsData);
    });

    return () => unsubscribe();
  }, [selectedCategory]);

  const pickImage = async () => {
    let maxImages = 1;

    if (selectedCategory === 'Aviation Jobs') {
      maxImages = 3;
    } else if (selectedCategory === 'Flight Schools') {
      maxImages = 5;
    } else if (selectedCategory === 'Aircraft for Sale') {
      maxImages =
        selectedPricing === 'Basic' ? 7 : selectedPricing === 'Featured' ? 14 : 18;
    }

    if (images.length >= maxImages) {
      Alert.alert(`You can only upload up to ${maxImages} images.`);
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
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
      const selectedImages = result.assets.map((asset) => asset.uri);
      setImages([...images, ...selectedImages].slice(0, maxImages));
    }
  };

  const renderImageUploadButton = () => {
    let maxImages = 1;
    if (selectedCategory === 'Aviation Jobs') {
      maxImages = 3;
    } else if (selectedCategory === 'Flight Schools') {
      maxImages = 5;
    } else if (selectedCategory === 'Aircraft for Sale') {
      maxImages =
        selectedPricing === 'Basic' ? 7 : selectedPricing === 'Featured' ? 14 : 18;
    }

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
      >
        <Text style={{ textAlign: 'center', color: COLORS.white }}>
          {images.length >= maxImages
            ? `Maximum ${maxImages} Images Reached`
            : `Add Image (${remainingUploads} remaining)`}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderListingImages = (item) => {
    return (
      <FlatList
        data={item.images}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(imageUri, index) => `${item.id}-${index}`}
        renderItem={({ item: imageUri }) => (
          <Image
            source={{ uri: imageUri }}
            style={{
              width: width - 32,
              height: 200,
              borderRadius: 10,
              marginBottom: 8,
              marginRight: 8,
            }}
          />
        )}
      />
    );
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

  const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
  };

  const fetchPaymentSheetParams = async () => {
    try {
      console.log(`Making request to: ${API_URL}/create-payment-intent`);
      const response = await fetch("https://us-central1-ready-set-fly-71506.cloudfunctions.net/paymentSheet",{
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: totalCost }),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.log('Error data:', errorData);
        throw new Error(errorData.error || 'Failed to fetch payment sheet parameters.');
      }

      const { paymentIntent, ephemeralKey, customer } = await response.json();
      console.log('Fetched payment sheet params:', { paymentIntent, ephemeralKey, customer });

      return {
        paymentIntent,
        ephemeralKey,
        customer,
      };
    } catch (error) {
      console.error('Error fetching payment sheet parameters:', error);
      Alert.alert('Error', 'Failed to fetch payment sheet parameters.');
      throw error;
    }
  };

  const initializePaymentSheet = async () => {
    if (!user) {
      Alert.alert('Error', 'User information is not available.');
      return false;
    }

    try {
      const { paymentIntent, ephemeralKey, customer } = await fetchPaymentSheetParams();

      const { error } = await initPaymentSheet({
        merchantDisplayName: 'Ready Set Fly',
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret: paymentIntent,
        allowsDelayedPaymentMethods: true,
        defaultBillingDetails: {
          name: user.displayName || 'Guest',
        },
      });

      if (error) {
        console.error('Payment Sheet initialization error:', error);
        Alert.alert('Error', 'Failed to initialize payment sheet');
        return false;
      } else {
        return true;
      }
    } catch (error) {
      console.error('Error initializing payment sheet:', error);
      Alert.alert('Error', 'Failed to initialize payment sheet');
      return false;
    }
  };

  const handleSubmitPayment = async () => {
    try {
      navigation.navigate('PaymentScreen', {
        totalCost,
        listingDetails,
        images,
        selectedCategory,
        selectedPricing,
      });
    } catch (error) {
      console.error('Payment Error:', error);
      Alert.alert('Error', 'Failed to process payment.');
      setLoading(false);
    }
  };

  const handleCompletePayment = async () => {
    if (!user) {
      Alert.alert('Error', 'User information is not available.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const uploadedImages = await Promise.all(
        images.map(async (imageUri) => {
          try {
            const response = await fetch(imageUri);
            const blob = await response.blob();
            const storageRef = ref(
              storage,
              `classifiedImages/${user.uid}/${new Date().getTime()}_${user.uid}`
            );
            const snapshot = await uploadBytes(storageRef, blob);
            return await getDownloadURL(snapshot.ref);
          } catch (error) {
            if (__DEV__) {
              console.error('Error uploading image: ', error);
              Alert.alert(
                'Development Mode',
                'Error uploading image. This will render in development mode, but you must fix this error before deploying.'
              );
              return imageUri;
            } else {
              throw error;
            }
          }
        })
      );

      const newListing = {
        ...listingDetails,
        category: selectedCategory,
        images: uploadedImages,
        ownerId: user.uid,
        userEmail: user.email,
        contactEmail: listingDetails.email,
        contactPhone: listingDetails.phone,
        createdAt: new Date(),
        pricingPackage: selectedPricing,
        pricingPackageDuration:
          selectedPricing === 'Basic'
            ? 7
            : selectedPricing === 'Featured'
            ? 14
            : 30,
        totalCost: totalCost / 100,
      };

      await addDoc(collection(db, 'UserPost'), newListing);

      Alert.alert('Payment Completed', 'Your listing has been successfully submitted!');
      setModalVisible(false);
      setLoading(false);
    } catch (error) {
      console.error('Error completing payment: ', error);
      Alert.alert('Error', 'Failed to complete payment and submit listing.');
      setLoading(false);
    }
  };

  const handleTestSubmitListing = async (values) => {
    if (!user) {
      Alert.alert('Error', 'User information is not available.');
      setLoading(false);
      return;
    }
  
    try {
      setLoading(true);
  
      const uploadedImages = await Promise.all(
        images.map(async (imageUri) => {
          try {
            const response = await fetch(imageUri);
            const blob = await response.blob();
            const storageRef = ref(
              storage,
              `classifiedImages/${new Date().getTime()}_${user.uid}`
            );
            const snapshot = await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(snapshot.ref);
            return downloadURL;
          } catch (error) {
            console.error('Error uploading image: ', error);
            return null;
          }
        })
      );
  
      const validUploadedImages = uploadedImages.filter((url) => url !== null);
  
      const testListing = {
        ...values,
        category: selectedCategory,
        images: validUploadedImages,
        ownerId: user.uid,
        userEmail: user.email,
        createdAt: new Date(),
        pricingPackage: selectedPricing,
      };
  
      await addDoc(collection(db, 'UserPost'), testListing);
  
      Alert.alert('Test Listing Submitted', 'Your test listing has been added successfully.');
      setModalVisible(false);
      setLoading(false);
    } catch (error) {
      console.error('Error submitting listing for testing: ', error);
      Alert.alert('Error', 'Failed to submit the listing for testing.');
      setLoading(false);
    }
  };
  
  const renderEditAndDeleteButtons = (listing) => {
    if (user && listing?.ownerId === user.uid) {
      return (
        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          <TouchableOpacity
            style={{
              backgroundColor: COLORS.primary,
              padding: 10,
              borderRadius: 10,
              alignItems: 'center',
              marginRight: 10,
            }}
            onPress={() => handleEditListing(listing)}
          >
            <Text style={{ color: COLORS.white, fontSize: 16 }}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              backgroundColor: COLORS.red,
              padding: 10,
              borderRadius: 10,
              alignItems: 'center',
            }}
            onPress={() => handleDeleteListing(listing.id)}
          >
            <Text style={{ color: COLORS.white, fontSize: 16 }}>Delete</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };

  const handleListingPress = (listing) => {
    setSelectedListing(listing);
    if (listing.category === 'Aviation Jobs') {
      setJobDetailsModalVisible(true);
    } else {
      setDetailsModalVisible(true);
    }
  };

  const handleEditListing = (listing) => {
    setSelectedListing(listing);
    setEditModalVisible(true);
  };

  const handleDeleteListing = async (listingId) => {
    try {
      Alert.alert(
        'Confirm Delete',
        'Are you sure you want to delete this listing?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await deleteDoc(doc(db, 'UserPost', listingId));
              Alert.alert('Listing Deleted', 'Your listing has been deleted.');
              setDetailsModalVisible(false);
              setJobDetailsModalVisible(false);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error deleting listing: ', error);
      Alert.alert('Error', 'Failed to delete the listing.');
    }
  };

  const handleSaveEdit = async (values) => {
    if (!user) {
      Alert.alert('Error', 'User information is not available.');
      return;
    }

    try {
      await updateDoc(doc(db, 'UserPost', selectedListing.id), values);
      Alert.alert('Listing Updated', 'Your listing has been successfully updated.');
      setEditModalVisible(false);
    } catch (error) {
      console.error('Error updating listing:', error);
      Alert.alert('Error', 'Failed to update the listing.');
    }
  };

  const handleAskQuestion = () => {
    if (selectedListing && selectedListing.contactEmail) {
      const email = selectedListing.contactEmail;
      const subject = encodeURIComponent(`Inquiry about ${selectedListing.title}`);
      const mailUrl = `mailto:${email}?subject=${subject}`;

      Linking.openURL(mailUrl).catch((error) => {
        console.error('Error opening mail app:', error);
        Alert.alert('Error', 'Unable to open mail app.');
      });
    } else {
      Alert.alert('Error', 'Contact email not available.');
    }
  };

  const onSubmitMethod = async (values) => {
    if (!user) {
      Alert.alert('Error', 'User information is not available.');
      setLoading(false);
      return;
    }

    setLoading(true);
    const selectedPackagePrice = pricingPackages[selectedPricing];
    const totalWithTaxInCents = Math.round(selectedPackagePrice * 1.0825 * 100);
    setTotalCost(totalWithTaxInCents);
    setListingDetails(values);

    setModalVisible(false);
    setFilterModalVisible(false);
    setDetailsModalVisible(false);
    setJobDetailsModalVisible(false);
    setEditModalVisible(false);

    navigation.navigate('PaymentScreen', {
      totalCost: totalWithTaxInCents,
      listingDetails: values,
      images,
      selectedCategory,
      selectedPricing,
    });

    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setModalVisible(false);
      setFilterModalVisible(false);
      setDetailsModalVisible(false);
      setJobDetailsModalVisible(false);
      setEditModalVisible(false);
    });

    return unsubscribe;
  }, [navigation]);

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      key={item}
      onPress={() => setSelectedCategory(item)}
      style={{
        padding: 8,
        borderRadius: 8,
        marginRight: 8,
        backgroundColor: selectedCategory === item ? COLORS.primary : COLORS.lightGray,
      }}
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
  );

  const goToNextImage = () => {
    if (
      selectedListing?.images &&
      selectedListing.images.length > 0 &&
      currentImageIndex < selectedListing.images.length - 1
    ) {
      setCurrentImageIndex(currentImageIndex + 1);
    } else {
      setCurrentImageIndex(0);
    }
  };

  const goToPreviousImage = () => {
    if (
      selectedListing?.images &&
      selectedListing.images.length > 0 &&
      currentImageIndex > 0
    ) {
      setCurrentImageIndex(currentImageIndex - 1);
    } else if (selectedListing?.images && selectedListing.images.length > 0) {
      setCurrentImageIndex(selectedListing.images.length - 1);
    }
  };

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [selectedListing]);

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.white }}>
      <Animated.View style={{ overflow: 'hidden', height: headerHeight }}>
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
            >
              Good Morning
            </Animated.Text>
            <Animated.Text
              style={{
                color: COLORS.white,
                fontWeight: 'bold',
                fontSize: Animated.add(headerFontSize, 6),
              }}
            >
              {user?.displayName}
            </Animated.Text>
          </Animated.View>
        </ImageBackground>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={{ padding: 16 }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ fontSize: 18, color: COLORS.secondary }}>
            Filter by Location or Aircraft Make
          </Text>
          <TouchableOpacity
            onPress={() => setFilterModalVisible(true)}
            style={{ backgroundColor: COLORS.lightGray, padding: 8, borderRadius: 50 }}
          >
            <Ionicons name="filter" size={24} color="gray" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={categories}
          renderItem={renderCategoryItem}
          horizontal
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 16 }}
        />

        <Text
          style={{
            fontSize: 24,
            fontWeight: 'bold',
            marginBottom: 16,
            textAlign: 'center',
            color: COLORS.black,
          }}
        >
          Aircraft Marketplace
        </Text>

        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={{
            backgroundColor: COLORS.red,
            borderRadius: 50,
            paddingVertical: 12,
            marginBottom: 24,
          }}
        >
          <Text style={{ color: COLORS.white, textAlign: 'center', fontWeight: 'bold' }}>
            Add Listing
          </Text>
        </TouchableOpacity>

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
              <TouchableOpacity onPress={() => handleListingPress(item)} style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: COLORS.black,
                    padding: 10,
                  }}
                >
                  {item.title}
                </Text>
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
                      {item.jobTitle}
                    </Text>
                    <Text
                      style={{ fontSize: 16, color: COLORS.secondary, marginBottom: 5 }}
                    >
                      {item.companyName}
                    </Text>
                    <Text style={{ fontSize: 14, color: COLORS.gray }}>
                      {item.city}, {item.state}
                    </Text>
                  </View>
                ) : item.category === 'Flight Schools' ? (
                  <View
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: COLORS.white,
                    }}
                  >
                    <Text
                      style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.black }}
                    >
                      {item.flightSchoolName}
                    </Text>
                    <Text
                      style={{
                        fontSize: 16,
                        color: COLORS.gray,
                        marginVertical: 5,
                      }}
                    >
                      {item.flightSchoolDetails}
                    </Text>
                    {item.images && item.images.length > 0 ? (
                      renderListingImages(item)
                    ) : (
                      <Text
                        style={{
                          textAlign: 'center',
                          color: COLORS.gray,
                          marginTop: 10,
                        }}
                      >
                        No Images Available
                      </Text>
                    )}
                  </View>
                ) : item.images && item.images.length > 0 ? (
                  renderListingImages(item)
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
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={{ textAlign: 'center', color: COLORS.gray }}>
            No listings available
          </Text>
        )}
      </Animated.ScrollView>

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
              {selectedListing?.jobTitle}
            </Text>
            <Text
              style={{ fontSize: 18, color: COLORS.secondary, marginBottom: 5 }}
            >
              {selectedListing?.companyName}
            </Text>
            <Text
              style={{ fontSize: 16, color: COLORS.gray, marginBottom: 10 }}
            >
              {selectedListing?.city}, {selectedListing?.state}
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: COLORS.black,
                marginBottom: 20,
              }}
            >
              {selectedListing?.jobDescription}
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
            <View
              style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
            >
              {renderEditAndDeleteButtons(selectedListing)}

              {selectedListing?.images && selectedListing.images.length > 0 ? (
                <View
                  style={{ width: '90%', height: '50%', position: 'relative' }}
                >
                  <Image
                    source={{ uri: selectedListing.images[currentImageIndex] }}
                    style={{
                      width: '100%',
                      height: '100%',
                      resizeMode: 'contain',
                    }}
                  />
                  <TouchableOpacity
                    style={{
                      position: 'absolute',
                      top: '45%',
                      padding: 10,
                      left: 10,
                    }}
                    onPress={goToPreviousImage}
                  >
                    <Ionicons name="arrow-back" size={36} color="white" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      position: 'absolute',
                      top: '45%',
                      padding: 10,
                      right: 10,
                    }}
                    onPress={goToNextImage}
                  >
                    <Ionicons name="arrow-forward" size={36} color="white" />
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={{ color: COLORS.white, marginTop: 20 }}>
                  No Images Available
                </Text>
              )}
              <Text
                style={{
                  color: COLORS.white,
                  fontSize: 24,
                  fontWeight: 'bold',
                  marginTop: 20,
                }}
              >
                {selectedListing?.flightSchoolName || selectedListing?.title}
              </Text>
              <Text
                style={{
                  color: COLORS.white,
                  fontSize: 18,
                  marginTop: 10,
                  textAlign: 'center',
                  paddingHorizontal: 20,
                }}
              >
                {selectedListing?.flightSchoolDetails ||
                  selectedListing?.description}
              </Text>
              <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 10 }}>
                {selectedListing?.city}, {selectedListing?.state}
              </Text>
              <TouchableOpacity
                style={{
                  marginTop: 20,
                  backgroundColor: COLORS.primary,
                  padding: 10,
                  borderRadius: 10,
                }}
                onPress={handleAskQuestion}
              >
                <Text style={{ color: COLORS.white, fontSize: 16 }}>
                  Ask a question
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  marginTop: 20,
                  backgroundColor: COLORS.red,
                  padding: 10,
                  borderRadius: 10,
                }}
                onPress={() => setDetailsModalVisible(false)}
              >
                <Text style={{ color: COLORS.white, fontSize: 16 }}>Close</Text>
              </TouchableOpacity>
            </View>
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
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
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
        onRequestClose={() => setModalVisible(false)}
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
                  Submit Your Listing
                </Text>

                <Text
                  style={{
                    marginBottom: 8,
                    color: COLORS.black,
                    fontWeight: 'bold',
                    textAlign: 'center'
                  }}
                >
                  Select Pricing Package
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-around', // Evenly space the buttons
                    marginBottom: 16,
                  }}
                >
                  {Object.keys(pricingPackages).map((key) => (
                    <View key={key} style={{ alignItems: 'center', marginHorizontal: 10 }}>
                      <TouchableOpacity
                        onPress={() => setSelectedPricing(key)}
                        style={{
                          backgroundColor: selectedPricing === key ? COLORS.primary : COLORS.lightGray,
                          paddingVertical: 12,
                          paddingHorizontal: 20,
                          borderRadius: 8,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.25,
                          shadowRadius: 3.84,
                          elevation: 5,
                          width: (width - 160) / 3, // Ensure all buttons have the same width
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ textAlign: 'center', color: selectedPricing === key ? COLORS.white : COLORS.black, fontWeight: 'bold', fontSize: 16 }}>
                          {key}
                        </Text>
                        <Text style={{ textAlign: 'center', color: selectedPricing === key ? COLORS.white : COLORS.black, fontWeight: 'bold', fontSize: 16 }}>
                          ${pricingPackages[key]}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => openPricingInfo(key)}
                        style={{
                          position: 'absolute',
                          bottom: -12,
                          left: (width - 160) / 6 - 12, // Position to the bottom left
                        }}
                      >
                        <Ionicons name="information-circle-outline" size={24} color={selectedPricing === key ? COLORS.white : COLORS.gray} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                <FlatList
                  data={categories}
                  renderItem={renderCategoryItem}
                  horizontal
                  keyExtractor={(item) => item}
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 16 }}
                />

                <Formik
                  initialValues={{
                    title: '',
                    price: '',
                    description: '',
                    city: '',
                    state: '',
                    email: '',
                    phone: '',
                    companyName: '',
                    jobTitle: '',
                    jobDescription: '',
                    category: selectedCategory || 'Aircraft for Sale', // Default to 'Aircraft for Sale'
                    images: [],
                    flightSchoolName: '',
                    flightSchoolDetails: '',
                  }}
                  onSubmit={onSubmitMethod}
                >
                  {({ handleChange, handleBlur, handleSubmit, values }) => (
                    <>
                      {selectedCategory === 'Aviation Jobs' ? (
                        <>
                          <TextInput
                            placeholder="Company Name"
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
                          />
                          <TextInput
                            placeholder="Job Title"
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
                          />
                          <TextInput
                            placeholder="Job Description"
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
                          />
                        </>
                      ) : selectedCategory === 'Flight Schools' ? (
                        <>
                          <TextInput
                            placeholder="Flight School Name"
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
                          />
                          <TextInput
                            placeholder="Flight School Details"
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
                          />
                        </>
                      ) : (
                        <>
                          <TextInput
                            placeholder="Aircraft Year/Make/Model"
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
                          />
                          <TextInput
                            placeholder="Price"
                            onChangeText={handleChange('price')}
                            onBlur={handleBlur('price')}
                            value={values.price}
                            keyboardType="default"
                            style={{
                              borderBottomWidth: 1,
                              borderBottomColor: COLORS.lightGray,
                              marginBottom: 16,
                              padding: 8,
                              color: COLORS.black,
                            }}
                          />
                          <TextInput
                            placeholder="Description"
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
                          />
                        </>
                      )}

                      <TextInput
                        placeholder="City"
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
                      />
                      <TextInput
                        placeholder="State"
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
                      />
                      <TextInput
                        placeholder="Contact Email (Required)"
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
                      />
                      <TextInput
                        placeholder="Phone Number (Optional)"
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
                      />

                      {['Aviation Jobs', 'Flight Schools', 'Aircraft for Sale'].includes(selectedCategory) && (
                        <>
                          <Text
                            style={{
                              marginBottom: 8,
                              color: COLORS.black,
                              fontWeight: 'bold',
                            }}
                          >
                            Upload Images
                          </Text>
                          <FlatList
                            data={images}
                            horizontal
                            renderItem={({ item, index }) => (
                              <Image
                                key={index}
                                source={{ uri: item }}
                                style={{
                                  width: 96,
                                  height: 96,
                                  marginRight: 8,
                                  borderRadius: 8,
                                }}
                              />
                            )}
                            keyExtractor={(item, index) => index.toString()}
                            nestedScrollEnabled={true}
                          />
                          {renderImageUploadButton()}
                        </>
                      )}

                      <TouchableOpacity
                        onPress={() => handleTestSubmitListing(values)}
                        style={{
                          backgroundColor: COLORS.primary,
                          paddingVertical: 12,
                          borderRadius: 50,
                          marginTop: 16,
                          marginBottom: 16,
                        }}
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

                      {loading ? (
                        <ActivityIndicator size="large" color={COLORS.red} />
                      ) : (
                        <TouchableOpacity
                          onPress={handleSubmit}
                          style={{
                            backgroundColor: COLORS.red,
                            paddingVertical: 12,
                            borderRadius: 50,
                          }}
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
                      )}
                    </>
                  )}
                </Formik>

                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={{
                    marginTop: 16,
                    paddingVertical: 8,
                    borderRadius: 50,
                    backgroundColor: COLORS.lightGray,
                  }}
                >
                  <Text style={{ textAlign: 'center', color: COLORS.black }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Animated.View>
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
          options={{ headerShown: false }} // This hides the header for the Classifieds screen
        />
        <Stack.Screen
          name="PaymentScreen"
          component={PaymentScreen}
          options={{ headerShown: false }} // This hides the header for the PaymentScreen
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
