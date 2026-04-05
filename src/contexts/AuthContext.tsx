import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { collection, doc, getDocs, query, where, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface AppUser {
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
      if (user) {
        try {
          // Check if user exists in the 'users' collection by email
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', user.email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data() as AppUser;
            
            if (!userData.actif) {
              setAuthError("Votre compte a été désactivé. Veuillez contacter l'administrateur.");
              await signOut(auth);
              setCurrentUser(null);
              setAppUser(null);
            } else {
              // If the user document doesn't have the UID yet (pre-authorized by admin), update it
              if (!userData.uid || userData.uid !== user.uid) {
                await updateDoc(doc(db, 'users', userDoc.id), { uid: user.uid });
                userData.uid = user.uid;
              }
              
              const isDefaultAdmin = user.email?.toLowerCase() === 'assou03mohamed@gmail.com';
              
              if (userDoc.id !== user.uid && userDoc.id !== user.email?.toLowerCase()) {
                if (isDefaultAdmin) {
                  await setDoc(doc(db, 'users', user.uid), { ...userData, uid: user.uid });
                  await deleteDoc(doc(db, 'users', userDoc.id));
                  setCurrentUser(user);
                  setAppUser({ id: user.uid, ...userData } as any);
                } else {
                  setAuthError("Votre compte nécessite une mise à jour de sécurité. Veuillez demander à l'administrateur de recréer votre compte.");
                  await signOut(auth);
                  setCurrentUser(null);
                  setAppUser(null);
                  return;
                }
              } else {
                setCurrentUser(user);
                setAppUser({ id: userDoc.id, ...userData } as any);
              }
              
              // If default admin, migrate other users with random IDs
              if (isDefaultAdmin) {
                try {
                  const allUsersSnapshot = await getDocs(collection(db, 'users'));
                  for (const docSnapshot of allUsersSnapshot.docs) {
                    const data = docSnapshot.data() as AppUser;
                    if (data.email && docSnapshot.id !== data.uid && docSnapshot.id !== data.email.toLowerCase()) {
                      console.log(`Migrating user ${data.email}...`);
                      await setDoc(doc(db, 'users', data.email.toLowerCase()), data);
                      await deleteDoc(doc(db, 'users', docSnapshot.id));
                    }
                  }
                } catch (err) {
                  console.error("Migration error:", err);
                }
              }
            }
          } else {
            // User not found in whitelist
            const isDefaultAdmin = user.email?.toLowerCase() === 'assou03mohamed@gmail.com';
            
            if (isDefaultAdmin) {
              // Create default admin if not exists
              const newUser = {
                uid: user.uid,
                email: user.email || '',
                nom: user.displayName?.split(' ')[1] || 'Admin',
                prenom: user.displayName?.split(' ')[0] || 'Super',
                role: 'admin',
                actif: true,
                date_creation: new Date().toISOString()
              };
              await setDoc(doc(db, 'users', user.uid), newUser);
              setCurrentUser(user);
              setAppUser({ id: user.uid, ...newUser } as any);
            } else {
              // Unauthorized user
              setAuthError("Votre compte n'est pas autorisé à accéder à cette plateforme.");
              await signOut(auth);
              setCurrentUser(null);
              setAppUser(null);
            }
          }
        } catch (error) {
          console.error("Erreur lors de la vérification de l'utilisateur:", error);
          setAuthError("Une erreur est survenue lors de l'authentification.");
          await signOut(auth);
          setCurrentUser(null);
          setAppUser(null);
        }
      } else {
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
