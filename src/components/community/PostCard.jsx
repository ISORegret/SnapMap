import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Heart, MapPin, MessageCircle, MoreHorizontal, Navigation, Pencil, Send, Share2, Sparkles, Trash2, User } from 'lucide-react';
import { addPostComment, deletePost, deletePostComment, reportPost, togglePostLike } from '../../api/posts';
import { kmToMi } from '../../utils/geo';

function timeAgo(value) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function PostCard({ post, currentUser, units, recommendationReason = '', onChanged, onEdit, showToast }) {
  const [slide, setSlide] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [working, setWorking] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const image = post.images[slide];
  const isOwn = currentUser?.id === post.userId;
  const distance = post.distanceKm != null
    ? (units === 'km' ? `${post.distanceKm.toFixed(1)} km away` : `${kmToMi(post.distanceKm).toFixed(1)} mi away`)
    : null;

  const handleLike = async () => {
    if (!currentUser) return showToast?.('Sign in to like posts.');
    const ok = await togglePostLike(post.id, post.likedByMe);
    if (ok) onChanged?.();
  };

  const sharePost = async () => {
    if (sharing) return;
    setSharing(true);
    const url = `${window.location.origin}${window.location.pathname || ''}#/explore?post=${post.id}`;
    const creator = post.author?.display_name || 'a SnapMap creator';
    const text = post.caption?.trim() ? `${post.caption.trim().slice(0, 180)}${post.caption.trim().length > 180 ? '…' : ''}` : `Photo from ${post.locationName} by ${creator}`;
    try {
      if (navigator.share) {
        const imageUrl = post.images[0]?.public_url;
        if (imageUrl && navigator.canShare) {
          try {
            const response = await fetch(imageUrl);
            if (response.ok) {
              const blob = await response.blob();
              const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp';
              const file = new File([blob], `snapmap-${post.id}.${extension}`, { type: blob.type || 'image/webp' });
              if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: `${post.locationName} · SnapMap`, text, url });
                return;
              }
            }
          } catch (imageShareError) {
            if (imageShareError?.name === 'AbortError') return;
          }
        }
        await navigator.share({ title: `${post.locationName} · SnapMap`, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast?.('Post link copied.');
    } catch (shareError) {
      if (shareError?.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(url);
        showToast?.('Post link copied.');
      } catch {
        showToast?.('Could not share this post.');
      }
    } finally {
      setSharing(false);
    }
  };

  const submitComment = async (event) => {
    event.preventDefault();
    if (!currentUser) return showToast?.('Sign in to join the conversation.');
    if (!comment.trim() || working) return;
    setWorking(true);
    const created = await addPostComment(post.id, comment);
    setWorking(false);
    if (created) { setComment(''); onChanged?.(); }
    else showToast?.('Could not add your comment.');
  };

  const handlePostAction = async (action) => {
    setMenuOpen(false);
    if (action === 'edit') {
      onEdit?.(post);
    } else if (action === 'delete') {
      if (!window.confirm('Delete this post and its photos?')) return;
      if (await deletePost(post)) { showToast?.('Post deleted.'); onChanged?.(); }
    } else if (await reportPost(post.id)) showToast?.('Post reported. Thank you.');
  };

  return (
    <article id={`post-${post.id}`} className="surface-card overflow-hidden rounded-[1.65rem]">
      <div className="flex items-center gap-3 p-4">
        <Link to={`/user/${post.author?.username}`} state={{ from: '/explore' }} className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-500/15 text-accent-400">
          {post.author?.avatar_url ? <img src={post.author.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-4 w-4" />}
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/user/${post.author?.username}`} state={{ from: '/explore' }} className="truncate text-sm font-extrabold text-primary">{post.author?.display_name || 'Creator'}</Link>
          <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted"><MapPin className="h-3 w-3 shrink-0 text-accent-400" /><span className="truncate">{post.locationName}</span><span>·</span><span className="shrink-0">{timeAgo(post.createdAt)}</span></p>
          {post.event && <Link to={`/event/${post.event.id}`} className="mt-1 flex items-center gap-1 truncate text-[11px] font-bold text-cyan-300"><CalendarDays className="h-3 w-3 shrink-0" /><span className="truncate">{post.event.title}</span></Link>}
          {recommendationReason && <p className="mt-1 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-accent-400"><Sparkles className="h-3 w-3" />{recommendationReason}</p>}
        </div>
        <div className="relative">
          <button type="button" onClick={() => setMenuOpen((open) => !open)} className="icon-button h-9 w-9 rounded-xl" aria-label="Post options"><MoreHorizontal className="h-4 w-4" /></button>
          {menuOpen && <div className="absolute right-0 top-11 z-20 w-44 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card-solid)] p-1.5 shadow-2xl">
            {isOwn && <button type="button" onClick={() => handlePostAction('edit')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-secondary hover:bg-white/5"><Pencil className="h-4 w-4 text-accent-400" />Edit post</button>}
            <button type="button" onClick={() => handlePostAction(isOwn ? 'delete' : 'report')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold text-secondary hover:bg-white/5">
              {isOwn ? <Trash2 className="h-4 w-4 text-rose-400" /> : <MoreHorizontal className="h-4 w-4" />}{isOwn ? 'Delete post' : 'Report post'}
            </button>
          </div>}
        </div>
      </div>

      <div className="relative aspect-[4/5] max-h-[42rem] bg-black">
        <img src={image?.public_url} alt={`Photo ${slide + 1} from ${post.locationName}`} className="h-full w-full object-contain" />
        {post.images.length > 1 && <>
          <button type="button" disabled={slide === 0} onClick={() => setSlide((value) => value - 1)} className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur disabled:opacity-20" aria-label="Previous photo"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" disabled={slide === post.images.length - 1} onClick={() => setSlide((value) => value + 1)} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur disabled:opacity-20" aria-label="Next photo"><ChevronRight className="h-5 w-5" /></button>
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">{slide + 1}/{post.images.length}</span>
        </>}
        {post.locationPrecision === 'approximate' && <span className="absolute bottom-3 left-3 rounded-full bg-black/65 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-white/80 backdrop-blur">Approximate location</span>}
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleLike} className={`flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-extrabold ${post.likedByMe ? 'text-rose-400' : 'text-secondary'}`}><Heart className={`h-5 w-5 ${post.likedByMe ? 'fill-current' : ''}`} />{post.likeCount || ''}</button>
          <button type="button" onClick={() => setCommentsOpen((open) => !open)} className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-extrabold text-secondary"><MessageCircle className="h-5 w-5" />{post.comments.length || ''}</button>
          <button type="button" onClick={sharePost} disabled={sharing} className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-extrabold text-secondary disabled:opacity-50" aria-label="Share post outside SnapMap"><Share2 className="h-5 w-5" /></button>
          {currentUser && <Link to="/messages" state={{ share: { type: 'post', id: post.id, title: post.locationName, subtitle: `Post by ${post.author?.display_name || 'a creator'}`, imageUrl: post.images[0]?.public_url || '' } }} className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-extrabold text-secondary" aria-label="Send post to a friend"><Send className="h-5 w-5" /></Link>}
          <div className="ml-auto flex items-center gap-2">
            {distance && <span className="hidden text-[11px] font-bold text-muted sm:inline">{distance}</span>}
            {post.spotId ? <Link to={`/spot/${post.spotId}`} className="flex items-center gap-1.5 rounded-xl bg-accent-500/10 px-3 py-2 text-xs font-extrabold text-accent-400"><Navigation className="h-3.5 w-3.5" />View spot</Link> : post.latitude != null && <Link to={`/?lat=${post.latitude}&lng=${post.longitude}`} className="flex items-center gap-1.5 rounded-xl bg-accent-500/10 px-3 py-2 text-xs font-extrabold text-accent-400"><Navigation className="h-3.5 w-3.5" />Map</Link>}
          </div>
        </div>
        {post.caption && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-secondary"><Link to={`/user/${post.author?.username}`} state={{ from: '/explore' }} className="mr-1 font-extrabold text-primary">{post.author?.display_name || 'Creator'}</Link>{post.caption}{post.updated_at && new Date(post.updated_at).getTime() > new Date(post.createdAt).getTime() + 1000 && <span className="ml-1.5 text-[10px] font-semibold text-muted">Edited</span>}</p>}
        {!commentsOpen && post.comments.length > 0 && <button type="button" onClick={() => setCommentsOpen(true)} className="mt-2 text-xs font-semibold text-muted">View {post.comments.length === 1 ? 'comment' : `all ${post.comments.length} comments`}</button>}
        {commentsOpen && <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
          <div className="max-h-64 space-y-3 overflow-y-auto">
            {post.comments.length === 0 && <p className="text-xs text-muted">No comments yet. Start the conversation.</p>}
            {post.comments.map((item) => <div key={item.id} className="group flex gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-500/10 text-accent-400">{item.author?.avatar_url ? <img src={item.author.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-3.5 w-3.5" />}</div>
              <div className="min-w-0 flex-1 rounded-2xl bg-black/10 px-3 py-2"><p className="text-xs"><Link to={`/user/${item.author?.username}`} state={{ from: '/explore' }} className="font-extrabold text-primary">{item.author?.display_name || 'Community member'}</Link><span className="ml-2 text-secondary">{item.body}</span></p><p className="mt-1 text-[10px] text-muted">{timeAgo(item.created_at)}</p></div>
              {currentUser?.id === item.user_id && <button type="button" onClick={async () => { if (await deletePostComment(item.id)) onChanged?.(); }} className="self-center p-1 text-muted opacity-0 transition group-hover:opacity-100" aria-label="Delete comment"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>)}
          </div>
          <form onSubmit={submitComment} className="mt-3 flex gap-2">
            <input value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} placeholder={currentUser ? 'Add a comment…' : 'Sign in to comment'} disabled={!currentUser} className="surface-input min-w-0 flex-1 rounded-xl px-3 py-2.5 text-sm" />
            <button type="submit" disabled={!comment.trim() || working} className="primary-button h-10 w-10 rounded-xl disabled:opacity-40" aria-label="Post comment"><Send className="h-4 w-4" /></button>
          </form>
        </div>}
      </div>
    </article>
  );
}
