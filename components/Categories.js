// import React from 'react';
// import { View, Text, FlatList, Image, StyleSheet } from 'react-native';

// const Categories = ({ categoryList }) => {
//   return (
//     <View>
//       <FlatList
//         data={categoryList}
//         horizontal={true}
//         showsHorizontalScrollIndicator={false}
//         keyExtractor={(item, index) => index.toString()}
//         renderItem={({ item }) => (
//           <View style={styles.imageContainer}>
//             <Image 
//               source={{ uri: item?.Image }} 
//               style={styles.image}
//             />
//           </View>
//         )}
//       />
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   imageContainer: {
//     marginRight: 10,
//   },
//   image: {
//     height: 200,
//     width: 30,
//     resizeMode: 'contain',
//   },
// });

// export default Categories;
