import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { getFamily, getInventory } from '@/lib/supabase/data';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [inventory, family] = await Promise.all([
    getInventory(user.id),
    getFamily(user.id),
  ]);

  return (
    <AppShell
      userEmail={user.email ?? 'Signed-in user'}
      initialInventory={inventory}
      initialFamily={family}
    />
  );
}
