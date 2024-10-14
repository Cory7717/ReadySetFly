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
  getDoc,
} from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { getAuth } from 'firebase/auth';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import Fontisto from '@expo/vector-icons/Fontisto';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Octicons from '@expo/vector-icons/Octicons';
import { useStripe } from '@stripe/stripe-react-native';
import { createStackNavigator } from '@react-navigation/stack';

import CheckoutScreen from '../payment/CheckoutScreen.js'; // Update with the correct path to your CheckoutScreen

const Stack = createStackNavigator();

const BookingCalendar = ({ airplaneId, ownerId }) => {
  const auth = getAuth();
  const user = auth.currentUser;
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

  const [rentalRequests, setRentalRequests] = useState([]);
  const [currentRentalRequest, setCurrentRentalRequest] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [notificationCount, setNotificationCount] = useState(0);

  const slideAnimation = useRef(new Animated.Value(300)).current;
  const renterId = user?.uid;

  useEffect(() => {
    const db = getFirestore();

    if (!renterId) {
      console.error('Error: renterId is undefined.');
      Alert.alert('Error', 'User is not authenticated.');
      return;
    }

    const rentalRequestsRef = collection(db, 'renters', renterId, 'rentalRequests');
    const rentalRequestsQuery = query(
      rentalRequestsRef,
      where('rentalStatus', 'in', ['pending', 'approved', 'denied']),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeRentalRequests = onSnapshot(
      rentalRequestsQuery,
      async (snapshot) => {
        const requests = [];
        for (const docSnap of snapshot.docs) {
          const requestData = docSnap.data();
          let ownerName = 'Unknown Owner';
          if (requestData.ownerId) {
            try {
              const ownerDocRef = doc(db, 'owners', requestData.ownerId);
              const ownerDoc = await getDoc(ownerDocRef);
              if (ownerDoc.exists()) {
                ownerName = ownerDoc.data().fullName || 'Unknown Owner';
              }
            } catch (error) {
              console.error('Error fetching owner details:', error);
            }
          }

          requests.push({
            id: docSnap.id,
            ...requestData,
            ownerName,
          });
        }
        setRentalRequests(requests);
      },
      (error) => {
        console.error('Error fetching rental requests:', error);
        Alert.alert('Error', 'Failed to fetch rental requests.');
      }
    );

    const notificationsRef = collection(db, 'renters', renterId, 'notifications');
    const notificationsQuery = query(notificationsRef, orderBy('createdAt', 'desc'));

    const unsubscribeNotifications = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const notifs = [];
        snapshot.docs.forEach((docSnap) => {
          const notifData = docSnap.data();
          notifs.push({
            id: docSnap.id,
            ...notifData,
          });
        });
        setNotifications(notifs);
        setNotificationCount(notifs.length);
      },
      (error) => {
        console.error('Error fetching notifications:', error);
        Alert.alert('Error', 'Failed to fetch notifications.');
      }
    );

    return () => {
      unsubscribeRentalRequests();
      unsubscribeNotifications();
    };
  }, [renterId]);

  useEffect(() => {
    if (rentalRequests.length > 0) {
      setCurrentRentalRequest(rentalRequests[0]); // Assume first rental request for now
      const approvedRequest = rentalRequests.find((request) => request.rentalStatus === 'approved');
      if (approvedRequest) {
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            id: 'approval-msg',
            senderId: approvedRequest.ownerId,
            senderName: approvedRequest.ownerName,
            text: 'Your rental request has been approved! Please proceed with the payment.',
            timestamp: new Date(),
          },
        ]);
        setChatButtonActive(true);
      }
    }
  }, [rentalRequests]);

  useEffect(() => {
    if (currentRentalRequest) {
      const db = getFirestore();
      const messagesRef = collection(db, 'renters', renterId, 'messages');
      const messagesQuery = query(
        messagesRef,
        where('rentalRequestId', '==', currentRentalRequest.id),
        orderBy('timestamp', 'asc')
      );

      const unsubscribeMessages = onSnapshot(
        messagesQuery,
        (snapshot) => {
          const msgs = [];
          snapshot.docs.forEach((docSnap) => {
            msgs.push({ id: docSnap.id, ...docSnap.data() });
          });
          setMessages(msgs);
        },
        (error) => {
          console.error('Error fetching messages:', error);
          Alert.alert('Error', 'Failed to fetch messages.');
        }
      );

      return () => unsubscribeMessages();
    }
  }, [currentRentalRequest, renterId]);

  const toggleMessagesModal = () => {
    setMessagesModalVisible(!messagesModalVisible);
  };

  const fetchCompletedRentals = async () => {
    const db = getFirestore();
    const rentalsRef = collection(db, 'orders');
    const resolvedRenterId = renterId || user?.uid;

    if (resolvedRenterId) {
      const q = query(
        rentalsRef,
        where('renterId', '==', resolvedRenterId),
        where('status', '==', 'completed'),
        orderBy('completedAt', 'desc')
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
        Alert.alert('Error', 'Failed to fetch completed rentals.');
      }
    } else {
      console.error('Error: renterId is undefined.');
      Alert.alert('Error', 'Renter ID is undefined.');
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
      const response = await fetch('https://your-api-endpoint.com/payment', {
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
    if (!rentalRequest) {
      console.error('Error: rentalRequest is null or undefined.');
      Alert.alert('Error', 'Rental request is not available.');
      return;
    }

    const totalCost = rentalRequest.totalCost || rentalRequest.rentalDetails?.totalCost;

    if (!totalCost) {
      console.error('Error: totalCost is not available in rentalRequest.');
      Alert.alert('Error', 'Total cost is not available.');
      return;
    }

    const paymentSuccessful = await processPayment(totalCost);

    if (paymentSuccessful) {
      const db = getFirestore();
      try {
        const rentalRequestRef = doc(db, 'renters', renterId, 'rentalRequests', rentalRequest.id);
        await updateDoc(rentalRequestRef, { rentalStatus: 'completed', completedAt: new Date() });

        setChatButtonActive(true);
        Alert.alert('Rental Confirmed', 'Your payment has been received.');
      } catch (error) {
        console.error('Error finalizing rental request:', error);
        Alert.alert('Error', 'Failed to finalize rental request.');
      }
    }
  };

  const sendMessage = async () => {
    if (messageText.trim() === '' || !currentRentalRequest?.id) return;

    const db = getFirestore();
    try {
      await addDoc(collection(db, 'renters', renterId, 'messages'), {
        rentalRequestId: currentRentalRequest.id,
        senderId: renterId,
        senderName: user?.displayName || 'Anonymous',
        text: messageText,
        timestamp: new Date(),
      });
      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message.');
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
        <StatusBar hidden={true} />
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
              Good afternoon, {user?.displayName || 'User'}
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
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Recommended for you</Text>
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
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>Manage Your Rentals</Text>
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
            {/* Add other profile fields as needed */}
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
        </View>
      </Modal>

      {/* Messages Modal */}
      <Modal visible={messagesModalVisible} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'white', padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>Messages</Text>
            <ScrollView style={{ flex: 1, marginBottom: 16 }}>
              {messages.map((message) => (
                <View key={message.id} style={{ marginBottom: 8 }}>
                  <Text style={{ fontWeight: 'bold' }}>{message.senderName}</Text>
                  <Text>{message.text}</Text>
                  <Text style={{ fontSize: 12, color: '#718096' }}>
                    {new Date(message.timestamp).toLocaleString()}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                placeholder="Type a message"
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#ccc',
                  borderRadius: 8,
                  padding: 12,
                  marginRight: 8,
                }}
                value={messageText}
                onChangeText={setMessageText}
              />
              <TouchableOpacity onPress={sendMessage} style={{ padding: 12 }}>
                <Ionicons name="send" size={24} color="#3182ce" />
              </TouchableOpacity>
            </View>
          </View>

          {currentRentalRequest ? (
            <View style={{ padding: 16 }}>
              <TouchableOpacity
                onPress={() => finalizeRentalRequest(currentRentalRequest)}
                style={{
                  backgroundColor: '#3182ce',
                  padding: 16,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Proceed to Payment</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={{ textAlign: 'center', color: '#718096' }}>
              No rental request available for payment.
            </Text>
          )}

          <TouchableOpacity
            onPress={toggleMessagesModal}
            style={{
              position: 'absolute',
              top: 40,
              right: 20,
              backgroundColor: '#f56565',
              padding: 12,
              borderRadius: 50,
            }}
          >
            <Ionicons name="close-circle" size={32} color="#2d3748" />
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Chat Bubble Button */}
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
        onPress={() => {
          if (chatButtonActive) {
            toggleMessagesModal();
          }
        }}
      >
        <Ionicons name="chatbubble-ellipses" size={32} color="white" />
      </TouchableOpacity>
    </View>
  );
};

// Wrap BookingCalendar in a stack navigator for proper navigation to CheckoutScreen
const BookingNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BookingCalendar" component={BookingCalendar} />
      <Stack.Screen name="CheckoutScreen" component={CheckoutScreen} />
    </Stack.Navigator>
  );
};

export default BookingNavigator;
