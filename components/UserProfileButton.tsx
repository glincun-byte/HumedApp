import React from 'react';
import { useAuth } from './AuthContext';

interface UserProfileButtonProps {
  onOpen: () => void;
}

const getInitialsFromEmail = (email?: string | null) => {
  if (!email) return '?';
  const namePart = email.split('@')[0] || '';
  if (!namePart) return email[0]?.toUpperCase() ?? '?';
  const pieces = namePart.replace(/[^a-zA-Z]/g, ' ').split(' ').filter(Boolean);
  if (pieces.length === 1) {
    return pieces[0].slice(0, 2).toUpperCase();
  }
  return (pieces[0][0] + pieces[1][0]).toUpperCase();
};

const UserProfileButton: React.FC<UserProfileButtonProps> = ({ onOpen }) => {
  const { user } = useAuth();

  if (!user) return null;

  const initials = getInitialsFromEmail(user.email);

  return (
    <button
      onClick={onOpen}
      className="fixed top-4 right-4 z-40 bg-white/90 backdrop-blur border border-emerald-100 shadow-md w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-emerald-700"
      aria-label="Ver perfil"
    >
      {initials}
    </button>
  );
};

export default UserProfileButton;

