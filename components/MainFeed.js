// import React, { useState } from 'react';
// import { View, Text, Image, TouchableOpacity, Alert, Modal, ScrollView } from 'react-native';
// import { FontAwesome, Feather } from '@expo/vector-icons';
// import { useUser } from '@clerk/clerk-expo';
// import { useNavigation } from '@react-navigation/native';

// const Post = ({ post, onEdit, onDelete }) => {
//   const { user } = useUser();
//   const [modalVisible, setModalVisible] = useState(false);
//   const navigation = useNavigation();

//   const handlePress = () => {
//     if (post) {
//       setModalVisible(true);
//     } else {
//       console.error('Post object is undefined or null');
//     }
//   };

//   return (
//     <>
//       <TouchableOpacity onPress={handlePress}>
//         <View style={{ padding: 16, backgroundColor: 'white', marginBottom: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 }}>
//           <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
//             <Image source={{ uri: post?.profileImage }} style={{ width: 40, height: 40, borderRadius: 20, marginRight: 16 }} />
//             <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{post?.userName}</Text>
//             {user?.id === post?.userId && (
//               <View style={{ marginLeft: 'auto', flexDirection: 'row' }}>
//                 <TouchableOpacity onPress={onEdit} style={{ marginRight: 10 }}>
//                   <Feather name="edit" size={24} color="blue" />
//                 </TouchableOpacity>
//                 <TouchableOpacity onPress={onDelete}>
//                   <Feather name="trash" size={24} color="red" />
//                 </TouchableOpacity>
//               </View>
//             )}
//           </View>
//           <Text style={{ marginBottom: 16 }}>{post?.content}</Text>
//           {post?.image && <Image source={{ uri: post?.image }} style={{ width: '100%', height: 240, borderRadius: 16 }} />}
//         </View>
//       </TouchableOpacity>

//       <Modal
//         animationType="slide"
//         transparent={true}
//         visible={modalVisible}
//         onRequestClose={() => setModalVisible(false)}
//       >
//         <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
//           <View style={{ width: '90%', backgroundColor: 'white', borderRadius: 10, padding: 20 }}>
//             <ScrollView>
//               <Text style={{ marginBottom: 10, fontSize: 18 }}>{post?.content}</Text>
//               {post?.image && (
//                 <Image
//                   source={{ uri: post?.image }}
//                   style={{ width: '100%', height: 300, borderRadius: 10, marginBottom: 10 }}
//                   resizeMode="cover"
//                 />
//               )}
//             </ScrollView>
//             <TouchableOpacity onPress={() => setModalVisible(false)} style={{ alignSelf: 'center', marginTop: 20 }}>
//               <Text style={{ color: 'blue' }}>Close</Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       </Modal>
//     </>
//   );
// };

// export default Post;
