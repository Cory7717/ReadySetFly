import React, { useEffect, useState, useRef } from "react";
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
  Switch,
  StyleSheet,
  Dimensions,
} from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../../firebaseConfig";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  deleteDoc,
  doc,
  addDoc,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";
import { Calendar } from "react-native-calendars";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const Home = ({ route, navigation }) => {
  const [user, setUser] = useState(null);
  const [listings, setListings] = useState([]);
  const [selectedListing, setSelectedListing] = useState(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [fullScreenModalVisible, setFullScreenModalVisible] = useState(false);
  const [filter, setFilter] = useState({
    make: "",
    location: "",
  });
  const [rentalHours, setRentalHours] = useState(1);
  const [rentalDate, setRentalDate] = useState(null);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [totalCost, setTotalCost] = useState({
    rentalCost: "0.00",
    bookingFee: "0.00",
    transactionFee: "0.00",
    salesTax: "0.00",
    total: "0.00",
  });
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [cityState, setCityState] = useState("");
  const [makeModel, setMakeModel] = useState("");

  // New State Variables for Additional Fields
  const [fullName, setFullName] = useState("");
  const [cityStateCombined, setCityStateCombined] = useState("");
  const [hasMedicalCertificate, setHasMedicalCertificate] = useState(false);
  const [hasRentersInsurance, setHasRentersInsurance] = useState(false);
  const [flightHours, setFlightHours] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      } else {
        Alert.alert("Error", "User is not authenticated.");
        navigation.replace("SignIn");
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToListings();
    return () => unsubscribe();
  }, [user, filter]);

  useEffect(() => {
    if (selectedListing && rentalHours > 0) {
      calculateTotalCost(rentalHours);
    }
  }, [selectedListing, rentalHours]);

  useEffect(() => {
    if (route?.params?.newListing) {
      setListings((prevListings) => [route.params.newListing, ...prevListings]);
    }

    if (route?.params?.unlistedId) {
      setListings((prevListings) =>
        prevListings.filter((listing) => listing.id !== route.params.unlistedId)
      );
    }
  }, [route?.params?.newListing, route?.params?.unlistedId]);

  const subscribeToListings = () => {
    const listingsRef = collection(db, "airplanes");
    let q = query(listingsRef, orderBy("createdAt", "desc"));

    if (filter.location) {
      q = query(q, where("location", "==", filter.location.toLowerCase()));
    }

    if (filter.make) {
      q = query(q, where("airplaneModel", "==", filter.make.toLowerCase()));
    }

    return onSnapshot(
      q,
      (snapshot) => {
        const listingsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        listingsData.forEach((listing) => {
          if (!Array.isArray(listing.images)) {
            listing.images = [listing.images];
          }
        });

        setListings(listingsData);
      },
      (error) => {
        console.error("Error fetching listings: ", error);
        if (error.code === "permission-denied") {
          Alert.alert(
            "Permission Denied",
            "You do not have permission to access these listings."
          );
        }
      }
    );
  };

  const calculateTotalCost = (hours) => {
    if (!selectedListing) return;

    const pricePerHour = parseFloat(selectedListing.ratesPerHour);
    const rentalCost = pricePerHour * hours;
    const bookingFee = rentalCost * 0.06;
    const transactionFee = rentalCost * 0.03;
    const salesTax = rentalCost * 0.0825;
    const total = rentalCost + bookingFee + transactionFee + salesTax;

    setTotalCost({
      rentalCost: rentalCost.toFixed(2),
      bookingFee: bookingFee.toFixed(2),
      transactionFee: transactionFee.toFixed(2),
      salesTax: salesTax.toFixed(2),
      total: total.toFixed(2),
    });
  };

  const handleSendRentalRequest = async () => {
    if (!selectedListing) return;

    if (!rentalDate) {
      Alert.alert("Error", "Please select a rental date.");
      return;
    }

    // Validation for New Fields
    if (!fullName.trim()) {
      Alert.alert("Error", "Please enter your full name.");
      return;
    }

    if (!cityStateCombined.trim()) {
      Alert.alert("Error", "Please enter your current city and state.");
      return;
    }

    if (!flightHours || isNaN(flightHours) || Number(flightHours) < 0) {
      Alert.alert("Error", "Please enter a valid number of flight hours.");
      return;
    }

    if (!hasMedicalCertificate) {
      Alert.alert(
        "Confirmation Required",
        "You must confirm that you have a current medical certificate."
      );
      return;
    }

    if (!hasRentersInsurance) {
      Alert.alert(
        "Confirmation Required",
        "You must confirm that you have current renter's insurance."
      );
      return;
    }

    const rentalCost = parseFloat(selectedListing.ratesPerHour) * rentalHours;
    const bookingFee = rentalCost * 0.06;
    const transactionFee = rentalCost * 0.03;
    const salesTax = rentalCost * 0.0825;
    const totalCostValue = rentalCost + bookingFee + transactionFee + salesTax;

    try {
      const rentalRequestData = {
        renterId: user.uid,
        renterName: fullName,
        ownerId: selectedListing.ownerId,
        airplaneModel: selectedListing.airplaneModel,
        rentalPeriod: rentalDate,
        totalCost: totalCostValue.toFixed(2),
        contact: user.email || "noemail@example.com",
        createdAt: new Date(),
        status: "pending",
        listingId: selectedListing.id,
        // New Fields
        currentLocation: cityStateCombined,
        hasMedicalCertificate: hasMedicalCertificate,
        hasRentersInsurance: hasRentersInsurance,
        flightHours: Number(flightHours),
      };

      const rentalRequestsRef = collection(
        db,
        "owners",
        selectedListing.ownerId,
        "rentalRequests"
      );
      await addDoc(rentalRequestsRef, rentalRequestData);

      setFullScreenModalVisible(false);
      Alert.alert(
        "Request Sent",
        "Your rental request has been sent to the owner. You will be notified once the owner reviews the request."
      );
    } catch (error) {
      console.error("Error sending rental request:", {
        errorMessage: error.message,
        errorCode: error.code,
        rentalRequestData,
      });
      Alert.alert("Error", "Failed to send rental request to the owner.");
    }
  };

  const handleDateSelection = (day) => {
    setRentalDate(day.dateString);
    setCalendarModalVisible(false);
  };

  const handleDeleteListing = async (listingId) => {
    try {
      await deleteDoc(doc(db, "airplanes", listingId));
      setListings((prevListings) =>
        prevListings.filter((listing) => listing.id !== listingId)
      );
      Alert.alert("Deleted", "The listing has been deleted.");
    } catch (error) {
      console.error("Error deleting listing: ", error);
      Alert.alert("Error", "Failed to delete the listing.");
    }
  };

  const handleEditListing = async (listingId) => {
    Alert.alert(
      "Edit Listing",
      `This would edit the listing with ID ${listingId}`
    );
  };

  const handleNextImage = () => {
    if (selectedListing && imageIndex < selectedListing.images.length - 1) {
      setImageIndex(imageIndex + 1);
    }
  };

  const handlePreviousImage = () => {
    if (selectedListing && imageIndex > 0) {
      setImageIndex(imageIndex - 1);
    }
  };

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowScrollToTop(offsetY > 200);
  };

  const handleScrollToTop = () => {
    scrollViewRef.current?.scrollToOffset({ animated: true, offset: 0 });
  };

  const clearFilter = () => {
    setFilter({ location: "", make: "" });
    setCityState("");
    setMakeModel("");
  };

  const applyFilter = () => {
    setFilter({
      location: cityState.toLowerCase(),
      make: makeModel.toLowerCase(),
    });
    setFilterModalVisible(false);
  };

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [200, 0],
    extrapolate: "clamp",
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const renderItem = ({ item }) => {
    const abbreviateText = (text, maxLength) => {
      if (text.length > maxLength) {
        return `${text.slice(0, maxLength - 3)}...`;
      }
      return text;
    };

    return (
      <View style={styles.listingContainer}>
        <TouchableOpacity
          onPress={() => {
            setSelectedListing(item);
            setImageIndex(0);
            setFullScreenModalVisible(true);
            setFullName(user?.displayName || "");
            setCityStateCombined("");
            setHasMedicalCertificate(false);
            setHasRentersInsurance(false);
            setFlightHours("");
          }}
          style={styles.listingCard}
        >
          <View style={styles.listingHeader}>
            <Text style={styles.listingTitle} numberOfLines={1}>
              {abbreviateText(
                `${item.year} ${item.make} ${item.airplaneModel}`,
                25
              )}
            </Text>
          </View>
          {item.images && item.images.length > 0 && (
            <ImageBackground
              source={{ uri: item.images[0] }}
              style={styles.listingImage}
              imageStyle={{ borderRadius: 10 }}
            >
              <View style={styles.listingImageOverlay}>
                <Text style={styles.listingLocation}>{item.location}</Text>
                <Text style={styles.listingRate}>
                  ${item.ratesPerHour}/hour
                </Text>
              </View>
            </ImageBackground>
          )}
          <View style={styles.listingDescriptionContainer}>
            <Text numberOfLines={2} style={styles.listingDescription}>
              {item.description}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View
        style={[
          styles.header,
          {
            height: headerHeight,
            opacity: headerOpacity,
          },
        ]}
      >
        <ImageBackground
          source={wingtipClouds}
          style={styles.headerImage}
          resizeMode="cover"
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.welcomeText}>Welcome</Text>
              <Text style={styles.userName}>
                {user?.displayName || "User"}
              </Text>
            </View>
          </View>
        </ImageBackground>
      </Animated.View>

      <FlatList
        data={listings}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={
          <>
            <View style={styles.filterHeader}>
              <Text style={styles.filterText}>
                Filter by location or Aircraft Make
              </Text>
              <TouchableOpacity
                onPress={() => setFilterModalVisible(true)}
                style={styles.filterButton}
              >
                <Ionicons name="filter" size={24} color="gray" />
              </TouchableOpacity>
            </View>

            <Text style={styles.availableListingsTitle}>
              Available Listings
            </Text>
          </>
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyListText}>
            No listings available
          </Text>
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false, listener: handleScroll }
        )}
        ref={scrollViewRef}
      />

      {showScrollToTop && (
        <TouchableOpacity
          style={styles.scrollToTopButton}
          onPress={handleScrollToTop}
        >
          <Ionicons name="arrow-up" size={24} color="white" />
        </TouchableOpacity>
      )}

      {/* Full Screen Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={fullScreenModalVisible}
        onRequestClose={() => setFullScreenModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          {selectedListing && selectedListing.images && (
            <View style={styles.modalContainer}>
              <TouchableOpacity
                onPress={() => setFullScreenModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={30} color="black" />
              </TouchableOpacity>
              <View style={styles.modalImageContainer}>
                <TouchableOpacity
                  onPress={handlePreviousImage}
                  style={styles.modalArrowButtonLeft}
                >
                  <Ionicons name="arrow-back" size={30} color="#1E90FF" />
                </TouchableOpacity>
                <Image
                  source={{ uri: selectedListing.images[imageIndex] }}
                  style={styles.modalImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={handleNextImage}
                  style={styles.modalArrowButtonRight}
                >
                  <Ionicons name="arrow-forward" size={30} color="#1E90FF" />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  {`${selectedListing.year} ${selectedListing.make} ${selectedListing.airplaneModel}`}
                </Text>
                <Text style={styles.modalRate}>
                  ${selectedListing.ratesPerHour} per hour
                </Text>
                <Text style={styles.modalLocation}>
                  Location: {selectedListing.location}
                </Text>

                <Text style={styles.modalDescription}>
                  {selectedListing.description}
                </Text>

                {selectedListing.ownerId === user.uid && (
                  <View style={styles.modalOwnerActions}>
                    <TouchableOpacity
                      onPress={() => handleEditListing(selectedListing.id)}
                      style={styles.modalEditButton}
                    >
                      <Text style={styles.buttonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteListing(selectedListing.id)}
                      style={styles.modalDeleteButton}
                    >
                      <Text style={styles.buttonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Developer Delete Button */}
                <TouchableOpacity
                  onPress={() => handleDeleteListing(selectedListing.id)}
                  style={styles.modalDeleteButton}
                >
                  <Text style={styles.buttonText}>Developer Delete</Text>
                </TouchableOpacity>

                {/* Full Name Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Enter your full name"
                    placeholderTextColor="#888"
                    style={styles.textInput}
                  />
                </View>

                {/* Combined City and State Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Current City & State</Text>
                  <TextInput
                    value={cityStateCombined}
                    onChangeText={setCityStateCombined}
                    placeholder="e.g., New York, NY"
                    placeholderTextColor="#888"
                    style={styles.textInput}
                  />
                </View>

                {/* Medical Certificate Toggle */}
                <View style={styles.toggleGroup}>
                  <Text style={styles.inputLabel}>
                    Do you have a current medical certificate?
                  </Text>
                  <Switch
                    value={hasMedicalCertificate}
                    onValueChange={setHasMedicalCertificate}
                  />
                </View>

                {/* Renters Insurance Toggle */}
                <View style={styles.toggleGroup}>
                  <Text style={styles.inputLabel}>
                    Do you have current renter's insurance?
                  </Text>
                  <Switch
                    value={hasRentersInsurance}
                    onValueChange={setHasRentersInsurance}
                  />
                </View>

                {/* Flight Hours Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Flight Hours</Text>
                  <TextInput
                    value={flightHours}
                    onChangeText={setFlightHours}
                    placeholder="Enter hours"
                    placeholderTextColor="#888"
                    keyboardType="numeric"
                    style={styles.textInputSmall}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Rental Hours</Text>
                  <TextInput
                    value={String(rentalHours)}
                    placeholderTextColor="#888"
                    onChangeText={(text) => setRentalHours(Number(text))}
                    keyboardType="numeric"
                    style={styles.textInputSmall}
                  />
                </View>

                <TouchableOpacity
                  onPress={() => setCalendarModalVisible(true)}
                  style={styles.calendarButton}
                >
                  <Text style={styles.calendarButtonText}>
                    Select Rental Date
                  </Text>
                </TouchableOpacity>

                {rentalDate && (
                  <Text style={styles.selectedDateText}>
                    Selected Rental Date: {rentalDate}
                  </Text>
                )}

                <View style={styles.totalCostContainer}>
                  <Text style={styles.totalCostTitle}>Total Cost</Text>
                  <Text>Rental Cost: ${totalCost.rentalCost}</Text>
                  <Text>Booking Fee: ${totalCost.bookingFee}</Text>
                  <Text>Transaction Fee: ${totalCost.transactionFee}</Text>
                  <Text>Sales Tax: ${totalCost.salesTax}</Text>
                  <Text style={styles.totalCostValue}>
                    Total: ${totalCost.total}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleSendRentalRequest}
                  style={styles.sendRequestButton}
                >
                  <Text style={styles.sendRequestButtonText}>
                    Send Rental Request
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Calendar Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={calendarModalVisible}
        onRequestClose={() => setCalendarModalVisible(false)}
      >
        <View style={styles.calendarModalContainer}>
          <View style={styles.calendarContent}>
            <Calendar
              onDayPress={handleDateSelection}
              markedDates={
                rentalDate
                  ? {
                      [rentalDate]: {
                        selected: true,
                        marked: true,
                        dotColor: "red",
                      },
                    }
                  : {}
              }
            />
            <TouchableOpacity
              onPress={() => setCalendarModalVisible(false)}
              style={styles.closeCalendarButton}
            >
              <Text style={styles.closeCalendarButtonText}>
                Close Calendar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.filterModalOverlay}
          onPressOut={() => setFilterModalVisible(false)}
        >
          <View style={styles.filterModalContent}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filter Listings</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color="black" />
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Enter City, State"
              placeholderTextColor="#888"
              value={cityState}
              onChangeText={setCityState}
              style={styles.filterTextInput}
            />
            <Text style={styles.orText}>OR</Text>
            <TextInput
              placeholder="Enter Make and Model"
              placeholderTextColor="#888"
              value={makeModel}
              onChangeText={setMakeModel}
              style={styles.filterTextInput}
            />
            <View style={styles.filterButtonsContainer}>
              <TouchableOpacity
                onPress={clearFilter}
                style={styles.clearFilterButton}
              >
                <Text style={styles.filterButtonText}>Clear Filter</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={applyFilter}
                style={styles.applyFilterButton}
              >
                <Text style={styles.filterButtonText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

// **Stylesheet for Clean and Modern Design**
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    overflow: "hidden",
  },
  headerImage: {
    flex: 1,
    justifyContent: "flex-start",
  },
  headerContent: {
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  welcomeText: {
    fontSize: 24,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  userName: {
    fontSize: 28,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  columnWrapper: {
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingTop: 10,
    paddingHorizontal: 10,
  },
  filterText: {
    fontSize: 18,
    color: "#4A4A4A",
  },
  filterButton: {
    backgroundColor: "#E2E2E2",
    padding: 8,
    borderRadius: 50,
  },
  availableListingsTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
    color: "#2d3748",
  },
  emptyListText: {
    textAlign: "center",
    color: "#4a5568",
    marginTop: 20,
  },
  listingContainer: {
    flex: 1,
    margin: 5,
  },
  listingCard: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    flex: 1,
  },
  listingHeader: {
    padding: 10,
    alignItems: "center",
  },
  listingTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2d3748",
  },
  listingImage: {
    height: 150,
    justifyContent: "flex-end", // Align overlay to the bottom
  },
  listingImageOverlay: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.3)", // Semi-transparent overlay
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  listingLocation: {
    color: "white",
    padding: 4,
    borderRadius: 5,
  },
  listingRate: {
    color: "white",
    padding: 4,
    borderRadius: 5,
  },
  listingDescriptionContainer: {
    padding: 10,
  },
  listingDescription: {
    color: "#4a5568",
  },
  scrollToTopButton: {
    position: "absolute",
    right: 20,
    bottom: 40,
    backgroundColor: "#1E90FF",
    padding: 10,
    borderRadius: 50,
    elevation: 5,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  modalContainer: {
    padding: 16,
    flex: 1,
  },
  modalCloseButton: {
    alignSelf: "flex-end",
  },
  modalImageContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalArrowButtonLeft: {
    padding: 10,
  },
  modalArrowButtonRight: {
    padding: 10,
  },
  modalImage: {
    width: SCREEN_WIDTH * 0.7, // 70% of screen width
    height: SCREEN_WIDTH * 0.45, // Maintain aspect ratio
    borderRadius: 10,
  },
  modalContent: {
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
    color: "#2d3748",
  },
  modalRate: {
    fontSize: 20,
    marginBottom: 8,
    textAlign: "center",
    color: "#2d3748",
  },
  modalLocation: {
    textAlign: "center",
    color: "#4a5568",
    marginBottom: 8,
  },
  modalDescription: {
    marginBottom: 16,
    textAlign: "center",
    color: "#4a5568",
  },
  modalOwnerActions: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 16,
  },
  modalEditButton: {
    backgroundColor: "#1E90FF",
    padding: 10,
    borderRadius: 8,
    marginRight: 8,
    width: 120,
    alignItems: "center",
  },
  modalDeleteButton: {
    backgroundColor: "#FF6347",
    padding: 10,
    borderRadius: 8,
    width: 120,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  inputGroup: {
    marginBottom: 16,
    width: "100%", // Ensure inputs take full width
  },
  inputLabel: {
    fontWeight: "bold",
    fontSize: 16, // Reduced font size for better fit
    marginBottom: 8,
  },
  textInput: {
    borderColor: "#CBD5E0",
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    width: "100%",
    textAlign: "center",
    backgroundColor: "#F7FAFC",
    placeholderTextColor:"#888",
  },
  textInputSmall: {
    borderColor: "#CBD5E0",
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    width: 100, // Increased width for better input
    textAlign: "center",
    backgroundColor: "#F7FAFC",
  },
  toggleGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    width: "100%", // Ensure toggles take full width
  },
  calendarButton: {
    backgroundColor: "#1E90FF",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: "100%",
  },
  calendarButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "bold",
  },
  selectedDateText: {
    marginBottom: 16,
    textAlign: "center",
    fontSize: 16,
    color: "#2d3748",
  },
  totalCostContainer: {
    marginBottom: 16,
  },
  totalCostTitle: {
    fontWeight: "bold",
    fontSize: 18,
    marginBottom: 8,
  },
  totalCostValue: {
    fontWeight: "bold",
    fontSize: 16,
  },
  sendRequestButton: {
    backgroundColor: "#1E90FF",
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    width: "100%",
  },
  sendRequestButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "bold",
  },
  calendarModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  calendarContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    width: "90%",
    alignItems: "center",
  },
  closeCalendarButton: {
    backgroundColor: "#1E90FF",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    width: "100%",
  },
  closeCalendarButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "bold",
  },
  filterModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  filterModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    height: "50%",
  },
  filterModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  filterTextInput: {
    borderColor: "#CBD5E0",
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: "#F7FAFC",
    width: "100%",
  },
  orText: {
    textAlign: "center",
    marginBottom: 10,
    fontSize: 16,
    color: "#4A4A4A",
  },
  filterButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  clearFilterButton: {
    backgroundColor: "#FF6347",
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
    alignItems: "center",
  },
  applyFilterButton: {
    backgroundColor: "#1E90FF",
    padding: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: "center",
  },
  filterButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "bold",
  },
});

export default Home;
