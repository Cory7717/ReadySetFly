// RenterDashboard.js
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
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { db } from "../../firebaseConfig";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  addDoc,
} from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import wingtipClouds from "../../Assets/images/wingtip_clouds.jpg";
import { Calendar } from "react-native-calendars";

const RenterDashboard = ({ user }) => {
  const [listings, setListings] = useState([]);
  const [selectedListing, setSelectedListing] = useState(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [rentalModalVisible, setRentalModalVisible] = useState(false);
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

  // Rental modal state
  const [renterName, setRenterName] = useState("");
  const [renterAddress, setRenterAddress] = useState("");
  const [aircraftType, setAircraftType] = useState("");
  const [flightHours, setFlightHours] = useState("");
  const [hasInsurance, setHasInsurance] = useState(false);
  const [isMedicalCurrent, setIsMedicalCurrent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading state for submission

  useEffect(() => {
    const unsubscribe = subscribeToListings();
    return () => unsubscribe();
  }, [filter]);

  useEffect(() => {
    if (selectedListing && rentalHours > 0) {
      calculateTotalCost(rentalHours);
    }
  }, [selectedListing, rentalHours]);

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
    if (
      !selectedListing ||
      !rentalDate ||
      !renterName ||
      !renterAddress ||
      !aircraftType ||
      !flightHours
    ) {
      Alert.alert("Error", "Please fill out all fields.");
      return;
    }

    if (!hasInsurance) {
      Alert.alert(
        "Ineligible to Rent",
        "You must have renter's insurance to rent an aircraft."
      );
      return;
    }

    if (!isMedicalCurrent) {
      Alert.alert(
        "Ineligible to Rent",
        "Your medical certificate must be current to rent an aircraft."
      );
      return;
    }

    setIsSubmitting(true);

    const rentalCost = parseFloat(selectedListing.ratesPerHour) * rentalHours;
    const bookingFee = rentalCost * 0.06;
    const transactionFee = rentalCost * 0.03;
    const salesTax = rentalCost * 0.0825;
    const totalCostValue = rentalCost + bookingFee + transactionFee + salesTax;

    try {
      const rentalRequestData = {
        renterId: user.uid,
        renterName,
        ownerId: selectedListing.ownerId,
        airplaneModel: selectedListing.airplaneModel,
        rentalPeriod: rentalDate,
        totalCost: totalCostValue.toFixed(2),
        contact: user.email || "noemail@example.com",
        renterAddress,
        aircraftType,
        flightHours,
        hasInsurance,
        isMedicalCurrent,
        createdAt: new Date(),
        status: "pending",
        listingId: selectedListing.id,
      };

      await addDoc(
        collection(db, "owners", selectedListing.ownerId, "rentalRequests"),
        rentalRequestData
      );

      setRentalModalVisible(false);
      Alert.alert("Request Sent", "Your rental request has been sent to the owner.");
    } catch (error) {
      console.error("Error sending rental request:", error);
      Alert.alert(
        "Error",
        `Failed to send rental request to the owner. Error: ${error.message}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateSelection = (day) => {
    setRentalDate(day.dateString);
    setCalendarModalVisible(false);
  };

  const renderItem = ({ item }) => {
    const abbreviateText = (text, maxLength) => {
      if (text.length > maxLength) {
        return `${text.slice(0, maxLength - 3)}...`;
      }
      return text;
    };

    return (
      <View style={{ flex: 1, margin: 5 }}>
        <TouchableOpacity
          onPress={() => {
            setSelectedListing(item);
            setImageIndex(0);
            setRentalModalVisible(true);
          }}
          style={styles.listingContainer}
        >
          <View style={styles.listingHeader}>
            <Text
              style={styles.listingTitle}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.5}
            >
              {abbreviateText(`${item.year} ${item.make} ${item.airplaneModel}`, 25)}
            </Text>
          </View>
          {item.images && item.images.length > 0 && (
            <ImageBackground
              source={{ uri: item.images[0] }}
              style={styles.listingImage}
              imageStyle={{ borderRadius: 10 }}
            >
              <View style={styles.imageOverlay}>
                <Text style={styles.imageText}>{item.location}</Text>
                <Text style={styles.imageText}>${item.ratesPerHour}/hour</Text>
              </View>
            </ImageBackground>
          )}
          <View style={styles.listingDescriptionContainer}>
            <Text
              numberOfLines={2}
              style={styles.listingDescription}
            >
              {item.description}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
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

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowScrollToTop(offsetY > 200);
  };

  const handleScrollToTop = () => {
    scrollViewRef.current?.scrollToOffset({ animated: true, offset: 0 });
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
      <Animated.View
        style={{
          height: headerHeight,
          opacity: headerOpacity,
          overflow: "hidden",
        }}
      >
        <ImageBackground
          source={wingtipClouds}
          style={{
            flex: 1,
            justifyContent: "flex-start",
          }}
          resizeMode="cover"
        >
          <Animated.View
            style={{
              paddingHorizontal: 16,
              paddingTop: 30, // Ensure sufficient padding from the top
              paddingBottom: 10, // Reduce padding to keep it close to the top
              flexDirection: "row",
              alignItems: "flex-start", // Align items to the start (top left)
            }}
          >
            <View style={{ marginTop: 10 }}>
              <Animated.Text
                style={{
                  fontSize: 24,
                  color: "white",
                  fontWeight: "bold",
                }}
              >
                Welcome
              </Animated.Text>
              <Animated.Text
                style={{
                  fontSize: 28,
                  color: "white",
                  fontWeight: "bold",
                }}
              >
                {user?.displayName || "User"}
              </Animated.Text>
            </View>
          </Animated.View>
        </ImageBackground>
      </Animated.View>

      <FlatList
        data={listings}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        ListHeaderComponent={
          <>
            <View style={styles.filterHeader}>
              <Text style={styles.filterText}>Filter by location or Aircraft Make</Text>
              <TouchableOpacity
                onPress={() => setFilterModalVisible(true)}
                style={styles.filterButton}
              >
                <Ionicons name="filter" size={24} color="gray" />
              </TouchableOpacity>
            </View>

            <Text style={styles.availableListingsText}>Available Listings</Text>
          </>
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No listings available</Text>
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

      {/* Rental Modal */}
      <Modal
        visible={rentalModalVisible}
        onRequestClose={() => setRentalModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, padding: 20 }}>
          <ScrollView>
            <Text style={styles.rentalModalTitle}>{`Renting ${selectedListing?.airplaneModel}`}</Text>
            <Text style={styles.rentalModalSubtitle}>{`Rate: $${selectedListing?.ratesPerHour}/hour`}</Text>

            {/* Renter Details */}
            <TextInput
              placeholder="Your Name"
              placeholderTextColor="#888"
              value={renterName}
              onChangeText={setRenterName}
              style={styles.input}
            />
            <TextInput
              placeholder="Your Address"
              placeholderTextColor="#888"
              value={renterAddress}
              onChangeText={setRenterAddress}
              style={styles.input}
            />

            {/* Rental Hours */}
            <Text style={styles.label}>Rental Hours:</Text>
            <TextInput
              value={String(rentalHours)}
              onChangeText={(text) => setRentalHours(Number(text))}
              keyboardType="numeric"
              style={styles.input}
              placeholderTextColor="#888"
            />

            {/* Select Rental Date */}
            <TouchableOpacity
              onPress={() => setCalendarModalVisible(true)}
              style={styles.selectDateButton}
            >
              <Text style={styles.selectDateButtonText}>Select Rental Date</Text>
            </TouchableOpacity>
            {rentalDate && <Text style={styles.selectedDate}>Selected Date: {rentalDate}</Text>}

            {/* Additional Rental Information */}
            <TextInput
              placeholder="Aircraft Type Certified In"
              placeholderTextColor="#888"
              value={aircraftType}
              onChangeText={setAircraftType}
              style={styles.input}
            />
            <TextInput
              placeholder="Total Flight Hours"
              placeholderTextColor="#888"
              value={flightHours}
              onChangeText={setFlightHours}
              keyboardType="numeric"
              style={styles.input}
            />

            {/* Insurance and Medical Toggles */}
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>Renter's Insurance:</Text>
              <Switch value={hasInsurance} onValueChange={setHasInsurance} />
            </View>

            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>Medical Certificate Current:</Text>
              <Switch
                value={isMedicalCurrent}
                onValueChange={setIsMedicalCurrent}
              />
            </View>

            {/* Cost Breakdown */}
            <View style={styles.costContainer}>
              <Text style={styles.costText}>Rental Cost: ${totalCost.rentalCost}</Text>
              <Text style={styles.costText}>Booking Fee: ${totalCost.bookingFee}</Text>
              <Text style={styles.costText}>Transaction Fee: ${totalCost.transactionFee}</Text>
              <Text style={styles.costText}>Sales Tax: ${totalCost.salesTax}</Text>
              <Text style={styles.totalCostText}>Total: ${totalCost.total}</Text>
            </View>

            {/* Submit Rental Request */}
            {isSubmitting ? (
              <ActivityIndicator size="large" color="#1E90FF" />
            ) : (
              <TouchableOpacity
                onPress={handleSendRentalRequest}
                style={styles.submitButton}
              >
                <Text style={styles.submitButtonText}>Submit Rental Request</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Calendar Modal */}
      <Modal
        visible={calendarModalVisible}
        onRequestClose={() => setCalendarModalVisible(false)}
      >
        <Calendar onDayPress={handleDateSelection} />
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
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filter Listings</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color="black" />
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Enter City, State"
              placeholderTextColor="#888"
              value={cityState}
              onChangeText={setCityState}
              style={styles.input}
            />
            <Text style={styles.orText}>OR</Text>
            <TextInput
              placeholder="Enter Make and Model"
              placeholderTextColor="#888"
              value={makeModel}
              onChangeText={setMakeModel}
              style={styles.input}
            />
            <View style={styles.filterButtonsContainer}>
              <TouchableOpacity
                onPress={clearFilter}
                style={[styles.filterButton, styles.clearFilterButton]}
              >
                <Text style={styles.filterButtonText}>Clear Filter</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={applyFilter}
                style={[styles.filterButton, styles.applyFilterButton]}
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

const styles = StyleSheet.create({
  listingContainer: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "white",
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
    justifyContent: "space-between",
  },
  imageOverlay: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 8,
    backgroundColor: "transparent",
  },
  imageText: {
    backgroundColor: "#000000a0",
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
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
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
  availableListingsText: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
    color: "#2d3748",
  },
  emptyText: {
    textAlign: "center",
    color: "#4a5568",
    marginTop: 20,
    fontSize: 16,
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
  rentalModalTitle: {
    fontSize: 24,
    marginBottom: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  rentalModalSubtitle: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: "center",
    color: "#555",
  },
  input: {
    borderColor: "#CBD5E0",
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
    borderRadius: 8,
  },
  label: {
    marginBottom: 5,
    fontSize: 16,
  },
  selectDateButton: {
    backgroundColor: "#1E90FF",
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  selectDateButtonText: {
    color: "white",
    textAlign: "center",
  },
  selectedDate: {
    marginBottom: 10,
    textAlign: "center",
    fontSize: 16,
    color: "#2d3748",
  },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  toggleLabel: {
    fontSize: 16,
  },
  costContainer: {
    marginBottom: 20,
  },
  costText: {
    fontSize: 16,
    color: "#4a5568",
  },
  totalCostText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2d3748",
  },
  submitButton: {
    backgroundColor: "#1E90FF",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  submitButtonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },
  filterModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  filterModalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    height: "50%",
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  orText: {
    textAlign: "center",
    marginBottom: 10,
    fontSize: 16,
  },
  filterButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  filterButton: {
    padding: 10,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
  },
  clearFilterButton: {
    backgroundColor: "#FF6347",
  },
  applyFilterButton: {
    backgroundColor: "#1E90FF",
  },
  filterButtonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },
});

export default RenterDashboard;
