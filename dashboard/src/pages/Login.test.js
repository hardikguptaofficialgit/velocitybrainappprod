import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import { useAuth } from '../contexts/AuthContext';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: jest.fn()
}));

const defaultAuth = {
  loginWithGithub: jest.fn(),
  loginWithGoogle: jest.fn(),
  completeTwoFactor: jest.fn(),
  error: null,
  user: null,
  loading: false,
  oauthPending: false
};

const renderLogin = (authOverrides = {}) => {
  const auth = {
    ...defaultAuth,
    loginWithGithub: jest.fn(async () => ({ success: false })),
    loginWithGoogle: jest.fn(async () => ({ success: false })),
    completeTwoFactor: jest.fn(async () => ({ success: false })),
    ...authOverrides
  };
  useAuth.mockReturnValue(auth);

  render(
    <MemoryRouter
      initialEntries={['/login']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Login />
    </MemoryRouter>
  );

  return auth;
};

describe('Login page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders only OAuth sign-in controls', () => {
    renderLogin();

    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue with Google/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument();
  });

  it('renders a recovery action during pending OAuth handoff', () => {
    renderLogin({ loading: true, oauthPending: true });

    expect(screen.getByText('Completing secure sign in...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in again' })).toBeInTheDocument();
  });

  it('shows the two-factor challenge after OAuth requires it', async () => {
    const loginWithGoogle = jest.fn(async () => ({
      success: false,
      requiresTwoFactor: true,
      challengeToken: 'oauth-challenge-token',
      user: { email: 'oauth2fa@example.com' }
    }));
    renderLogin({ loginWithGoogle });

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));

    expect(await screen.findByText('Verify your account')).toBeInTheDocument();
    expect(screen.getByText('Enter the code for oauth2fa@example.com.')).toBeInTheDocument();
    expect(screen.getByLabelText('Authenticator code')).toBeInTheDocument();
  });
});
