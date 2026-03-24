import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Profile from './Profile';
import SignIn from './SignIn';

export default function Account({ allSpots, currentUser, currentUserProfile }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser && currentUserProfile?.username) {
      navigate(`/user/${currentUserProfile.username}`, { replace: true });
    }
  }, [currentUser, currentUserProfile?.username, navigate]);

  if (currentUser && !currentUserProfile?.username) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="text-slate-500">Loading profile…</p>
      </div>
    );
  }

  if (!currentUser) {
    return <SignIn currentUser={currentUser} />;
  }

  return null;
}
