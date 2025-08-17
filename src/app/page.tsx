'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, ChevronLeft, ChevronRight, Plus, Settings, User, Clock, X, Edit, Trash2, LogOut } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, startOfWeek, endOfWeek } from 'date-fns'
import { tr } from 'date-fns/locale'
import { addAppointment, getAppointments, deleteAppointment, updateAppointment } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// Loading component
function AuthLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Yükleniyor...</p>
      </div>
    </div>
  )
}

// Login redirect component  
function LoginRedirect() {
  const router = useRouter()
  
  useEffect(() => {
    router.push('/login')
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Calendar className="h-12 w-12 text-blue-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Giriş Gerekli</h2>
        <p className="text-gray-600 mb-4">Randevu sistemi için giriş yapmalısınız</p>
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  )
}

export default function CalendarPage() {
  // 1. Auth hook
  const { user, userProfile, loading, signOut } = useAuth()
  
  // 2. Tüm state'ler
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')
  const [showSettings, setShowSettings] = useState(false)
  const [showAddAppointment, setShowAddAppointment] = useState(false)
  const [showEditAppointment, setShowEditAppointment] = useState(false)
  const [showAppointmentDetail, setShowAppointmentDetail] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<any>(null)
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [appointments, setAppointments] = useState<any[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  
  const [newAppointment, setNewAppointment] = useState({
    title: '',
    clientName: '',
    clientPhone: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '10:00',
    duration: 60,
    description: ''
  })
  
  const [businessSettings, setBusinessSettings] = useState({
    workingHours: {
      start: '09:00',
      end: '18:00'
    },
    maxAppointmentsPerSlot: 2,
    appointmentDuration: 60,
    businessName: 'İşletmem'
  })

  // 3. Functions
  const loadAppointments = async () => {
    try {
      setDataLoading(true)
      const data = await getAppointments()
      
      const userAppointments = data.filter((apt: any) => 
        !apt.user_id || apt.user_id === user?.id
      )
      
      const formattedAppointments = userAppointments.map((apt: any) => ({
        id: apt.id,
        title: apt.title,
        clientName: apt.client_name,
        clientPhone: apt.client_phone,
        startTime: new Date(apt.start_time),
        endTime: new Date(apt.end_time),
        status: apt.status,
        source: apt.source,
        description: apt.description || ''
      }))
      
      setAppointments(formattedAppointments)
    } catch (error) {
      console.error('Randevular yüklenemedi:', error)
    } finally {
      setDataLoading(false)
    }
  }

  const handleShowAppointmentDetail = (appointment: any) => {
    setSelectedAppointment(appointment)
    setShowAppointmentDetail(true)
  }

  const handleAddAppointment = async () => {
    try {
      const startDateTime = new Date(`${newAppointment.date}T${newAppointment.startTime}:00`)
      const endDateTime = new Date(startDateTime.getTime() + newAppointment.duration * 60 * 1000)

      const sameHourAppointments = getHourAppointments(startDateTime, startDateTime.getHours())
      
      if (sameHourAppointments.length >= businessSettings.maxAppointmentsPerSlot) {
        alert(`Bu saatte maksimum ${businessSettings.maxAppointmentsPerSlot} randevu alınabilir!`)
        return
      }

      await addAppointment({
        title: newAppointment.title,
        clientName: newAppointment.clientName,
        clientPhone: newAppointment.clientPhone,
        startTime: startDateTime,
        endTime: endDateTime,
        description: newAppointment.description
      })

      await loadAppointments()
      setShowAddAppointment(false)
      setNewAppointment({
        title: '',
        clientName: '',
        clientPhone: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: '10:00',
        duration: 60,
        description: ''
      })
      
      alert('Randevu başarıyla eklendi!')
      
    } catch (error) {
      console.error('Randevu ekleme hatası:', error)
      alert('Randevu eklenirken bir hata oluştu!')
    }
  }

  const handleDeleteAppointment = async (appointmentId: string, appointmentTitle: string) => {
    if (!confirm(`"${appointmentTitle}" randevusunu silmek istediğinize emin misiniz?`)) {
      return
    }

    try {
      await deleteAppointment(appointmentId)
      await loadAppointments()
      alert('Randevu başarıyla silindi!')
    } catch (error) {
      console.error('Randevu silme hatası:', error)
      alert('Randevu silinirken bir hata oluştu!')
    }
  }

  const handleEditAppointment = (appointment: any) => {
    setEditingAppointment(appointment)
    setNewAppointment({
      title: appointment.title,
      clientName: appointment.clientName,
      clientPhone: appointment.clientPhone,
      date: format(new Date(appointment.startTime), 'yyyy-MM-dd'),
      startTime: format(new Date(appointment.startTime), 'HH:mm'),
      duration: Math.round((new Date(appointment.endTime).getTime() - new Date(appointment.startTime).getTime()) / (1000 * 60)),
      description: appointment.description || ''
    })
    setShowEditAppointment(true)
  }

  const handleUpdateAppointment = async () => {
    try {
      if (!editingAppointment) return

      const startDateTime = new Date(`${newAppointment.date}T${newAppointment.startTime}:00`)
      const endDateTime = new Date(startDateTime.getTime() + newAppointment.duration * 60 * 1000)

      await updateAppointment(editingAppointment.id, {
        title: newAppointment.title,
        clientName: newAppointment.clientName,
        clientPhone: newAppointment.clientPhone,
        startTime: startDateTime,
        endTime: endDateTime,
        description: newAppointment.description
      })

      await loadAppointments()
      setShowEditAppointment(false)
      setEditingAppointment(null)
      setNewAppointment({
        title: '',
        clientName: '',
        clientPhone: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: '10:00',
        duration: 60,
        description: ''
      })
      
      alert('Randevu başarıyla güncellendi!')
      
    } catch (error) {
      console.error('Randevu güncelleme hatası:', error)
      alert('Randevu güncellenirken bir hata oluştu!')
    }
  }

  // 4. useEffect'ler
  useEffect(() => {
    if (user) {
      loadAppointments()
    }
  }, [user])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (showUserMenu && !target.closest('.user-menu-container')) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showUserMenu])

  // 5. Auth kontrolü
  if (loading) {
    return <AuthLoading />
  }
  
  if (!user) {
    return <LoginRedirect />
  }

  // 6. Diğer functions
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1))

  const getDayAppointments = (date: Date) => {
    return appointments.filter(apt => 
      isSameDay(new Date(apt.startTime), date)
    )
  }

  const getHourAppointments = (date: Date, hour: number) => {
    return appointments.filter(apt => {
      const aptStart = new Date(apt.startTime)
      return isSameDay(aptStart, date) && aptStart.getHours() === hour
    })
  }

  const generateHourSlots = () => {
    const slots = []
    const [startHour] = businessSettings.workingHours.start.split(':').map(Number)
    const [endHour] = businessSettings.workingHours.end.split(':').map(Number)
    
    for (let hour = startHour; hour < endHour; hour++) {
      slots.push(hour)
    }
    return slots
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-500'
      case 'pending': return 'bg-yellow-500'
      case 'cancelled': return 'bg-red-500'
      default: return 'bg-blue-500'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Calendar className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {userProfile?.name || 'Randevu Sistemi'}
                </h1>
                <p className="text-sm text-gray-600">
                  {userProfile?.business_type === 'kuafor' ? 'Kuaför' :
                   userProfile?.business_type === 'doktor' ? 'Doktor' :
                   userProfile?.business_type === 'klinik' ? 'Klinik' :
                   userProfile?.business_type === 'emlak' ? 'Emlak' :
                   userProfile?.business_type || 'İşletme'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setShowAddAppointment(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Yeni Randevu</span>
              </button>
              
              <button 
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="h-5 w-5" />
              </button>
              
              <div className="relative user-menu-container">
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <User className="h-5 w-5" />
                  <span className="text-sm font-medium">{userProfile?.name?.split(' ')[0] || 'Kullanıcı'}</span>
                </button>
                
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-50">
                    <div className="p-3 border-b">
                      <p className="font-medium text-gray-900">{userProfile?.name}</p>
                      <p className="text-sm text-gray-500">{userProfile?.email}</p>
                    </div>
                    <div className="p-1">
                      <button
                        onClick={async () => {
                          setShowUserMenu(false)
                          try {
                            await signOut()
                            window.location.href = '/login'
                          } catch (error) {
                            console.error('Çıkış hatası:', error)
                            window.location.href = '/login'
                          }
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center space-x-2"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Çıkış Yap</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-lg">
          {/* Takvim Header */}
          <div className="p-6 border-b">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <button 
                  onClick={prevMonth}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                
                <h2 className="text-2xl font-bold text-gray-900">
                  {format(currentDate, 'MMMM yyyy', { locale: tr })}
                </h2>
                
                <button 
                  onClick={nextMonth}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setView('day')}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    view === 'day' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Gün
                </button>
                <button 
                  onClick={() => setView('week')}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    view === 'week' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Hafta
                </button>
                <button 
                  onClick={() => setView('month')}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    view === 'month' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Ay
                </button>
              </div>
            </div>
          </div>

          {/* Takvim Grid */}
          <div className="p-6">
            {view === 'month' && (
              <>
                <div className="grid grid-cols-7 gap-1 mb-4">
                  {['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map(day => (
                    <div key={day} className="p-3 text-center text-sm font-semibold text-gray-600">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map(day => {
                    const dayAppointments = getDayAppointments(day)
                    const isCurrentMonth = isSameMonth(day, currentDate)
                    const isSelected = isSameDay(day, selectedDate)
                    const isTodayDate = isToday(day)

                    return (
                      <div
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={`
                          min-h-[120px] p-2 border rounded-lg cursor-pointer transition-all
                          ${isCurrentMonth ? 'bg-white hover:bg-blue-50 text-gray-900' : 'bg-gray-50 text-gray-500'}
                          ${isSelected ? 'ring-2 ring-blue-500' : ''}
                          ${isTodayDate ? 'bg-blue-100 border-blue-300' : ''}
                        `}
                      >
                        <div className={`text-sm font-semibold mb-1 ${isTodayDate ? 'text-blue-600' : ''}`}>
                          {format(day, 'd')}
                        </div>
                        
                        <div className="space-y-1">
                          {dayAppointments.slice(0, 3).map(apt => (
                            <div
                              key={apt.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleShowAppointmentDetail(apt)
                              }}
                              className={`
                                text-xs p-1 rounded text-white truncate cursor-pointer hover:opacity-80 transition-opacity group relative
                                ${getStatusColor(apt.status)}
                              `}
                              title={`${apt.clientName} - ${apt.title}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="truncate">
                                  {format(new Date(apt.startTime), 'HH:mm')} {apt.clientName}
                                </span>
                                
                                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleEditAppointment(apt)
                                    }}
                                    className="p-0.5 hover:bg-white hover:bg-opacity-20 rounded"
                                    title="Düzenle"
                                  >
                                    <Edit className="h-2.5 w-2.5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteAppointment(apt.id, apt.title)
                                    }}
                                    className="p-0.5 hover:bg-white hover:bg-opacity-20 rounded"
                                    title="Sil"
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {dayAppointments.length > 3 && (
                            <div className="text-xs text-gray-500">
                              +{dayAppointments.length - 3} daha
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {view === 'day' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-900">
                  {format(selectedDate, 'dd MMMM yyyy EEEE', { locale: tr })}
                </h3>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid gap-2">
                    {generateHourSlots().map(hour => {
                      const hourAppointments = getHourAppointments(selectedDate, hour)
                      
                      return (
                        <div key={hour} className="border rounded-lg p-3 transition-all cursor-pointer bg-white hover:bg-blue-50">
                          <div className="flex items-start space-x-4">
                            <div className="w-16 text-sm font-semibold text-gray-600">
                              {hour.toString().padStart(2, '0')}:00
                            </div>
                            
                            <div className="flex-1">
                              {hourAppointments.length === 0 ? (
                                <div className="text-gray-400 text-sm">Müsait</div>
                              ) : (
                                <div className="space-y-2">
                                  {hourAppointments.map(apt => (
                                    <div key={apt.id} className={`
                                      p-2 rounded border-l-4 text-sm bg-opacity-10 relative group cursor-pointer
                                      ${getStatusColor(apt.status)}
                                    `}
                                    onClick={() => handleShowAppointmentDetail(apt)}
                                    >
                                      <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                          <div className="font-medium">{apt.clientName}</div>
                                          <div className="text-gray-600">{apt.title}</div>
                                          <div className="text-xs text-gray-500">
                                            {format(new Date(apt.startTime), 'HH:mm')} - {format(new Date(apt.endTime), 'HH:mm')}
                                          </div>
                                        </div>
                                        
                                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleEditAppointment(apt)
                                            }}
                                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                                            title="Düzenle"
                                          >
                                            <Edit className="h-3 w-3" />
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleDeleteAppointment(apt.id, apt.title)
                                            }}
                                            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors"
                                            title="Sil"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>
                                        
                                        <span className={`
                                          px-2 py-1 rounded-full text-xs text-white ml-2
                                          ${getStatusColor(apt.status)}
                                        `}>
                                          {apt.status === 'confirmed' ? 'Onaylandı' : 
                                           apt.status === 'pending' ? 'Bekliyor' : 'İptal'}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            
                            <button 
                              onClick={() => {
                                setNewAppointment(prev => ({
                                  ...prev,
                                  date: format(selectedDate, 'yyyy-MM-dd'),
                                  startTime: `${hour.toString().padStart(2, '0')}:00`
                                }))
                                setShowAddAppointment(true)
                              }}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* İstatistikler */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Bugün</h3>
                <p className="text-2xl font-bold text-green-600">
                  {getDayAppointments(new Date()).length}
                </p>
                <p className="text-sm text-gray-500">randevu</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Bu Ay</h3>
                <p className="text-2xl font-bold text-blue-600">{appointments.length}</p>
                <p className="text-sm text-gray-500">randevu</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Calendar className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Bekleyen</h3>
                <p className="text-2xl font-bold text-yellow-600">
                  {appointments.filter(apt => apt.status === 'pending').length}
                </p>
                <p className="text-sm text-gray-500">randevu</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Randevu Detay Modal */}
      {showAppointmentDetail && selectedAppointment && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Randevu Detayları</h3>
              <button 
                onClick={() => setShowAppointmentDetail(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Randevu Türü
                  </label>
                  <p className="text-sm text-gray-900">{selectedAppointment.title}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Müşteri
                  </label>
                  <p className="text-sm text-gray-900">{selectedAppointment.clientName}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefon
                </label>
                <p className="text-sm text-gray-900">{selectedAppointment.clientPhone}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tarih
                  </label>
                  <p className="text-sm text-gray-900">
                    {format(new Date(selectedAppointment.startTime), 'dd MMMM yyyy', { locale: tr })}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Saat
                  </label>
                  <p className="text-sm text-gray-900">
                    {format(new Date(selectedAppointment.startTime), 'HH:mm')} - {format(new Date(selectedAppointment.endTime), 'HH:mm')}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Durum
                </label>
                <span className={`
                  px-2 py-1 rounded-full text-xs text-white
                  ${getStatusColor(selectedAppointment.status)}
                `}>
                  {selectedAppointment.status === 'confirmed' ? 'Onaylandı' : 
                   selectedAppointment.status === 'pending' ? 'Bekliyor' : 'İptal'}
                </span>
              </div>

              {selectedAppointment.description && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Açıklama
                  </label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                    {selectedAppointment.description}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kaynak
                </label>
                <p className="text-sm text-gray-900">
                  {selectedAppointment.source === 'manual' ? 'Manuel' :
                   selectedAppointment.source === 'n8n' ? 'Otomatik (n8n)' :
                   selectedAppointment.source === 'vapi' ? 'Sesli Asistan' : 'Bilinmiyor'}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t">
              <button 
                onClick={() => {
                  setShowAppointmentDetail(false)
                  handleEditAppointment(selectedAppointment)
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Edit className="h-4 w-4" />
                <span>Düzenle</span>
              </button>
              <button 
                onClick={() => setShowAppointmentDetail(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ayarlar Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">İşletme Ayarları</h3>
              <button 
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  İşletme Adı
                </label>
                <input
                  type="text"
                  value={businessSettings.businessName}
                  onChange={(e) => setBusinessSettings(prev => ({
                    ...prev,
                    businessName: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  placeholder="İşletme adınız"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Çalışma Saatleri
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Başlangıç</label>
                    <input
                      type="time"
                      value={businessSettings.workingHours.start}
                      onChange={(e) => setBusinessSettings(prev => ({
                        ...prev,
                        workingHours: { ...prev.workingHours, start: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Bitiş</label>
                    <input
                      type="time"
                      value={businessSettings.workingHours.end}
                      onChange={(e) => setBusinessSettings(prev => ({
                        ...prev,
                        workingHours: { ...prev.workingHours, end: e.target.value }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aynı Saatte Maksimum Randevu
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={businessSettings.maxAppointmentsPerSlot}
                  onChange={(e) => setBusinessSettings(prev => ({
                    ...prev,
                    maxAppointmentsPerSlot: parseInt(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Varsayılan Randevu Süresi (Dakika)
                </label>
                <select
                  value={businessSettings.appointmentDuration}
                  onChange={(e) => setBusinessSettings(prev => ({
                    ...prev,
                    appointmentDuration: parseInt(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  <option value={15}>15 dakika</option>
                  <option value={30}>30 dakika</option>
                  <option value={45}>45 dakika</option>
                  <option value={60}>1 saat</option>
                  <option value={90}>1.5 saat</option>
                  <option value={120}>2 saat</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t">
              <button 
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                İptal
              </button>
              <button 
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Randevu Ekleme Modal */}
      {showAddAppointment && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Yeni Randevu Ekle</h3>
              <button 
                onClick={() => setShowAddAppointment(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Randevu Türü/Başlık
                </label>
                <input
                  type="text"
                  value={newAppointment.title}
                  onChange={(e) => setNewAppointment(prev => ({
                    ...prev,
                    title: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  placeholder="Örn: Saç kesimi, Kontrol muayenesi"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Müşteri Adı
                </label>
                <input
                  type="text"
                  value={newAppointment.clientName}
                  onChange={(e) => setNewAppointment(prev => ({
                    ...prev,
                    clientName: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  placeholder="Müşteri adı soyadı"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefon Numarası
                </label>
                <input
                  type="tel"
                  value={newAppointment.clientPhone}
                  onChange={(e) => setNewAppointment(prev => ({
                    ...prev,
                    clientPhone: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  placeholder="05xxxxxxxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Açıklama
                </label>
                <textarea
                  value={newAppointment.description}
                  onChange={(e) => setNewAppointment(prev => ({
                    ...prev,
                    description: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  placeholder="Bu randevuda neler yapılacak?"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tarih
                  </label>
                  <input
                    type="date"
                    value={newAppointment.date}
                    onChange={(e) => setNewAppointment(prev => ({
                      ...prev,
                      date: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Başlangıç Saati
                  </label>
                  <input
                    type="time"
                    value={newAppointment.startTime}
                    onChange={(e) => setNewAppointment(prev => ({
                      ...prev,
                      startTime: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Randevu Süresi
                </label>
                <select
                  value={newAppointment.duration}
                  onChange={(e) => setNewAppointment(prev => ({
                    ...prev,
                    duration: parseInt(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  <option value={15}>15 dakika</option>
                  <option value={30}>30 dakika</option>
                  <option value={45}>45 dakika</option>
                  <option value={60}>1 saat</option>
                  <option value={90}>1.5 saat</option>
                  <option value={120}>2 saat</option>
                  <option value={150}>2.5 saat</option>
                  <option value={180}>3 saat</option>
                </select>
              </div>

              {newAppointment.date && newAppointment.startTime && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-800">
                      Seçilen saatte {getHourAppointments(
                        new Date(`${newAppointment.date}T${newAppointment.startTime}:00`),
                        new Date(`${newAppointment.date}T${newAppointment.startTime}:00`).getHours()
                      ).length}/{businessSettings.maxAppointmentsPerSlot} randevu var
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t">
              <button 
                onClick={() => setShowAddAppointment(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                İptal
              </button>
              <button 
                onClick={handleAddAppointment}
                disabled={!newAppointment.title || !newAppointment.clientName || !newAppointment.clientPhone}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Randevu Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Randevu Düzenleme Modal */}
      {showEditAppointment && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Randevu Düzenle</h3>
              <button 
                onClick={() => {
                  setShowEditAppointment(false)
                  setEditingAppointment(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Randevu Türü/Başlık
                </label>
                <input
                  type="text"
                  value={newAppointment.title}
                  onChange={(e) => setNewAppointment(prev => ({
                    ...prev,
                    title: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  placeholder="Örn: Saç kesimi, Kontrol muayenesi"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Müşteri Adı
                </label>
                <input
                  type="text"
                  value={newAppointment.clientName}
                  onChange={(e) => setNewAppointment(prev => ({
                    ...prev,
                    clientName: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  placeholder="Müşteri adı soyadı"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefon Numarası
                </label>
                <input
                  type="tel"
                  value={newAppointment.clientPhone}
                  onChange={(e) => setNewAppointment(prev => ({
                    ...prev,
                    clientPhone: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  placeholder="05xxxxxxxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Açıklama
                </label>
                <textarea
                  value={newAppointment.description}
                  onChange={(e) => setNewAppointment(prev => ({
                    ...prev,
                    description: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500"
                  placeholder="Bu randevuda neler yapılacak?"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tarih
                  </label>
                  <input
                    type="date"
                    value={newAppointment.date}
                    onChange={(e) => setNewAppointment(prev => ({
                      ...prev,
                      date: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Başlangıç Saati
                  </label>
                  <input
                    type="time"
                    value={newAppointment.startTime}
                    onChange={(e) => setNewAppointment(prev => ({
                      ...prev,
                      startTime: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Randevu Süresi
                </label>
                <select
                  value={newAppointment.duration}
                  onChange={(e) => setNewAppointment(prev => ({
                    ...prev,
                    duration: parseInt(e.target.value)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  <option value={15}>15 dakika</option>
                  <option value={30}>30 dakika</option>
                  <option value={45}>45 dakika</option>
                  <option value={60}>1 saat</option>
                  <option value={90}>1.5 saat</option>
                  <option value={120}>2 saat</option>
                  <option value={150}>2.5 saat</option>
                  <option value={180}>3 saat</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t">
              <button 
                onClick={() => {
                  setShowEditAppointment(false)
                  setEditingAppointment(null)
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                İptal
              </button>
              <button 
                onClick={handleUpdateAppointment}
                disabled={!newAppointment.title || !newAppointment.clientName || !newAppointment.clientPhone}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Güncelle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}