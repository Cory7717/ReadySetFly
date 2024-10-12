// app/(tabs)/flights.js

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Avatar, Badge, Button } from 'react-native-paper';
import FullScreenProfileImageModal from '../components/FullScreenProfileImageModal'; // Ensure this path is correct

// Constants
const DEFAULT_PROFILE_IMAGE = 'https://via.placeholder.com/150';

// Stack Navigator
const Stack = createStackNavigator();

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

// FeedHeader Component combining UserHeader and CreatePost
const FeedHeader = ({ navigation, headerTranslateY, onProfileImagePress }) => {
  return (
    <Animated.View style={{ transform: [{ translateY: headerTranslateY }] }}>
      <UserHeader navigation={navigation} onProfileImagePress={onProfileImagePress} />
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
    try {
      const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        const { status: requestStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (requestStatus !== 'granted') {
          Alert.alert('Permission Required', 'Permission to access the media library is required!');
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

          const filename = `profileImages/${user.uid}/${user.uid}_${Date.now()}`;
          const storageRef = ref(storage, filename);
          await uploadBytes(storageRef, blob);

          const imageUrl = await getDownloadURL(storageRef);
          await updateDoc(doc(db, 'users', user.uid), { image: imageUrl });
          setProfileImage(imageUrl);

          // Update auth.currentUser.photoURL
          await updateProfile(auth.currentUser, { photoURL: imageUrl });
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
          onPress={() => onProfileImagePress(user.uid)}
          style={styles.profileImageContainer}
        >
          <Avatar.Image size={70} source={{ uri: profileImage }} style={styles.largeProfileImage} />
          {uploading && (
            <ActivityIndicator size="small" color="#fff" style={styles.uploadingIndicator} />
          )}
        </TouchableOpacity>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.displayName || 'Pilot Name'}</Text>
          <Text style={styles.stats}>
            {unreadNotifications} Notifications | {user?.posts || 0} Posts
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications-outline" size={30} color="#fff" />
          {unreadNotifications > 0 && <Badge style={styles.badge}>{unreadNotifications}</Badge>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Alert.alert('Messages')}>
          <Ionicons name="chatbubbles-outline" size={30} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Alert.alert('Settings')}>
          <Ionicons name="settings-outline" size={30} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
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

// Utility function to generate a unique ID
const generateUniqueId = () => {
  return `${auth.currentUser.uid}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
        const { status: requestStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (requestStatus !== 'granted') {
          Alert.alert('Permission Required', 'Permission to access the media library is required!');
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
        userName: user.displayName || 'Anonymous',
        // Removed profileImage field to fetch dynamically
        createdAt: serverTimestamp(),
        userId: user.uid,
        comments: [],
        likes: [],
      };

      try {
        const docRef = await addDoc(collection(db, 'posts'), newPost);
        // Optionally, you can emit an event or use a state management library to notify MainFeed
        // For simplicity, it's omitted here
        setContent('');
        setImage(null);
      } catch (error) {
        Alert.alert('Error', 'Could not submit post.');
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
          value={content}
          onChangeText={setContent}
          multiline
          style={styles.postInput}
        />
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={uploading || (!content.trim() && !image)}
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
          <TouchableOpacity onPress={removeImage} style={styles.removeImageButton}>
            <Ionicons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      <Button
        mode="outlined"
        icon="image-outline"
        onPress={pickImage}
        style={styles.addButton}
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

// Post Component with image handling, comments, edit, and delete functionality
const Post = React.memo(({ post: initialPost, onViewPost, onProfileImagePress }) => {
  const [post, setPost] = useState(initialPost);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState(post.comments || []);
  const [likes, setLikes] = useState(post.likes || []);
  const [liked, setLiked] = useState((post.likes || []).includes(auth.currentUser.uid));
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editText, setEditText] = useState(post.content);

  // Fetch the latest user profile
  const userProfile = useUserProfile(post.userId);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'posts', post.id), (docSnap) => {
      if (docSnap.exists()) {
        const updatedPost = { id: docSnap.id, ...docSnap.data() };
        setPost(updatedPost);
        setComments(updatedPost.comments || []);
        setLikes(updatedPost.likes || []);
        setLiked(updatedPost.likes?.includes(auth.currentUser.uid));
      }
    });
    return () => unsubscribe();
  }, [post.id]);

  const handleEdit = async () => {
    try {
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        content: editText,
      });
      setEditModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Could not update post.');
    }
  };

  const handleDelete = async () => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this post?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'posts', post.id));
          } catch (error) {
            Alert.alert('Error', 'Could not delete post.');
          }
        },
      },
    ]);
  };

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
    }
  }, [liked, post.id, post.userId]);

  const handleShare = useCallback(async () => {
    Alert.alert('Share', `Sharing ${post.userName}'s post.`);
    if (post.userId !== auth.currentUser.uid) {
      await addDoc(collection(db, 'notifications'), {
        toUserId: post.userId,
        fromUserId: auth.currentUser.uid,
        fromUserName: auth.currentUser.displayName || 'Anonymous',
        type: 'share',
        postId: post.id,
        read: false,
        createdAt: serverTimestamp(),
      });
    }
  }, [post.userId, post.userName]);

  const renderDate = useMemo(() => {
    if (post.createdAt) {
      if (post.createdAt.toDate) {
        return new Date(post.createdAt.toDate()).toLocaleDateString();
      } else if (post.createdAt instanceof Date) {
        return post.createdAt.toLocaleDateString();
      }
    }
    return 'Unknown Date';
  }, [post.createdAt]);

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
      };
      try {
        const postRef = doc(db, 'posts', post.id);
        await updateDoc(postRef, {
          comments: arrayUnion(newComment),
        });
        setCommentText('');

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
      }
    }
  }, [commentText, post.id, post.userId]);

  // Function to handle liking/unliking a comment
  const handleLikeComment = useCallback(async (commentId, commentAuthorId) => {
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
      const updatedComment = updatedComments.find((cmt) => cmt.id === commentId);

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
  }, [comments, post.id]);

  return (
    <TouchableOpacity onPress={() => onViewPost(post)}>
      <View style={styles.postContainer}>
        <View style={styles.postHeader}>
          <TouchableOpacity onPress={() => onProfileImagePress(post.userId)}>
            {userProfile ? (
              <Image source={{ uri: userProfile.image || DEFAULT_PROFILE_IMAGE }} style={styles.avatar} />
            ) : (
              <Image source={{ uri: DEFAULT_PROFILE_IMAGE }} style={styles.avatar} />
            )}
          </TouchableOpacity>
          <View style={styles.postUserInfo}>
            <Text style={styles.postUserName}>{post?.userName || 'Unknown User'}</Text>
            <Text style={styles.postDate}>{renderDate}</Text>
          </View>
          {post.userId === auth.currentUser.uid && (
            <TouchableOpacity
              onPress={() => setEditModalVisible(true)}
              style={styles.menuButton}
            >
              <Ionicons name="ellipsis-vertical" size={24} color="gray" />
            </TouchableOpacity>
          )}
        </View>
        <Text numberOfLines={4} ellipsizeMode="tail" style={styles.postContent}>
          {handleTextWithLinks(post?.content || '')}
        </Text>
        {post.image && (
          <View style={styles.postImageContainer}>
            <TouchableOpacity onPress={() => onViewPost(post)}>
              <Image source={{ uri: post.image }} style={styles.postImage} resizeMode="cover" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.postActions}>
          <TouchableOpacity style={styles.postActionButton} onPress={handleLike}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={24}
              color={liked ? 'red' : 'gray'}
            />
            <Text style={styles.postActionText}>{likes.length > 0 ? likes.length : ''}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.postActionButton} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={24} color="gray" />
            <Text style={styles.postActionText}>Share</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.commentsSection}>
          {comments.slice(0, 3).map((cmt) => (
            <Comment
              key={cmt.id} // Ensure 'id' exists and is unique
              comment={cmt}
              postId={post.id} // Pass 'postId' to Comment
              onLikeComment={handleLikeComment}
              onReplyComment={() => {}} // Implement reply functionality as needed
              userId={auth.currentUser.uid}
              onProfileImagePress={onProfileImagePress} // Pass the handler to Comment
            />
          ))}
          {comments.length > 3 && (
            <Text style={styles.viewMoreComments}>View more comments...</Text>
          )}
        </View>

        <View style={styles.commentInputContainer}>
          <TouchableOpacity onPress={() => onProfileImagePress(auth.currentUser.uid)}>
            <Image
              source={{ uri: auth.currentUser?.photoURL || DEFAULT_PROFILE_IMAGE }}
              style={styles.avatar}
            />
          </TouchableOpacity>
          <TextInput
            placeholder="Add a comment..."
            value={commentText}
            onChangeText={setCommentText}
            style={styles.commentInput}
          />
          <TouchableOpacity
            onPress={handleAddComment}
            disabled={!commentText.trim()}
          >
            <Ionicons name="send" size={24} color="#1D4ED8" style={styles.sendIcon} />
          </TouchableOpacity>
        </View>

        <Modal visible={editModalVisible} transparent={true}>
          <View style={styles.editModalContainer}>
            <View style={styles.editModal}>
              <TextInput
                style={styles.editInput}
                value={editText}
                onChangeText={setEditText}
                multiline
              />
              <View style={styles.modalButtons}>
                <Button onPress={handleEdit}>Save</Button>
                <Button onPress={() => setEditModalVisible(false)}>Cancel</Button>
                <Button onPress={handleDelete} color="red">Delete</Button>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </TouchableOpacity>
  );
});

