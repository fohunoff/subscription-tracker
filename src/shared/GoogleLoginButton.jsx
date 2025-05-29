import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../features/notifications';

const GoogleLoginButton = () => {
  const { loginWithGoogle } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      await loginWithGoogle(credentialResponse.credential);
      showToast('Успешный вход!', 'success');
    } catch (error) {
      console.error('Ошибка входа через Google:', error);
      showToast('Ошибка входа через Google', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleError = () => {
    console.error('Google OAuth ошибка');
    showToast('Не удалось войти через Google', 'error');
  };

  return (
    <div className="google-login-container">
      {loading ? (
        <div className="flex items-center justify-center py-3 px-6 bg-slate-100 rounded-lg">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-primary mr-2"></div>
          <span className="text-slate-600">Вход...</span>
        </div>
      ) : (
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={handleError}
          useOneTap={false}
          auto_select={false}
          theme="outline"
          size="large"
          text="signin_with"
          shape="rectangular"
          logo_alignment="left"
        />
      )}
    </div>
  );
};

export default GoogleLoginButton;