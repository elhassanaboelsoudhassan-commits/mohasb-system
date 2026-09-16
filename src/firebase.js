import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyB91NOOg3HSVkLTMKnMwDJH42Mtj8p2duI",
  authDomain: "mohasb-system.firebaseapp.com",
  projectId: "mohasb-system",
  storageBucket: "mohasb-system.firebasestorage.app",
  messagingSenderId: "3704300720",
  appId: "1:3704300720:web:fe5fc8914326b6d1bf0775",
  measurementId: "G-7VBGMF8MHP"
};

// تهيئة تطبيق فايربيز المركزي
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

// مجموعات فايربيز المطلوبة
export const USERS_COLLECTION = 'users';
export const TENANTS_COLLECTION = 'tenants';

/**
 * دالة تسجيل/حفظ منشأة أو شركة جديدة في فايربيز Firestore
 * تخزن في مجموعة "users" حسب متطلبات النظام وتزامنها سحابياً
 */
export async function saveCompanyToFirebase(companyData) {
  try {
    const timestamp = serverTimestamp();
    const docData = {
      ...companyData,
      role: companyData.role || 'company_admin',
      status: companyData.status || 'active',
      created_at: new Date().toISOString(),
      firestore_timestamp: timestamp,
      source: 'mohasb_web_pos'
    };

    // 1. الحفظ في مجموعة "users"
    const usersCol = collection(db, USERS_COLLECTION);
    const userDocRef = await addDoc(usersCol, docData);

    // 2. المزامنة أيضاً مع مجموعة tenants
    try {
      const tenantsCol = collection(db, TENANTS_COLLECTION);
      await setDoc(doc(tenantsCol, userDocRef.id), { ...docData, id: userDocRef.id });
    } catch (e) {
      // تجاهل إذا كانت الصلاحيات تقتصر على users
    }

    return { success: true, id: userDocRef.id };
  } catch (error) {
    console.error('Firebase save error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * دالة المراقبة الحية الفورية (onSnapshot) لقائمة الشركات والمشتركين
 * تعمل بالنبض اللحظي لتظهر الشركات الجديدة فوراً بدون إعادة تحميل الصفحة
 */
export function subscribeToLiveCompanies(callback) {
  try {
    const usersCol = collection(db, USERS_COLLECTION);
    const q = query(usersCol);

    return onSnapshot(q, (snapshot) => {
      const liveList = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        liveList.push({
          id: docSnap.id,
          ...data,
          name_ar: data.name_ar || data.company_name_ar || data.name || data.company_name || 'شركة مسجلة سحابياً',
          owner_name: data.owner_name || data.user_name || data.name || 'المشترك',
          email: data.email || '—',
          phone: data.phone || data.mobile || '—',
          code: data.code || ('CO-' + docSnap.id.slice(-4).toUpperCase()),
          status: data.status || 'active',
          trial_ends_at: data.trial_ends_at || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
          is_firebase_live: true
        });
      });
      if (liveList.length > 0) {
        callback(liveList);
      }
    }, (error) => {
      console.warn('Firebase snapshot warning:', error);
    });
  } catch (error) {
    console.warn('Could not establish Firebase snapshot listener:', error);
    return () => {};
  }
}
