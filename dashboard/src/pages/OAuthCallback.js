import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BlobLoader from '../components/BlobLoader';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, appwriteUser, verifyOAuthToken } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const userId = params.get('userId');
    const secret = params.get('secret');

    if (userId && secret && !user) {
      verifyOAuthToken(userId, secret).then((result) => {
        if (result?.success) {
          window.history.replaceState({}, '', '/oauth-callback');
          navigate(result.user?.onboardingCompleted ? '/dashboard' : '/onboarding', { replace: true });
        } else {
          navigate('/login?error=oauth_failed', { replace: true });
        }
      });
      return;
    }

    if (!loading) {
      if (user) {
        navigate(user.onboardingCompleted ? '/dashboard' : '/onboarding', { replace: true });
      } else if (!appwriteUser) {
        // No session found after OAuth redirect - fallback to login
        navigate('/login', { replace: true });
      }
    }
  }, [appwriteUser, loading, location.search, navigate, user, verifyOAuthToken]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <BlobLoader size={84} label="Completing sign in..." />
      </div>
    </div>
  );
};

export default OAuthCallback;
