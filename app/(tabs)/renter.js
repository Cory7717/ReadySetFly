import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, Image, View, Text, Button, Alert, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Calendar, CalendarList, Agenda } from 'react-native-calendars';
import { getFirestore, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import UpcomingBookings from "../../components/UpcomingBookings";
import RenterProfile from "../../components/RenterProfile";
import { Formik } from "formik";
import { Picker, PickerItem } from "@react-native-picker/picker";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { app } from "../../firebaseConfig";



const Tab = createMaterialTopTabNavigator();



const BookingCalendar = ({ airplaneId, userId }) => {
  const [bookings, setBookings] = useState({});
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    const fetchBookings = async () => {
      if (!airplaneId) {
        console.error('airplaneId is undefined');
        return;
      }

      const db = getFirestore();
      const bookingsCollection = collection(db, 'bookings');
      const q = query(bookingsCollection, where('airplaneId', '==', airplaneId));

      try {
        const querySnapshot = await getDocs(q);
        let bookingsData = {};
        querySnapshot.forEach((doc) => {
          const { startDate, endDate } = doc.data();
          bookingsData[startDate] = { marked: true, dotColor: 'red' };
          bookingsData[endDate] = { marked: true, dotColor: 'red' };
        });
        setBookings(bookingsData);
      } catch (error) {
        console.error('Error fetching bookings:', error);
      }
    };

    fetchBookings();
  }, [airplaneId]);

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
  };

  const pickImage = async () => {
    // No permissions request is necessary for launching the image library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });
  
    console.log(result);
  
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };
  

  const handleBooking = async () => {
    if (!selectedDate) {
      Alert.alert('Please select a date first.');
      return;
    }

    if (!userId) {
      console.error('userId is undefined');
      return;
    }

    const db = getFirestore();
    try {
      await addDoc(collection(db, 'bookings'), {
        airplaneId,
        renterId: userId,
        startDate: selectedDate,
        endDate: selectedDate,
        status: 'pending'
      });
      Alert.alert('Booking request sent!');
    } catch (error) {
      console.error('Error adding booking:', error);
    }
  };

  return (
    <SafeAreaView className="h-full bg-white sand mt-7">
      <ScrollView>
      <View className="pb-2 border-b-2">
          <Tab.Navigator
            screenOptions={{
              tabBarIndicatorStyle: "",
              tabBarScrollEnabled: true,
              textBarShowLabel: true,
              tabBarStyle: {
                backgroundColor: "#fff",
                alignItems: "center",
              },
            }}
          >
            <Tab.Screen
              name="Upcoming Bookings"
              component={UpcomingBookings}
              options={{}}
            />
            <Tab.Screen name="Profile" component={RenterProfile} />
          </Tab.Navigator>
        </View>
        <View className="flex-1 items-center justify-center bg-white">
          <Text className="font-rubikblack text-4xl text-center text-#404040 px-8">
            Renter Dashboard
          </Text>
        </View>
        <TouchableOpacity onPress={pickImage}>
          <View className="items-center">
            <Image
              className="align-center, content-center"
              source={require("../../Assets/images/Placeholder_view_vector.png")}
              style={{
                width: 150,
                height: 150,
                borderRadius: 15,
                paddingBottom: 10,
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
            onSubmit={value=> onSubmitValue(value)}
          >
            {({
              handleChange,
              handleBlur,
              handleSubmit,
              values,
              handleAddListing,
            }) => (
              <View>
                <TextInput
                  style={styles.input}
                  placeholder="Name"
                  value={values?.name}
                  onChangeText={handleChange("name")}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Certifications"
                  value={values?.certifications}
                  // This will need to be changed to wrap text inside of description box
                  // className='text-wrap'
                  numberOfLines={5}
                  onChangeText={handleChange("desc")}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Contact"
                  value={values?.contact}
                  onChangeText={handleChange("contact")}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Location"
                  value={values?.address}
                  onChangeText={handleChange("location")}
                />
                <Picker
                  selectedValue={values?.category}
                  onValueChange={handleChange("Category")}
                  className="border-spacing-2"
                >
                  <Picker.Item label="Single Engine Prop" value={"Dropdown"} />
                  {/* {categoryList&&categoryList.map(()=>(
                    
                   ))} */}
                  <Picker.Item key={""} label="Turbo Prop" value={"Dropdown"} />
                  <Picker.Item label="Twin Engine Prop" value={"Dropdown"} />
                  <Picker.Item label="Turbo Prop" value={"Dropdown"} />
                  <Picker.Item label="Helicopter" value={"Dropdown"} />
                  <Picker.Item label="Jet" value={"Dropdown"} />
                </Picker>
                <Button
                  onPress={handleAddListing}
                  className="mt-7"
                  title="submit"
                />
              </View>
            )}
          </Formik>
    <View>
      <Calendar
        onDayPress={handleDayPress}
        markedDates={bookings}
      />
      <Button title="Book Airplane" onPress={handleBooking} />
    </View>
    </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    paddingHorizontal: 17,
    fontSize: 17,
    marginBottom: 5,
    marginTop: 10,
    textAlignVertical: "top",
    justifyContent: "space-evenly",
    flexDirection: "row",
    flex: 1,
    flexWrap: "wrap",
  },
});

export default BookingCalendar;
