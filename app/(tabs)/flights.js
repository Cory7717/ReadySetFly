// Import statements
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  StatusBar,
  Dimensions,
  StyleSheet,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-expo';
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
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebaseConfig';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Appbar, Avatar, Badge, Button } from 'react-native-paper';

// Constants
const DEFAULT_PROFILE_IMAGE = 'https://via.placeholder.com/150'; // Replace with a valid URL

// Stack Navigator
const Stack = createStackNavigator();

// User Header Component
const UserHeader = ({ navigation, user }) => {
  const [profileImage, setProfileImage] = useState(user?.imageUrl || DEFAULT_PROFILE_IMAGE);
  const [uploading, setUploading] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    // Listen to unread notifications
    const q = query(
      collection(db, 'notifications'),
      where('toUserId', '==', user.id),
      where('read', '==', false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadNotifications(snapshot.size);
    });
    return () => unsubscribe();
  }, [user.id]);

  const pickProfileImage = useCallback(async () => {
    try {
      const permissionResult = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        const requestResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!requestResult.granted) {
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

          const filename = `profileImages/${user.id}_${Date.now()}`;
          const storageRef = ref(storage, filename);
          await uploadBytes(storageRef, blob);

          // Close the blob to release memory
          blob.close();

          const imageUrl = await getDownloadURL(storageRef);

          // Update the user's profile image
          await user.update({ imageUrl: imageUrl });

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
    <Appbar.Header style={styles.header}>
      <TouchableOpacity onPress={pickProfileImage}>
        <Avatar.Image size={40} source={{ uri: profileImage }} />
        {uploading && (
          <ActivityIndicator
            size="small"
            color="#fff"
            style={styles.uploadingIndicator}
          />
        )}
      </TouchableOpacity>
      <Appbar.Content
        title="Pilot's Lounge"
        subtitle="Aviation News & Events"
        titleStyle={styles.headerTitle}
        subtitleStyle={styles.headerSubtitle}
      />
      <Appbar.Action
        icon="bell-outline"
        color="#fff"
        onPress={() => navigation.navigate('Notifications')}
      />
      {unreadNotifications > 0 && (
        <Badge style={styles.badge}>{unreadNotifications}</Badge>
      )}
      <Appbar.Action
        icon="message-outline"
        color="#fff"
        onPress={() => Alert.alert('Messages')}
      />
      <Appbar.Action
        icon="cog-outline"
        color="#fff"
        onPress={() => Alert.alert('Settings')}
      />
    </Appbar.Header>
  );
};

// Create Post Component with image fix
const CreatePost = ({ onSubmit }) => {
  const { user } = useUser();
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null); // Single image URI
  const [uploading, setUploading] = useState(false);

  const pickImage = useCallback(async () => {
    try {
      const permissionResult = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        const requestResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!requestResult.granted) {
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
          const blob = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onload = function () {
              resolve(xhr.response);
            };
            xhr.onerror = function () {
              reject(new TypeError('Network request failed'));
            };
            xhr.responseType = 'blob';
            xhr.open('GET', image, true);
            xhr.send(null);
          });

          if (!user.id || !blob) {
            throw new Error('Invalid user ID or image data.');
          }

          const filename = `${user.id}_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          const storageRef = ref(storage, `postImages/${filename}`);
          await uploadBytes(storageRef, blob);

          // Close the blob to release memory
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
        userName: user.fullName,
        profileImage: user.imageUrl,
        createdAt: serverTimestamp(),
        userId: user.id,
        comments: [],
        likes: [],
      };

      try {
        const docRef = await addDoc(collection(db, 'posts'), newPost);
        onSubmit({ ...newPost, id: docRef.id });
        setContent('');
        setImage(null);
      } catch (error) {
        Alert.alert('Error', 'Could not submit post.');
      }
    } else {
      Alert.alert('Error', 'Please enter some text or upload an image.');
    }
  }, [content, image, user, onSubmit]);

  const removeImage = () => {
    setImage(null);
  };

  return (
    <View style={styles.createPostContainer}>
      <View style={styles.createPostHeader}>
        <Image
          source={{ uri: user?.imageUrl || DEFAULT_PROFILE_IMAGE }}
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

// Post Component with image fix
const Post = React.memo(({ post: initialPost, onViewPost }) => {
  const { user } = useUser();
  const [post, setPost] = useState(initialPost);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState(post.comments || []);
  const [likes, setLikes] = useState(post.likes || []);
  const [liked, setLiked] = useState((post.likes || []).includes(user.id));

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'posts', post.id), (docSnap) => {
      if (docSnap.exists()) {
        const updatedPost = { id: docSnap.id, ...docSnap.data() };
        setPost(updatedPost);
        setComments(updatedPost.comments || []);
        setLikes(updatedPost.likes || []);
        setLiked(updatedPost.likes?.includes(user.id));
      }
    });
    return () => unsubscribe();
  }, [post.id, user.id]);

  const handleAddComment = useCallback(async () => {
    if (commentText.trim()) {
      const newComment = {
        userId: user.id,
        userName: user.fullName || 'Anonymous',
        text: commentText,
        userImage: user.imageUrl || DEFAULT_PROFILE_IMAGE,
        likes: [],
        replies: [],
      };
      try {
        const postRef = doc(db, 'posts', post.id);
        await updateDoc(postRef, {
          comments: arrayUnion(newComment),
        });
        setCommentText('');

        if (post.userId !== user.id) {
          await addDoc(collection(db, 'notifications'), {
            toUserId: post.userId,
            fromUserId: user.id,
            fromUserName: user.fullName || 'Anonymous',
            type: 'comment',
            postId: post.id,
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      } catch (error) {
        Alert.alert('Error', 'Could not add comment.');
      }
    }
  }, [commentText, post.id, post.userId, user]);

  const handleLike = useCallback(async () => {
    try {
      const postRef = doc(db, 'posts', post.id);
      if (liked) {
        await updateDoc(postRef, {
          likes: arrayRemove(user.id),
        });
        setLiked(false);
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(user.id),
        });
        setLiked(true);

        if (post.userId !== user.id) {
          await addDoc(collection(db, 'notifications'), {
            toUserId: post.userId,
            fromUserId: user.id,
            fromUserName: user.fullName || 'Anonymous',
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
  }, [liked, post.id, post.userId, user]);

  const handleShare = useCallback(async () => {
    Alert.alert('Share', `Sharing ${post.userName}'s post.`);
    if (post.userId !== user.id) {
      await addDoc(collection(db, 'notifications'), {
        toUserId: post.userId,
        fromUserId: user.id,
        fromUserName: user.fullName || 'Anonymous',
        type: 'share',
        postId: post.id,
        read: false,
        createdAt: serverTimestamp(),
      });
    }
  }, [post.userId, post.userName, user]);

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
    <TouchableOpacity onPress={() => onViewPost(post)}>
      <View style={styles.postContainer}>
        <View style={styles.postHeader}>
          {post?.profileImage ? (
            <Image source={{ uri: post.profileImage }} style={styles.avatar} />
          ) : (
            <Image source={{ uri: DEFAULT_PROFILE_IMAGE }} style={styles.avatar} />
          )}
          <View style={styles.postUserInfo}>
            <Text style={styles.postUserName}>{post?.userName || 'Unknown User'}</Text>
            <Text style={styles.postDate}>{renderDate}</Text>
          </View>
        </View>
        <Text
          numberOfLines={4}
          ellipsizeMode="tail"
          style={styles.postContent}
        >
          {post?.content || ''}
        </Text>
        {post.image && (
          <View style={styles.postImageContainer}>
            <TouchableOpacity onPress={() => onViewPost(post)}>
              <Image
                source={{ uri: post.image }}
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
          >
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={24}
              color={liked ? 'red' : 'gray'}
            />
            <Text style={styles.postActionText}>{likes.length > 0 ? likes.length : ''}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.postActionButton}
            onPress={handleShare}
          >
            <Ionicons name="share-social-outline" size={24} color="gray" />
            <Text style={styles.postActionText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Comments Section */}
        <View style={styles.commentsSection}>
          {comments.slice(0, 3).map((cmt, index) => (
            <Comment
              key={index}
              comment={cmt}
              onLikeComment={() => {}}
              onReplyComment={() => {}}
              userId={user.id}
            />
          ))}
          {comments.length > 3 && (
            <Text style={styles.viewMoreComments}>View more comments...</Text>
          )}
        </View>

        {/* Comment Input */}
        <View style={styles.commentInputContainer}>
          <Image
            source={{ uri: user?.imageUrl || DEFAULT_PROFILE_IMAGE }}
            style={styles.avatar}
          />
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
            <Ionicons
              name="send"
              size={24}
              color="#1D4ED8"
              style={styles.sendIcon}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// Comment Component
const Comment = ({ comment, onLikeComment, onReplyComment, userId }) => {
  const [liked, setLiked] = useState((comment.likes || []).includes(userId));
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');

  const handleLike = () => {
    setLiked(!liked);
    onLikeComment(comment);
  };

  const handleReply = () => {
    setShowReplyInput(!showReplyInput);
  };

  const handleAddReply = () => {
    if (replyText.trim()) {
      onReplyComment(comment, replyText);
      setReplyText('');
      setShowReplyInput(false);
    }
  };

  return (
    <View style={[styles.commentContainer, { marginLeft: (comment.depth || 0) * 20 }]}>
      <View style={styles.commentHeader}>
        <Image
          source={{ uri: comment.userImage || DEFAULT_PROFILE_IMAGE }}
          style={styles.avatar}
        />
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
          {comment.replies.slice(0, 3).map((reply, index) => (
            <Comment
              key={index}
              comment={{ ...reply, depth: (comment.depth || 0) + 1 }}
              onLikeComment={onLikeComment}
              onReplyComment={onReplyComment}
              userId={userId}
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
  const { user } = useUser();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      where('toUserId', '==', user.id),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setNotifications(notifs);
    });
    return () => unsubscribe();
  }, [user.id]);

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
            style={[
              styles.notificationItem,
              { backgroundColor: item.read ? '#fff' : '#E5E7EB' },
            ]}
            onPress={() => {
              markAsRead(item.id);
              navigation.navigate('FullScreenPost', { postId: item.postId });
            }}
          >
            <Text>
              {item.fromUserName}{' '}
              {item.type === 'like'
                ? 'liked'
                : item.type === 'comment'
                ? 'commented on'
                : item.type === 'share'
                ? 'shared'
                : item.type === 'reply'
                ? 'replied to your comment on'
                : ''}{' '}
              your post.
            </Text>
            <Text style={styles.notificationDate}>
              {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : ''}
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

// FullScreen Post modal with image fix
const FullScreenPostModal = ({ post: initialPost, visible, onClose }) => {
  const [post, setPost] = useState(initialPost);
  const [comment, setComment] = useState('');
  const { user } = useUser();

  const [comments, setComments] = useState(post.comments || []);
  const [likes, setLikes] = useState(post.likes || []);
  const [liked, setLiked] = useState((post.likes || []).includes(user.id));

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'posts', post.id), (docSnap) => {
      if (docSnap.exists()) {
        const updatedPost = { id: docSnap.id, ...docSnap.data() };
        setPost(updatedPost);
        setComments(updatedPost.comments || []);
        setLikes(updatedPost.likes || []);
        setLiked(updatedPost.likes?.includes(user.id));
      }
    });
    return () => unsubscribe();
  }, [post.id, user.id]);

  const handleAddComment = useCallback(async () => {
    if (comment.trim()) {
      const newComment = {
        userId: user.id,
        userName: user.fullName || 'Anonymous',
        text: comment,
        userImage: user.imageUrl || DEFAULT_PROFILE_IMAGE,
        likes: [],
        replies: [],
      };
      try {
        const postRef = doc(db, 'posts', post.id);
        await updateDoc(postRef, {
          comments: arrayUnion(newComment),
        });
        setComment('');

        if (post.userId !== user.id) {
          await addDoc(collection(db, 'notifications'), {
            toUserId: post.userId,
            fromUserId: user.id,
            fromUserName: user.fullName || 'Anonymous',
            type: 'comment',
            postId: post.id,
            read: false,
            createdAt: serverTimestamp(),
          });
        }
      } catch (error) {
        Alert.alert('Error', 'Could not add comment.');
      }
    }
  }, [comment, post.id, post.userId, user]);

  const handleLike = useCallback(async () => {
    try {
      const postRef = doc(db, 'posts', post.id);
      if (liked) {
        await updateDoc(postRef, {
          likes: arrayRemove(user.id),
        });
        setLiked(false);
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(user.id),
        });
        setLiked(true);

        if (post.userId !== user.id) {
          await addDoc(collection(db, 'notifications'), {
            toUserId: post.userId,
            fromUserId: user.id,
            fromUserName: user.fullName || 'Anonymous',
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
  }, [liked, post.id, post.userId, user]);

  return (
    <Modal visible={visible} transparent={false}>
      <SafeAreaView style={styles.fullScreenContainer}>
        <ScrollView style={{ flex: 1 }}>
          <View style={styles.fullScreenPost}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close-outline" size={30} color="black" />
            </TouchableOpacity>
            <View style={styles.fullScreenHeader}>
              <Image
                source={{ uri: post?.profileImage || DEFAULT_PROFILE_IMAGE }}
                style={styles.fullScreenAvatar}
              />
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
                <Image
                  source={{ uri: post.image }}
                  style={styles.fullScreenImage}
                  resizeMode="cover"
                />
              </View>
            )}
            <View style={styles.postActions}>
              <TouchableOpacity
                style={styles.postActionButton}
                onPress={handleLike}
              >
                <Ionicons
                  name={liked ? 'heart' : 'heart-outline'}
                  size={24}
                  color={liked ? 'red' : 'gray'}
                />
                <Text style={styles.postActionText}>{likes.length > 0 ? likes.length : ''}</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 20 }}>
              <Text style={styles.commentsHeader}>Comments</Text>
              {comments.map((cmt, index) => (
                <Comment
                  key={index}
                  comment={cmt}
                  onLikeComment={() => {}}
                  onReplyComment={() => {}}
                  userId={user.id}
                />
              ))}
            </View>
          </View>
        </ScrollView>
        <View style={styles.commentInputContainer}>
          <TextInput
            placeholder="Add a comment..."
            value={comment}
            onChangeText={setComment}
            style={styles.commentInput}
          />
          <TouchableOpacity onPress={handleAddComment} style={styles.sendButton}>
            <Ionicons name="send" size={24} color="#1D4ED8" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// FullScreen Post component
