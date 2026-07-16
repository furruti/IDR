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
  const forceLogin = searchParams.get('forceLogin') === '1';
  const isBypass = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true';
  const provider = isBypass ? 'credentials' : 'keycloak';

  console.log('[SSO] callbackUrl:', callbackUrl);
  console.log('[SSO] forceLogin:', forceLogin);

  if (forceLogin) {
    await signIn(
      provider,
      { redirectTo: callbackUrl },
      new URLSearchParams({
        prompt: 'login',
        max_age: '0',
      })
    );
  } else {
    await signIn(provider, { redirectTo: callbackUrl });
  }
}
