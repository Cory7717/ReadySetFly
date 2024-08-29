// import React, { useState, useEffect, useRef } from 'react';
// import { View, TextInput, Button, Image, TouchableOpacity, Text, Animated, StyleSheet, Alert } from 'react-native';
// import * as ImagePicker from 'expo-image-picker';
// import * as Location from 'expo-location';
// import { Ionicons } from '@expo/vector-icons';

// const CreateNewPost = ({ onSubmit }) => {
//   const [content, setContent] = useState('');
//   const [image, setImage] = useState(null);
//   const [showForm, setShowForm] = useState(false);

//   const buttonSize = useRef(new Animated.Value(150)).current;

//   useEffect(() => {
//     Animated.timing(buttonSize, {
//       toValue: showForm ? 200 : 150,
//       duration: 300,
//       useNativeDriver: false,
//     }).start();
//   }, [showForm]);

//   useEffect(() => {
//     (async () => {
//       let { status } = await Location.requestForegroundPermissionsAsync();
//       if (status !== 'granted') {
//         Alert.alert('Permission to access location was denied');
//         return;
//       }

//       await Location.getCurrentPositionAsync({});
//     })();
//   }, []);

//   const pickImage = async () => {
//     const result = await ImagePicker.launchImageLibraryAsync({
//       mediaTypes: ImagePicker.MediaTypeOptions.Images,
//       allowsEditing: true,
//       aspect: [4, 3],
//       quality: 1,
//     });

//     if (!result.canceled) {
//       setImage(result.assets[0].uri);
//     }
//   };

//   const handleSubmit = () => {
//     const newPost = {
//       userName: 'Current User',
//       profileImage: 'https://example.com/current-user-profile.jpg', // Replace with actual profile image URL
//       time: 'Just now',
//       content,
//       image,
//       likes: 0,
//       comments: 0,
//     };

//     onSubmit(newPost);
//     setContent('');
//     setImage(null);
//     setShowForm(false);
//   };

//   return (
//     <View style={styles.container}>
//       <Animated.View style={{ width: buttonSize, height: showForm ? null : buttonSize }}>
//         {showForm ? (
//           <View>
//             <TextInput
//               style={styles.input}
//               placeholder="What's on your mind?"
//               value={content}
//               onChangeText={setContent}
//               multiline
//             />
//             <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
//               <Ionicons name="camera-outline" size={24} color="white" />
//               <Text style={styles.uploadButtonText}>Upload Image</Text>
//             </TouchableOpacity>
//             {image && <Image source={{ uri: image }} style={styles.image} />}
//             <Button title="Submit" onPress={handleSubmit} />
//           </View>
//         ) : (
//           <TouchableOpacity style={styles.showFormButton} onPress={() => setShowForm(true)}>
//             <Text style={styles.showFormButtonText}>Create New Post</Text>
//           </TouchableOpacity>
//         )}
//       </Animated.View>
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     padding: 16,
//     backgroundColor: 'white',
//     borderRadius: 8,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.1,
//     shadowRadius: 4,
//     marginBottom: 16,
//   },
//   input: {
//     borderWidth: 1,
//     borderColor: '#ccc',
//     padding: 8,
//     borderRadius: 8,
//     marginBottom: 8,
//   },
//   uploadButton: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     backgroundColor: '#007bff',
//     padding: 10,
//     borderRadius: 8,
//     marginBottom: 8,
//   },
//   uploadButtonText: {
//     color: 'white',
//     marginLeft: 8,
//   },
//   image: {
//     width: '100%',
//     height: 200,
//     marginBottom: 10,
//     borderRadius: 8,
//   },
//   showFormButton: {
//     backgroundColor: '#28a745',
//     padding: 10,
//     borderRadius: 8,
//     alignItems: 'center',
//   },
//   showFormButtonText: {
//     color: 'white',
//     fontSize: 16,
//   },
// });

// export default CreateNewPost;
