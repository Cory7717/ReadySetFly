// import React from 'react';
// import { View, Text, Image, StyleSheet } from 'react-native';
// import { useNavigation } from '@react-navigation/native';
// import CustomButton from './CustomButton'; // Uncomment if CustomButton is needed

// import { images } from '../constants';

// const EmptyState = ({ title, subtitle }) => {
//   const navigation = useNavigation();

//   return (
//     <View style={styles.container}>
//       <Image source={images.empty} resizeMode="contain" style={styles.image} />

//       <Text style={styles.title}>{title}</Text>
//       <Text style={styles.subtitle}>{subtitle}</Text>

//       <CustomButton
//         title="Back to Explore"
//         handlePress={() => navigation.navigate('Home')}
//         containerStyles={styles.buttonContainer}
//       />
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     paddingHorizontal: 16,
//   },
//   image: {
//     width: 270,
//     height: 216,
//   },
//   title: {
//     fontSize: 14,
//     fontFamily: 'Rubik-Medium', // Ensure this font is loaded in your app
//     color: '#A0AEC0', // Equivalent to text-gray-100
//   },
//   subtitle: {
//     fontSize: 20,
//     textAlign: 'center',
//     fontFamily: 'Rubik-SemiBold', // Ensure this font is loaded in your app
//     color: '#FFFFFF',
//     marginTop: 8,
//   },
//   buttonContainer: {
//     width: '100%',
//     marginVertical: 20,
//   },
// });

// export default EmptyState;
