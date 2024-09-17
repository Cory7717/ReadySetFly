// Import statements
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, Feather } from '@expo/vector-icons';
import { styled } from 'nativewind';
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

// Constants
const DEFAULT_PROFILE_IMAGE = 'https://via.placeholder.com/150'; // Replace with a valid URL

// Styled components with modern design
const Container = styled(View, 'flex-1 bg-white');
const HeaderContainer = styled(SafeAreaView, 'bg-white border border-gray-200 rounded-md shadow-lg m-2');
const Header = styled(View, 'p-2 flex-row items-center justify-between');
const ProfileImage = styled(Image, 'w-10 h-10 rounded-full');
const PostContainer = styled(View, 'bg-white mb-4 rounded-2xl shadow-md border border-gray-100 p-4');
const PostActions = styled(View, 'flex-row justify-around mt-2 border-t border-gray-200 pt-2');
const ActionButton = styled(TouchableOpacity, 'flex-row items-center justify-center flex-1');
const ActionText = styled(Text, 'ml-1 text-gray-600');
const UserName = styled(Text, 'text-base font-semibold text-gray-900');
const PostContent = styled(Text, 'text-base text-gray-800 mb-2');
const CommentInput = styled(TextInput, 'flex-1 p-2 bg-gray-100 rounded-full');

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

  const pickProfileImage = async () => {
    // Ask for permission to access media library
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access the camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      const selectedImage = result.assets[0].uri;

      // Upload the image to Firebase Storage
      setUploading(true);
      try {
        // Convert image to blob
        const response = await fetch(selectedImage);
        const blob = await response.blob();

        const filename = `profileImages/${user.id}_${Date.now()}`;
        const storageRef = ref(storage, filename);
        await uploadBytes(storageRef, blob);

        const imageUrl = await getDownloadURL(storageRef);

        // Update the user's profile image
        // Note: Update this according to how you handle user profiles
        await user.update({ imageUrl: imageUrl });

        // Update state
        setProfileImage(imageUrl);
      } catch (error) {
        console.log(error);
        Alert.alert('Error', 'Could not update profile image.');
      }
      setUploading(false);
    }
  };

  return (
    <HeaderContainer>
      <StatusBar hidden />
      <Header>
        <TouchableOpacity onPress={pickProfileImage}>
          <ProfileImage source={{ uri: profileImage }} />
          {uploading && (
            <ActivityIndicator
              size="small"
              color="#1D4ED8"
              style={{ position: 'absolute', top: '40%', left: '40%' }}
            />
          )}
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ textAlign: 'center', fontSize: 24, fontWeight: 'bold', color: '#1D4ED8' }}>
            Pilot's Lounge
          </Text>
          <Text style={{ textAlign: 'center', fontSize: 14, color: '#6B7280', marginTop: 4 }}>
            Your home for all Aviation News and Events
          </Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={24} color="#1D4ED8" style={{ marginHorizontal: 5 }} />
            {unreadNotifications > 0 && (
              <View
                style={{
                  position: 'absolute',
                  right: -5,
                  top: -5,
                  backgroundColor: 'red',
                  borderRadius: 10,
                  width: 20,
                  height: 20,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: 'white', fontSize: 12 }}>{unreadNotifications}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert('Messages')}>
            <Ionicons name="chatbubble-ellipses-outline" size={24} color="#1D4ED8" style={{ marginHorizontal: 5 }} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert('Settings')}>
            <Ionicons name="settings-outline" size={24} color="#1D4ED8" style={{ marginHorizontal: 5 }} />
          </TouchableOpacity>
        </View>
      </Header>
    </HeaderContainer>
  );
};

