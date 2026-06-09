import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import { account, ID } from '../lib/appwrite';
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

jest.mock('../lib/appwrite', () => ({
  account: {
    get: jest.fn(),
    createJWT: jest.fn(),
    deleteSession: jest.fn(async () => {}),
    createEmailPasswordSession: jest.fn(async () => {}),
    createMagicURLToken: jest.fn(async () => ({})),
    createSession: jest.fn(async () => ({})),
    updateMagicURLSession: jest.fn(async () => ({})),
    createOAuth2Token: jest.fn(),
    createOAuth2Session: jest.fn()
  },
  ID: { unique: jest.fn(() => 'unique-user-id') },
  OAuthProvider: { Google: 'google', Github: 'github' }
}));

function AuthProbe() {
  const { user, loading, magicUrlPending, sendMagicUrl, verifyMagicUrl, loginWithGithub } = useAuth();
  return (
    <div>
      <span>{loading ? 'loading' : 'ready'}</span>
      <span>{user?.email || 'no-user'}</span>
      <span>{magicUrlPending ? 'magic-pending' : 'magic-idle'}</span>
      <button type="button" onClick={() => sendMagicUrl('magic@example.com')}>send magic</button>
      <button type="button" onClick={() => verifyMagicUrl('user-1', 'magic-secret')}>verify magic</button>
      <button type="button" onClick={() => loginWithGithub()}>github oauth</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    axios.defaults.headers.common = {};
    ID.unique.mockReturnValue('unique-user-id');
    account.get.mockResolvedValue({
      $id: 'user-1',
      email: 'stored@example.com',
      name: 'Stored User'
    });
    account.createJWT.mockResolvedValue({ jwt: 'fresh-appwrite-jwt' });
    axios.get.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'stored@example.com',
          onboardingCompleted: true
        }
      }
    });
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

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/api\/auth\/me$/));
    });

    await act(async () => {
      resolveValidation({ data: { user: storedUser } });
    });
  });

  it('does not enter magic verification mode when sending a magic link', async () => {
    account.get.mockRejectedValue({ code: 401 });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    expect(await screen.findByText('ready')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'send magic' }));
    });

    expect(account.createMagicURLToken).toHaveBeenCalledWith({
      userId: 'unique-user-id',
      email: 'magic@example.com',
      url: 'http://localhost/login'
    });
    expect(screen.getByText('magic-idle')).toBeInTheDocument();
  });

  it('creates an Appwrite session when verifying a magic link callback', async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    expect(await screen.findByText('ready')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'verify magic' }));
    });

    expect(account.createSession).toHaveBeenCalledWith({
      userId: 'user-1',
      secret: 'magic-secret'
    });
    expect(account.updateMagicURLSession).not.toHaveBeenCalled();
    expect(await screen.findByText('stored@example.com')).toBeInTheDocument();
  });

  it('starts GitHub OAuth with the token callback flow', async () => {
    account.get.mockRejectedValue({ code: 401 });
    account.createOAuth2Token.mockReturnValue(undefined);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    expect(await screen.findByText('ready')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'github oauth' }));
    });

    expect(account.createOAuth2Token).toHaveBeenCalledWith({
      provider: 'github',
      success: 'http://localhost/oauth-callback',
      failure: 'http://localhost/login?error=github_failed'
    });
    expect(account.createOAuth2Session).not.toHaveBeenCalled();
  });
});