Post.displayName = "Post";

// Comment Component
const Comment = ({ comment, onLikeComment, onReplyComment, userId, postId, onProfileImagePress }) => {
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

  const handleAddReply = useCallback(async () => {
    if (replyText.trim()) {
      const newReply = {
        id: generateUniqueId(), // Unique ID
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Anonymous',
        text: replyText.trim(),
        likes: [],
        replies: [],
      };
      try {
        const postRef = doc(db, 'posts', postId); // Reference to the post
        const postSnap = await getDoc(postRef);
        if (postSnap.exists()) {
          const postData = postSnap.data();
          const updatedComments = postData.comments.map((cmt) => {
            if (cmt.id === comment.id) {
              return {
                ...cmt,
                replies: [...(cmt.replies || []), newReply],
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
        console.log('Add Reply Error:', error); // Enhanced error logging
        Alert.alert('Error', 'Could not add reply.');
      }
    }
  }, [replyText, postId, comment.id, comment.userId]);

  return (
    <View style={[styles.commentContainer, { marginLeft: (comment.depth || 0) * 20 }]}>
      <View style={styles.commentHeader}>
        <TouchableOpacity onPress={() => onProfileImagePress(comment.userId)}>
          {userProfile ? (
            <Image source={{ uri: userProfile.image || DEFAULT_PROFILE_IMAGE }} style={styles.avatar} />
          ) : (
            <Image source={{ uri: DEFAULT_PROFILE_IMAGE }} style={styles.avatar} />
          )}
        </TouchableOpacity>
        <View style={styles.commentContent}>
          <Text style={styles.commentUserName}>{comment.userName}</Text>
          <Text>{comment.text}</Text>
          <View style={styles.commentActions}>
            <TouchableOpacity onPress={handleLike} style={styles.commentActionButton}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={16}
                color={liked ? 'red' : 'gray'}
              />
              <Text style={styles.commentActionText}>{(comment.likes || []).length}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleReply} style={styles.commentReplyButton}>
              <Text style={styles.replyText}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {showReplyInput && (
        <View style={styles.replyInputContainer}>
          <TextInput
            placeholder="Write a reply..."
            value={replyText}
            onChangeText={setReplyText}
            style={styles.replyInput}
          />
          <TouchableOpacity
            onPress={handleAddReply}
            disabled={!replyText.trim()}
            style={styles.sendReplyButton}
          >
            <Ionicons name="send" size={20} color="#1D4ED8" />
          </TouchableOpacity>
        </View>
      )}
      {comment.replies && comment.replies.length > 0 && (
        <View style={styles.repliesContainer}>
          {comment.replies.slice(0, 3).map((reply) => (
            <Comment
              key={reply.id} // Ensure 'id' exists and is unique
              comment={reply}
              postId={postId} // Pass 'postId' to nested Comment
              onLikeComment={onLikeComment}
              onReplyComment={onReplyComment}
              userId={userId}
              onProfileImagePress={onProfileImagePress} // Pass the handler to nested Comment
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

// Notifications Component
const Notifications = ({ navigation }) => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
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
    }
  };

  return (
    <SafeAreaView style={styles.notificationsContainer}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.notificationItem, { backgroundColor: item.read ? '#fff' : '#E5E7EB' }]}
            onPress={() => {
              markAsRead(item.id);
              navigation.navigate('FullScreenPost', { postId: item.postId });
            }}
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
              {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : ''}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyNotifications}>No notifications.</Text>}
      />
    </SafeAreaView>
  );
};

// FullScreenPostModal Component
const FullScreenPostModal = ({ post: initialPost, visible, onClose }) => {
  const [post, setPost] = useState(initialPost);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState(post.comments || []);
  const [likes, setLikes] = useState(post.likes || []);
  const [liked, setLiked] = useState((post.likes || []).includes(auth.currentUser.uid));
  const [image, setImage] = useState(null); // Assuming image handling is needed
  const [uploading, setUploading] = useState(false);

  // State for Nested FullScreenProfileImageModal
  const [profileImageModalVisible, setProfileImageModalVisible] = useState(false);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState(null);

  // Fetch the latest user profile
  const userProfile = useUserProfile(post.userId);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'posts', post.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Process comments and replies to ensure unique 'id's
        const processedComments = (data.comments || []).map((cmt) => ({
          ...cmt,
          id: cmt.id || generateUniqueId(),
          replies: (cmt.replies || []).map((reply) => ({
            ...reply,
            id: reply.id || generateUniqueId(),
          })),
        }));
        const updatedPost = { id: docSnap.id, ...data, comments: processedComments };
        setPost(updatedPost);
        setComments(updatedPost.comments || []);
        setLikes(updatedPost.likes || []);
        setLiked(updatedPost.likes?.includes(auth.currentUser.uid));
      }
    });
    return () => unsubscribe();
  }, [post.id]);

  const handleAddComment = useCallback(async () => {
    if (comment.trim()) {
      const newComment = {
        id: generateUniqueId(), // Unique ID
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Anonymous',
        text: comment.trim(),
        likes: [],
        replies: [],
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
      }
    }
  }, [comment, post.id, post.userId]);

  const handleLikeComment = useCallback(async (commentId, commentAuthorId) => {
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
      const updatedComment = updatedComments.find((cmt) => cmt.id === commentId);

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
  }, [comments, post.id]);

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
    }
  }, [liked, post.id, post.userId]);

  const handleShare = useCallback(async () => {
    Alert.alert('Share', `Sharing ${post.userName}'s post.`);
    if (post.userId !== auth.currentUser.uid) {
      await addDoc(collection(db, 'notifications'), {
        toUserId: post.userId,
        fromUserId: auth.currentUser.uid,
        fromUserName: auth.currentUser.displayName || 'Anonymous',
        type: 'share',
        postId: post.id,
        read: false,
        createdAt: serverTimestamp(),
      });
    }
  }, [post.userId, post.userName]);

  const renderDate = useMemo(() => {
    if (post.createdAt) {
      if (post.createdAt.toDate) {
        return new Date(post.createdAt.toDate()).toLocaleDateString();
      } else if (post.createdAt instanceof Date) {
        return post.createdAt.toLocaleDateString();
      }
    }
    return 'Unknown Date';
  }, [post.createdAt]);

  return (
    <FullScreenProfileImageModal
      visible={profileImageModalVisible}
      onClose={() => setProfileImageModalVisible(false)}
      userId={selectedProfileUserId}
    />
  );
};

