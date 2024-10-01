import React, { useState, useEffect, useRef } from 'react';
import {
  TextInput,
  Image,
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ImageBackground,
  StatusBar,
  Animated,
} from 'react-native';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import { Formik } from 'formik';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import Fontisto from '@expo/vector-icons/Fontisto';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Octicons from '@expo/vector-icons/Octicons';
import { useStripe } from '@stripe/stripe-react-native';

const BookingCalendar = ({ airplaneId, ownerId }) => {
  const { user } = useUser();
  const stripe = useStripe();
  const navigation = useNavigation();
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [rentalCostEstimatorModalVisible, setRentalCostEstimatorModalVisible] = useState(false);
  const [messagesModalVisible, setMessagesModalVisible] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    aircraftType: '',
    certifications: '',
    contact: '',
    address: '',
    logBooks: null,
    medical: null,
    insurance: null,
    image: null,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [completedRentals, setCompletedRentals] = useState([]);
  const [ratings, setRatings] = useState({});
  const [rentalDate, setRentalDate] = useState('');
  const [rentalHours, setRentalHours] = useState('');
  const [preferredLocation, setPreferredLocation] = useState('');
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [isMapModalVisible, setMapModalVisible] = useState(false);
  const [initialLocation, setInitialLocation] = useState(null);
  const [costPerHour, setCostPerHour] = useState('');
  const [numHours, setNumHours] = useState('');
  const [costPerGallon, setCostPerGallon] = useState('');
  const [numGallons, setNumGallons] = useState('');
  const [chatButtonActive, setChatButtonActive] = useState(false);

  // New state variables
  const [rentalRequests, setRentalRequests] = useState([]);
  const [currentRentalRequest, setCurrentRentalRequest] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');

  const slideAnimation = useRef(new Animated.Value(300)).current;

  const renterId = user?.id;

  useEffect(() => {
    fetchCompletedRentals();
    getCurrentLocation();
  }, [ownerId, user]);

  useEffect(() => {
    const db = getFirestore();
    const rentalRequestsRef = collection(db, 'rentalRequests');

    const q = query(rentalRequestsRef, where('renterId', '==', renterId));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const requests = [];
      querySnapshot.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() });
      });
      setRentalRequests(requests);
    });

    return () => unsubscribe();
  }, [renterId]);

  useEffect(() => {
    if (rentalRequests.length > 0) {
      setCurrentRentalRequest(rentalRequests[0]); // Assuming only one active rental request
      const approvedRequest = rentalRequests.find((request) => request.status === 'approved');
      if (approvedRequest) {
        Alert.alert(
          'Rental Request Approved',
          'Your rental request has been approved. Please complete the payment.'
        );
        setChatButtonActive(true);
      }
    }
  }, [rentalRequests]);

  useEffect(() => {
    if (currentRentalRequest && currentRentalRequest.status === 'completed') {
      const db = getFirestore();
      const messagesRef = collection(db, 'messages');

      const q = query(
        messagesRef,
        where('rentalRequestId', '==', currentRentalRequest.id),
        orderBy('timestamp', 'asc')
      );

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const msgs = [];
        querySnapshot.forEach((doc) => {
          msgs.push({ id: doc.id, ...doc.data() });
        });
        setMessages(msgs);
      });

      return () => unsubscribe();
    }
  }, [currentRentalRequest]);

  const fetchCompletedRentals = async () => {
    const db = getFirestore();
    const rentalsRef = collection(db, 'orders');

    const resolvedOwnerId = ownerId || user?.id;

    if (resolvedOwnerId) {
      const q = query(
        rentalsRef,
        where('ownerId', '==', resolvedOwnerId),
        where('status', '==', 'completed')
      );

      try {
        const querySnapshot = await getDocs(q);
        const rentals = [];
        querySnapshot.forEach((doc) => {
          rentals.push({ id: doc.id, ...doc.data() });
        });
        setCompletedRentals(rentals);
      } catch (error) {
        console.error('Error fetching completed rentals:', error);
      }
    } else {
      console.error('Error: ownerId is undefined.');
      Alert.alert('Error', 'Owner ID is undefined.');
    }
  };

  const getCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission to access location was denied');
      return;
    }

    let location = await Location.getCurrentPositionAsync({});
    setInitialLocation({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    });
  };

  const handleRating = async (rentalId, rating) => {
    const db = getFirestore();
    try {
      const rentalDocRef = doc(db, 'orders', rentalId);
      await updateDoc(rentalDocRef, { rating });
      setRatings((prevRatings) => ({ ...prevRatings, [rentalId]: rating }));
      Alert.alert('Rating Submitted', 'Thank you for your feedback!');
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert('Error', 'Failed to submit rating.');
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 4],
      quality: 1,
    });

    if (!result.canceled) {
      setProfileData({ ...profileData, image: result.assets[0].uri });
    }
  };

  const pickDocument = async (field) => {
    let result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
    });

    if (result.type !== 'cancel') {
      setProfileData({ ...profileData, [field]: result.uri });
    }
  };

  const handleProfileSubmit = (values) => {
    setProfileData(values);
    setProfileSaved(true);
    setProfileModalVisible(false);
  };

  const handleNavigation = (filter) => {
    try {
      navigation.navigate('Home', { filter });
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Failed to navigate to the home screen.');
    }
  };

  const processPayment = async (amount) => {
    try {
      const response = await fetch('https://api.stripe.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convert to cents
          currency: 'usd',
        }),
      });
      const { clientSecret } = await response.json();

      const { paymentIntent, error } = await stripe.confirmPayment({
        paymentIntentClientSecret: clientSecret,
      });

      if (error) {
        Alert.alert('Payment failed', error.message);
        return false;
      }

      if (paymentIntent.status === 'Succeeded') {
        Alert.alert('Payment successful', 'Your payment has been processed successfully.');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error processing payment:', error);
      Alert.alert('Error', 'Payment processing failed.');
      return false;
    }
  };

  const finalizeRentalRequest = async (rentalRequest) => {
    const paymentSuccessful = await processPayment(rentalRequest.rentalDetails.totalCost);

    if (paymentSuccessful) {
      const db = getFirestore();
      try {
        const rentalRequestRef = doc(db, 'rentalRequests', rentalRequest.id);
        await updateDoc(rentalRequestRef, { status: 'completed' });

        setChatButtonActive(true);
        Alert.alert('Rental Confirmed', 'Your payment has been received.');
      } catch (error) {
        console.error('Error finalizing rental request:', error);
        Alert.alert('Error', 'Failed to finalize rental request.');
      }
    }
  };

  const sendMessage = async () => {
    if (messageText.trim() === '') return;

    const db = getFirestore();
    try {
      await addDoc(collection(db, 'messages'), {
        rentalRequestId: currentRentalRequest.id,
        senderId: renterId,
        senderName: user.fullName,
        text: messageText,
        timestamp: new Date(),
      });
      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchCompletedRentals();
    setRefreshing(false);
  };

  const toggleMenu = () => {
    if (menuVisible) {
      Animated.timing(slideAnimation, {
        toValue: 300,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setMenuVisible(false));
    } else {
      setMenuVisible(true);
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleConfirm = (date) => {
    const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    setRentalDate(formattedDate);
    hideDatePicker();
  };

  const openMapModal = () => {
    setMapModalVisible(true);
  };

  const closeMapModal = () => {
    setMapModalVisible(false);
  };

  const calculateRentalCost = () => {
    const hours = parseFloat(rentalHours) || 0;
    const hourlyCost = parseFloat(costPerHour) || 200; // Example cost per hour
    const bookingFee = hourlyCost * hours * 0.06;
    const processingFee = hourlyCost * hours * 0.03;
    const tax = hourlyCost * hours * 0.0825;
    const totalCost = hourlyCost * hours + bookingFee + processingFee + tax;

    return totalCost.toFixed(2);
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <SafeAreaView style={{ backgroundColor: 'white' }}>
        <StatusBar barStyle="light-content" />
      </SafeAreaView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        <ImageBackground
          source={require('../../Assets/images/wingtip_clouds.jpg')}
          style={{
            height: 200,
            paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
            justifyContent: 'center',
            paddingHorizontal: 16,
          }}
          resizeMode="cover"
        >
          <SafeAreaView style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: 'white' }}>
              Good afternoon, {user?.fullName}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
              <TouchableOpacity
                onPress={showDatePicker}
                style={{
                  backgroundColor: 'white',
                  borderRadius: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  flex: 1,
                  marginRight: 8,
                  opacity: 0.9,
                  justifyContent: 'center',
                }}
              >
                <Text>{rentalDate || 'Select Date'}</Text>
              </TouchableOpacity>
              <TextInput
                placeholder="Estimated Hours"
                keyboardType="numeric"
                style={{
                  backgroundColor: 'white',
                  borderRadius: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  flex: 1,
                  opacity: 0.9,
                }}
                onChangeText={setRentalHours}
                value={rentalHours}
              />
            </View>
            <TouchableOpacity
              onPress={openMapModal}
              style={{
                backgroundColor: 'white',
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 12,
                marginTop: 16,
                opacity: 0.9,
                textAlign: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ textAlign: 'center' }}>
                {preferredLocation || 'Preferred City/Airport'}
              </Text>
            </TouchableOpacity>
          </SafeAreaView>
        </ImageBackground>

        {/* Original UI elements */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
          <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => handleNavigation('all')}>
            <Octicons name="paper-airplane" size={32} color="#3182ce" />
            <Text>All Aircraft</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => handleNavigation('jets')}>
            <Ionicons name="airplane-outline" size={32} color="#3182ce" />
            <Text>Jets</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ alignItems: 'center' }}
            onPress={() => handleNavigation('pistons')}
          >
            <MaterialCommunityIcons name="engine-outline" size={32} color="#3182ce" />
            <Text>Pistons</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ alignItems: 'center' }}
            onPress={() => handleNavigation('helicopters')}
          >
            <Fontisto name="helicopter" size={32} color="#3182ce" />
            <Text>Helicopters</Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Recent searches</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View
              style={{
                backgroundColor: '#edf2f7',
                padding: 12,
                borderRadius: 8,
                flex: 1,
                marginRight: 8,
              }}
            >
              <Text>Van Nuys Airport</Text>
              <Text style={{ color: '#a0aec0' }}>3 guests · 9/10/23-9/17/23</Text>
            </View>
            <View style={{ backgroundColor: '#edf2f7', padding: 12, borderRadius: 8, flex: 1 }}>
              <Text>Santa Monica Airport</Text>
              <Text style={{ color: '#a0aec0' }}>2 guests · 9/18/23-9/25/23</Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Aircraft Types</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <TouchableOpacity
              style={{ flex: 1, marginRight: 8 }}
              onPress={() => handleNavigation('single-piston')}
            >
              <Text style={{ marginTop: 8, fontWeight: 'bold' }}>Single Engine Piston</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => handleNavigation('twin-piston')}>
              <Text style={{ marginTop: 8, fontWeight: 'bold' }}>Twin Engine Piston</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            Recommended for you
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={{ marginRight: 16 }}
              onPress={() => handleNavigation('cessna-172')}
            >
              <Image
                source={require('../../Assets/images/recommended1.jpg')}
                style={{ width: 200, height: 120, borderRadius: 8 }}
                resizeMode="cover"
              />
              <Text style={{ marginTop: 8, fontWeight: 'bold' }}>Cessna 172</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ marginRight: 16 }}
              onPress={() => handleNavigation('beechcraft-baron')}
            >
              <Image
                source={require('../../Assets/images/recommended2.jpg')}
                style={{ width: 200, height: 120, borderRadius: 8 }}
                resizeMode="cover"
              />
              <Text style={{ marginTop: 8, fontWeight: 'bold' }}>Beechcraft Baron</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ marginRight: 16 }}
              onPress={() => handleNavigation('cirrus-sr22')}
            >
              <Image
                source={require('../../Assets/images/recommended3.jpg')}
                style={{ width: 200, height: 120, borderRadius: 8 }}
                resizeMode="cover"
              />
              <Text style={{ marginTop: 8, fontWeight: 'bold' }}>Cirrus SR22</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            Manage Your Rentals
          </Text>
          {completedRentals.length > 0 ? (
            completedRentals.map((rental) => (
              <View
                key={rental.id}
                style={{
                  backgroundColor: '#edf2f7',
                  padding: 16,
                  borderRadius: 16,
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontWeight: 'bold', color: '#2d3748' }}>{rental.renterName}</Text>
                <Text style={{ color: '#4a5568' }}>{rental.rentalPeriod}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <Text style={{ color: '#2d3748' }}>Rate this renter:</Text>
                  <View style={{ flexDirection: 'row', marginLeft: 16 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity key={star} onPress={() => handleRating(rental.id, star)}>
                        <FontAwesome
                          name={star <= (ratings[rental.id] || 0) ? 'star' : 'star-o'}
                          size={24}
                          color="gold"
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            ))
          ) : (
            <Text style={{ textAlign: 'center', color: '#718096' }}>
              No completed rentals available.
            </Text>
          )}
        </View>

        {/* Profile Information Display */}
        {profileSaved ? (
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: 'white',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.22,
              shadowRadius: 2.22,
              elevation: 3,
              borderRadius: 24,
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: '#2d3748',
                marginBottom: 8,
              }}
            >
              Profile Information
            </Text>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Text style={{ fontWeight: 'bold', color: '#2d3748', flex: 1 }}>Name:</Text>
              <Text style={{ color: '#718096', flex: 2 }}>{profileData.name}</Text>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Text style={{ fontWeight: 'bold', color: '#2d3748', flex: 1 }}>Aircraft Type:</Text>
              <Text style={{ color: '#718096', flex: 2 }}>{profileData.aircraftType}</Text>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Text style={{ fontWeight: 'bold', color: '#2d3748', flex: 1 }}>Certifications:</Text>
              <Text style={{ color: '#718096', flex: 2 }}>{profileData.certifications}</Text>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Text style={{ fontWeight: 'bold', color: '#2d3748', flex: 1 }}>Contact:</Text>
              <Text style={{ color: '#718096', flex: 2 }}>{profileData.contact}</Text>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 8 }}>
              <Text style={{ fontWeight: 'bold', color: '#2d3748', flex: 1 }}>Location:</Text>
              <Text style={{ color: '#718096', flex: 2 }}>{profileData.address}</Text>
            </View>
            {profileData.logBooks && (
              <Text style={{ color: '#718096', marginBottom: 8 }}>
                Log Books Uploaded: {profileData.logBooks.split('/').pop()}
              </Text>
            )}
            {profileData.medical && (
              <Text style={{ color: '#718096', marginBottom: 8 }}>
                Medical Uploaded: {profileData.medical.split('/').pop()}
              </Text>
            )}
            {profileData.insurance && (
              <Text style={{ color: '#718096', marginBottom: 8 }}>
                Insurance Uploaded: {profileData.insurance.split('/').pop()}
              </Text>
            )}
            {profileData.image && (
              <Image
                source={{ uri: profileData.image }}
                style={{
                  width: 144,
                  height: 144,
                  borderRadius: 8,
                  marginTop: 8,
                }}
              />
            )}
          </View>
        ) : (
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: 'white',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.22,
              shadowRadius: 2.22,
              elevation: 3,
              borderRadius: 24,
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: '#2d3748',
                marginBottom: 8,
              }}
            >
              No Profile Information Available
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Menu and other modals remain unchanged */}

      <TouchableOpacity
        style={{
          position: 'absolute',
          top: 40,
          right: 20,
          zIndex: 1,
        }}
        onPress={toggleMenu}
      >
        <Ionicons name="menu" size={32} color="black" />
      </TouchableOpacity>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirm}
        onCancel={hideDatePicker}
      />

      {/* Map Modal */}
      <Modal visible={isMapModalVisible} animationType="slide">
        <View style={{ flex: 1 }}>
          <MapView
            style={{ flex: 1 }}
            initialRegion={initialLocation}
            showsUserLocation={true}
            showsBuildings={true}
            showsTraffic={true}
            pitchEnabled={true}
          >
            {preferredLocation ? (
              <Marker
                coordinate={{
                  latitude: preferredLocation.latitude,
                  longitude: preferredLocation.longitude,
                }}
                title="Preferred Location"
                description="Your chosen location"
              />
            ) : null}
          </MapView>
          <TouchableOpacity
            onPress={closeMapModal}
            style={{
              position: 'absolute',
              top: 40,
              left: 20,
              backgroundColor: '#f56565',
              padding: 12,
              borderRadius: 50,
            }}
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          {/* Additional Map UI elements can be added here */}
        </View>
      </Modal>

      {/* Profile Modal, Rental Cost Estimator Modal, Messages Modal (unchanged) */}
      {/* ... Include the modals code here ... */}

      <TouchableOpacity
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          backgroundColor: chatButtonActive ? '#3182ce' : '#ccc',
          width: 60,
          height: 60,
          borderRadius: 30,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
        onPress={() => chatButtonActive && setMessagesModalVisible(true)}
      >
        <Ionicons name="chatbubble-ellipses" size={32} color="white" />
      </TouchableOpacity>
    </View>
  );
};

export default BookingCalendar;
