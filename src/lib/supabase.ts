import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Randevu ekleme fonksiyonu
export const addAppointment = async (appointment: {
  title: string
  clientName: string
  clientPhone: string
  startTime: Date
  endTime: Date
}) => {
  const { data, error } = await supabase
    .from('appointments')
    .insert([
      {
        title: appointment.title,
        client_name: appointment.clientName,
        client_phone: appointment.clientPhone,
        start_time: appointment.startTime.toISOString(),
        end_time: appointment.endTime.toISOString(),
        status: 'confirmed',
        source: 'manual'
      }
    ])
    .select()

  if (error) {
    console.error('Randevu ekleme hatası:', error)
    console.error('Hata mesajı:', error.message)
    console.error('Hata kodu:', error.code)
    console.error('Hata detayları:', error.details)
    console.error('Tam hata objesi:', JSON.stringify(error, null, 2))
    throw error
  }

  return data
}

// Randevuları getirme fonksiyonu
export const getAppointments = async () => {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .order('start_time', { ascending: true })

  if (error) {
    console.error('Randevu getirme hatası:', error)
    throw error
  }

  return data
}

// Randevu silme fonksiyonu
export const deleteAppointment = async (id: string) => {
  const response = await fetch(`/api/appointments/${id}`, {
    method: 'DELETE',
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Randevu silinemedi')
  }
  
  return await response.json()
}

// Randevu güncelleme fonksiyonu
export const updateAppointment = async (id: string, appointment: {
  title?: string
  clientName?: string
  clientPhone?: string
  startTime?: Date
  endTime?: Date
  status?: string
  duration?: number
}) => {
  const updateData: any = {}
  
  if (appointment.title) updateData.title = appointment.title
  if (appointment.clientName) updateData.clientName = appointment.clientName
  if (appointment.clientPhone) updateData.clientPhone = appointment.clientPhone
  if (appointment.startTime) updateData.startTime = appointment.startTime.toISOString()
  if (appointment.endTime) updateData.endTime = appointment.endTime.toISOString()
  if (appointment.status) updateData.status = appointment.status
  if (appointment.duration) updateData.duration = appointment.duration

  const response = await fetch(`/api/appointments/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateData),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Randevu güncellenemedi')
  }
  
  return await response.json()
}