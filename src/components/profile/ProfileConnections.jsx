import React from 'react';
import { Link } from 'react-router-dom';
import { User, UserPlus, Users } from 'lucide-react';
import { acceptFriendRequest, declineFriendRequest } from '../../api/follows';

export default function ProfileConnections({ connections, isOwnProfile, locationPath, onRefresh }) {
  return (
    <>
{(connections.friends.length > 0 || (isOwnProfile && (connections.incoming.length > 0 || connections.outgoing.length > 0))) && (
  <section className="px-4 pt-5">
    {isOwnProfile && connections.incoming.length > 0 && (
      <div className="surface-card mb-5 rounded-[1.5rem] p-4">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-accent-400" />
          <h2 className="text-sm font-extrabold text-primary">Friend requests</h2>
          <span className="ml-auto rounded-full bg-accent-500 px-2 py-0.5 text-[10px] font-extrabold text-[#211603]">{connections.incoming.length}</span>
        </div>
        <div className="space-y-2">
          {connections.incoming.map((creator) => (
            <div key={creator.id} className="flex items-center gap-3 rounded-2xl bg-black/10 p-2.5">
              <Link to={`/user/${creator.username}`} state={{ from: locationPath }} className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-500/15 text-accent-400">
                  {creator.avatar_url ? <img src={creator.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-4 w-4" />}
                </div>
                <div className="min-w-0"><p className="truncate text-sm font-bold text-primary">{creator.display_name || 'SnapMap user'}</p><p className="truncate text-xs text-slate-500">SnapMap creator</p></div>
              </Link>
              <button type="button" onClick={async () => { await acceptFriendRequest(creator.id); onRefresh?.(); }} className="rounded-xl bg-accent-500 px-3 py-2 text-xs font-extrabold text-[#211603]">Accept</button>
              <button type="button" onClick={async () => { await declineFriendRequest(creator.id); onRefresh?.(); }} className="rounded-xl border border-white/10 px-2.5 py-2 text-xs font-bold text-slate-500">Decline</button>
            </div>
          ))}
        </div>
      </div>
    )}

    {connections.friends.length > 0 && (
      <div>
        <div className="mb-3 flex items-center gap-2"><Users className="h-4 w-4 text-accent-400" /><h2 className="text-sm font-extrabold text-primary">Friends</h2></div>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
          {connections.friends.map((creator) => (
            <Link key={creator.id} to={`/user/${creator.username}`} state={{ from: locationPath }} className="surface-card w-28 shrink-0 rounded-[1.35rem] p-3 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-accent-500/15 text-accent-400">
                {creator.avatar_url ? <img src={creator.avatar_url} alt="" className="h-full w-full object-cover" /> : <User className="h-5 w-5" />}
              </div>
              <p className="mt-2 truncate text-xs font-extrabold text-primary">{creator.display_name || 'SnapMap user'}</p>
              <p className="truncate text-[10px] text-slate-500">SnapMap creator</p>
            </Link>
          ))}
        </div>
      </div>
    )}

    {isOwnProfile && connections.outgoing.length > 0 && (
      <p className="mt-3 text-xs text-slate-500">Pending requests: {connections.outgoing.map((creator) => creator.display_name || 'SnapMap user').join(', ')}</p>
    )}
  </section>
)}

    </>
  );
}
