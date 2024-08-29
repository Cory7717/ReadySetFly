// import React, { useState, useEffect } from "react";
// import {
//   StyleSheet,
//   TextInput,
//   Image,
//   View,
//   Text,
//   Button,
//   Alert,
//   SafeAreaView,
//   ScrollView,
//   TouchableOpacity,
//   Modal,
//   FlatList,
// } from "react-native";
// import { Calendar } from "react-native-calendars";
// import {
//   getFirestore,
//   collection,
//   addDoc,
//   query,
//   where,
//   getDocs,
// } from "firebase/firestore";
// import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
// import UpcomingBookings from "../../components/UpcomingBookings";
// import RenterProfile from "../../components/RenterProfile";
// import { Formik } from "formik";
// import { Picker } from "@react-native-picker/picker";
// import * as ImagePicker from "expo-image-picker";
// import { getStorage, ref, uploadBytes } from "firebase/storage";
// import { app } from "../../firebaseConfig";

// const Tab = createMaterialTopTabNavigator();

// const BookingCalendar = ({ airplaneId, userId }) => {
//   const [bookings, setBookings] = useState({});
//   const [selectedDate, setSelectedDate] = useState("");
//   const [selectedDates, setSelectedDates] = useState({});
//   const [textInputValue, setTextInputValue] = useState("");
//   const [modalVisible, setModalVisible] = useState(false);
//   const [image, setImage] = useState(null);
//   const [searchQuery, setSearchQuery] = useState("");
//   const [searchResults, setSearchResults] = useState([]);

//   useEffect(() => {
//     const fetchBookings = async () => {
//       if (!airplaneId) {
//         console.error("airplaneId is undefined");
//         return;
//       }

//       const db = getFirestore();
//       const bookingsCollection = collection(db, "bookings");
//       const q = query(
//         bookingsCollection,
//         where("airplaneId", "==", airplaneId)
//       );

//       try {
//         const querySnapshot = await getDocs(q);
//         let bookingsData = {};
//         querySnapshot.forEach((doc) => {
//           const { startDate, endDate } = doc.data();
//           bookingsData[startDate] = { marked: true, dotColor: "red" };
//           bookingsData[endDate] = { marked: true, dotColor: "red" };
//         });
//         setBookings(bookingsData);
//       } catch (error) {
//         console.error("Error fetching bookings:", error);
//       }
//     };

//     fetchBookings();
//   }, [airplaneId]);

//   const handleDayPress = (day) => {
//     setSelectedDate(day.dateString);
//   };

//   const pickImage = async () => {
//     let result = await ImagePicker.launchImageLibraryAsync({
//       mediaTypes: ImagePicker.MediaTypeOptions.All,
//       allowsEditing: true,
//       aspect: [4, 4],
//       quality: 1,
//     });

//     if (!result.canceled) {
//       setImage(result.assets[0].uri);
//     }
//   };

//   const handleBooking = async () => {
//     if (!selectedDate) {
//       Alert.alert("Please select a date first.");
//       return;
//     }

//     if (!userId) {
//       console.error("userId is undefined");
//       return;
//     }

//     const db = getFirestore();
//     try {
//       await addDoc(collection(db, "bookings"), {
//         airplaneId,
//         renterId: userId,
//         startDate: selectedDate,
//         endDate: selectedDate,
//         status: "pending",
//       });
//       Alert.alert("Booking request sent!");
//     } catch (error) {
//       console.error("Error adding booking:", error);
//     }
//   };

//   const onDayPress = (day) => {
//     const dateKey = day.dateString;
//     let newSelectedDates = { ...selectedDates };
//     if (newSelectedDates[dateKey]) {
//       delete newSelectedDates[dateKey];
//     } else {
//       newSelectedDates[dateKey] = { selected: true, marked: true };
//     }
//     setSelectedDates(newSelectedDates);
//     const selectedKeys = Object.keys(newSelectedDates);
//     setTextInputValue(selectedKeys.join(", "));
//   };

//   const handleSearch = async () => {
//     if (!searchQuery) {
//       Alert.alert("Please enter a search query.");
//       return;
//     }

//     const db = getFirestore();
//     const airplanesCollection = collection(db, "airplanes");
//     const q = query(airplanesCollection, where("location", "==", searchQuery));

//     try {
//       const querySnapshot = await getDocs(q);
//       let results = [];
//       querySnapshot.forEach((doc) => {
//         results.push(doc.data());
//       });
//       setSearchResults(results);
//     } catch (error) {
//       console.error("Error searching for airplanes:", error);
//     }
//   };

