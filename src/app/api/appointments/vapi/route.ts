import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// VAPI'den randevu ekleme - POST endpoint
export async function POST(request: NextRequest) {
  try {
    // VAPI'den gelen veriyi al
    const body = await request.json()
    
    console.log('VAPI\'den gelen veri:', body)
    
    // VAPI'den gelen farklı formatları destekle
    const {
      // VAPI standard format
      transcript,
      summary,
      extractedData,
      
      // Manuel format
      telefon,
      isim,
      randevu_nedeni,
      saat,
      
      // Alternative formats
      phone,
      name,
      appointment_type,
      datetime,
      time,
      date
    } = body

    // Veriyi normalize et
    let customerPhone = telefon || phone || extractedData?.telefon || extractedData?.phone
    let customerName = isim || name || extractedData?.isim || extractedData?.name
    let appointmentType = randevu_nedeni || appointment_type || extractedData?.randevu_nedeni || extractedData?.appointment_type
    let appointmentTime = saat || datetime || time || extractedData?.saat || extractedData?.datetime

    // Eğer extractedData yoksa transcript'ten çıkarmaya çalış
    if (!customerPhone && transcript) {
      // Basit regex ile telefon numarası bul
      const phoneMatch = transcript.match(/(\d{11}|\d{3}\s?\d{3}\s?\d{2}\s?\d{2}|05\d{9})/g)
      if (phoneMatch) {
        customerPhone = phoneMatch[0].replace(/\s/g, '')
      }
    }

    // Gerekli alanları kontrol et
    if (!customerPhone || !customerName || !appointmentType || !appointmentTime) {
      return NextResponse.json(
        { 
          error: 'Eksik randevu bilgisi',
          message: 'Telefon, isim, randevu türü ve saat bilgisi gerekli',
          received: {
            transcript: transcript || 'Yok',
            extracted: {
              telefon: customerPhone || 'Bulunamadı',
              isim: customerName || 'Bulunamadı',
              randevu_nedeni: appointmentType || 'Bulunamadı',
              saat: appointmentTime || 'Bulunamadı'
            }
          },
          suggestion: 'VAPI\'yi randevu bilgilerini çıkaracak şekilde yapılandırın'
        }, 
        { status: 400 }
      )
    }

    // Tarih formatını düzenle
    let startDateTime: Date
    try {
      // Farklı tarih formatlarını destekle
      if (appointmentTime.includes('T')) {
        // ISO format
        startDateTime = new Date(appointmentTime)
      } else if (appointmentTime.includes('/')) {
        // US format: MM/DD/YYYY HH:MM
        startDateTime = new Date(appointmentTime)
      } else {
        // TR format: DD.MM.YYYY HH:MM veya YYYY-MM-DD HH:MM
        startDateTime = new Date(appointmentTime.replace(' ', 'T') + ':00')
      }
      
      // Geçersiz tarih kontrolü
      if (isNaN(startDateTime.getTime())) {
        throw new Error('Geçersiz tarih')
      }
      
    } catch (error) {
      return NextResponse.json(
        { 
          error: 'Geçersiz tarih formatı', 
          message: 'Tarih formatı parse edilemedi',
          received: appointmentTime,
          supportedFormats: [
            'YYYY-MM-DD HH:MM',
            'DD.MM.YYYY HH:MM', 
            'MM/DD/YYYY HH:MM',
            'ISO format'
          ]
        }, 
        { status: 400 }
      )
    }

    // Varsayılan 1 saat süreli randevu
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000)

    // Telefon numarasını temizle
    customerPhone = customerPhone.replace(/\D/g, '') // Sadece rakamları al
    if (customerPhone.length === 11 && customerPhone.startsWith('0')) {
      // 05551234567 formatı - doğru
    } else if (customerPhone.length === 10) {
      // 5551234567 formatı - başına 0 ekle
      customerPhone = '0' + customerPhone
    }

    // Supabase'e kaydet
    const { data, error } = await supabase
      .from('appointments')
      .insert([
        {
          title: appointmentType,
          client_name: customerName,
          client_phone: customerPhone,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: 'confirmed',
          source: 'vapi',
          description: transcript ? `VAPI Transcript: ${transcript.substring(0, 500)}` : null
        }
      ])
      .select()

    if (error) {
      console.error('Supabase hatası:', error)
      return NextResponse.json(
        { 
          error: 'Veritabanı hatası', 
          message: error.message,
          details: error
        }, 
        { status: 500 }
      )
    }

    console.log('VAPI randevusu başarıyla eklendi:', data)

    // Başarılı yanıt
    return NextResponse.json({
      success: true,
      message: 'Sesli randevu başarıyla oluşturuldu',
      appointment: data[0],
      info: {
        musteri: customerName,
        telefon: customerPhone,
        randevu_turu: appointmentType,
        tarih: startDateTime.toLocaleString('tr-TR'),
        durum: 'Onaylandı',
        kaynak: 'Sesli Asistan (VAPI)'
      },
      vapi_data: {
        transcript: transcript || 'Transcript bulunamadı',
        processed_data: {
          telefon: customerPhone,
          isim: customerName,
          randevu_nedeni: appointmentType,
          saat: appointmentTime
        }
      }
    })

  } catch (error) {
    console.error('VAPI API hatası:', error)
    return NextResponse.json(
      { 
        error: 'Sunucu hatası', 
        message: error instanceof Error ? error.message : 'Bilinmeyen hata',
        type: 'VAPI_PROCESSING_ERROR'
      }, 
      { status: 500 }
    )
  }
}

// VAPI durum sorgulama - GET endpoint
export async function GET(request: NextRequest) {
  try {
    // VAPI kaynaklı randevuları getir
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('source', 'vapi')
      .order('start_time', { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json(
        { error: 'Veritabanı hatası', message: error.message }, 
        { status: 500 }
      )
    }

    const formattedAppointments = data.map(apt => ({
      id: apt.id,
      musteri_adi: apt.client_name,
      telefon: apt.client_phone,
      randevu_turu: apt.title,
      tarih: new Date(apt.start_time).toLocaleString('tr-TR'),
      durum: apt.status === 'confirmed' ? 'Onaylandı' : 
             apt.status === 'pending' ? 'Bekliyor' : 'İptal',
      transcript_ozet: apt.description ? apt.description.substring(0, 100) + '...' : null,
      olusturma_tarihi: new Date(apt.created_at).toLocaleString('tr-TR')
    }))

    return NextResponse.json({
      success: true,
      message: 'VAPI randevuları listelendi',
      count: formattedAppointments.length,
      appointments: formattedAppointments,
      endpoint_info: {
        description: 'VAPI sesli asistan randevu endpoint\'i',
        usage: 'POST /api/vapi ile randevu oluşturun',
        required_fields: ['telefon', 'isim', 'randevu_nedeni', 'saat']
      }
    })

  } catch (error) {
    console.error('VAPI GET hatası:', error)
    return NextResponse.json(
      { error: 'Sunucu hatası', message: 'VAPI randevuları getirilemedi' }, 
      { status: 500 }
    )
  }
}