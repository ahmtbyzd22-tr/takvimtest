import { supabase } from './supabase'

// Kullanıcı kayıt
export const signUp = async (email: string, password: string, businessData: {
  businessName: string
  businessType: string
  phone: string
}) => {
  // Supabase auth ile kayıt
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        business_name: businessData.businessName,
        business_type: businessData.businessType,
        phone: businessData.phone
      }
    }
  })

  if (authError) {
    throw new Error(authError.message)
  }

  // Users tablosuna da ekle
  if (authData.user) {
    const { error: dbError } = await supabase
      .from('users')
      .insert([
        {
          id: authData.user.id,
          email: email,
          name: businessData.businessName,
          phone: businessData.phone,
          business_type: businessData.businessType
        }
      ])

    if (dbError) {
      console.error('User profile oluşturma hatası:', dbError)
      // Auth user'ı silmeye çalış
      await supabase.auth.admin.deleteUser(authData.user.id)
      throw new Error('Kullanıcı profili oluşturulamadı')
    }
  }

  return authData
}

// Kullanıcı giriş
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

// Çıkış yap
export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    throw new Error(error.message)
  }
}

// Mevcut kullanıcıyı al
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error) {
    throw new Error(error.message)
  }

  return user
}

// Kullanıcı session'ını kontrol et
export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession()
  
  if (error) {
    throw new Error(error.message)
  }

  return session
}

// Kullanıcı profil bilgilerini al
export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

// Şifre sıfırlama
export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  })

  if (error) {
    throw new Error(error.message)
  }
}

// Auth state değişikliklerini dinle
export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  return supabase.auth.onAuthStateChange(callback)
}