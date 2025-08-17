import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// n8n'den randevu ekleme - POST endpoint
export async function POST(request: NextRequest) {
  try {
    // n8n'den gelen veriyi al
    const body = await request.json()
    
    console.log('n8n\'den gelen veri:', body)
    
    // Gerekli alanları kontrol et
    const { 
      telefon, 
      isim, 
      randevu_nedeni, 
      saat 
    } = body

    if (!telefon || !isim || !randevu_nedeni || !saat) {
      return NextResponse.json(
        { 
          error: 'Eksik bilgi', 
          message: 'telefon, isim, randevu_nedeni ve saat gerekli',
          received: body
        }, 
        { status: 400 }
      )
    }

    // Tarih formatını düzenle (n8n'den gelen formatı parse et)
    let startDateTime: Date
    try {
      // Farklı tarih formatlarını destekle
      if (saat.includes('T')) {
        // ISO format: "2024-07-15T14:30:00"
        startDateTime = new Date(saat)
      } else {
        // Basit format: "2024-07-15 14:30"
        startDateTime = new Date(saat.replace(' ', 'T') + ':00')
      }
      
      // Türkiye saatine çevir
      startDateTime = new Date(startDateTime.getTime())
      
    } catch (error) {
      return NextResponse.json(
        { 
          error: 'Geçersiz tarih formatı', 
          message: 'Tarih formatı: YYYY-MM-DD HH:MM veya ISO formatında olmalı',
          received: saat
        }, 
        { status: 400 }
      )
    }

    // Varsayılan 1 saat süreli randevu
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000)

    // Supabase'e kaydet
    const { data, error } = await supabase
      .from('appointments')
      .insert([
        {
          title: randevu_nedeni,
          client_name: isim,
          client_phone: telefon,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: 'confirmed',
          source: 'n8n'
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

    console.log('Randevu başarıyla eklendi:', data)

    // Başarılı yanıt
    return NextResponse.json({
      success: true,
      message: 'Randevu başarıyla oluşturuldu',
      appointment: data[0],
      info: {
        musteri: isim,
        telefon: telefon,
        randevu_turu: randevu_nedeni,
        tarih: startDateTime.toLocaleString('tr-TR'),
        durum: 'Onaylandı'
      }
    })

  } catch (error) {
    console.error('API hatası:', error)
    return NextResponse.json(
      { 
        error: 'Sunucu hatası', 
        message: error instanceof Error ? error.message : 'Bilinmeyen hata'
      }, 
      { status: 500 }
    )
  }
}

// Randevuları listeleme - GET endpoint
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('start_time', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: 'Veritabanı hatası', message: error.message }, 
        { status: 500 }
      )
    }

    // Türkçe formatta döndür
    const formattedAppointments = data.map(apt => ({
      id: apt.id,
      musteri_adi: apt.client_name,
      telefon: apt.client_phone,
      randevu_turu: apt.title,
      tarih: new Date(apt.start_time).toLocaleString('tr-TR'),
      durum: apt.status === 'confirmed' ? 'Onaylandı' : 
             apt.status === 'pending' ? 'Bekliyor' : 'İptal',
      kaynak: apt.source === 'n8n' ? 'Otomatik' : 
              apt.source === 'vapi' ? 'Sesli' : 'Manuel'
    }))

    return NextResponse.json({
      success: true,
      count: formattedAppointments.length,
      appointments: formattedAppointments
    })

  } catch (error) {
    console.error('API hatası:', error)
    return NextResponse.json(
      { error: 'Sunucu hatası', message: 'Randevular getirilemedi' }, 
      { status: 500 }
    )
  }
}