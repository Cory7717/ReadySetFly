// app/(tabs)/flights.js 

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  createContext,
  useContext,
} from 'react';
import {
  SafeAreaView,
  View,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  FlatList,
  Modal,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Linking,
  Animated,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged, updateProfile } from 'firebase/auth';
import {
  collection,
  addDoc,
  updateDoc,
  orderBy,
  deleteDoc,
  doc,
  limit,
  startAfter,
  getDocs,
  query,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  where,
  getDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../../firebaseConfig';
import { Avatar, Badge, Button } from 'react-native-paper';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';

// Constants
const DEFAULT_PROFILE_IMAGE = 'https://via.placeholder.com/150';

// Stack Navigator
const Stack = createStackNavigator();

// Helper function to generate unique IDs
const generateUniqueId = () => {
  if (auth.currentUser && auth.currentUser.uid) {
    return `${auth.currentUser.uid}_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }
  // Fallback in case auth.currentUser is not available
  return `unknown_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Detects URLs in the text and makes them clickable
const handleTextWithLinks = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <Text
          key={`link-${index}`}
          style={styles.linkText}
          onPress={() => Linking.openURL(part)}
        >
          {part}
        </Text>
      );
    }
    return part;
  });
};

// Create Context for Post Modal
const PostModalContext = createContext();

const PostModalProvider = ({ children }) => {
  const [isPostModalVisible, setIsPostModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);

  const openPostModal = (postId) => {
    setSelectedPostId(postId);
    setIsPostModalVisible(true);
  };

  const closePostModal = () => {
    setIsPostModalVisible(false);
    setSelectedPostId(null);
  };

  return (
    <PostModalContext.Provider
      value={{ isPostModalVisible, selectedPostId, openPostModal, closePostModal }}
    >
      {children}
    </PostModalContext.Provider>
  );
};

// Custom Hook to fetch user profile
const useUserProfile = (userId) => {
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    if (!userId) return;
    const userRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
      } else {
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, [userId]);

  return userProfile;
};

// Comment Component
const Comment = ({
  comment,
  onLikeComment,
  onReplyComment,
  userId,
  postId,
  depth = 0, // Default depth
  onProfileImagePress,
}) => {
  const [liked, setLiked] = useState((comment.likes || []).includes(userId));
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');

  // Fetch the latest user profile
  const userProfile = useUserProfile(comment.userId);

  const handleLike = () => {
    setLiked(!liked);
    onLikeComment(comment.id, comment.userId);
  };

  const handleReply = () => {
    setShowReplyInput(!showReplyInput);
  };

  const handleAddReply = async () => {
    if (replyText.trim()) {
      const newReply = {
        id: generateUniqueId(), // Unique ID
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Anonymous',
        text: replyText.trim(),
        likes: [],
        replies: [],
        depth: depth + 1, // Increment depth for the reply
      };
      try {
        // Reference to the parent post
        const postRef = doc(db, 'posts', postId);
        // Fetch the current post
        const postSnap = await getDoc(postRef);
        if (postSnap.exists()) {
          const postData = postSnap.data();
          const updatedComments = postData.comments.map((cmt) => {
            if (cmt.id === comment.id) {
              const updatedReplies = cmt.replies
                ? [...cmt.replies, newReply]
                : [newReply];
              return {
                ...cmt,
                replies: updatedReplies,
              };
            }
            return cmt;
          });
          await updateDoc(postRef, { comments: updatedComments });

          setReplyText('');
          setShowReplyInput(false);

          // Send notification to the reply author if different
          if (comment.userId !== auth.currentUser.uid) {
            await addDoc(collection(db, 'notifications'), {
              toUserId: comment.userId,
              fromUserId: auth.currentUser.uid,
              fromUserName: auth.currentUser.displayName || 'Anonymous',
              type: 'reply',
              postId: postRef.id,
              commentId: comment.id,
              read: false,
              createdAt: serverTimestamp(),
            });
          }
        } else {
          Alert.alert('Error', 'Post does not exist.');
        }
      } catch (error) {
        Alert.alert('Error', 'Could not add reply.');
        console.log(error);
      }
    }
  };

  return (
    <View
      style={[
        styles.commentContainer,
        { marginLeft: depth * 20 }, // Indent based on depth
      ]}
    >
      <View style={styles.commentHeader}>
        <TouchableOpacity
          onPress={() => {
            if (comment.userId) {
              onProfileImagePress(comment.userId);
            } else {
              Alert.alert('Error', 'User ID not available.');
            }
          }}
          accessible={true}
          accessibilityLabel="View Commenter's Profile"
        >
          {userProfile ? (
            <Image
              source={{ uri: userProfile.image || DEFAULT_PROFILE_IMAGE }}
              style={styles.avatar}
            />
          ) : (
            <Image
              source={{ uri: DEFAULT_PROFILE_IMAGE }}
              style={styles.avatar}
            />
          )}
        </TouchableOpacity>
        <View style={styles.commentContent}>
          <Text style={styles.commentUserName}>{comment.userName}</Text>
          <Text>{comment.text}</Text>
          <View style={styles.commentActions}>
            <TouchableOpacity
              onPress={handleLike}
              style={styles.commentActionButton}
              accessible={true}
              accessibilityLabel="Like Comment"
            >
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={16}
                color={liked ? 'red' : 'gray'}
              />
              <Text style={styles.commentActionText}>
                {(comment.likes || []).length}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleReply}
              style={styles.commentReplyButton}
              accessible={true}
              accessibilityLabel="Reply to Comment"
            >
              <Text style={styles.replyText}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {showReplyInput && (
        <View style={styles.replyInputContainer}>
          <TextInput
            placeholder="Write a reply..."
            placeholderTextColor="#888"            
            value={replyText}
            onChangeText={setReplyText}
            style={styles.replyInput}
            accessible={true}
            accessibilityLabel="Write a reply input field"
          />
          <TouchableOpacity
            onPress={handleAddReply}
            disabled={!replyText.trim()}
            style={styles.sendReplyButton}
            accessible={true}
            accessibilityLabel="Submit Reply"
          >
            <Ionicons name="send" size={20} color="#1D4ED8" />
          </TouchableOpacity>
        </View>
      )}
      {comment.replies && comment.replies.length > 0 && (
        <View style={styles.repliesContainer}>
          {comment.replies.slice(0, 3).map((reply) => (
            <Comment
              key={reply.id || generateUniqueId()} // Ensure 'id' exists and is unique
              comment={reply}
              postId={postId} // Pass 'postId' to Comment
              onLikeComment={onLikeComment}
              onReplyComment={onReplyComment}
              userId={userId}
              depth={reply.depth || 0} // Initialize depth, default to 0
              onProfileImagePress={onProfileImagePress} // Pass it down
            />
          ))}
          {comment.replies.length > 3 && (
            <Text style={styles.viewMoreReplies}>View more replies...</Text>
          )}
        </View>
      )}
    </View>
  );
};

