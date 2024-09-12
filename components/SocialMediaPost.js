// import React from "react";
// import { View, Text, Image, TouchableOpacity, Alert } from "react-native";
// import { FontAwesome } from "@expo/vector-icons";
// import { useNavigation } from '@react-navigation/native';
// import { useUser } from "@clerk/clerk-expo"; // Assuming you're using Clerk for authentication
// import { doc, deleteDoc } from "firebase/firestore"; // Firebase Firestore functions
// import { db } from "../../firebaseConfig"; // Your Firebase config file

// const SocialMediaPost = ({ post }) => {
//   const navigation = useNavigation();
//   const { user } = useUser(); // Get the current user

//   const onHashtagPress = (hashtag) => {
//     Alert.alert('Hashtag Pressed', `You pressed ${hashtag}`);
//   };

//   const onMentionPress = (mention) => {
//     Alert.alert('Mention Pressed', `You pressed ${mention}`);
//   };

//   const handlePress = () => {
//     navigation.navigate('FullScreenPost', { post });
//   };

//   const handleDeletePost = async () => {
//     Alert.alert(
//       "Delete Post",
//       "Are you sure you want to delete this post?",
//       [
//         {
//           text: "Cancel",
//           style: "cancel"
//         },
//         {
//           text: "Delete",
//           style: "destructive",
//           onPress: async () => {
//             try {
//               await deleteDoc(doc(db, "posts", post.id));
//               Alert.alert("Success", "Post deleted successfully.");
//             } catch (error) {
//               Alert.alert("Error", "Failed to delete post.");
//               console.error("Error deleting post: ", error);
//             }
//           }
//         }
//       ]
//     );
//   };

//   return (
//     <View style={styles.postContainer}>
//       <View style={styles.postHeader}>
//         <Image source={{ uri: post.profileImage }} style={styles.profileImage} />
//         <View>
//           <Text style={styles.userName}>{post.userName}</Text>
//           <Text style={styles.postTime}>{post.time}</Text>
//         </View>
//         {user.id === post.userId && ( // Show delete button only if the current user is the creator of the post
//           <TouchableOpacity onPress={handleDeletePost} style={styles.deleteButton}>
//             <FontAwesome name="trash" size={24} color="red" />
//           </TouchableOpacity>
//         )}
//       </View>
//       <TouchableOpacity onPress={handlePress}>
//         <Text style={styles.postContent}>{post.content}</Text>
//         {post.image && <Image source={{ uri: post.image }} style={styles.postImage} />}
//       </TouchableOpacity>
//       <View style={styles.postFooter}>
//         <TouchableOpacity style={styles.likeButton} onPress={() => console.log("Liked!")}>
//           <FontAwesome name="heart-o" size={24} color="black" />
//           <Text style={styles.iconText}>{post.likes}</Text>
//         </TouchableOpacity>
//         <TouchableOpacity style={styles.commentButton} onPress={() => console.log("Post your comment!")}>
//           <FontAwesome name="comment-o" size={24} color="black" />
//           <Text style={styles.iconText}>{post.comments}</Text>
//         </TouchableOpacity>
//         <TouchableOpacity style={styles.shareButton} onPress={() => console.log("Share with your friends!!")}>
//           <FontAwesome name="share" size={24} color="black" />
//           <Text style={styles.iconText}>Share</Text>
//         </TouchableOpacity>
//       </View>
//     </View>
//   );
// };

// const styles = {
//   postContainer: {
//     padding: 16,
//     backgroundColor: 'white',
//     borderRadius: 16,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.2,
//     shadowRadius: 4,
//     marginBottom: 16,
//   },
//   postHeader: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: 16,
//   },
//   profileImage: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     marginRight: 16,
//   },
//   userName: {
//     fontWeight: 'bold',
//     fontSize: 18,
//   },
//   postTime: {
//     color: '#888',
//     fontSize: 14,
//   },
//   postContent: {
//     marginBottom: 16,
//     fontSize: 16,
//   },
//   postImage: {
//     width: '100%',
//     height: 240,
//     borderRadius: 16,
//     marginBottom: 16,
//   },
//   postFooter: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//   },
//   likeButton: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   commentButton: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   shareButton: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   iconText: {
//     marginLeft: 8,
//     fontSize: 16,
//   },
//   deleteButton: {
//     marginLeft: 'auto',
//     marginRight: 16,
//   },
// };

// export default SocialMediaPost;
