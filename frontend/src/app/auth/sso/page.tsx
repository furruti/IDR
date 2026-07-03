import { redirect } from 'next/navigation';

type Props = {
  searchParams: Promise<{
    callbackUrl?: string;
  }>;
};

export default async function SsoPage({ searchParams }: Props) {
  const params = await searchParams;
  const cb = params.callbackUrl ? `?callbackUrl=${encodeURIComponent(params.callbackUrl)}` : '';
  redirect(`/api/auth/sso${cb}`);
}