// Post Component
const Post = React.memo(({ post, onViewPost, onProfileImagePress }) => {
  const [currentPost, setCurrentPost] = useState(post);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState(currentPost.comments || []);
  const [likes, setLikes] = useState(currentPost.likes || []);
  const [liked, setLiked] = useState(
    (currentPost.likes || []).includes(auth.currentUser.uid)
  );
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editText, setEditText] = useState(currentPost.content);

  // Fetch the latest user profile
  const userProfile = useUserProfile(currentPost.userId);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'posts', currentPost.id),
      (docSnap) => {
        if (docSnap.exists()) {
          const updatedPost = { id: docSnap.id, ...docSnap.data() };
          setCurrentPost(updatedPost);
          setComments(updatedPost.comments || []);
          setLikes(updatedPost.likes || []);
          setLiked(updatedPost.likes?.includes(auth.currentUser.uid));
        }
      }
    );
    return () => unsubscribe();
  }, [currentPost.id]);

  const handleEdit = async () => {
    try {
      const postRef = doc(db, 'posts', currentPost.id);
      await updateDoc(postRef, {
        content: editText,
      });
      setEditModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Could not update post.');
      console.log(error);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this post?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'posts', currentPost.id));
            } catch (error) {
              Alert.alert('Error', 'Could not delete post.');
              console.log(error);
            }
          },
        },
      ]
    );
  };

  const handleLike = useCallback(async () => {
    try {
      const postRef = doc(db, 'posts', currentPost.id);
      if (liked) {
        await updateDoc(postRef, {
          likes: arrayRemove(auth.currentUser.uid),
        });
        setLiked(false);
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(auth.currentUser.uid),
        });
        setLiked(true);

        if (currentPost.userId !== auth.currentUser.uid) {
          await addDoc(collection(db, 'notifications'), {
            toUserId: currentPost.userId,
            fromUserId: auth.currentUser.uid,
            fromUserName: auth.currentUser.displayName || 'Anonymous',
            type: 'like',
            postId: currentPost.id,
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Could not update like.');
      console.log(error);
    }
  }, [liked, currentPost.id, currentPost.userId]);

  const handleShare = useCallback(async () => {
    Alert.alert('Share', `Sharing ${currentPost.userName}'s post.`);
    if (currentPost.userId !== auth.currentUser.uid) {
      try {
        await addDoc(collection(db, 'notifications'), {
          toUserId: currentPost.userId,
          fromUserId: auth.currentUser.uid,
          fromUserName: auth.currentUser.displayName || 'Anonymous',
          type: 'share',
          postId: currentPost.id,
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        Alert.alert('Error', 'Could not send share notification.');
        console.log(error);
      }
    }
  }, [currentPost.userId, currentPost.userName, currentPost.id]);

  const renderDate = useMemo(() => {
    if (currentPost.createdAt) {
      if (currentPost.createdAt.toDate) {
        return new Date(currentPost.createdAt.toDate()).toLocaleDateString();
      } else if (currentPost.createdAt instanceof Date) {
        return currentPost.createdAt.toLocaleDateString();
      }
    }
    return 'Unknown Date';
  }, [currentPost.createdAt]);

  // Function to handle adding a comment from the main screen
  const handleAddComment = useCallback(async () => {
    if (commentText.trim()) {
      const newComment = {
        id: generateUniqueId(), // Unique ID
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Anonymous',
        text: commentText.trim(),
        likes: [],
        replies: [],
        depth: 0, // Initial depth for top-level comments
      };
      try {
        const postRef = doc(db, 'posts', currentPost.id);
        await updateDoc(postRef, {
          comments: arrayUnion(newComment),
        });
        setCommentText('');

        if (currentPost.userId !== auth.currentUser.uid) {
          await addDoc(collection(db, 'notifications'), {
            toUserId: currentPost.userId,
            fromUserId: auth.currentUser.uid,
            fromUserName: auth.currentUser.displayName || 'Anonymous',
            type: 'comment',
            postId: currentPost.id,
            commentId: newComment.id,
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      } catch (error) {
        Alert.alert('Error', 'Could not add comment.');
        console.log(error);
      }
    }
  }, [commentText, currentPost.id, currentPost.userId]);

  // Function to handle liking/unliking a comment
  const handleLikeComment = useCallback(
    async (commentId, commentAuthorId) => {
      try {
        const postRef = doc(db, 'posts', currentPost.id);
        const currentComments = comments;

        const updatedComments = currentComments.map((cmt) => {
          if (cmt.id === commentId) {
            if (cmt.likes.includes(auth.currentUser.uid)) {
              return {
                ...cmt,
                likes: cmt.likes.filter((uid) => uid !== auth.currentUser.uid),
              };
            } else {
              return {
                ...cmt,
                likes: [...cmt.likes, auth.currentUser.uid],
              };
            }
          }
          return cmt;
        });

        await updateDoc(postRef, { comments: updatedComments });

        // Find the updated comment
        const updatedComment = updatedComments.find(
          (cmt) => cmt.id === commentId
        );

        // If the comment is liked, send a notification
        if (updatedComment.likes.includes(auth.currentUser.uid)) {
          await addDoc(collection(db, 'notifications'), {
            toUserId: commentAuthorId,
            fromUserId: auth.currentUser.uid,
            fromUserName: auth.currentUser.displayName || 'Anonymous',
            type: 'like_comment',
            postId: currentPost.id,
            commentId: commentId,
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      } catch (error) {
        console.log(error);
        Alert.alert('Error', 'Could not update comment like.');
      }
    },
    [comments, currentPost.id]
  );

  return (
    <TouchableOpacity
      onPress={() => onViewPost(currentPost)}
      accessible={true}
      accessibilityLabel="View Full Post"
    >
      <View style={styles.postContainer}>
        <View style={styles.postHeader}>
          <TouchableOpacity
            onPress={() => {
              if (currentPost.userId) {
                onProfileImagePress(currentPost.userId);
              } else {
                Alert.alert('Error', 'User ID not available.');
              }
            }}
            accessible={true}
            accessibilityLabel="View User Profile"
          >
            {userProfile ? (
              <Image
                source={{ uri: userProfile.image || DEFAULT_PROFILE_IMAGE }}
                style={styles.avatar}
              />
            ) : (
              <Image
                source={{ uri: DEFAULT_PROFILE_IMAGE }}
                style={styles.avatar}
              />
            )}
          </TouchableOpacity>
          <View style={styles.postUserInfo}>
            <Text style={styles.postUserName}>
              {currentPost?.userName || 'Unknown User'}
            </Text>
            <Text style={styles.postDate}>{renderDate}</Text>
          </View>
          {currentPost.userId === auth.currentUser?.uid && (
            <TouchableOpacity
              onPress={() => setEditModalVisible(true)}
              style={styles.menuButton}
              accessible={true}
              accessibilityLabel="Edit Post"
            >
              <Ionicons name="ellipsis-vertical" size={24} color="gray" />
            </TouchableOpacity>
          )}
        </View>
        <Text numberOfLines={4} ellipsizeMode="tail" style={styles.postContent}>
          {handleTextWithLinks(currentPost?.content || '')}
        </Text>
        {currentPost.image && (
          <View style={styles.postImageContainer}>
            <TouchableOpacity
              onPress={() => onViewPost(currentPost)}
              accessible={true}
              accessibilityLabel="View Post Image"
            >
              <Image
                source={{ uri: currentPost.image }}
                style={styles.postImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.postActionButton}
            onPress={handleLike}
            accessible={true}
            accessibilityLabel="Like Post"
          >
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={24}
              color={liked ? 'red' : 'gray'}
            />
            <Text style={styles.postActionText}>
              {likes.length > 0 ? likes.length : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.postActionButton}
            onPress={handleShare}
            accessible={true}
            accessibilityLabel="Share Post"
          >
            <Ionicons name="share-social-outline" size={24} color="gray" />
            <Text style={styles.postActionText}>Share</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.commentsSection}>
          {comments.slice(0, 3).map((cmt) => (
            <Comment
              key={cmt.id || generateUniqueId()} // Ensure 'id' exists and is unique
              comment={cmt}
              postId={currentPost.id} // Pass 'postId' to Comment
              onLikeComment={handleLikeComment}
              onReplyComment={() => {}} // Implement reply functionality as needed
              userId={auth.currentUser.uid}
              depth={cmt.depth || 0} // Initialize depth, default to 0
              onProfileImagePress={onProfileImagePress}
            />
          ))}
          {comments.length > 3 && (
            <Text style={styles.viewMoreComments}>View more comments...</Text>
          )}
        </View>

        <View style={styles.commentInputContainer}>
          <TouchableOpacity
            onPress={() => {
              if (auth.currentUser?.uid) {
                onProfileImagePress(auth.currentUser.uid);
              } else {
                Alert.alert('Error', 'User not authenticated.');
              }
            }}
            disabled={!auth.currentUser?.uid} // Disable if user not authenticated
            accessible={true}
            accessibilityLabel="View Your Profile"
          >
            <Image
              source={{
                uri: auth.currentUser?.photoURL || DEFAULT_PROFILE_IMAGE,
              }}
              style={styles.avatar}
            />
          </TouchableOpacity>
          <TextInput
            placeholder="Add a comment..."
            placeholderTextColor="#888"
            value={commentText}
            onChangeText={setCommentText}
            style={styles.commentInput}
            accessible={true}
            accessibilityLabel="Add a comment input field"
          />
          <TouchableOpacity
            onPress={handleAddComment}
            disabled={!commentText.trim()}
            accessible={true}
            accessibilityLabel="Submit Comment"
          >
            <Ionicons
              name="send"
              size={24}
              color="#1D4ED8"
              style={styles.sendIcon}
            />
          </TouchableOpacity>
        </View>

        <Modal
          visible={editModalVisible}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.editModalContainer}>
            <View style={styles.editModal}>
              <TextInput
                style={styles.editInput}
                placeholderTextColor="#888"
                value={editText}
                onChangeText={setEditText}
                multiline
                accessible={true}
                accessibilityLabel="Edit post content"
              />
              <View style={styles.modalButtons}>
                <Button onPress={handleEdit} accessibilityLabel="Save Edit">
                  Save
                </Button>
                <Button
                  onPress={() => setEditModalVisible(false)}
                  accessibilityLabel="Cancel Edit"
                >
                  Cancel
                </Button>
                <Button
                  onPress={handleDelete}
                  color="red"
                  accessibilityLabel="Delete Post"
                >
                  Delete
                </Button>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </TouchableOpacity>
  );
});

Post.displayName = 'Post';

// FeedHeader Component combining UserHeader and CreatePost
const FeedHeader = ({ navigation, headerTranslateY, onProfileImagePress }) => {
  return (
    <Animated.View style={{ transform: [{ translateY: headerTranslateY }] }}>
      <UserHeader
        navigation={navigation}
        onProfileImagePress={onProfileImagePress}
      />
      <CreatePost />
    </Animated.View>
  );
};

// User Header Component
const UserHeader = ({ navigation, onProfileImagePress }) => {
  const [profileImage, setProfileImage] = useState(DEFAULT_PROFILE_IMAGE);
  const [uploading, setUploading] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Fetch user profile from Firestore
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setProfileImage(userData.image || DEFAULT_PROFILE_IMAGE);
        } else {
          setProfileImage(DEFAULT_PROFILE_IMAGE);
        }
        // Listen for unread notifications
        const q = query(
          collection(db, 'notifications'),
          where('toUserId', '==', firebaseUser.uid),
          where('read', '==', false)
        );
        const unsubscribeNotifs = onSnapshot(q, (snapshot) => {
          setUnreadNotifications(snapshot.size);
        });
        return () => unsubscribeNotifs();
      }
    });
    return () => unsubscribe();
  }, []);

  const pickProfileImage = useCallback(async () => {
    if (!user) {
      Alert.alert('Error', 'No authenticated user found.');
      return;
    }
    try {
      const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        const { status: requestStatus } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (requestStatus !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Permission to access the media library is required!'
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0].uri;

        if (selectedImage) {
          setUploading(true);
          const blob = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onload = function () {
              resolve(xhr.response);
            };
            xhr.onerror = function () {
              reject(new TypeError('Network request failed'));
            };
            xhr.responseType = 'blob';
            xhr.open('GET', selectedImage, true);
            xhr.send(null);
          });

          const filename = `profileImages/${user.uid}/${
            user.uid
          }_${Date.now()}`;
          const storageRef = ref(storage, filename);
          await uploadBytes(storageRef, blob);

          const imageUrl = await getDownloadURL(storageRef);
          await updateDoc(doc(db, 'users', user.uid), { image: imageUrl });

          // Update auth.currentUser.photoURL
          await updateProfile(auth.currentUser, { photoURL: imageUrl });
          setProfileImage(imageUrl);
        } else {
          Alert.alert('Error', 'Failed to select image.');
        }
      }
    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'Could not update profile image.');
    } finally {
      setUploading(false);
    }
  }, [user]);

  return (
    <View style={styles.headerContainer}>
      <Text style={styles.pilotsLoungeText}>The Pilots Lounge</Text>
      <View style={styles.headerTop}>
        <TouchableOpacity
          onPress={() => {
            if (user && user.uid) {
              onProfileImagePress(user.uid);
            } else {
              Alert.alert('Error', 'User not authenticated.');
            }
          }}
          style={styles.profileImageContainer}
          disabled={!user} // Disable if user is not available
          accessible={true}
          accessibilityLabel="View Profile Image"
        >
          <Avatar.Image
            size={70}
            source={{ uri: profileImage }}
            style={styles.largeProfileImage}
          />
          {uploading && (
            <ActivityIndicator
              size="small"
              color="#fff"
              style={styles.uploadingIndicator}
            />
          )}
        </TouchableOpacity>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {user?.displayName || 'Pilot Name'}
          </Text>
          <Text style={styles.stats}>
            {unreadNotifications} Notifications | {user?.posts || 0} Posts
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => {
            if (user) {
              navigation.navigate('Notifications');
            } else {
              Alert.alert('Error', 'User not authenticated.');
            }
          }}
          accessible={true}
          accessibilityLabel="Navigate to Notifications"
        >
          <Ionicons name="notifications-outline" size={30} color="#fff" />
          {unreadNotifications > 0 && (
            <Badge style={styles.badge}>{unreadNotifications}</Badge>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Alert.alert('Messages')}
          accessible={true}
          accessibilityLabel="Navigate to Messages"
        >
          <Ionicons name="chatbubbles-outline" size={30} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Alert.alert('Settings')}
          accessible={true}
          accessibilityLabel="Navigate to Settings"
        >
          <Ionicons name="settings-outline" size={30} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Create Post Component with image handling
