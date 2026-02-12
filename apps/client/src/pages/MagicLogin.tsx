import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api, { validatedRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { authResponseSchema } from '@laburauto/shared/zod';
import type { User } from '@laburauto/shared';

const MagicLogin: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Missing magic token');
      return;
    }

    const verifyToken = async () => {
      try {
        const { token: sessionToken, user, redirectPath } = await validatedRequest(
          () => api.post('/auth/magic-login', { token }),
          authResponseSchema
        );

        // Log in the user in our context
        login(sessionToken, user as unknown as User);

        // Redirect to target path
        navigate(redirectPath || '/', { replace: true });
      } catch (err: any) {
        console.error('Magic login failed:', err);
        setError(err.response?.data?.error || 'Failed to authenticate via magic link');
      }
    };

    verifyToken();
  }, [token, login, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      {!error ? (
        <>
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          </div>
          <h1 className="text-2xl font-bold mb-2">Verifying your identity...</h1>
          <p className="text-gray-600">Please wait while we securely log you in.</p>
        </>
      ) : (
        <div className="bg-red-50 p-6 rounded-lg border border-red-200 inline-block max-w-md w-full">
          <h1 className="text-xl font-bold text-red-700 mb-2">Authentication Failed</h1>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium"
          >
            Go to Login
          </button>
        </div>
      )}
    </div>
  );
};

export default MagicLogin;
