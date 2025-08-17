import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Randevu silme - DELETE endpoint
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    console.log('Silinecek randevu ID:', id)

    // Randevuyu sil
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Randevu silme hatası:', error)
      return NextResponse.json(
        { 
          error: 'Silme hatası', 
          message: error.message 
        }, 
        { status: 500 }
      )
    }

    console.log('Randevu başarıyla silindi:', id)

    return NextResponse.json({
      success: true,
      message: 'Randevu başarıyla silindi',
      deletedId: id
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

// Randevu güncelleme - PUT endpoint
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    console.log('Güncellenecek randevu ID:', id)
    console.log('Gelen güncelleme verisi:', body)

    const { 
      title, 
      clientName, 
      clientPhone, 
      startTime, 
      endTime,
      status,
      duration 
    } = body

    // Eğer sadece süre verilmişse end time'ı hesapla
    let finalEndTime = endTime
    if (duration && startTime && !endTime) {
      const start = new Date(startTime)
      finalEndTime = new Date(start.getTime() + duration * 60 * 1000).toISOString()
    }

    // Güncelleme verisi hazırla
    const updateData: any = {}
    
    if (title !== undefined) updateData.title = title
    if (clientName !== undefined) updateData.client_name = clientName
    if (clientPhone !== undefined) updateData.client_phone = clientPhone
    if (startTime !== undefined) updateData.start_time = new Date(startTime).toISOString()
    if (finalEndTime !== undefined) updateData.end_time = new Date(finalEndTime).toISOString()
    if (status !== undefined) updateData.status = status

    // Updated timestamp ekle
    updateData.updated_at = new Date().toISOString()

    console.log('Update data:', updateData)

    // Randevuyu güncelle
    const { data, error } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .select()

    if (error) {
      console.error('Randevu güncelleme hatası:', error)
      return NextResponse.json(
        { 
          error: 'Güncelleme hatası', 
          message: error.message,
          details: error
        }, 
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { 
          error: 'Randevu bulunamadı', 
          message: 'Bu ID ile randevu bulunamadı',
          id: id
        }, 
        { status: 404 }
      )
    }

    console.log('Randevu başarıyla güncellendi:', data[0])

    return NextResponse.json({
      success: true,
      message: 'Randevu başarıyla güncellendi',
      appointment: data[0],
      info: {
        id: id,
        musteri: data[0].client_name,
        telefon: data[0].client_phone,
        randevu_turu: data[0].title,
        tarih: new Date(data[0].start_time).toLocaleString('tr-TR'),
        durum: data[0].status === 'confirmed' ? 'Onaylandı' : 
               data[0].status === 'pending' ? 'Bekliyor' : 'İptal'
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

// Tek randevu getirme - GET endpoint
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Randevu getirme hatası:', error)
      return NextResponse.json(
        { 
          error: 'Randevu bulunamadı', 
          message: error.message 
        }, 
        { status: 404 }
      )
    }

    // Frontend formatına çevir
    const appointment = {
      id: data.id,
      title: data.title,
      clientName: data.client_name,
      clientPhone: data.client_phone,
      startTime: data.start_time,
      endTime: data.end_time,
      status: data.status,
      source: data.source,
      description: data.description,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    }

    return NextResponse.json({
      success: true,
      appointment: appointment,
      info: {
        musteri: data.client_name,
        telefon: data.client_phone,
        randevu_turu: data.title,
        tarih: new Date(data.start_time).toLocaleString('tr-TR'),
        durum: data.status === 'confirmed' ? 'Onaylandı' : 
               data.status === 'pending' ? 'Bekliyor' : 'İptal',
        kaynak: data.source === 'n8n' ? 'Otomatik' : 
                data.source === 'vapi' ? 'Sesli' : 'Manuel'
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