const CreatePost = () => {
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
      }
    });
    return () => unsubscribe();
  }, []);

  const pickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        const { status: requestStatus } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (requestStatus !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Permission to access the media library is required!'
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0].uri;

        if (selectedImage) {
          setImage(selectedImage);
        } else {
          Alert.alert('Error', 'Failed to select image.');
        }
      }
    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'Could not pick image.');
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (content.trim() || image) {
      let imageUrl = null;

      if (image) {
        setUploading(true);
        try {
          const response = await fetch(image);
          const blob = await response.blob();

          const filename = `${user.uid}_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          const storageRef = ref(storage, `postImages/${filename}`);
          await uploadBytes(storageRef, blob);

          blob.close();

          imageUrl = await getDownloadURL(storageRef);
        } catch (error) {
          console.log(error);
          Alert.alert('Error', 'Could not upload image.');
          setUploading(false);
          return;
        }
        setUploading(false);
      }

      const newPost = {
        content,
        image: imageUrl || null,
        createdAt: serverTimestamp(),
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        comments: [],
        likes: [],
      };

      try {
        await addDoc(collection(db, 'posts'), newPost);
        setContent('');
        setImage(null);
      } catch (error) {
        Alert.alert('Error', 'Could not submit post.');
        console.log(error);
      }
    } else {
      Alert.alert('Error', 'Please enter some text or upload an image.');
    }
  }, [content, image, user]);

  const removeImage = () => {
    setImage(null);
  };

  return (
    <View style={styles.createPostContainer}>
      <View style={styles.createPostHeader}>
        <Image
          source={{ uri: user?.photoURL || DEFAULT_PROFILE_IMAGE }}
          style={styles.avatar}
        />
        <TextInput
          placeholder="What's on your mind?"
          placeholderTextColor="#888"
          value={content}
          onChangeText={setContent}
          multiline
          style={styles.postInput}
          accessible={true}
          accessibilityLabel="Create a new post input field"
        />
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={uploading || (!content.trim() && !image)}
          accessible={true}
          accessibilityLabel="Submit Post"
        >
          <Ionicons
            name="send"
            size={24}
            color="#1D4ED8"
            style={styles.sendIcon}
          />
        </TouchableOpacity>
      </View>
      {image && (
        <View style={styles.imagePreviewContainer}>
          <Image source={{ uri: image }} style={styles.imagePreview} />
          <TouchableOpacity
            onPress={removeImage}
            style={styles.removeImageButton}
            accessible={true}
            accessibilityLabel="Remove Image"
          >
            <Ionicons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      <Button
        mode="outlined"
        icon="image-outline"
        onPress={pickImage}
        style={styles.addButton}
        accessibilityLabel="Add Photo to Post"
      >
        Add Photo
      </Button>
      {uploading && (
        <ActivityIndicator
          size="large"
          color="#1D4ED8"
          style={styles.uploadingIndicator}
        />
      )}
    </View>
  );
};

// Notifications Component
const Notifications = ({ navigation, onProfileImagePress }) => {
  const [notifications, setNotifications] = useState([]);
  const { openPostModal } = useContext(PostModalContext);

  useEffect(() => {
    if (!auth.currentUser) {
      Alert.alert('Error', 'User not authenticated.');
      return;
    }
    const q = query(
      collection(db, 'notifications'),
      where('toUserId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setNotifications(notifs);
    });
    return () => unsubscribe();
  }, []);

  const markAsRead = async (id) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (error) {
      Alert.alert('Error', 'Could not mark notification as read.');
      console.log(error);
    }
  };

  return (
    <SafeAreaView style={styles.notificationsContainer}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.notificationItem,
              { backgroundColor: item.read ? '#fff' : '#E5E7EB' },
            ]}
            onPress={() => {
              markAsRead(item.id);
              if (item.postId) {
                openPostModal(item.postId);
              }
            }}
            accessible={true}
            accessibilityLabel={`Notification from ${item.fromUserName}`}
          >
            <Text>
              {item.fromUserName}{' '}
              {item.type === 'like'
                ? 'liked your post.'
                : item.type === 'comment'
                ? 'commented on your post.'
                : item.type === 'share'
                ? 'shared your post.'
                : item.type === 'reply'
                ? 'replied to your comment on your post.'
                : ''}
            </Text>
            <Text style={styles.notificationDate}>
              {item.createdAt?.toDate
                ? item.createdAt.toDate().toLocaleString()
                : ''}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyNotifications}>No notifications.</Text>
        }
      />
    </SafeAreaView>
  );
};

// FullScreenProfileImageModal Component
const FullScreenProfileImageModal = ({ visible, onClose, userId }) => {
  const [profileImageLikes, setProfileImageLikes] = useState([]);
  const [profileImageComments, setProfileImageComments] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [liking, setLiking] = useState(false);
  const [commenting, setCommenting] = useState(false);

  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    const userRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserProfile(data);
        setProfileImageLikes(data.profileImageLikes || []);
        setProfileImageComments(data.profileImageComments || []);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const hasLiked = useMemo(() => {
    return profileImageLikes.includes(auth.currentUser.uid);
  }, [profileImageLikes]);

  const handleLikeImage = useCallback(async () => {
    if (liking) return; // Prevent multiple taps
    setLiking(true);
    try {
      const userRef = doc(db, 'users', userId);
      if (hasLiked) {
        await updateDoc(userRef, {
          profileImageLikes: arrayRemove(auth.currentUser.uid),
        });
      } else {
        await updateDoc(userRef, {
          profileImageLikes: arrayUnion(auth.currentUser.uid),
        });

        if (userId !== auth.currentUser.uid) {
          await addDoc(collection(db, 'notifications'), {
            toUserId: userId,
            fromUserId: auth.currentUser.uid,
            fromUserName: auth.currentUser.displayName || 'Anonymous',
            type: 'like_profile_image',
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Could not update like.');
      console.log(error);
    }
    setLiking(false);
  }, [hasLiked, userId, liking]);

  const handleAddComment = useCallback(async () => {
    if (commentText.trim()) {
      setCommenting(true);
      const newComment = {
        id: generateUniqueId(),
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Anonymous',
        text: commentText.trim(),
        createdAt: serverTimestamp(),
        depth: 0, // Initial depth for top-level comments in profile image
      };
      try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          profileImageComments: arrayUnion(newComment),
        });
        setCommentText('');

        if (userId !== auth.currentUser.uid) {
          await addDoc(collection(db, 'notifications'), {
            toUserId: userId,
            fromUserId: auth.currentUser.uid,
            fromUserName: auth.currentUser.displayName || 'Anonymous',
            type: 'comment_profile_image',
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      } catch (error) {
        Alert.alert('Error', 'Could not add comment.');
        console.log(error);
      }
      setCommenting(false);
    }
  }, [commentText, userId]);

  // Function to handle opening profile images within comments inside the modal
  const handleNestedProfileImagePress = (nestedUserId) => {
    if (nestedUserId && nestedUserId !== userId) {
      // Implement logic to handle nested profile image press if needed
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent={false}>
      <SafeAreaView style={styles.fullScreenProfileContainer}>
        <ScrollView contentContainerStyle={styles.fullScreenProfileContent}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessible={true}
            accessibilityLabel="Close Profile Image Modal"
          >
            <Ionicons name="close-outline" size={30} color="black" />
          </TouchableOpacity>
          {loading ? (
            <ActivityIndicator size="large" color="#1D4ED8" />
          ) : userProfile ? (
            <>
              <Image
                source={{ uri: userProfile.image || DEFAULT_PROFILE_IMAGE }}
                style={styles.fullScreenProfileImage}
                resizeMode="contain"
              />
              <View style={styles.fullScreenProfileActions}>
                <TouchableOpacity
                  onPress={handleLikeImage}
                  style={styles.likeButton}
                  accessible={true}
                  accessibilityLabel="Like Profile Image"
                >
                  <Ionicons
                    name={hasLiked ? 'heart' : 'heart-outline'}
                    size={30}
                    color={hasLiked ? 'red' : 'gray'}
                  />
                  <Text style={styles.likeCount}>
                    {profileImageLikes.length}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.fullScreenProfileComments}>
                <Text style={styles.commentsHeader}>Comments</Text>
                {profileImageComments.map((cmt) => (
                  <View
                    key={cmt.id || generateUniqueId()}
                    style={styles.profileComment}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        if (cmt.userId) {
                          handleNestedProfileImagePress(cmt.userId);
                        } else {
                          Alert.alert('Error', 'User ID not available.');
                        }
                      }}
                      accessible={true}
                      accessibilityLabel={`View ${cmt.userName}'s Profile`}
                    >
                      <Image
                        source={{
                          uri: cmt.userProfileImage || DEFAULT_PROFILE_IMAGE,
                        }}
                        style={styles.commentAvatar}
                      />
                    </TouchableOpacity>
                    <View style={styles.commentTextContainer}>
                      <Text style={styles.commentUserName}>{cmt.userName}</Text>
                      <Text>{cmt.text}</Text>
                      <Text style={styles.commentDate}>
                        {cmt.createdAt?.toDate
                          ? cmt.createdAt.toDate().toLocaleString()
                          : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              <View style={styles.fullScreenProfileCommentInput}>
                <TouchableOpacity
                  onPress={() => {
                    if (auth.currentUser?.uid) {
                      // Handle user's own profile image press if needed
                    } else {
                      Alert.alert('Error', 'User not authenticated.');
                    }
                  }}
                  accessible={true}
                  accessibilityLabel="View Your Profile"
                >
                  <Image
                    source={{
                      uri: auth.currentUser?.photoURL || DEFAULT_PROFILE_IMAGE,
                    }}
                    style={styles.avatar}
                  />
                </TouchableOpacity>
                <TextInput
                  placeholder="Add a comment..."
                  placeholderTextColor="#888"
                  value={commentText}
                  onChangeText={setCommentText}
                  style={styles.profileCommentInput}
                  accessible={true}
                  accessibilityLabel="Add a comment input field"
                />
                <TouchableOpacity
                  onPress={handleAddComment}
                  disabled={!commentText.trim() || commenting}
                  accessible={true}
                  accessibilityLabel="Submit Comment"
                >
                  <Ionicons name="send" size={24} color="#1D4ED8" />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <Text>User not found.</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// FullScreenPostModal Component
const FullScreenPostModal = ({ onProfileImagePress }) => {
  const { isPostModalVisible, selectedPostId, closePostModal } =
    useContext(PostModalContext);
  const [post, setPost] = useState(null);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [likes, setLikes] = useState([]);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (selectedPostId) {
      const unsubscribe = onSnapshot(
        doc(db, 'posts', selectedPostId),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const processedComments = (data.comments || []).map((cmt) => ({
              ...cmt,
              id: cmt.id || generateUniqueId(),
              replies: (cmt.replies || []).map((reply) => ({
                ...reply,
                id: reply.id || generateUniqueId(),
              })),
            }));
            const updatedPost = {
              id: docSnap.id,
              ...data,
              comments: processedComments,
            };
            setPost(updatedPost);
            setComments(updatedPost.comments || []);
            setLikes(updatedPost.likes || []);
            setLiked(updatedPost.likes?.includes(auth.currentUser.uid));
          }
        }
      );
      return () => unsubscribe();
    }
  }, [selectedPostId]);

  const userProfile = useUserProfile(post?.userId);

  const handleAddComment = useCallback(async () => {
    if (comment.trim()) {
      const newComment = {
        id: generateUniqueId(), // Unique ID
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Anonymous',
        text: comment.trim(),
        likes: [],
        replies: [],
        depth: 0, // Initial depth for top-level comments
      };
      try {
        const postRef = doc(db, 'posts', post.id);
        await updateDoc(postRef, {
          comments: arrayUnion(newComment),
        });
        setComment('');

        if (post.userId !== auth.currentUser.uid) {
          await addDoc(collection(db, 'notifications'), {
            toUserId: post.userId,
            fromUserId: auth.currentUser.uid,
            fromUserName: auth.currentUser.displayName || 'Anonymous',
            type: 'comment',
            postId: post.id,
            commentId: newComment.id,
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      } catch (error) {
        Alert.alert('Error', 'Could not add comment.');
        console.log(error);
      }
    }
  }, [comment, post?.id, post?.userId]);

  const handleLikeComment = useCallback(
    async (commentId, commentAuthorId) => {
      try {
        const postRef = doc(db, 'posts', post.id);
        const currentComments = comments;

        const updatedComments = currentComments.map((cmt) => {
          if (cmt.id === commentId) {
            if (cmt.likes.includes(auth.currentUser.uid)) {
              return {
                ...cmt,
                likes: cmt.likes.filter((uid) => uid !== auth.currentUser.uid),
              };
            } else {
              return {
                ...cmt,
                likes: [...cmt.likes, auth.currentUser.uid],
              };
            }
          }
          return cmt;
        });

        await updateDoc(postRef, { comments: updatedComments });

        // Find the updated comment
        const updatedComment = updatedComments.find(
          (cmt) => cmt.id === commentId
        );

        // If the comment is liked, send a notification
        if (updatedComment.likes.includes(auth.currentUser.uid)) {
          await addDoc(collection(db, 'notifications'), {
            toUserId: commentAuthorId,
            fromUserId: auth.currentUser.uid,
            fromUserName: auth.currentUser.displayName || 'Anonymous',
            type: 'like_comment',
            postId: post.id,
            commentId: commentId,
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      } catch (error) {
        console.log(error);
        Alert.alert('Error', 'Could not update comment like.');
      }
    },
    [comments, post?.id]
  );

  const handleLike = useCallback(async () => {
    try {
      const postRef = doc(db, 'posts', post.id);
      if (liked) {
        await updateDoc(postRef, {
          likes: arrayRemove(auth.currentUser.uid),
        });
        setLiked(false);
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(auth.currentUser.uid),
        });
        setLiked(true);

        if (post.userId !== auth.currentUser.uid) {
          await addDoc(collection(db, 'notifications'), {
            toUserId: post.userId,
            fromUserId: auth.currentUser.uid,
            fromUserName: auth.currentUser.displayName || 'Anonymous',
            type: 'like',
            postId: post.id,
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Could not update like.');
      console.log(error);
    }
  }, [liked, post?.id, post?.userId]);

  if (!post) {
    return null;
  }

  return (
    <Modal visible={isPostModalVisible} transparent={false}>
      <SafeAreaView style={styles.fullScreenContainer}>
        <ScrollView style={{ flex: 1 }}>
          <View style={styles.fullScreenPost}>
            <TouchableOpacity
              onPress={closePostModal}
              style={styles.closeButton}
              accessible={true}
              accessibilityLabel="Close Post Modal"
            >
              <Ionicons name="close-outline" size={30} color="black" />
            </TouchableOpacity>
            <View style={styles.fullScreenHeader}>
              <TouchableOpacity
                onPress={() => {
                  if (post.userId) {
                    onProfileImagePress(post.userId);
                  } else {
                    Alert.alert('Error', 'User ID not available.');
                  }
                }}
                accessible={true}
                accessibilityLabel="View User Profile"
              >
                {userProfile ? (
                  <Image
                    source={{ uri: userProfile.image || DEFAULT_PROFILE_IMAGE }}
                    style={styles.fullScreenAvatar}
                  />
                ) : (
                  <Image
                    source={{ uri: DEFAULT_PROFILE_IMAGE }}
                    style={styles.fullScreenAvatar}
                  />
                )}
              </TouchableOpacity>
              <Text style={styles.fullScreenUserName}>
                {post?.userName || 'Unknown User'}
              </Text>
              <Text style={styles.fullScreenDate}>
                {post?.createdAt?.toDate
                  ? post.createdAt.toDate().toLocaleDateString()
                  : 'Unknown Date'}
              </Text>
            </View>
            <Text>{post?.content || ''}</Text>
            {post.image && (
              <View style={styles.fullScreenImageContainer}>
                <TouchableOpacity
                  onPress={() => {
                    if (post.userId) {
                      onProfileImagePress(post.userId);
                    }
                  }}
                  accessible={true}
                  accessibilityLabel="View Post Image"
                >
                  <Image
                    source={{ uri: post.image }}
                    style={styles.fullScreenImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.postActions}>
              <TouchableOpacity
                style={styles.postActionButton}
                onPress={handleLike}
                accessible={true}
                accessibilityLabel="Like Post"
              >
                <Ionicons
                  name={liked ? 'heart' : 'heart-outline'}
                  size={24}
                  color={liked ? 'red' : 'gray'}
                />
                <Text style={styles.postActionText}>
                  {likes.length > 0 ? likes.length : ''}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 20 }}>
              <Text style={styles.commentsHeader}>Comments</Text>
              {comments.map((cmt) => (
                <Comment
                  key={cmt.id || generateUniqueId()} // Ensure 'id' exists and is unique
                  comment={cmt}
                  postId={post.id} // Pass 'postId' to Comment
                  onLikeComment={handleLikeComment}
                  onReplyComment={() => {}} // Implement reply functionality as needed
                  userId={auth.currentUser.uid}
                  depth={cmt.depth || 0} // Initialize depth, default to 0
                  onProfileImagePress={onProfileImagePress}
                />
              ))}
            </View>
          </View>
        </ScrollView>
        <View style={styles.commentInputContainer}>
          <TouchableOpacity
            onPress={() => {
              if (auth.currentUser?.uid) {
                onProfileImagePress(auth.currentUser.uid);
              } else {
                Alert.alert('Error', 'User not authenticated.');
              }
            }}
            disabled={!auth.currentUser?.uid} // Disable if user not authenticated
            accessible={true}
            accessibilityLabel="View Your Profile"
          >
            <Image
              source={{
                uri: auth.currentUser?.photoURL || DEFAULT_PROFILE_IMAGE,
              }}
              style={styles.avatar}
            />
          </TouchableOpacity>
          <TextInput
            placeholder="Add a comment..."
            placeholderTextColor="#888"
            value={comment}
            onChangeText={setComment}
            style={styles.commentInput}
            accessible={true}
            accessibilityLabel="Add a comment input field"
          />
          <TouchableOpacity
            onPress={handleAddComment}
            style={styles.sendButton}
            accessible={true}
            accessibilityLabel="Submit Comment"
          >
            <Ionicons name="send" size={24} color="#1D4ED8" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// MainFeed Component with updated error handling
const MainFeed = ({ navigation, onProfileImagePress }) => {
  const [posts, setPosts] = useState([]);
  const [lastVisible, setLastVisible] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null); // Added error state
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const previousScrollY = useRef(0);
  const flatListRef = useRef(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  const { openPostModal } = useContext(PostModalContext);

  const PAGE_SIZE = 10;

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = useCallback(
    async (loadMore = false) => {
      setLoading(true);
      try {
        let postsRef = collection(db, 'posts');
        let q = query(postsRef, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
        if (loadMore && lastVisible) {
          q = query(
            postsRef,
            orderBy('createdAt', 'desc'),
            startAfter(lastVisible),
            limit(PAGE_SIZE)
          );
        }
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const newPosts = snapshot.docs.map((doc) => {
            const data = doc.data();
            const processedComments = (data.comments || []).map((cmt) => ({
              ...cmt,
              id: cmt.id || generateUniqueId(),
              replies: (cmt.replies || []).map((reply) => ({
                ...reply,
                id: reply.id || generateUniqueId(),
                depth: reply.depth || 0,
              })),
              depth: cmt.depth || 0,
            }));
            return { id: doc.id, ...data, comments: processedComments };
          });
          setPosts((prevPosts) =>
            loadMore ? [...prevPosts, ...newPosts] : newPosts
          );
          setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
          setError(null); // Reset error on successful fetch
        } else {
          // No more posts to fetch
          setLastVisible(null);
        }
      } catch (error) {
        console.log('Fetch Posts Error:', error);
        setError('Failed to fetch posts. Please try again later.');
      }
      setLoading(false);
    },
    [lastVisible]
  );

  const handleLoadMore = () => {
    if (!loading && lastVisible) {
      fetchPosts(true);
    }
  };

  const handleViewPost = (post) => {
    openPostModal(post.id);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts().then(() => setRefreshing(false));
  };

  const handleScroll = (event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const diff = currentScrollY - previousScrollY.current;

    // Show or hide the Scroll to Top button based on scroll position
    if (currentScrollY > 300 && !showScrollToTop) {
      // Threshold can be adjusted
      setShowScrollToTop(true);
    } else if (currentScrollY <= 300 && showScrollToTop) {
      setShowScrollToTop(false);
    }

    if (diff > 0 && currentScrollY > 50) {
      // Scrolling down
      Animated.timing(headerTranslateY, {
        toValue: -160, // Header height to hide
        duration: 50, // Instant hide
        useNativeDriver: true,
      }).start();
    } else if (diff < 0) {
      // Scrolling up
      Animated.timing(headerTranslateY, {
        toValue: 0, // Show header
        duration: 50, // Instant show
        useNativeDriver: true,
      }).start();
    }

    previousScrollY.current = currentScrollY;
  };

  return (
    <SafeAreaView style={styles.mainFeedContainer}>
      <View style={{ flex: 1 }}>
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => fetchPosts()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        <FlatList
          ref={flatListRef}
          data={posts}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <FeedHeader
              navigation={navigation}
              headerTranslateY={headerTranslateY}
              onProfileImagePress={onProfileImagePress}
            />
          }
          renderItem={({ item }) => (
            <Post
              post={item}
              onViewPost={handleViewPost}
              onProfileImagePress={onProfileImagePress}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading && (
              <ActivityIndicator
                size="large"
                color="#1D4ED8"
                style={styles.loadingIndicator}
              />
            )
          }
          ListEmptyComponent={
            !loading && (
              <Text style={styles.emptyPosts}>No posts available.</Text>
            )
          }
          onScroll={handleScroll}
          scrollEventThrottle={16}
          accessible={true}
          accessibilityLabel="Main Feed List"
        />
        {showScrollToTop && (
          <TouchableOpacity
            style={styles.scrollToTopButton}
            onPress={() =>
              flatListRef.current.scrollToOffset({ offset: 0, animated: true })
            }
            accessible={true}
            accessibilityLabel="Scroll to Top"
          >
            <Ionicons name="arrow-up" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

// Root App Component
export default function App() {
  const [profileImageModalVisible, setProfileImageModalVisible] = useState(false);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState(null);

  const onProfileImagePress = (userId) => {
    if (userId) {
      setSelectedProfileUserId(userId);
      setProfileImageModalVisible(true);
    } else {
      Alert.alert('Error', 'User ID is not available.');
    }
  };

  return (
    <PostModalProvider>
      <NavigationContainer independent={true}>
        <Stack.Navigator initialRouteName="flights">
          {/* Include all your routes here */}
          <Stack.Screen
            name="flights"
            options={{ headerShown: false }}
          >
            {(props) => (
              <MainFeed {...props} onProfileImagePress={onProfileImagePress} />
            )}
          </Stack.Screen>
          {/* Add other screens as needed */}
          <Stack.Screen
            name="Notifications"
            options={{ title: 'Notifications' }}
          >
            {(props) => (
              <Notifications
                {...props}
                onProfileImagePress={onProfileImagePress}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
      {/* FullScreenPostModal */}
      <FullScreenPostModal onProfileImagePress={onProfileImagePress} />
      {/* FullScreenProfileImageModal */}
      {profileImageModalVisible && (
        <FullScreenProfileImageModal
          visible={profileImageModalVisible}
          onClose={() => setProfileImageModalVisible(false)}
          userId={selectedProfileUserId}
        />
      )}
    </PostModalProvider>
  );
}

// Stylesheet
const styles = StyleSheet.create({
  // ... [Your existing styles go here]

  errorContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#FDEDEC',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    marginBottom: 10,
  },
  retryText: {
    color: '#1D4ED8',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  profileModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  profileModalContent: {
    alignItems: 'center',
    padding: 20,
  },
  profileImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 20,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileBio: {
    fontSize: 16,
    marginVertical: 10,
  },
  profileLocation: {
    fontSize: 16,
    color: 'gray',
  },
  editProfileContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  editProfileContent: {
    padding: 20,
  },
  input: {
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
  },
  commentContainer: {
    marginBottom: 10,
    padding: 10,
    borderColor: '#E5E7EB',
    borderBottomWidth: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentContent: {
    marginLeft: 10,
    flex: 1,
  },
  commentUserName: {
    fontWeight: 'bold',
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentActionText: {
    marginLeft: 5,
  },
  commentReplyButton: {
    marginLeft: 20,
  },
  replyText: {
    color: 'blue',
  },
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    marginLeft: 50,
  },
  replyInput: {
    flex: 1,
    padding: 5,
    backgroundColor: '#F3F4F6',
    borderRadius: 5,
  },
  sendReplyButton: {
    marginLeft: 5,
  },
  repliesContainer: {
    marginTop: 10,
  },
  viewMoreReplies: {
    marginLeft: 50,
    color: 'gray',
  },
  headerContainer: {
    backgroundColor: '#1D4ED8',
    padding: 20,
    overflow: 'hidden',
  },
  pilotsLoungeText: {
    fontSize: 22,
    color: '#fff',
    textAlign: 'left',
    marginBottom: 0,
    paddingTop: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileImageContainer: {
    position: 'relative',
  },
  largeProfileImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderColor: '#fff',
    borderWidth: 2,
  },
  userInfo: {
    flex: 1,
    marginLeft: 10,
  },
  userName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stats: {
    color: '#fff',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 120,
    marginTop: 10,
  },
  uploadingIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF4500',
  },
  linkText: {
    color: '#1D4ED8',
    textDecorationLine: 'underline',
  },
  createPostContainer: {
    backgroundColor: 'white',
    padding: 10,
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  createPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  postInput: {
    flex: 1,
    marginLeft: 10,
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    textAlignVertical: 'top',
  },
  sendIcon: {
    marginLeft: 10,
  },
  imagePreviewContainer: {
    marginTop: 10,
    position: 'relative',
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    padding: 5,
  },
  addButton: {
    marginTop: 10,
  },
  postContainer: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  postUserInfo: {
    marginLeft: 10,
  },
  postUserName: {
    fontWeight: 'bold',
  },
  postDate: {
    color: 'gray',
    fontSize: 12,
  },
  postContent: {
    color: '#4B5563',
    fontSize: 16,
    marginBottom: 8,
  },
  postImageContainer: {
    marginBottom: 10,
  },
  postImage: {
    width: '100%',
    height: 300,
    borderRadius: 20,
  },
  fullScreenPostImage: {
    width: '100%',
    height: 300,
    borderRadius: 20,
    marginBottom: 10,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  postActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postActionText: {
    marginLeft: 5,
  },
  commentsSection: {
    marginTop: 10,
  },
  viewMoreComments: {
    color: 'gray',
    marginLeft: 50,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  commentInput: {
    flex: 1,
    marginLeft: 10,
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  editModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  editModal: {
    width: '80%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    elevation: 5,
  },
  editInput: {
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
    padding: 10,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  menuButton: {
    marginLeft: 'auto',
  },
  commentContainer: {
    marginBottom: 10,
    padding: 10,
    borderColor: '#E5E7EB',
    borderBottomWidth: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentContent: {
    marginLeft: 10,
    flex: 1,
  },
  commentUserName: {
    fontWeight: 'bold',
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentActionText: {
    marginLeft: 5,
  },
  commentReplyButton: {
    marginLeft: 20,
  },
  replyText: {
    color: 'blue',
  },
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    marginLeft: 50,
  },
  replyInput: {
    flex: 1,
    padding: 5,
    backgroundColor: '#F3F4F6',
    borderRadius: 5,
  },
  sendReplyButton: {
    marginLeft: 5,
  },
  repliesContainer: {
    marginTop: 10,
  },
  viewMoreReplies: {
    marginLeft: 50,
    color: 'gray',
  },
  headerContainer: {
    backgroundColor: '#1D4ED8',
    padding: 20,
    overflow: 'hidden',
  },
  pilotsLoungeText: {
    fontSize: 22,
    color: '#fff',
    textAlign: 'left',
    marginBottom: 0,
    paddingTop: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileImageContainer: {
    position: 'relative',
  },
  largeProfileImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderColor: '#fff',
    borderWidth: 2,
  },
  userInfo: {
    flex: 1,
    marginLeft: 10,
  },
  userName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stats: {
    color: '#fff',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 120,
    marginTop: 10,
  },
  uploadingIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF4500',
  },
  linkText: {
    color: '#1D4ED8',
    textDecorationLine: 'underline',
  },
  createPostContainer: {
    backgroundColor: 'white',
    padding: 10,
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  createPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  postInput: {
    flex: 1,
    marginLeft: 10,
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    textAlignVertical: 'top',
  },
  sendIcon: {
    marginLeft: 10,
  },
  imagePreviewContainer: {
    marginTop: 10,
    position: 'relative',
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    padding: 5,
  },
  addButton: {
    marginTop: 10,
  },
  postContainer: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  postUserInfo: {
    marginLeft: 10,
  },
  postUserName: {
    fontWeight: 'bold',
  },
  postDate: {
    color: 'gray',
    fontSize: 12,
  },
  postContent: {
    color: '#4B5563',
    fontSize: 16,
    marginBottom: 8,
  },
  postImageContainer: {
    marginBottom: 10,
  },
  postImage: {
    width: '100%',
    height: 300,
    borderRadius: 20,
  },
  fullScreenPostImage: {
    width: '100%',
    height: 300,
    borderRadius: 20,
    marginBottom: 10,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  postActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postActionText: {
    marginLeft: 5,
  },
  commentsSection: {
    marginTop: 10,
  },
  viewMoreComments: {
    color: 'gray',
    marginLeft: 50,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  commentInput: {
    flex: 1,
    marginLeft: 10,
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  editModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  editModal: {
    width: '80%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    elevation: 5,
  },
  editInput: {
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
    padding: 10,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  menuButton: {
    marginLeft: 'auto',
  },
  commentContainer: {
    marginBottom: 10,
    padding: 10,
    borderColor: '#E5E7EB',
    borderBottomWidth: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentContent: {
    marginLeft: 10,
    flex: 1,
  },
  commentUserName: {
    fontWeight: 'bold',
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentActionText: {
    marginLeft: 5,
  },
  commentReplyButton: {
    marginLeft: 20,
  },
  replyText: {
    color: 'blue',
  },
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    marginLeft: 50,
  },
  replyInput: {
    flex: 1,
    padding: 5,
    backgroundColor: '#F3F4F6',
    borderRadius: 5,
  },
  sendReplyButton: {
    marginLeft: 5,
  },
  repliesContainer: {
    marginTop: 10,
  },
  viewMoreReplies: {
    marginLeft: 50,
    color: 'gray',
  },
  headerContainer: {
    backgroundColor: '#1D4ED8',
    padding: 20,
    overflow: 'hidden',
  },
  pilotsLoungeText: {
    fontSize: 22,
    color: '#fff',
    textAlign: 'left',
    marginBottom: 0,
    paddingTop: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileImageContainer: {
    position: 'relative',
  },
  largeProfileImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderColor: '#fff',
    borderWidth: 2,
  },
  userInfo: {
    flex: 1,
    marginLeft: 10,
  },
  userName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stats: {
    color: '#fff',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 120,
    marginTop: 10,
  },
  uploadingIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF4500',
  },
  linkText: {
    color: '#1D4ED8',
    textDecorationLine: 'underline',
  },
  createPostContainer: {
    backgroundColor: 'white',
    padding: 10,
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  createPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  postInput: {
    flex: 1,
    marginLeft: 10,
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    textAlignVertical: 'top',
  },
  sendIcon: {
    marginLeft: 10,
  },
  imagePreviewContainer: {
    marginTop: 10,
    position: 'relative',
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    padding: 5,
  },
  addButton: {
    marginTop: 10,
  },
  postContainer: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  postUserInfo: {
    marginLeft: 10,
  },
  postUserName: {
    fontWeight: 'bold',
  },
  postDate: {
    color: 'gray',
    fontSize: 12,
  },
  postContent: {
    color: '#4B5563',
    fontSize: 16,
    marginBottom: 8,
  },
  postImageContainer: {
    marginBottom: 10,
  },
  postImage: {
    width: '100%',
    height: 300,
    borderRadius: 20,
  },
  fullScreenPostImage: {
    width: '100%',
    height: 300,
    borderRadius: 20,
    marginBottom: 10,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  postActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postActionText: {
    marginLeft: 5,
  },
  commentsSection: {
    marginTop: 10,
  },
  viewMoreComments: {
    color: 'gray',
    marginLeft: 50,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  commentInput: {
    flex: 1,
    marginLeft: 10,
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  editModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  editModal: {
    width: '80%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    elevation: 5,
  },
  editInput: {
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
    padding: 10,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  menuButton: {
    marginLeft: 'auto',
  },
  commentContainer: {
    marginBottom: 10,
    padding: 10,
    borderColor: '#E5E7EB',
    borderBottomWidth: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentContent: {
    marginLeft: 10,
    flex: 1,
  },
  commentUserName: {
    fontWeight: 'bold',
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentActionText: {
    marginLeft: 5,
  },
  commentReplyButton: {
    marginLeft: 20,
  },
  replyText: {
    color: 'blue',
  },
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    marginLeft: 50,
  },
  replyInput: {
    flex: 1,
    padding: 5,
    backgroundColor: '#F3F4F6',
    borderRadius: 5,
  },
  sendReplyButton: {
    marginLeft: 5,
  },
  repliesContainer: {
    marginTop: 10,
  },
  viewMoreReplies: {
    marginLeft: 50,
    color: 'gray',
  },
  headerContainer: {
    backgroundColor: '#1D4ED8',
    padding: 20,
    overflow: 'hidden',
  },
  pilotsLoungeText: {
    fontSize: 22,
    color: '#fff',
    textAlign: 'left',
    marginBottom: 0,
    paddingTop: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileImageContainer: {
    position: 'relative',
  },
  largeProfileImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderColor: '#fff',
    borderWidth: 2,
  },
  userInfo: {
    flex: 1,
    marginLeft: 10,
  },
  userName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stats: {
    color: '#fff',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 120,
    marginTop: 10,
  },
  uploadingIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF4500',
  },
  linkText: {
    color: '#1D4ED8',
    textDecorationLine: 'underline',
  },
  createPostContainer: {
    backgroundColor: 'white',
    padding: 10,
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  createPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  postInput: {
    flex: 1,
    marginLeft: 10,
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    textAlignVertical: 'top',
  },
  sendIcon: {
    marginLeft: 10,
  },
  imagePreviewContainer: {
    marginTop: 10,
    position: 'relative',
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  removeImageButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 15,
    padding: 5,
  },
  addButton: {
    marginTop: 10,
  },
  postContainer: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  postUserInfo: {
    marginLeft: 10,
  },
  postUserName: {
    fontWeight: 'bold',
  },
  postDate: {
    color: 'gray',
    fontSize: 12,
  },
  postContent: {
    color: '#4B5563',
    fontSize: 16,
    marginBottom: 8,
  },
  postImageContainer: {
    marginBottom: 10,
  },
  postImage: {
    width: '100%',
    height: 300,
    borderRadius: 20,
  },
  fullScreenPostImage: {
    width: '100%',
    height: 300,
    borderRadius: 20,
    marginBottom: 10,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  postActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postActionText: {
    marginLeft: 5,
  },
  commentsSection: {
    marginTop: 10,
  },
  viewMoreComments: {
    color: 'gray',
    marginLeft: 50,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  commentInput: {
    flex: 1,
    marginLeft: 10,
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  editModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  editModal: {
    width: '80%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    elevation: 5,
  },
  editInput: {
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
    padding: 10,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  menuButton: {
    marginLeft: 'auto',
  },
  commentContainer: {
    marginBottom: 10,
    padding: 10,
    borderColor: '#E5E7EB',
    borderBottomWidth: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentContent: {
    marginLeft: 10,
    flex: 1,
  },
  commentUserName: {
    fontWeight: 'bold',
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentActionText: {
    marginLeft: 5,
  },
  commentReplyButton: {
    marginLeft: 20,
  },
  replyText: {
    color: 'blue',
  },
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    marginLeft: 50,
  },
  replyInput: {
    flex: 1,
    padding: 5,
    backgroundColor: '#F3F4F6',
    borderRadius: 5,
  },
  sendReplyButton: {
    marginLeft: 5,
  },
  repliesContainer: {
    marginTop: 10,
  },
  viewMoreReplies: {
    marginLeft: 50,
    color: 'gray',
  },
  notificationsContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  notificationItem: {
    padding: 15,
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
  },
  notificationDate: {
    color: 'gray',
    fontSize: 12,
  },
  emptyNotifications: {
    textAlign: 'center',
    marginTop: 20,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  fullScreenPost: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButton: {
    alignSelf: 'flex-end',
  },
  fullScreenHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  fullScreenAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  fullScreenUserName: {
    fontWeight: 'bold',
    fontSize: 18,
    marginTop: 8,
  },
  fullScreenDate: {
    color: 'gray',
    fontSize: 12,
  },
  fullScreenImageContainer: {
    marginBottom: 10,
  },
  fullScreenImage: {
    width: '100%',
    height: 300,
    borderRadius: 20,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  postActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postActionText: {
    marginLeft: 5,
  },
  commentsHeader: {
    fontWeight: 'bold',
    marginBottom: 10,
  },
  sendButton: {
    marginLeft: 10,
  },
  mainFeedContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingIndicator: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyPosts: {
    textAlign: 'center',
    marginTop: 20,
  },
  scrollToTopButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: '#1D4ED8',
    borderRadius: 25,
    padding: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  fullScreenProfileContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  fullScreenProfileContent: {
    alignItems: 'center',
    padding: 20,
  },
  fullScreenProfileImage: {
    width: '100%',
    height: 400,
    borderRadius: 10,
  },
  fullScreenProfileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeCount: {
    marginLeft: 5,
    fontSize: 18,
  },
  fullScreenProfileComments: {
    width: '100%',
    marginTop: 20,
  },
  profileComment: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  commentTextContainer: {
    marginLeft: 10,
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderRadius: 10,
    flex: 1,
  },
  profileCommentInput: {
    flex: 1,
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    marginRight: 10,
  },
  fullScreenProfileCommentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  videoContainer: {
    width: '100%',
    height: 300,
    marginVertical: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  imageCarouselContainer: {
    flexDirection: 'row',
    marginVertical: 10,
  },
  imageContainer: {
    marginRight: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  image: {
    width: 150,
    height: 150,
    borderRadius: 10,
  },
});
