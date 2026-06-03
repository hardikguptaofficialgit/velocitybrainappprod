import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import { useAuth } from '../contexts/AuthContext';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: jest.fn()
}));

const defaultAuth = {
  loginWithGithub: jest.fn(),
  loginWithGoogle: jest.fn(),
  loginWithPassword: jest.fn(),
  registerWithPassword: jest.fn(),
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
    loginWithPassword: jest.fn(async () => ({ success: false })),
    registerWithPassword: jest.fn(async () => ({ success: false })),
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

const submitPasswordForm = () => {
  const buttons = screen.getAllByRole('button', { name: 'Sign in' });
  fireEvent.click(buttons[buttons.length - 1]);
};

describe('Login page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders OAuth and password sign-in controls', () => {
    renderLogin();

    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue with Google/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('switches to account creation mode and calls register', async () => {
    const registerWithPassword = jest.fn(async () => ({
      success: true,
      user: { id: 'user-1', onboardingCompleted: false }
    }));
    renderLogin({ registerWithPassword });

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'supersecret123' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Create account' }).pop());

    await waitFor(() => {
      expect(registerWithPassword).toHaveBeenCalledWith({
        name: 'New User',
        email: 'new@example.com',
        password: 'supersecret123'
      });
    });
  });

  it('shows the two-factor challenge after password login requires it', async () => {
    const loginWithPassword = jest.fn(async () => ({
      success: false,
      requiresTwoFactor: true,
      challengeToken: 'challenge-token',
      user: { email: 'twofactor@example.com' }
    }));
    renderLogin({ loginWithPassword });

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'twofactor@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'supersecret123' } });
    submitPasswordForm();

    expect(await screen.findByText('Verify your account')).toBeInTheDocument();
    expect(screen.getByText('Enter the code for twofactor@example.com.')).toBeInTheDocument();
    expect(screen.getByLabelText('Authenticator code')).toBeInTheDocument();
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
