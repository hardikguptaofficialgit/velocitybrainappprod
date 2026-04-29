import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BlobLoader from '../components/BlobLoader';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    // OAuth redirect is handled by AuthContext
    // This page just redirects based on auth state
    if (!loading) {
      if (user) {
        navigate('/dashboard', { replace: true });
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
