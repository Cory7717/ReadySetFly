import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  TextInput,
  Image,
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from "react-native";
import { Calendar } from "react-native-calendars";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { Formik } from "formik";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { useUser } from "@clerk/clerk-expo";
import Slider from "../../components/Slider";

const Tab = createMaterialTopTabNavigator();

const BookingCalendar = ({ airplaneId, userId }) => {
  const { user } = useUser();
  const [bookings, setBookings] = useState({});
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedDates, setSelectedDates] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [image, setImage] = useState(null);

  useEffect(() => {
    const fetchBookings = async () => {
      if (!airplaneId) {
        console.error("airplaneId is undefined");
        return;
      }

      const db = getFirestore();
      const bookingsCollection = collection(db, "bookings");
      const q = query(bookingsCollection, where("airplaneId", "==", airplaneId));

      try {
        const querySnapshot = await getDocs(q);
        let bookingsData = {};
        querySnapshot.forEach((doc) => {
          const { startDate, endDate } = doc.data();
          bookingsData[startDate] = { marked: true, dotColor: "red" };
          bookingsData[endDate] = { marked: true, dotColor: "red" };
        });
        setBookings(bookingsData);
      } catch (error) {
        console.error("Error fetching bookings:", error);
      }
    };

    fetchBookings();
  }, [airplaneId]);

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 4],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleBooking = async () => {
    if (!selectedDate) {
      Alert.alert("Please select a date first.");
      return;
    }

    if (!userId) {
      console.error("userId is undefined");
      return;
    }

    const db = getFirestore();
    try {
      await addDoc(collection(db, "bookings"), {
        airplaneId,
        renterId: userId,
        startDate: selectedDate,
        endDate: selectedDate,
        status: "pending",
      });
      Alert.alert("Booking request sent!");
    } catch (error) {
      console.error("Error adding booking:", error);
    }
  };

  const onDayPress = (day) => {
    const dateKey = day.dateString;
    let newSelectedDates = { ...selectedDates };
    if (newSelectedDates[dateKey]) {
      delete newSelectedDates[dateKey];
    } else {
      newSelectedDates[dateKey] = { selected: true, marked: true };
    }
    setSelectedDates(newSelectedDates);
  };

  return (
    <SafeAreaView className="h-full bg-white mt-7">
      <ScrollView>
        <View className="flex-row gap-2 pt-3 ml-2">
          <Image
            source={{ uri: user?.imageUrl }}
            className="rounded-full w-12 h-12"
          />
          <View>
            <Text className="text-[16px]">Welcome</Text>
            <Text className="text-[20px] font-bold">{user?.fullName}</Text>
          </View>
        </View>

        <Slider />

        <View className="flex-1 bg-white">
          <Text className="font-rubikblack text-4xl text-gray-800 px-8">
            Renter Dashboard
          </Text>
        </View>

        <TouchableOpacity onPress={pickImage}>
          <View className="pl-8">
            <Image
              source={require("../../Assets/images/Placeholder_view_vector.png")}
              style={{
                width: 150,
                height: 150,
                borderRadius: 15,
                marginBottom: 15,
                marginTop: 15,
              }}
            />
          </View>
        </TouchableOpacity>

        <Formik
          initialValues={{
            name: "",
            certifications: "",
            contact: "",
            address: "",
            price: "",
            image: "",
          }}
          onSubmit={(value) => onSubmitValue(value)}
        >
          {({
            handleChange,
            handleBlur,
            handleSubmit,
            values,
          }) => (
            <View className="px-8">
              <TextInput
                style={styles.input}
                placeholder="Name"
                value={values.name}
                onChangeText={handleChange("name")}
              />
              <TextInput
                style={styles.input}
                placeholder="Certifications"
                value={values.certifications}
                numberOfLines={5}
                onChangeText={handleChange("certifications")}
              />
              <TextInput
                style={styles.input}
                placeholder="Contact"
                value={values.contact}
                onChangeText={handleChange("contact")}
              />
              <TextInput
                style={styles.input}
                placeholder="Location"
                value={values.address}
                onChangeText={handleChange("address")}
              />
              <Picker
                selectedValue={values.category}
                onValueChange={handleChange("category")}
                style={styles.picker}
              >
                <Picker.Item label="Single Engine Prop" value="single_engine" />
                <Picker.Item label="Twin Engine Prop" value="twin_engine" />
                <Picker.Item label="Turbo Prop" value="turbo_prop" />
                <Picker.Item label="Helicopter" value="helicopter" />
                <Picker.Item label="Jet" value="jet" />
              </Picker>
              <TouchableOpacity
                onPress={handleSubmit}
                style={styles.submitButton}
              >
                <Text className="text-white text-center font-bold">
                  Submit
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Formik>

        <View style={styles.container}>
          <TextInput
            style={styles.input}
            placeholder="Select booking dates"
            value={Object.keys(selectedDates).join(", ")}
            onFocus={() => setModalVisible(true)}
          />
          <Modal
            visible={modalVisible}
            transparent={true}
            animationType="slide"
          >
            <View style={styles.modalContainer}>
              <Calendar
                onDayPress={onDayPress}
                markedDates={selectedDates}
              />
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </Modal>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  input: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  container: {
    padding: 10,
  },
  picker: {
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 15,
  },
  submitButton: {
    backgroundColor: '#1E90FF',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  closeButton: {
    backgroundColor: '#fff',
    padding: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 18,
  },
});

export default BookingCalendar;
