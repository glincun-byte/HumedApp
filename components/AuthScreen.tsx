import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { Eye, EyeOff } from 'lucide-react';

const AuthScreen: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const { lang } = useLanguage();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const { error: err } =
      mode === 'login'
        ? await signIn(email, password)
        : await signUp(email, password, username);

    if (err) {
      let friendly = err;
      if (mode === 'register') {
        if (err === 'USERNAME_TAKEN') {
          friendly =
            lang === 'en'
              ? 'This username is already in use. Please choose a different one.'
              : 'Este nombre de usuario ya está en uso. Por favor, elige uno diferente.';
        } else if (err === 'EMAIL_ALREADY_REGISTERED') {
          friendly =
            lang === 'en'
              ? 'This email is already registered. Please sign in instead.'
              : 'Este correo ya se encuentra registrado. Por favor, inicia sesión.';
        } else if (err === 'USERNAME_REQUIRED') {
          friendly =
            lang === 'en'
              ? 'Please choose a username to create your account.'
              : 'Por favor elige un nombre de usuario para crear tu cuenta.';
        } else {
          const lower = err.toLowerCase();

          // Caso 1: el correo ya existe
          if (lower.includes('already registered') || lower.includes('already exists')) {
            friendly =
              lang === 'en'
                ? 'This email is already registered. Please sign in instead.'
                : 'Este correo ya se encuentra registrado. Por favor, inicia sesión.';
          }
          // Caso 2: muchos intentos de registro seguidos
          else if (lower.includes('rate limit')) {
            friendly =
              lang === 'en'
                ? 'Supabase temporarily blocked new sign-ups due to too many attempts from this source. Wait a few minutes and try again.'
                : 'Supabase bloqueó temporalmente los registros por demasiados intentos desde esta red/dispositivo. Espera unos minutos e inténtalo de nuevo.';
          }
          // Caso 3: problemas con el nombre de usuario (por ejemplo, ya está en uso) a partir de errores de Supabase
          else if (
            lower.includes('username') ||
            lower.includes('user name') ||
            lower.includes('duplicate key value')
          ) {
            friendly =
              lang === 'en'
                ? 'This username is already in use. Please choose a different one.'
                : 'Este nombre de usuario ya está en uso. Por favor, elige uno diferente.';
          }
        }
      }
      setError(friendly);
    } else {
      if (mode === 'login') {
        setSuccess(
          lang === 'en' ? 'Sign in successful.' : 'Inicio de sesión exitoso.'
        );
      } else {
        setSuccess(
          lang === 'en'
            ? 'Registration successful. Check your email if confirmation is required.'
            : 'Registro exitoso. Revisa tu correo si se requiere confirmación.'
        );
      }
    }

    setLoading(false);
  };

  return (
    <div className="p-4 animate-fadeIn text-black">
      <div className="eco-card rounded-3xl p-5 border border-white/80 shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
      <h1 className="text-2xl font-bold text-black mb-4">
        {mode === 'login'
          ? lang === 'en'
            ? 'Sign in'
            : 'Inicia sesión'
          : lang === 'en'
          ? 'Create your account'
          : 'Crea tu cuenta'}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {lang === 'en'
          ? 'To participate in the community and record citizen reports, please sign in or register.'
          : 'Para participar en la comunidad y registrar reportes ciudadanos, inicia sesión o regístrate.'}
      </p>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('login')}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold ${
            mode === 'login'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {lang === 'en' ? 'Sign in' : 'Iniciar sesión'}
        </button>
        <button
          onClick={() => setMode('register')}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold ${
            mode === 'register'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {lang === 'en' ? 'Register' : 'Registrarse'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              {lang === 'en' ? 'Username (unique)' : 'Nombre de usuario (único)'}
            </label>
            <input
              type="text"
              required={mode === 'register'}
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ej: humedal_guardian"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              {lang === 'en'
                ? 'It will appear as @username in your reports.'
                : 'Se mostrará como @usuario en tus reportes.'}
            </p>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            {lang === 'en' ? 'Email' : 'Correo electrónico'}
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder={
              lang === 'en' ? 'your-email@example.com' : 'tu-correo@ejemplo.com'
            }
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            {lang === 'en' ? 'Password' : 'Contraseña'}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full p-3 pr-11 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder={
                lang === 'en' ? 'Minimum 8 characters' : 'Mínimo 8 caracteres'
              }
            />
            <button
              type="button"
              onClick={() => setShowPassword(prev => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-emerald-700 transition-colors"
              aria-label={
                showPassword
                  ? lang === 'en'
                    ? 'Hide password'
                    : 'Ocultar contraseña'
                  : lang === 'en'
                  ? 'Show password'
                  : 'Mostrar contraseña'
              }
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-2">
            {error}
          </p>
        )}

        {success && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-2">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60"
        >
          {loading
            ? lang === 'en'
              ? 'Processing...'
              : 'Procesando...'
            : mode === 'login'
            ? lang === 'en'
              ? 'Enter'
              : 'Entrar'
            : lang === 'en'
            ? 'Create account'
            : 'Crear cuenta'}
        </button>
      </form>
      </div>
    </div>
  );
};

export default AuthScreen;
