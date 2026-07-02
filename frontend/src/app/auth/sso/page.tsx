import { signIn } from '@/lib/auth';

type Props = {
  searchParams: Promise<{
    callbackUrl?: string;
  }>;
};

function getSafeCallbackUrl(callbackUrl?: string) {
  if (callbackUrl?.startsWith('/') && !callbackUrl.startsWith('//')) {
    return callbackUrl;
  }

  return '/';
}

export default async function SsoPage({ searchParams }: Props) {
  const params = await searchParams;
  const callbackUrl = getSafeCallbackUrl(params.callbackUrl);

  await signIn('keycloak', {
    redirectTo: callbackUrl,
  });

  return null;
}
