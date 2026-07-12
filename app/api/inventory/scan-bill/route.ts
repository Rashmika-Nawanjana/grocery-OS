import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { scanBillImage } from '@/lib/services/bill-scanner';
import { isVertexConfigured } from '@/lib/services/gemini';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isVertexConfigured()) {
    return NextResponse.json(
      { error: 'Bill scanning requires Vertex AI (GOOGLE_CLOUD_PROJECT + GOOGLE_APPLICATION_CREDENTIALS)' },
      { status: 503 }
    );
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Upload a bill photo as "file"' }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be under 8 MB' }, { status: 400 });
  }

  const mimeType = file.type || 'image/jpeg';
  if (!ALLOWED_TYPES.has(mimeType)) {
    return NextResponse.json({ error: 'Use JPEG, PNG, or WebP photos' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString('base64');

  const scan = await scanBillImage(base64, mimeType);
  if (!scan?.items.length) {
    return NextResponse.json(
      { error: 'Could not read grocery items from this photo. Try a clearer, well-lit receipt image.' },
      { status: 422 }
    );
  }

  return NextResponse.json({
    success: true,
    items: scan.items,
    scannedCount: scan.items.length,
    storeName: scan.storeName,
    billDate: scan.billDate,
    notes: scan.notes,
  });
}
