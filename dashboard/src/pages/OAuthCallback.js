import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BlobLoader from '../components/BlobLoader';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    // OAuth redirect completion is handled by AuthContext.
    // Redirect to the correct destination once auth state resolves.
    if (!loading) {
      if (user) {
        navigate(user.onboardingCompleted ? '/dashboard' : '/onboarding', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <BlobLoader size={84} label="Completing sign in..." />
      </div>
    </div>
  );
};

export default OAuthCallback;
