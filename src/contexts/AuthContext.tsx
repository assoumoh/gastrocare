import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface AppUser {
  id: string;
  uid: string;
  email: string;
  nom: string;
  prenom: string;
  role: 'medecin' | 'assistante' | 'admin';
  actif: boolean;
}

interface AuthContextType {
  currentUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
  authError: string | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthError(null);

      if (!user) {
        setCurrentUser(null);
        setAppUser(null);
        setLoading(false);
        return;
      }

      try {
        // Chercher l'utilisateur par son UID dans Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          // Utilisateur non trouvé → non autorisé
          setAuthError("Votre compte n'est pas autorisé à accéder à cette plateforme. Contactez l'administrateur.");
          await signOut(auth);
          setCurrentUser(null);
          setAppUser(null);
          setLoading(false);
          return;
        }

        const userData = userDocSnap.data() as Omit<AppUser, 'id'>;

        // Vérifier que le compte est actif
        if (!userData.actif) {
          setAuthError("Votre compte a été désactivé. Veuillez contacter l'administrateur.");
          await signOut(auth);
          setCurrentUser(null);
          setAppUser(null);
          setLoading(false);
          return;
        }

        // Mettre à jour le UID si nécessaire (cas pré-inscription par admin)
        if (!userData.uid || userData.uid !== user.uid) {
          await updateDoc(userDocRef, { uid: user.uid });
        }

        setCurrentUser(user);
        setAppUser({ id: user.uid, ...userData });

      } catch (error) {
        console.error("Erreur lors de la vérification de l'utilisateur:", error);
        setAuthError("Une erreur est survenue lors de l'authentification.");
        await signOut(auth);
        setCurrentUser(null);
        setAppUser(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        setAuthError("La connexion a échoué. Veuillez réessayer.");
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value = {
    currentUser,
    appUser,
    loading,
    authError,
    loginWithGoogle,
    logout,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};
