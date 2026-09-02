import { supabase, hasSupabase } from './supabase';
import { getFriendConnections } from './follows';
import { getBlockedUserIds } from './safety';

const POST_SELECT = `
  id, user_id, spot_id, caption, location_name, latitude, longitude, location_precision, created_at, updated_at,
  author:profiles!posts_user_id_fkey(id, username, display_name, avatar_url),
  spot:spots(id, name, address),
  images:post_images(id, public_url, storage_path, position, width, height),
  likes:post_likes(user_id),
  comments:post_comments(id, body, user_id, created_at, author:profiles!post_comments_user_id_fkey(id, username, display_name, avatar_url))
`;

function normalizePost(post, currentUserId = null) {
  const images = [...(post.images || [])].sort((a, b) => a.position - b.position);
  const comments = [...(post.comments || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return {
    ...post,
    userId: post.user_id,
    spotId: post.spot_id,
    locationName: post.location_name,
    locationPrecision: post.location_precision,
    createdAt: post.created_at,
    images,
    comments,
    likeCount: post.likes?.length || 0,
    likedByMe: Boolean(currentUserId && post.likes?.some((like) => like.user_id === currentUserId)),
  };
}

export async function fetchPosts({ mode = 'newest', profileId = null, limit = 40 } = {}) {
  if (!hasSupabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  let query = supabase.from('posts').select(POST_SELECT).order('created_at', { ascending: false }).limit(Math.min(Math.max(limit, 1), 75));
  if (profileId) query = query.eq('user_id', profileId);
  const { data, error } = await query;
  if (error) {
    console.warn('SnapMap: feed fetch failed', error);
    return [];
  }
  let posts = data || [];
  if (user?.id) {
    const blocked = new Set(await getBlockedUserIds());
    posts = posts.filter((post) => !blocked.has(post.user_id));
    if (mode === 'friends' && !profileId) {
      const connections = await getFriendConnections(user.id);
      const allowed = new Set([user.id, ...connections.friends.map((friend) => friend.id)]);
      posts = posts.filter((post) => allowed.has(post.user_id));
    }
  } else if (mode === 'friends') {
    posts = [];
  }
  return posts.map((post) => normalizePost(post, user?.id));
}

export async function fetchMapPosts(limit = 100) {
  if (!hasSupabase) return [];
  const { data, error } = await supabase
    .from('posts')
    .select(`
      id, user_id, spot_id, location_name, latitude, longitude, location_precision, created_at,
      author:profiles!posts_user_id_fkey(username, display_name),
      images:post_images(public_url, position)
    `)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 150));
  if (error) {
    console.warn('SnapMap: map posts fetch failed', error);
    return [];
  }
  return (data || []).map((post) => ({
    id: post.id,
    userId: post.user_id,
    spotId: post.spot_id,
    locationName: post.location_name,
    latitude: post.latitude,
    longitude: post.longitude,
    locationPrecision: post.location_precision,
    createdAt: post.created_at,
    author: post.author,
    imageUrl: [...(post.images || [])].sort((a, b) => a.position - b.position)[0]?.public_url || null,
  }));
}

function loadImage(file, src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export async function compressPostImage(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Choose an image file.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Each original photo must be under 20 MB.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(file, objectUrl);
    const maxEdge = 2048;
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d', { alpha: false }).drawImage(image, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.84));
    if (!blob) throw new Error('That photo could not be processed.');
    return { blob, width, height, previewUrl: URL.createObjectURL(blob) };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function createPost({ caption = '', locationName, latitude = null, longitude = null, locationPrecision = 'exact', spotId = null, images = [] }) {
  if (!hasSupabase || !images.length || !locationName?.trim()) return { post: null, error: 'Add a photo and location.' };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { post: null, error: 'Sign in to post.' };
  const isApproximate = locationPrecision === 'approximate';
  // Approximate posts never send exact coordinates to the database.
  const storedLatitude = latitude == null ? null : (isApproximate ? Math.round(latitude * 100) / 100 : latitude);
  const storedLongitude = longitude == null ? null : (isApproximate ? Math.round(longitude * 100) / 100 : longitude);
  const { data: post, error } = await supabase.from('posts').insert({
    user_id: user.id,
    spot_id: spotId || null,
    caption: String(caption).trim().slice(0, 2200),
    location_name: String(locationName).trim().slice(0, 160),
    latitude: storedLatitude,
    longitude: storedLongitude,
    location_precision: isApproximate ? 'approximate' : 'exact',
  }).select('id').single();
  if (error || !post) return { post: null, error: error?.message || 'Could not create post.' };

  const uploadedPaths = [];
  try {
    const rows = [];
    for (let index = 0; index < images.length; index += 1) {
      const item = images[index];
      const path = `${user.id}/${post.id}/${index}-${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage.from('post-images').upload(path, item.blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
      if (uploadError) throw uploadError;
      uploadedPaths.push(path);
      const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(path);
      rows.push({ post_id: post.id, user_id: user.id, storage_path: path, public_url: publicUrl, position: index, width: item.width, height: item.height });
    }
    const { error: imageError } = await supabase.from('post_images').insert(rows);
    if (imageError) throw imageError;
    const { data: created, error: fetchError } = await supabase.from('posts').select(POST_SELECT).eq('id', post.id).single();
    if (fetchError) throw fetchError;
    return { post: normalizePost(created, user.id), error: null };
  } catch (uploadError) {
    if (uploadedPaths.length) await supabase.storage.from('post-images').remove(uploadedPaths);
    await supabase.from('posts').delete().eq('id', post.id);
    console.warn('SnapMap: post upload failed', uploadError);
    return { post: null, error: uploadError?.message || 'Photo upload failed.' };
  }
}

export async function togglePostLike(postId, liked) {
  if (!hasSupabase || !postId) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const request = liked
    ? supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id)
    : supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
  const { error } = await request;
  return !error;
}

export async function addPostComment(postId, body) {
  if (!hasSupabase || !postId || !body?.trim()) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('post_comments').insert({ post_id: postId, user_id: user.id, body: body.trim().slice(0, 1000) })
    .select('id, body, user_id, created_at, author:profiles!post_comments_user_id_fkey(id, username, display_name, avatar_url)').single();
  return error ? null : data;
}

export async function deletePostComment(commentId) {
  if (!hasSupabase || !commentId) return false;
  const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
  return !error;
}

export async function deletePost(post) {
  if (!hasSupabase || !post?.id) return false;
  const paths = (post.images || []).map((image) => image.storage_path).filter(Boolean);
  const { error } = await supabase.from('posts').delete().eq('id', post.id);
  if (!error && paths.length) await supabase.storage.from('post-images').remove(paths);
  return !error;
}

export async function reportPost(postId, reason = 'inappropriate') {
  if (!hasSupabase || !postId) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from('post_reports').insert({ reporter_id: user.id, post_id: postId, reason });
  return !error || error.code === '23505';
}

export function subscribeToFeed(onChange) {
  if (!hasSupabase) return () => {};
  const channel = supabase.channel('spot-feed-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments' }, onChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}
