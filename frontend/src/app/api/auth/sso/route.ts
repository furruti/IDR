import { signIn } from '@/lib/auth';
import { NextRequest } from 'next/server';

function getSafeCallbackUrl(callbackUrl?: string | null) {
  if (callbackUrl?.startsWith('/') && !callbackUrl.startsWith('//')) {
    return callbackUrl;
  }
  return '/';
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const callbackUrl = getSafeCallbackUrl(searchParams.get('callbackUrl'));
  const isBypass = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true';
  const provider = isBypass ? 'credentials' : 'keycloak';

  console.log('[SSO] callbackUrl:', callbackUrl);
  console.log('[SSO] forcing prompt login:', true);

  await signIn(
    provider,
    { callbackUrl },
    {
      prompt: 'login',
      max_age: '0',
    }
  );
}
