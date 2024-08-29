// import React, { useState } from "react";
// import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet } from "react-native";
// import { Ionicons } from '@expo/vector-icons'; // Assuming you meant to import Ionicons
// import { icons } from "../constants"; // Make sure this path is correct

// const FormField = ({
//   title,
//   value,
//   placeholder,
//   handleChangeText,
//   otherStyles,
//   ...props
// }) => {
//   const [showPassword, setShowPassword] = useState(false);

//   return (
//     <View style={[styles.container, otherStyles]}>
//       <Text style={styles.title}>{title}</Text>
//       <View style={styles.inputContainer}>
//         <TextInput
//           style={styles.textInput}
//           value={value}
//           placeholder={placeholder}
//           placeholderTextColor="#7B7B8B"
//           onChangeText={handleChangeText}
//           secureTextEntry={title === "Password" && !showPassword}
//           {...props}
//         />
//         {title === "Password" && (
//           <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
//             <Image
//               source={!showPassword ? icons.eye : icons.eyeHide}
//               style={styles.icon}
//               resizeMode="contain"
//             />
//           </TouchableOpacity>
//         )}
//       </View>
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     marginBottom: 16, // Space between fields
//   },
//   title: {
//     fontSize: 16,
//     color: "black",
//     fontFamily: "Rubik-Regular", // Ensure this font is loaded in your app
//     marginBottom: 8,
//   },
//   inputContainer: {
//     width: '100%',
//     height: 56,
//     paddingHorizontal: 16,
//     backgroundColor: 'white',
//     borderRadius: 16,
//     borderWidth: 2,
//     borderColor: '#D3D3D3', // Equivalent to border-black-200
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   textInput: {
//     flex: 1,
//     color: 'black',
//     fontFamily: "Rubik-Bold", // Ensure this font is loaded in your app
//     fontSize: 16,
//   },
//   icon: {
//     width: 24,
//     height: 24,
//   },
// });

// export default FormField;