//   return (
//     <SafeAreaView style={styles.safeArea}>
//       <ScrollView>
//         <View style={styles.tabContainer}>
//           <Tab.Navigator
//             screenOptions={{
//               tabBarIndicatorStyle: styles.tabIndicator,
//               tabBarScrollEnabled: true,
//               tabBarStyle: styles.tabBar,
//             }}
//           >
//             <Tab.Screen
//               name="Upcoming Bookings"
//               component={UpcomingBookings}
//               options={{}}
//             />
//             <Tab.Screen
//               name="Profile"
//               component={RenterProfile}
//               options={{
//                 tabBarButton: (props) => (
//                   <TouchableOpacity {...props} onPress={() => {}}>
//                     <Text>Profile</Text>
//                   </TouchableOpacity>
//                 ),
//               }}
//             />
//           </Tab.Navigator>
//         </View>
//         <View style={styles.headerContainer}>
//           <Text style={styles.headerText}>Renter Dashboard</Text>
//         </View>
//         <TouchableOpacity onPress={pickImage}>
//           <View style={styles.imageContainer}>
//             <Image
//               source={require("../../Assets/images/Placeholder_view_vector.png")}
//               style={styles.placeholderImage}
//             />
//           </View>
//         </TouchableOpacity>
//         <Formik
//           initialValues={{
//             name: "",
//             certifications: "",
//             contact: "",
//             address: "",
//             price: "",
//             image: "",
//           }}
//           onSubmit={(value) => onSubmitValue(value)}
//         >
//           {({
//             handleChange,
//             handleBlur,
//             handleSubmit,
//             values,
//             handleAddListing,
//           }) => (
//             <View>
//               <TextInput
//                 style={styles.input}
//                 placeholder="Name"
//                 value={values?.name}
//                 onChangeText={handleChange("name")}
//               />
//               <TextInput
//                 style={styles.input}
//                 placeholder="Certifications"
//                 value={values?.certifications}
//                 numberOfLines={5}
//                 onChangeText={handleChange("desc")}
//               />
//               <TextInput
//                 style={styles.input}
//                 placeholder="Contact"
//                 value={values?.contact}
//                 onChangeText={handleChange("contact")}
//               />
//               <TextInput
//                 style={styles.input}
//                 placeholder="Location"
//                 value={values?.address}
//                 onChangeText={handleChange("location")}
//               />
//               <Picker
//                 selectedValue={values?.category}
//                 onValueChange={handleChange("Category")}
//                 style={styles.picker}
//               >
//                 <Picker.Item label="Single Engine Prop" value={"Dropdown"} />
//                 <Picker.Item key={""} label="Turbo Prop" value={"Dropdown"} />
//                 <Picker.Item label="Twin Engine Prop" value={"Dropdown"} />
//                 <Picker.Item label="Turbo Prop" value={"Dropdown"} />
//                 <Picker.Item label="Helicopter" value={"Dropdown"} />
//                 <Picker.Item label="Jet" value={"Dropdown"} />
//               </Picker>
//               <Button
//                 onPress={handleAddListing}
//                 style={styles.submitButton}
//                 title="Submit"
//               />
//             </View>
//           )}
//         </Formik>
//         <View style={styles.container}>
//           <TextInput
//             style={styles.input}
//             placeholder="Select booking dates"
//             value={textInputValue}
//             onFocus={() => setModalVisible(true)}
//           />
//           <Modal
//             visible={modalVisible}
//             transparent={true}
//             animationType="slide"
//           >
//             <View style={styles.modalContainer}>
//               <Calendar onDayPress={onDayPress} markedDates={selectedDates} />
//               <TouchableOpacity
//                 onPress={() => setModalVisible(false)}
//                 style={styles.closeButton}
//               >
//                 <Text style={styles.closeButtonText}>Close</Text>
//               </TouchableOpacity>
//             </View>
//           </Modal>
//         </View>
//         <View style={styles.searchContainer}>
//           <TextInput
//             style={styles.input}
//             placeholder="Search for aircraft in your area"
//             value={searchQuery}
//             onChangeText={setSearchQuery}
//           />
//           <Button title="Search" onPress={handleSearch} />
//         </View>
//         <FlatList
//           data={searchResults}
//           keyExtractor={(item) => item.id}
//           renderItem={({ item }) => (
//             <View style={styles.searchResult}>
//               <Text>{item.name}</Text>
//               <Text>{item.location}</Text>
//             </View>
//           )}
//         />
//         <Button title="Book" onPress={handleBooking} />
//       </ScrollView>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   safeArea: {
//     flex: 1,
//     backgroundColor: "#fff",
//   },
//   tabContainer: {
//     paddingBottom: 2,
//     borderBottomWidth: 2,
//     borderBottomColor: "#ccc",
//   },
//   tabIndicator: {
//     backgroundColor: "#000",
//   },
//   tabBar: {
//     backgroundColor: "#fff",
//     alignItems: "center",
//   },
//   headerContainer: {
//     alignItems: "center",
//     justifyContent: "center",
//     paddingVertical: 16,
//   },
//   headerText: {
//     fontSize: 28,
//     fontWeight: "bold",
//     color: "#404040",
//   },
//   imageContainer: {
//     alignItems: "center",
//     marginVertical: 15,
//   },
//   placeholderImage: {
//     width: 150,
//     height: 150,
//     borderRadius: 15,
//   },
//   input: {
//     height: 40,
//     margin: 12,
//     borderWidth: 1,
//     borderColor: "#ccc",
//     padding: 10,
//     borderRadius: 8,
//   },
//   picker: {
//     height: 50,
//     margin: 12,
//     borderWidth: 1,
//     borderColor: "#ccc",
//     borderRadius: 8,
//   },
//   submitButton: {
//     marginTop: 20,
//   },
//   container: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   modalContainer: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//     backgroundColor: "rgba(0, 0, 0, 0.5)",
//   },
//   closeButton: {
//     marginTop: 20,
//     padding: 10,
//     backgroundColor: "white",
//     borderRadius: 5,
//   },
//   closeButtonText: {
//     color: "black",
//   },
//   searchContainer: {
//     margin: 12,
//   },
//   searchResult: {
//     padding: 10,
//     borderBottomWidth: 1,
//     borderBottomColor: "#ccc",
//   },
// });

// export default BookingCalendar;