// Create Post Component (Updated)
const CreatePost = ({ onSubmit }) => {
  const { user } = useUser();
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null); // Single image URI
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access the camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      const selectedImage = result.assets[0].uri;
      setImage(selectedImage);
    }
  };

  const handleSubmit = async () => {
    if (content.trim() || image) {
      let imageUrl = null;

      if (image) {
        setUploading(true);
        try {
          // Convert image to blob using fetch
          const response = await fetch(image);
          const blob = await response.blob();

          const filename = `${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const storageRef = ref(storage, `postImages/${filename}`);
          await uploadBytes(storageRef, blob);

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
        // Creating new post
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
  };

  const removeImage = () => {
    setImage(null);
  };

  return (
    <View
      style={{
        backgroundColor: 'white',
        padding: 10,
        borderBottomColor: '#E5E7EB',
        borderBottomWidth: 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <ProfileImage source={{ uri: user?.imageUrl || DEFAULT_PROFILE_IMAGE }} />
        <TextInput
          placeholder="What's on your mind?"
          value={content}
          onChangeText={setContent}
          multiline
          style={{
            flex: 1,
            marginLeft: 10,
            padding: 10,
            backgroundColor: '#F3F4F6',
            borderRadius: 20,
            textAlignVertical: 'top',
          }}
        />
        <TouchableOpacity onPress={handleSubmit} disabled={uploading || (!content.trim() && !image)}>
          <Ionicons name="send" size={24} color="#1D4ED8" style={{ marginLeft: 10 }} />
        </TouchableOpacity>
      </View>
      {image && (
        <View style={{ marginTop: 10, position: 'relative' }}>
          <Image
            source={{ uri: image }}
            style={{ width: 100, height: 100, borderRadius: 10 }}
          />
          <TouchableOpacity
            onPress={removeImage}
            style={{
              position: 'absolute',
              top: 5,
              right: 5,
              backgroundColor: 'rgba(0,0,0,0.5)',
              borderRadius: 15,
              padding: 5,
            }}
          >
            <Ionicons name="close" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
      <TouchableOpacity
        onPress={pickImage}
        style={{
          padding: 10,
          backgroundColor: '#E5E7EB',
          borderRadius: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 10,
        }}
      >
        <Ionicons name="image-outline" size={24} color="gray" />
        <Text style={{ color: 'gray', marginLeft: 10 }}>Add Photo</Text>
      </TouchableOpacity>
      {uploading && <ActivityIndicator size="large" color="#1D4ED8" style={{ marginTop: 10 }} />}
    </View>
  );
};

// Post card component with likes and comments
const Post = ({ post, onDelete, onEdit, onViewPost, onShare }) => {
  const { user } = useUser();
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState(post.comments || []);
  const [likes, setLikes] = useState(post.likes || []);
  const [liked, setLiked] = useState((post.likes || []).includes(user.id));

  useEffect(() => {
    // Real-time updates for comments and likes
    const unsubscribe = onSnapshot(doc(db, 'posts', post.id), (docSnap) => {
      if (docSnap.exists()) {
        const updatedPost = docSnap.data();
        setComments(updatedPost.comments || []);
        setLikes(updatedPost.likes || []);
        setLiked(updatedPost.likes?.includes(user.id));
      }
    });
    return () => unsubscribe();
  }, [post.id, user.id]);

  const handleAddComment = async () => {
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

        // Send notification to post owner
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
  };

  const handleLike = async () => {
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

        // Send notification to post owner
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
  };

  const handleShare = async () => {
    Alert.alert('Share', `Sharing ${post.userName}'s post.`);
    // Send notification to post owner
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
  };

  const renderDate = () => {
    if (post.createdAt) {
      if (post.createdAt.toDate) {
        return new Date(post.createdAt.toDate()).toLocaleDateString();
      } else if (post.createdAt instanceof Date) {
        return post.createdAt.toLocaleDateString();
      }
    }
    return 'Unknown Date'; // Fallback if the date is missing or not valid
  };

  const handleLikeComment = async (targetComment) => {
    try {
      // Recursive function to update the likes in the comment tree
      const updateLikes = (commentsArray) => {
        return commentsArray.map((cmt) => {
          if (cmt === targetComment) {
            const alreadyLiked = (cmt.likes || []).includes(user.id);
            const updatedLikes = alreadyLiked
              ? cmt.likes.filter((id) => id !== user.id)
              : [...(cmt.likes || []), user.id];
            return { ...cmt, likes: updatedLikes };
          } else if (cmt.replies && cmt.replies.length > 0) {
            return { ...cmt, replies: updateLikes(cmt.replies) };
          } else {
            return cmt;
          }
        });
      };

      const updatedComments = updateLikes(comments);
      setComments(updatedComments);

      // Update in Firestore
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        comments: updatedComments,
      });
    } catch (error) {
      Alert.alert('Error', 'Could not update comment like.');
    }
  };

  const handleReplyComment = async (parentComment, replyText) => {
    try {
      const newReply = {
        userId: user.id,
        userName: user.fullName || 'Anonymous',
        text: replyText,
        userImage: user.imageUrl || DEFAULT_PROFILE_IMAGE,
        likes: [],
        replies: [],
      };

      // Recursive function to add the reply to the correct comment
      const addReply = (commentsArray) => {
        return commentsArray.map((cmt) => {
          if (cmt === parentComment) {
            const updatedReplies = cmt.replies ? [...cmt.replies, newReply] : [newReply];
            return { ...cmt, replies: updatedReplies };
          } else if (cmt.replies && cmt.replies.length > 0) {
            return { ...cmt, replies: addReply(cmt.replies) };
          } else {
            return cmt;
          }
        });
      };

      const updatedComments = addReply(comments);
      setComments(updatedComments);

      // Update in Firestore
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        comments: updatedComments,
      });

      // Send notification to the comment owner
      if (parentComment.userId !== user.id) {
        await addDoc(collection(db, 'notifications'), {
          toUserId: parentComment.userId,
          fromUserId: user.id,
          fromUserName: user.fullName || 'Anonymous',
          type: 'reply',
          postId: post.id,
          read: false,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Could not add reply.');
    }
  };

  return (
    <TouchableOpacity onPress={() => onViewPost(post)}>
      <PostContainer>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          {post?.profileImage ? (
            <ProfileImage source={{ uri: post.profileImage }} />
          ) : (
            <ProfileImage source={{ uri: DEFAULT_PROFILE_IMAGE }} />
          )}
          <View style={{ marginLeft: 10 }}>
            <UserName>{post?.userName || 'Unknown User'}</UserName>
            <Text style={{ color: 'gray', fontSize: 12 }}>{renderDate()}</Text>
          </View>
          {user?.id === post?.userId && (
            <TouchableOpacity onPress={() => setOptionsVisible(true)} style={{ marginLeft: 'auto' }}>
              <Feather name="more-vertical" size={24} color="gray" />
            </TouchableOpacity>
          )}
        </View>
        <PostContent>{post?.content || ''}</PostContent>

        {post.image && (
          <View style={{ marginBottom: 10 }}>
            <TouchableOpacity onPress={() => onViewPost(post)}>
              <Image
                source={{ uri: post.image }}
                style={{ width: '100%', height: 300, borderRadius: 20 }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          </View>
        )}

        <PostActions>
          <ActionButton onPress={handleLike}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={24} color={liked ? 'red' : 'gray'} />
            <ActionText>{likes.length > 0 ? likes.length : ''}</ActionText>
          </ActionButton>
          <ActionButton onPress={handleShare}>
            <Ionicons name="share-social-outline" size={24} color="gray" />
            <ActionText>Share</ActionText>
          </ActionButton>
        </PostActions>

        {/* Comments Section */}
        <View style={{ marginTop: 10 }}>
          {comments.slice(0, 3).map((cmt, index) => (
            <Comment
              key={index}
              comment={cmt}
              onLikeComment={handleLikeComment}
              onReplyComment={handleReplyComment}
              userId={user.id}
            />
          ))}
          {comments.length > 3 && (
            <Text style={{ color: 'gray', marginLeft: 50 }}>View more comments...</Text>
          )}
        </View>

        {/* Comment Input */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
          <ProfileImage source={{ uri: user?.imageUrl || DEFAULT_PROFILE_IMAGE }} />
          <TextInput
            placeholder="Add a comment..."
            value={commentText}
            onChangeText={setCommentText}
            style={{
              flex: 1,
              marginLeft: 10,
              padding: 10,
              backgroundColor: '#F3F4F6',
              borderRadius: 20,
            }}
          />
          <TouchableOpacity onPress={handleAddComment} disabled={!commentText.trim()}>
            <Ionicons name="send" size={24} color="#1D4ED8" style={{ marginLeft: 10 }} />
          </TouchableOpacity>
        </View>

        {optionsVisible && (
          <Modal
            transparent={true}
            visible={optionsVisible}
            animationType="fade"
            onRequestClose={() => setOptionsVisible(false)}
          >
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setOptionsVisible(false)}>
              <View
                style={{
                  position: 'absolute',
                  top: 40,
                  right: 20,
                  backgroundColor: 'white',
                  padding: 10,
                  borderRadius: 10,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 4,
                  elevation: 5,
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    setOptionsVisible(false);
                    onEdit(post);
                  }}
                  style={{ padding: 10 }}
                >
                  <Text>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setOptionsVisible(false);
                    onDelete(post.id);
                  }}
                  style={{ padding: 10 }}
                >
                  <Text style={{ color: 'red' }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        )}
      </PostContainer>
    </TouchableOpacity>
  );
};

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
    <View style={{ marginBottom: 10, marginLeft: (comment.depth || 0) * 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <ProfileImage source={{ uri: comment.userImage || DEFAULT_PROFILE_IMAGE }} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={{ fontWeight: 'bold' }}>{comment.userName}</Text>
          <Text>{comment.text}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
            <TouchableOpacity onPress={handleLike} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? 'red' : 'gray'} />
              <Text style={{ marginLeft: 5 }}>{(comment.likes || []).length}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleReply} style={{ marginLeft: 20 }}>
              <Text style={{ color: 'blue' }}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      {/* Reply Input */}
      {showReplyInput && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5, marginLeft: 50 }}>
          <TextInput
            placeholder="Write a reply..."
            value={replyText}
            onChangeText={setReplyText}
            style={{ flex: 1, padding: 5, backgroundColor: '#F3F4F6', borderRadius: 5 }}
          />
          <TouchableOpacity onPress={handleAddReply} disabled={!replyText.trim()} style={{ marginLeft: 5 }}>
            <Ionicons name="send" size={20} color="#1D4ED8" />
          </TouchableOpacity>
        </View>
      )}
      {/* Render Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <View style={{ marginTop: 10 }}>
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
            <Text style={{ marginLeft: 50, color: 'gray' }}>View more replies...</Text>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              padding: 15,
              borderBottomColor: '#E5E7EB',
              borderBottomWidth: 1,
              backgroundColor: item.read ? '#fff' : '#E5E7EB',
            }}
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
            <Text style={{ color: 'gray', fontSize: 12 }}>
              {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : ''}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No notifications.</Text>}
      />
    </SafeAreaView>
  );
};

// FullScreen Post modal with updated design
const FullScreenPostModal = ({ post, visible, onClose }) => {
  const [comment, setComment] = useState('');
  const { user } = useUser();

  const [comments, setComments] = useState(post.comments || []);
  const [likes, setLikes] = useState(post.likes || []);
  const [liked, setLiked] = useState((post.likes || []).includes(user.id));

  useEffect(() => {
    // Real-time updates for comments and likes
    const unsubscribe = onSnapshot(doc(db, 'posts', post.id), (docSnap) => {
      if (docSnap.exists()) {
        const updatedPost = docSnap.data();
        setComments(updatedPost.comments || []);
        setLikes(updatedPost.likes || []);
        setLiked(updatedPost.likes?.includes(user.id));
      }
    });
    return () => unsubscribe();
  }, [post.id, user.id]);

  const handleAddComment = async () => {
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

        // Send notification to post owner
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
  };

  const handleLike = async () => {
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

        // Send notification to post owner
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
  };

  const handleLikeComment = async (targetComment) => {
    try {
      // Recursive function to update the likes in the comment tree
      const updateLikes = (commentsArray) => {
        return commentsArray.map((cmt) => {
          if (cmt === targetComment) {
            const alreadyLiked = (cmt.likes || []).includes(user.id);
            const updatedLikes = alreadyLiked
              ? cmt.likes.filter((id) => id !== user.id)
              : [...(cmt.likes || []), user.id];
            return { ...cmt, likes: updatedLikes };
          } else if (cmt.replies && cmt.replies.length > 0) {
            return { ...cmt, replies: updateLikes(cmt.replies) };
          } else {
            return cmt;
          }
        });
      };

      const updatedComments = updateLikes(comments);
      setComments(updatedComments);

      // Update in Firestore
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        comments: updatedComments,
      });
    } catch (error) {
      Alert.alert('Error', 'Could not update comment like.');
    }
  };

  const handleReplyComment = async (parentComment, replyText) => {
    try {
      const newReply = {
        userId: user.id,
        userName: user.fullName || 'Anonymous',
        text: replyText,
        userImage: user.imageUrl || DEFAULT_PROFILE_IMAGE,
        likes: [],
        replies: [],
      };

      // Recursive function to add the reply to the correct comment
      const addReply = (commentsArray) => {
        return commentsArray.map((cmt) => {
          if (cmt === parentComment) {
            const updatedReplies = cmt.replies ? [...cmt.replies, newReply] : [newReply];
            return { ...cmt, replies: updatedReplies };
          } else if (cmt.replies && cmt.replies.length > 0) {
            return { ...cmt, replies: addReply(cmt.replies) };
          } else {
            return cmt;
          }
        });
      };

      const updatedComments = addReply(comments);
      setComments(updatedComments);

      // Update in Firestore
      const postRef = doc(db, 'posts', post.id);
      await updateDoc(postRef, {
        comments: updatedComments,
      });

      // Send notification to the comment owner
      if (parentComment.userId !== user.id) {
        await addDoc(collection(db, 'notifications'), {
          toUserId: parentComment.userId,
          fromUserId: user.id,
          fromUserName: user.fullName || 'Anonymous',
          type: 'reply',
          postId: post.id,
          read: false,
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Could not add reply.');
    }
  };

  if (!post) {
    return null; // Return nothing if post is undefined
  }

  return (
    <Modal visible={visible} transparent={false}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <ScrollView style={{ flex: 1 }}>
          <View
            style={{
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
            }}
          >
            <TouchableOpacity onPress={onClose} style={{ alignSelf: 'flex-end' }}>
              <Ionicons name="close-outline" size={30} color="black" />
            </TouchableOpacity>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <ProfileImage source={{ uri: post?.profileImage || DEFAULT_PROFILE_IMAGE }} />
              <Text style={{ fontWeight: 'bold', fontSize: 18, marginTop: 8 }}>
                {post?.userName || 'Unknown User'}
              </Text>
              <Text style={{ color: 'gray', fontSize: 12 }}>
                {post?.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString() : 'Unknown Date'}
              </Text>
            </View>
            <PostContent>{post?.content || ''}</PostContent>
            {post.image && (
              <View style={{ marginBottom: 10 }}>
                <Image
                  source={{ uri: post.image }}
                  style={{ width: '100%', height: 300, borderRadius: 20 }}
                  resizeMode="cover"
                />
              </View>
            )}
            <PostActions>
              <ActionButton onPress={handleLike}>
                <Ionicons name={liked ? 'heart' : 'heart-outline'} size={24} color={liked ? 'red' : 'gray'} />
                <ActionText>{likes.length > 0 ? likes.length : ''}</ActionText>
              </ActionButton>
            </PostActions>

            {/* Comments Section */}
            <View style={{ marginTop: 20, paddingHorizontal: 16 }}>
              <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>Comments</Text>
              {comments.map((cmt, index) => (
                <Comment
                  key={index}
                  comment={cmt}
                  onLikeComment={handleLikeComment}
                  onReplyComment={handleReplyComment}
                  userId={user.id}
                />
              ))}
            </View>
          </View>
        </ScrollView>
        {/* Comment Input */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 10,
            borderTopColor: '#E5E7EB',
            borderTopWidth: 1,
            backgroundColor: '#fff',
          }}
        >
          <CommentInput
            placeholder="Add a comment..."
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <TouchableOpacity onPress={handleAddComment} style={{ marginLeft: 10 }}>
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
    return <ActivityIndicator size="large" color="#1D4ED8" style={{ flex: 1, justifyContent: 'center' }} />;
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
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [postToEdit, setPostToEdit] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const PAGE_SIZE = 10;

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async (loadMore = false) => {
    setLoading(true);
    try {
      let postsRef = collection(db, 'posts');
      let q = query(postsRef, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
      if (loadMore && lastVisible) {
        q = query(postsRef, orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(PAGE_SIZE));
      }
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const newPosts = snapshot.docs.map((doc) => {
          const data = doc.data();
          return { id: doc.id, ...data };
        });
        setPosts((prevPosts) => (loadMore ? [...prevPosts, ...newPosts] : newPosts));
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not fetch posts.');
    }
    setLoading(false);
  };

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

  const handleDelete = (id) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => confirmDelete(id),
        },
      ],
      { cancelable: true }
    );
  };

  const confirmDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'posts', id));
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      Alert.alert('Error', 'Could not delete post.');
    }
  };

  const handleEdit = (post) => {
    setPostToEdit(post);
    setIsEditingPost(true);
  };

  const handleNewPost = (newPost) => {
    setPosts([newPost, ...posts]);
  };

  return (
    <Container>
      <UserHeader navigation={navigation} user={user} />
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<CreatePost onSubmit={handleNewPost} />}
        renderItem={({ item }) => (
          <Post
            key={item.id}
            post={item}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onViewPost={handleViewPost}
            onShare={() => {}}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loading && <ActivityIndicator size="large" color="#1D4ED8" />}
        ListEmptyComponent={
          !loading && <Text style={{ textAlign: 'center', marginTop: 20 }}>No posts available.</Text>
        }
      />
    </Container>
  );
};

// Root App Component
export default function App() {
  return (
    <NavigationContainer independent={true}>
      <Stack.Navigator initialRouteName="MainFeed">
        <Stack.Screen name="MainFeed" component={MainFeed} options={{ headerShown: false }} />
        <Stack.Screen name="FullScreenPost" component={FullScreenPost} options={{ headerShown: false }} />
        <Stack.Screen name="Notifications" component={Notifications} options={{ title: 'Notifications' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
