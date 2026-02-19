import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { AxiosError } from 'axios';

export default function SsoCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const code = searchParams.get('code');
  const missingCodeError = 'Missing SSO exchange code';
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      return;
    }

    const exchangeCode = async () => {
      try {
        const response = await api.post('/auth/sso/exchange', { code });
        login(response.data.token, response.data.user);
        navigate('/', { replace: true });
      } catch (err: unknown) {
        const axiosError = err as AxiosError<{ error?: string }>;
        const message = axiosError.response?.data?.error || 'Failed to complete SSO login';
        setError(message);
      }
    };

    exchangeCode();
  }, [code, login, navigate]);

  if (!code) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        <div className="bg-red-50 p-6 rounded-lg border border-red-200 inline-block max-w-md w-full">
          <h1 className="text-xl font-bold text-red-700 mb-2">SSO Login Failed</h1>
          <p className="text-red-600 mb-4">{missingCodeError}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        <div className="bg-red-50 p-6 rounded-lg border border-red-200 inline-block max-w-md w-full">
          <h1 className="text-xl font-bold text-red-700 mb-2">SSO Login Failed</h1>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <div className="mb-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
      <h1 className="text-2xl font-bold mb-2">Signing you in...</h1>
      <p className="text-gray-600">Please wait while we complete secure SSO authentication.</p>
    </div>
  );
}