const FullScreenPost = ({ route, navigation }) => {
  const { post, postId } = route.params;
  const [currentPost, setCurrentPost] = useState(post);

  useEffect(() => {
    if (!post && postId) {
      const unsubscribe = onSnapshot(doc(db, 'posts', postId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCurrentPost({ id: docSnap.id, ...data });
        } else {
          Alert.alert('Error', 'Post not found.');
          navigation.goBack();
        }
      });
      return () => unsubscribe();
    }
  }, [post, postId, navigation]);

  if (!currentPost) {
    return (
      <ActivityIndicator
        size="large"
        color="#1D4ED8"
        style={styles.loadingIndicator}
      />
    );
  }

  return (
    <FullScreenPostModal
      post={currentPost}
      visible={true}
      onClose={() => navigation.goBack()}
    />
  );
};

// Main Feed Component
const MainFeed = ({ navigation }) => {
  const { user } = useUser();
  const [posts, setPosts] = useState([]);
  const [lastVisible, setLastVisible] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
            return { id: doc.id, ...data };
          });
          setPosts((prevPosts) =>
            loadMore ? [...prevPosts, ...newPosts] : newPosts
          );
          setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        }
      } catch (error) {
        Alert.alert('Error', 'Could not fetch posts.');
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

  const handleNewPost = (newPost) => {
    setPosts([newPost, ...posts]);
  };

  return (
    <SafeAreaView style={styles.mainFeedContainer}>
      <UserHeader navigation={navigation} user={user} />
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<CreatePost onSubmit={handleNewPost} />}
        renderItem={({ item }) => (
          <Post key={item.id} post={item} onViewPost={handleViewPost} />
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
          component={FullScreenPost}
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
  header: {
    backgroundColor: '#1D4ED8',
  },
  headerTitle: {
    color: '#fff',
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#fff',
  },
  uploadingIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 70,
  },
  createPostContainer: {
    backgroundColor: 'white',
    padding: 10,
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
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
    backgroundColor: 'white',
    margin: 10,
    padding: 10,
    borderRadius: 20,
    shadowOpacity: 0.5,
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
  },
  commentInput: {
    flex: 1,
    marginLeft: 10,
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
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
    backgroundColor: 'white',
  },
  loadingIndicator: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyPosts: {
    textAlign: 'center',
    marginTop: 20,
  },
});
