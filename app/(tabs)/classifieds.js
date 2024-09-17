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
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { db, storage } from '../../firebaseConfig';
import {
  collection,
  getDocs,
  orderBy,
  addDoc,
  query,
  where,
  updateDoc,
  doc,
  deleteDoc,
} from 'firebase/firestore';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import wingtipClouds from '../../Assets/images/wingtip_clouds.jpg';
import * as ImagePicker from 'expo-image-picker';
import { Formik } from 'formik';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useStripe } from '@stripe/stripe-react-native';
import { API_URL } from '@env';

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

const Classifieds = () => {
  const { user } = useUser();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [listings, setListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPricing, setSelectedPricing] = useState('Basic');
  const [totalCost, setTotalCost] = useState(0);
  const [listingDetails, setListingDetails] = useState({});
  const [selectedListing, setSelectedListing] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [location, setLocation] = useState(null);

  const categories = ['Aircraft for Sale', 'Aviation Jobs', 'Flight Schools'];

  const defaultPricingPackages = {
    Basic: 25,
    Featured: 70,
    Enhanced: 150,
  };

  const [pricingPackages, setPricingPackages] = useState(defaultPricingPackages);

  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission denied', 'Location access is required.');
          return;
        }

        let currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation);
      } catch (error) {
        console.error('Error fetching location: ', error);
      }

      getLatestItemList();
    })();
  }, [user, location]);

  useEffect(() => {
    if (selectedCategory === 'Aviation Jobs') {
      setPricingPackages({
        Basic: 15, // $15/week for Aviation Jobs
      });
      setSelectedPricing('Basic');
    } else if (selectedCategory === 'Flight Schools') {
      setPricingPackages({
        Basic: 250, // $250/month for Flight Schools
      });
      setSelectedPricing('Basic');
    } else {
      setPricingPackages(defaultPricingPackages); // Reset to default pricing options for other categories
      setSelectedPricing('Basic');
    }
  }, [selectedCategory]);

  const getLatestItemList = async () => {
    try {
      let q = query(collection(db, 'UserPost'), orderBy('createdAt', 'desc'));

      if (selectedCategory) {
        q = query(
          collection(db, 'UserPost'),
          where('category', '==', selectedCategory),
          orderBy('createdAt', 'desc')
        );
      }

      const querySnapShot = await getDocs(q);
      const listingsData = [];
      querySnapShot.forEach((doc) => {
        listingsData.push({ id: doc.id, ...doc.data() });
      });

      setListings(listingsData);
      setFilteredListings(listingsData);
    } catch (error) {
      console.error('Error fetching listings: ', error);
      Alert.alert('Error', `Failed to load listings: ${error.message}`);
    }
  };

  useEffect(() => {
    getLatestItemList();
  }, [selectedCategory]);

  const pickImage = async () => {
    let maxImages =
      selectedPricing === 'Basic' ? 7 : selectedPricing === 'Featured' ? 12 : 16;
    if (images.length >= maxImages) {
      Alert.alert(`You can only upload up to ${maxImages} images.`);
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
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
      const selectedImages = result.assets.map((asset) => asset.uri);
      setImages([...images, ...selectedImages].slice(0, maxImages));
    }
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
    const R = 3958.8;
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
    const response = await fetch(`${API_URL}/payment-sheet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: totalCost * 100 }),
    });
    const { paymentIntent, ephemeralKey, customer } = await response.json();

    return {
      paymentIntent,
      ephemeralKey,
      customer,
    };
  };

  const initializePaymentSheet = async () => {
    try {
      const { paymentIntent, ephemeralKey, customer } = await fetchPaymentSheetParams();

      const { error } = await initPaymentSheet({
        merchantDisplayName: 'Ready Set Fly',
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey,
        paymentIntentClientSecret: paymentIntent,
        allowsDelayedPaymentMethods: true,
        defaultBillingDetails: {
          name: user.fullName || 'Guest',
        },
      });

      if (!error) {
        return true;
      } else {
        console.error('Payment Sheet initialization error:', error);
        Alert.alert('Error', 'Failed to initialize payment sheet');
        return false;
      }
    } catch (error) {
      console.error('Error initializing payment sheet:', error);
      return false;
    }
  };

  const onSubmitMethod = async (values) => {
    setLoading(true);
    const selectedPackagePrice = pricingPackages[selectedPricing];
    const totalWithTax = (selectedPackagePrice * 1.0825).toFixed(2);
    setTotalCost(totalWithTax);
    setListingDetails(values);

    // Open the payment modal instead of navigating to another screen
    setPaymentModalVisible(true);
    setLoading(false);
  };

  const handleSubmitPayment = async () => {
    const isInitialized = await initializePaymentSheet();
    if (isInitialized) {
      setPaymentModalVisible(false); // Close the payment modal before showing the Stripe screen
      const { error } = await presentPaymentSheet();

      if (error) {
        Alert.alert('Payment Failed', error.message);
      } else {
        handleCompletePayment();
      }
    }
  };

  const handleCompletePayment = async () => {
    try {
      setLoading(true);

      const uploadedImages = await Promise.all(
        images.map(async (imageUri) => {
          try {
            const response = await fetch(imageUri);
            const blob = await response.blob();
            const storageRef = ref(
              storage,
              `classifiedImages/${new Date().getTime()}_${user.id}`
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
        userEmail: user.primaryEmailAddress.emailAddress,
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
        totalCost,
      };

      await addDoc(collection(db, 'UserPost'), newListing);

      Alert.alert(
        'Payment Completed',
        'Your listing has been successfully submitted!'
      );
      setModalVisible(false);
      getLatestItemList();
    } catch (error) {
      console.error('Error completing payment: ', error);
      Alert.alert('Error', 'Failed to complete payment and submit listing.');
    } finally {
      setLoading(false);
    }
  };

  const handleListingPress = (listing) => {
    setSelectedListing(listing);
    setCurrentImageIndex(0);
    setDetailsModalVisible(true);
  };

  const handleEditListing = (listing) => {
    setSelectedListing(listing);
    setEditModalVisible(true);
  };

  const handleDeleteListing = async (listingId) => {
    try {
      await deleteDoc(doc(db, 'UserPost', listingId));
      Alert.alert('Listing Deleted', 'Your listing has been deleted.');
      getLatestItemList();
    } catch (error) {
      console.error('Error deleting listing: ', error);
      Alert.alert('Error', 'Failed to delete the listing.');
    }
  };

  const renderCategoryItem = ({ item }) => (
    <TouchableOpacity
      key={item}
      onPress={() => setSelectedCategory(item)}
      style={[
        styles.categoryButton,
        selectedCategory === item
          ? styles.categoryButtonSelected
          : styles.categoryButtonUnselected,
      ]}
    >
      <Text
        style={[
          styles.categoryButtonText,
          selectedCategory === item && { color: COLORS.white },
        ]}
      >
        {item}
      </Text>
    </TouchableOpacity>
  );

  const goToNextImage = () => {
    if (
      selectedListing?.images &&
      currentImageIndex < selectedListing.images.length - 1
    ) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  const goToPreviousImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

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

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.headerContainer, { height: headerHeight }]}>
        <ImageBackground
          source={wingtipClouds}
          style={styles.headerBackground}
          resizeMode="cover"
        >
          <Animated.View
            style={[
              styles.headerContent,
              { paddingTop: headerPaddingTop, paddingBottom: 20 },
            ]}
          >
            <Animated.Text
              style={[styles.headerGreeting, { fontSize: headerFontSize }]}
            >
              Good Morning
            </Animated.Text>
            <Animated.Text
              style={[
                styles.headerName,
                { fontSize: Animated.add(headerFontSize, 6) },
              ]}
            >
              {user?.fullName}
            </Animated.Text>
          </Animated.View>
        </ImageBackground>
      </Animated.View>

      <Animated.ScrollView
        contentContainerStyle={styles.scrollViewContent}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        <View style={styles.filterContainer}>
          <Text style={styles.filterText}>
            Filter by Location or Aircraft Make
          </Text>
          <TouchableOpacity
            onPress={() => setFilterModalVisible(true)}
            style={styles.filterButton}
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
          style={styles.categoryList}
        />

        <Text style={styles.titleText}>Aircraft Marketplace</Text>

        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>Add Listing</Text>
        </TouchableOpacity>

        {filteredListings.length > 0 ? (
          filteredListings.map((item) => (
            <View style={styles.listingCard} key={item.id}>
              <TouchableOpacity
                onPress={() => handleListingPress(item)}
                style={{ flex: 1 }}
              >
                <ImageBackground
                  source={{ uri: item.images && item.images[0] }}
                  style={styles.listingImageBackground}
                  imageStyle={{ borderRadius: 10 }}
                >
                  <View style={styles.listingImageTextContainer}>
                    <Text style={styles.listingImageText}>
                      {item.city}, {item.state}
                    </Text>
                    <Text style={styles.listingImageText}>${item.price}</Text>
                  </View>
                </ImageBackground>
                <View style={styles.listingContent}>
                  <Text style={styles.listingTitle}>{item.title}</Text>
                  <Text numberOfLines={2} style={styles.listingDescription}>
                    {item.description}
                  </Text>
                </View>
              </TouchableOpacity>
              <View style={styles.listingActions}>
                <TouchableOpacity
                  onPress={() => handleEditListing(item)}
                  style={styles.editButton}
                >
                  <Text style={styles.buttonText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteListing(item.id)}
                  style={styles.deleteButton}
                >
                  <Text style={styles.buttonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <Text style={{ textAlign: 'center', color: COLORS.gray }}>
            No listings available
          </Text>
        )}
      </Animated.ScrollView>

      {/* Full Screen Modal for Listing Details */}
      <Modal
        visible={detailsModalVisible}
        transparent={true}
        onRequestClose={() => setDetailsModalVisible(false)}
        animationType="slide"
      >
        <View style={styles.detailsModalBackground}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.detailsModalContent}>
              {selectedListing?.images && (
                <View style={styles.detailsImageContainer}>
                  <Image
                    source={{ uri: selectedListing.images[currentImageIndex] }}
                    style={styles.detailsImage}
                  />
                  <View style={styles.imageNavigation}>
                    <TouchableOpacity onPress={goToPreviousImage}>
                      <Ionicons name="arrow-back" size={36} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={goToNextImage}>
                      <Ionicons name="arrow-forward" size={36} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              <Text style={styles.detailsTitle}>{selectedListing?.title}</Text>
              <Text style={styles.detailsPrice}>${selectedListing?.price}</Text>
              <Text style={styles.detailsDescription}>
                {selectedListing?.description}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setDetailsModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Filter by Location Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <ScrollView
              contentContainerStyle={styles.modalContentContainer}
              style={styles.modalScrollView}
              nestedScrollEnabled={true}
            >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Filter Listings</Text>

                <TouchableOpacity
                  onPress={() => filterListingsByDistance(100)}
                  style={styles.modalButton}
                >
                  <Text style={styles.modalButtonText}>
                    View Listings Within 100 Miles
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setFilteredListings(listings)}
                  style={styles.modalButton}
                >
                  <Text style={styles.modalButtonText}>View All Listings</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setFilterModalVisible(false)}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Submit Listing Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <ScrollView
              contentContainerStyle={styles.modalContentContainer}
              style={styles.modalScrollView}
              nestedScrollEnabled={true}
            >
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Submit Your Listing</Text>

                <Text style={styles.sectionTitle}>Select Pricing Package</Text>
                <View style={styles.pricingOptions}>
                  {Object.keys(pricingPackages).map((key) => (
                    <TouchableOpacity
                      key={key}
                      onPress={() => setSelectedPricing(key)}
                      style={[
                        styles.pricingOption,
                        selectedPricing === key && styles.pricingOptionSelected,
                      ]}
                    >
                      <Text style={styles.pricingOptionText}>{key}</Text>
                      <Text style={styles.pricingOptionText}>
                        ${pricingPackages[key]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <FlatList
                  data={categories}
                  renderItem={renderCategoryItem}
                  horizontal
                  keyExtractor={(item) => item}
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoryList}
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
                    category: selectedCategory || 'Single Engine Piston',
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
                            style={styles.input}
                          />
                          <TextInput
                            placeholder="Job Title"
                            onChangeText={handleChange('jobTitle')}
                            onBlur={handleBlur('jobTitle')}
                            value={values.jobTitle}
                            style={styles.input}
                          />
                          <TextInput
                            placeholder="Job Description"
                            onChangeText={handleChange('jobDescription')}
                            onBlur={handleBlur('jobDescription')}
                            value={values.jobDescription}
                            multiline
                            numberOfLines={4}
                            style={styles.textArea}
                          />
                        </>
                      ) : selectedCategory === 'Flight Schools' ? (
                        <>
                          <TextInput
                            placeholder="Flight School Name"
                            onChangeText={handleChange('flightSchoolName')}
                            onBlur={handleBlur('flightSchoolName')}
                            value={values.flightSchoolName}
                            style={styles.input}
                          />
                          <TextInput
                            placeholder="Flight School Details"
                            onChangeText={handleChange('flightSchoolDetails')}
                            onBlur={handleBlur('flightSchoolDetails')}
                            value={values.flightSchoolDetails}
                            multiline
                            numberOfLines={4}
                            style={styles.textArea}
                          />
                        </>
                      ) : (
                        <>
                          <TextInput
                            placeholder="Aircraft Year/Make/Model"
                            onChangeText={handleChange('title')}
                            onBlur={handleBlur('title')}
                            value={values.title}
                            style={styles.input}
                          />
                          <TextInput
                            placeholder="Price"
                            onChangeText={handleChange('price')}
                            onBlur={handleBlur('price')}
                            value={values.price}
                            keyboardType="default"
                            style={styles.input}
                          />
                          <TextInput
                            placeholder="Description"
                            onChangeText={handleChange('description')}
                            onBlur={handleBlur('description')}
                            value={values.description}
                            multiline
                            numberOfLines={4}
                            style={styles.textArea}
                          />
                        </>
                      )}

                      <TextInput
                        placeholder="City"
                        onChangeText={handleChange('city')}
                        onBlur={handleBlur('city')}
                        value={values.city}
                        style={styles.input}
                      />
                      <TextInput
                        placeholder="State"
                        onChangeText={handleChange('state')}
                        onBlur={handleBlur('state')}
                        value={values.state}
                        style={styles.input}
                      />
                      <TextInput
                        placeholder="Contact Email (Required)"
                        onChangeText={handleChange('email')}
                        onBlur={handleBlur('email')}
                        value={values.email}
                        keyboardType="email-address"
                        style={styles.input}
                      />
                      <TextInput
                        placeholder="Phone Number (Optional)"
                        onChangeText={handleChange('phone')}
                        onBlur={handleBlur('phone')}
                        value={values.phone}
                        keyboardType="phone-pad"
                        style={styles.input}
                      />

                      {selectedCategory !== 'Aviation Jobs' && (
                        <>
                          <Text style={styles.sectionTitle}>Upload Images</Text>
                          <FlatList
                            data={images}
                            horizontal
                            renderItem={({ item, index }) => (
                              <Image
                                key={index}
                                source={{ uri: item }}
                                style={styles.uploadedImage}
                              />
                            )}
                            keyExtractor={(item, index) => index.toString()}
                            nestedScrollEnabled={true}
                          />
                          <TouchableOpacity
                            onPress={pickImage}
                            style={styles.uploadButton}
                          >
                            <Text style={styles.uploadButtonText}>
                              {images.length >=
                              (selectedPricing === 'Basic'
                                ? 7
                                : selectedPricing === 'Featured'
                                ? 12
                                : 16)
                                ? `Maximum ${
                                    selectedPricing === 'Basic'
                                      ? 7
                                      : selectedPricing === 'Featured'
                                      ? 12
                                      : 16
                                  } Images`
                                : 'Add Image'}
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}

                      {loading ? (
                        <ActivityIndicator size="large" color={COLORS.red} />
                      ) : (
                        <TouchableOpacity
                          onPress={handleSubmit}
                          style={styles.submitButton}
                        >
                          <Text style={styles.submitButtonText}>
                            Submit Listing
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </Formik>

                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={paymentModalVisible}
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.paymentModalContent}>
            <Text style={styles.modalTitle}>Complete Payment</Text>

            <Text style={styles.paymentAmount}>Total Cost: ${totalCost}</Text>

            <TouchableOpacity
              onPress={handleSubmitPayment}
              style={styles.submitButton}
            >
              <Text style={styles.submitButtonText}>Proceed to Pay</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPaymentModalVisible(false)}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Classifieds;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  headerContainer: {
    overflow: 'hidden',
  },
  headerBackground: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  headerContent: {
    paddingHorizontal: 16,
  },
  headerGreeting: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  headerName: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  scrollViewContent: {
    padding: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  filterText: {
    fontSize: 18,
    color: COLORS.secondary,
  },
  filterButton: {
    backgroundColor: COLORS.lightGray,
    padding: 8,
    borderRadius: 50,
  },
  categoryList: {
    marginBottom: 16,
  },
  categoryButton: {
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  categoryButtonSelected: {
    backgroundColor: COLORS.primary,
  },
  categoryButtonUnselected: {
    backgroundColor: COLORS.lightGray,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  titleText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: COLORS.black,
  },
  addButton: {
    backgroundColor: COLORS.red,
    borderRadius: 50,
    paddingVertical: 12,
    marginBottom: 24,
  },
  addButtonText: {
    color: COLORS.white,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  listingCard: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    marginBottom: 20,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  listingImageBackground: {
    height: 200,
    justifyContent: 'space-between',
  },
  listingImageTextContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
  },
  listingImageText: {
    backgroundColor: '#000000a0',
    color: COLORS.white,
    padding: 4,
    borderRadius: 5,
  },
  listingContent: {
    padding: 10,
  },
  listingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  listingDescription: {
    color: COLORS.gray,
  },
  listingActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 10,
  },
  editButton: {
    backgroundColor: COLORS.primary,
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  deleteButton: {
    backgroundColor: COLORS.red,
    padding: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: COLORS.white,
  },
  detailsModalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  detailsModalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsImageContainer: {
    width: '90%',
    height: '50%',
  },
  detailsImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  imageNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    width: '50%',
  },
  detailsTitle: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
  },
  detailsPrice: {
    color: COLORS.white,
    fontSize: 18,
    marginTop: 10,
  },
  detailsDescription: {
    color: COLORS.white,
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  closeButton: {
    marginTop: 30,
    backgroundColor: COLORS.red,
    padding: 10,
    borderRadius: 10,
  },
  closeButtonText: {
    color: COLORS.white,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    flex: 1,
    width: '100%',
  },
  modalContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScrollView: {
    width: '100%',
    maxWidth: 320,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
    color: COLORS.black,
  },
  modalButton: {
    backgroundColor: COLORS.red,
    paddingVertical: 12,
    borderRadius: 50,
    marginBottom: 12,
  },
  modalButtonText: {
    color: COLORS.white,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: COLORS.lightGray,
  },
  cancelButtonText: {
    textAlign: 'center',
    color: COLORS.black,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    marginBottom: 16,
    padding: 8,
    color: COLORS.black,
  },
  textArea: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    marginBottom: 16,
    padding: 8,
    color: COLORS.black,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    marginBottom: 8,
    color: COLORS.black,
    fontWeight: 'bold',
  },
  pricingOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pricingOption: {
    padding: 8,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: COLORS.lightGray,
    width: (width - 64) / 3 - 8,
    alignItems: 'center',
  },
  pricingOptionSelected: {
    borderColor: COLORS.primary,
  },
  pricingOptionText: {
    textAlign: 'center',
    color: COLORS.black,
  },
  uploadedImage: {
    width: 96,
    height: 96,
    marginRight: 8,
    borderRadius: 8,
  },
  uploadButton: {
    backgroundColor: COLORS.background,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 50,
    marginTop: 8,
    marginBottom: 16,
  },
  uploadButtonText: {
    textAlign: 'center',
    color: COLORS.black,
  },
  submitButton: {
    backgroundColor: COLORS.red,
    paddingVertical: 12,
    borderRadius: 50,
    marginTop: 16,
  },
  submitButtonText: {
    color: COLORS.white,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  paymentModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    width: '90%',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    alignItems: 'center',
  },
  paymentAmount: {
    fontSize: 18,
    color: COLORS.secondary,
    marginBottom: 12,
  },
});
