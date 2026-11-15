import { AuthProvider } from '@/components/AuthProvider';
import { FreetownApp } from '@/components/FreetownApp';

export default function HomePage() {
  return (
    <AuthProvider>
      <FreetownApp />
    </AuthProvider>
  );
}
