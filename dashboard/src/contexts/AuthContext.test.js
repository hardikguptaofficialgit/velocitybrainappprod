import React from 'react';
import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { AuthProvider, useAuth } from './AuthContext';

jest.mock('axios', () => {
  const axiosMock = jest.fn();
  axiosMock.defaults = { headers: { common: {} } };
  axiosMock.get = jest.fn();
  axiosMock.post = jest.fn();
  axiosMock.interceptors = {
    response: {
      use: jest.fn(() => 1),
      eject: jest.fn()
    }
  };
  return axiosMock;
});

jest.mock('firebase/auth', () => ({
  signOut: jest.fn(async () => {}),
  onAuthStateChanged: jest.fn(() => jest.fn()),
  signInWithPopup: jest.fn(),
  signInWithRedirect: jest.fn(),
  getRedirectResult: jest.fn(async () => null)
}));

jest.mock('../lib/firebase', () => ({
  auth: {
    currentUser: null,
    authStateReady: jest.fn(async () => {})
  },
  googleProvider: {},
  githubProvider: {}
}));

function AuthProbe() {
  const { user, loading } = useAuth();
  return (
    <div>
      <span>{loading ? 'loading' : 'ready'}</span>
      <span>{user?.email || 'no-user'}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    axios.defaults.headers.common = {};
    onAuthStateChanged.mockReturnValue(jest.fn());
    getRedirectResult.mockResolvedValue(null);
  });

  it('renders a stored backend session before slow validation completes', async () => {
    const storedUser = {
      id: 'user-1',
      email: 'stored@example.com',
      onboardingCompleted: true
    };
    localStorage.setItem('velocitybrain_token', 'stored-token');
    localStorage.setItem('velocitybrain_user', JSON.stringify(storedUser));

    let resolveValidation;
    axios.get.mockImplementation(() => new Promise((resolve) => {
      resolveValidation = resolve;
    }));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    expect(await screen.findByText('stored@example.com')).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();

    await act(async () => {
      resolveValidation({ data: { user: storedUser } });
    });
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/api\/auth\/me$/));
    });
  });
});