// MainFeed Component with updated image handling in posts and header visibility
const MainFeed = ({ navigation }) => {
  const [posts, setPosts] = useState([]);
  const [lastVisible, setLastVisible] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const headerTranslateY = useRef(new Animated.Value(0)).current; // Animated value for header translation
  const previousScrollY = useRef(0); // To keep track of previous scroll position
  const flatListRef = useRef(null); // Ref for FlatList
  const [showScrollToTop, setShowScrollToTop] = useState(false); // State for Scroll to Top button visibility

  // State for Profile Image Modal
  const [profileImageModalVisible, setProfileImageModalVisible] = useState(false);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState(null);

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
            // Ensure all comments have unique 'id's and their replies as well
            const processedComments = (data.comments || []).map((cmt) => ({
              ...cmt,
              id: cmt.id || generateUniqueId(),
              replies: (cmt.replies || []).map((reply) => ({
                ...reply,
                id: reply.id || generateUniqueId(),
              })),
            }));
            return { id: doc.id, ...data, comments: processedComments };
          });
          setPosts((prevPosts) =>
            loadMore ? [...prevPosts, ...newPosts] : newPosts
          );
          setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        }
      } catch (error) {
        Alert.alert('Error', 'Could not fetch posts.');
        console.log(error);
      }
      setLoading(false);
    },
    [lastVisible]
  );

  const handleLoadMore = () => {
    if (!loading) {
      fetchPosts(true);
    }
  };

  const handleViewPost = (post) => {
    navigation.navigate('FullScreenPost', { post });
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts().then(() => setRefreshing(false));
  };

  const handleScroll = (event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const diff = currentScrollY - previousScrollY.current;

    // Show or hide the Scroll to Top button based on scroll position
    if (currentScrollY > 300 && !showScrollToTop) { // Threshold can be adjusted
      setShowScrollToTop(true);
    } else if (currentScrollY <= 300 && showScrollToTop) {
      setShowScrollToTop(false);
    }

    if (diff > 0 && currentScrollY > 50) { // Scrolling down
      Animated.timing(headerTranslateY, {
        toValue: -160, // Header height to hide
        duration: 50, // Instant hide
        useNativeDriver: true,
      }).start();
    } else if (diff < 0) { // Scrolling up
      Animated.timing(headerTranslateY, {
        toValue: 0, // Show header
        duration: 50, // Instant show
        useNativeDriver: true,
      }).start();
    }

    previousScrollY.current = currentScrollY;
  };

  // Function to handle profile image press
  const handleProfileImagePress = (userId) => {
    setSelectedProfileUserId(userId);
    setProfileImageModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.mainFeedContainer}>
      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={posts}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <FeedHeader
              navigation={navigation}
              headerTranslateY={headerTranslateY}
              onProfileImagePress={handleProfileImagePress}
            />
          }
          renderItem={({ item }) => (
            <Post
              key={item.id}
              post={item}
              onViewPost={handleViewPost}
              onProfileImagePress={handleProfileImagePress}
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
            !loading && <Text style={styles.emptyPosts}>No posts available.</Text>
          }
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />
        {showScrollToTop && (
          <TouchableOpacity
            style={styles.scrollToTopButton}
            onPress={() => flatListRef.current.scrollToOffset({ offset: 0, animated: true })}
          >
            <Ionicons name="arrow-up" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
      {/* FullScreenProfileImageModal */}
      <FullScreenProfileImageModal
        visible={profileImageModalVisible}
        onClose={() => setProfileImageModalVisible(false)}
        userId={selectedProfileUserId}
      />
    </SafeAreaView>
  );
};

// Root App Component
export default function App() {
  return (
    <NavigationContainer independent={true}>
      <Stack.Navigator initialRouteName="MainFeed">
        <Stack.Screen
          name="MainFeed"
          component={MainFeed}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="FullScreenPost"
          component={FullScreenPost} // Ensure FullScreenPost is properly implemented
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Notifications"
          component={Notifications}
          options={{ title: 'Notifications' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Stylesheet
const styles = StyleSheet.create({
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
});
